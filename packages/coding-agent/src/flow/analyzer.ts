/** Bounded, local static overview: recognizable I/O call sites and separate import dependencies. */
import { execFile } from "node:child_process";
import { constants, type Dirent } from "node:fs";
import { type FileHandle, lstat, open, readdir, realpath } from "node:fs/promises";
import { basename, extname, join, posix, resolve } from "node:path";
import { promisify } from "node:util";
import ignore, { type Ignore } from "ignore";
import type { FlowEdge, FlowEvidence, FlowGraph, FlowNode } from "./types.ts";

interface SourceFile {
	path: string;
	language: string;
	content: string;
	masked: string;
	lines: string[];
	group: string;
	componentId: string;
	imports: ImportReference[];
}

interface ImportReference {
	specifier: string;
	line: number;
}

interface Manifest {
	directory: string;
	name?: string;
	binPaths: string[];
}

interface IgnoreScope {
	directory: string;
	rules: Ignore;
}

interface ScanState {
	root: string;
	files: SourceFile[];
	manifests: Manifest[];
	warnings: Set<string>;
	bytes: number;
	directories: number;
}

const MAX_FILES = 4000;
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_COMPONENTS = 18;
const MAX_EVIDENCE = 8;
const SOURCE_LANGUAGES: Readonly<Record<string, string>> = {
	".ts": "TypeScript",
	".tsx": "TypeScript",
	".mts": "TypeScript",
	".cts": "TypeScript",
	".js": "JavaScript",
	".jsx": "JavaScript",
	".mjs": "JavaScript",
	".cjs": "JavaScript",
	".py": "Python",
	".rs": "Rust",
};
const EXCLUDED_DIRECTORIES = new Set([
	"node_modules",
	"vendor",
	"dist",
	"build",
	"out",
	"target",
	"coverage",
	"__pycache__",
	"venv",
	"test",
	"tests",
	"__tests__",
	"testing",
	"fixtures",
	"__fixtures__",
	"snapshots",
	"__snapshots__",
	"generated",
	"__generated__",
	"docs",
	"examples",
	"tmp",
	"temp",
	"logs",
]);
const executeFile = promisify(execFile);

/** Analyze source beneath root without executing project code or contacting external services. */
export async function analyzeProject(root: string): Promise<FlowGraph> {
	const startedAt = performance.now();
	const projectRoot = await realpath(resolve(root));
	if (!(await lstat(projectRoot)).isDirectory()) throw new Error("The project root must be a directory.");
	const state: ScanState = {
		root: projectRoot,
		files: [],
		manifests: [],
		bytes: 0,
		directories: 0,
		warnings: new Set([
			"Static heuristic analysis, not runtime tracing or taint analysis. Detected means a recognizable source pattern; inferred connections need review.",
			"Imports are dependency edges, not proof that data flows between components. Dynamic dispatch, aliases, generated code and template expressions may be missed.",
			"Scans TypeScript, JavaScript, Python and Rust. Conventional test/generated filenames, test/example/docs/build directories, hidden paths, secret-named files and symlinks are excluded; .gitignore, .ignore and .pi-flowignore are honored. Inline tests and unusually named generated code may remain.",
		]),
	};
	const metadataPromise = readGitMetadata(projectRoot);
	await scanDirectory("", [], state);
	state.files.sort((left, right) => left.path.localeCompare(right.path));
	const nodes = groupComponents(state);
	const edges = new Map<string, FlowEdge>();
	const fileIndex = new Map(state.files.map((file) => [file.path, file]));
	const workspaces = state.manifests
		.filter((manifest) => manifest.name)
		.sort((a, b) => (b.name?.length ?? 0) - (a.name?.length ?? 0));
	for (const file of state.files) {
		file.imports = extractImports(file);
		for (const reference of file.imports) {
			const target = resolveImport(file, reference.specifier, fileIndex, workspaces);
			if (target && target.componentId !== file.componentId) {
				addEdge(
					edges,
					file.componentId,
					target.componentId,
					"dependency",
					"Imports",
					"detected",
					evidence(file, reference.line),
				);
			}
		}
		analyzeIo(file, nodes, edges);
	}
	const metadata = await metadataPromise;
	const projectManifest = state.manifests.find((manifest) => manifest.directory === "");
	if (!state.files.length)
		state.warnings.add("No supported application source files were found within the scan limits.");
	return {
		version: 1,
		project: {
			name: projectManifest?.name || basename(projectRoot),
			root: projectRoot,
			scannedAt: new Date().toISOString(),
			...metadata,
			fileCount: state.files.length,
			lineCount: state.files.reduce((sum, file) => sum + file.lines.length, 0),
			durationMs: Math.round(performance.now() - startedAt),
			languages: [...new Set(state.files.map((file) => file.language))].sort(),
		},
		nodes: [...nodes.values()],
		edges: [...edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
		files: state.files.map((file) => ({
			path: file.path,
			language: file.language,
			lines: file.lines.length,
			componentId: file.componentId,
		})),
		warnings: [...state.warnings],
	};
}

async function scanDirectory(directory: string, inherited: IgnoreScope[], state: ScanState): Promise<void> {
	if (state.files.length >= MAX_FILES || state.bytes >= MAX_BYTES || state.directories >= 10000) {
		state.warnings.add(
			"Scan limit reached: at most 4,000 source files, 32 MiB of source and 10,000 directories are inspected. This overview is partial.",
		);
		return;
	}
	if (directory.split("/").length > 32) {
		state.warnings.add("Directories deeper than 32 levels were skipped.");
		return;
	}
	state.directories++;
	const scopes = [...inherited];
	const rules = ignore();
	for (const name of [".gitignore", ".ignore", ".pi-flowignore"]) {
		try {
			const content = await readBounded(join(state.root, directory, name), 128 * 1024);
			if (content !== undefined) rules.add(content);
		} catch {
			state.warnings.add(`Could not read ignore rules in ${directory || "."}; built-in exclusions still apply.`);
		}
	}
	scopes.push({ directory, rules });
	let entries: Dirent[];
	try {
		const absoluteDirectory = join(state.root, directory);
		if ((await lstat(absoluteDirectory)).isSymbolicLink()) return;
		entries = await readdir(absoluteDirectory, { withFileTypes: true });
	} catch {
		state.warnings.add(`Could not read directory ${directory || "."}.`);
		return;
	}
	entries.sort((left, right) => left.name.localeCompare(right.name));
	for (const entry of entries) {
		if (entry.isSymbolicLink() || entry.name.startsWith(".")) continue;
		const relativePath = directory ? `${directory}/${entry.name}` : entry.name;
		const isDirectory = entry.isDirectory();
		if (isDirectory && EXCLUDED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
		if (isIgnored(relativePath, isDirectory, scopes)) continue;
		if (isDirectory) {
			await scanDirectory(relativePath, scopes, state);
			continue;
		}
		if (!entry.isFile()) continue;
		if (["package.json", "Cargo.toml", "pyproject.toml"].includes(entry.name)) {
			await readManifest(relativePath, directory, state);
			continue;
		}
		const language = SOURCE_LANGUAGES[extname(entry.name)];
		if (!language || isExcludedSource(entry.name)) continue;
		if (state.files.length >= MAX_FILES || state.bytes >= MAX_BYTES) {
			state.warnings.add(
				"Scan limit reached: at most 4,000 source files and 32 MiB of source are inspected. This overview is partial.",
			);
			return;
		}
		try {
			const content = await readBounded(
				join(state.root, relativePath),
				Math.min(MAX_FILE_BYTES, MAX_BYTES - state.bytes),
			);
			if (content === undefined) {
				state.warnings.add(
					"Oversized, binary, unreadable or nonregular source files were skipped (512 KiB per file maximum).",
				);
				continue;
			}
			state.bytes += Buffer.byteLength(content);
			const lines = content ? content.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n") : [];
			state.files.push({
				path: relativePath,
				language,
				content,
				masked: maskNonCode(content, language),
				lines,
				group: "",
				componentId: "",
				imports: [],
			});
		} catch {
			state.warnings.add(`Could not read source file ${relativePath}.`);
		}
	}
}

function isIgnored(path: string, directory: boolean, scopes: IgnoreScope[]): boolean {
	let ignored = false;
	for (const scope of scopes) {
		const relativePath = scope.directory ? path.slice(scope.directory.length + 1) : path;
		const result = scope.rules.test(`${relativePath}${directory ? "/" : ""}`);
		if (result.ignored) ignored = true;
		else if (result.unignored) ignored = false;
	}
	return ignored;
}

function isExcludedSource(name: string): boolean {
	return (
		/(?:\.d\.[cm]?ts|\.(?:test|spec|generated|gen|min|bundle)\.[^.]+)$/i.test(name) ||
		/^(?:test_|conftest\.|secrets?(?:[._-]|$)|credentials?(?:[._-]|$))/i.test(name) ||
		/^(?:vitest|vite|webpack|rollup|jest|playwright|eslint|babel|tailwind|postcss)\.config\./i.test(name)
	);
}

async function readBounded(path: string, maximum: number): Promise<string | undefined> {
	let handle: FileHandle;
	try {
		handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
	} catch (error) {
		// Filesystem input can disappear, be a symlink or deny access between enumeration and opening.
		if (error instanceof Error && "code" in error && ["ENOENT", "ELOOP"].includes(String(error.code)))
			return undefined;
		throw error;
	}
	try {
		const stat = await handle.stat();
		if (!stat.isFile() || stat.size > maximum) return undefined;
		const buffer = Buffer.alloc(Math.min(stat.size + 1, maximum + 1));
		let total = 0;
		while (total < buffer.length) {
			const { bytesRead } = await handle.read(buffer, total, buffer.length - total, null);
			if (!bytesRead) break;
			total += bytesRead;
		}
		// Reject files that grew while being read rather than treating a truncated prefix as complete source.
		if (total > maximum || total === buffer.length) return undefined;
		const bytes = buffer.subarray(0, total);
		return bytes.includes(0) ? undefined : bytes.toString("utf8");
	} finally {
		await handle.close();
	}
}

async function readManifest(path: string, directory: string, state: ScanState): Promise<void> {
	try {
		const content = await readBounded(join(state.root, path), 256 * 1024);
		if (!content) return;
		let name: string | undefined;
		const binPaths: string[] = [];
		if (path.endsWith("package.json")) {
			// Package manifests are untrusted project input; validate only the fields used here.
			const value: unknown = JSON.parse(content);
			if (!value || typeof value !== "object" || Array.isArray(value)) return;
			if ("name" in value && typeof value.name === "string") name = value.name.slice(0, 160);
			if ("bin" in value) {
				const bins =
					typeof value.bin === "string"
						? [value.bin]
						: value.bin && typeof value.bin === "object"
							? Object.values(value.bin)
							: [];
				for (const bin of bins)
					if (typeof bin === "string") binPaths.push(posix.normalize(posix.join(directory, bin)));
			}
		} else {
			name = /^\s*name\s*=\s*["']([^"']+)["']/m.exec(content)?.[1];
		}
		const existing = state.manifests.find((manifest) => manifest.directory === directory);
		if (!existing) state.manifests.push({ directory, name, binPaths });
		else {
			existing.name ??= name;
			existing.binPaths.push(...binPaths);
		}
	} catch {
		state.warnings.add(`Could not parse ${path}; directory names will be used where needed.`);
	}
}

function groupComponents(state: ScanState): Map<string, FlowNode> {
	const manifests = [...state.manifests].sort((left, right) => right.directory.length - left.directory.length);
	const groupCounts = new Map<string, number>();
	for (const file of state.files) {
		const manifest = manifests.find((item) => item.directory && file.path.startsWith(`${item.directory}/`));
		const parts = file.path.split("/");
		file.group =
			["packages", "apps", "services", "crates"].includes(parts[0] ?? "") && parts.length > 2
				? parts.slice(0, 2).join("/")
				: manifest?.directory ||
					(["src", "lib", "source"].includes(parts[0] ?? "")
						? parts.length > 2
							? parts.slice(0, 2).join("/")
							: "."
						: parts.length > 1
							? (parts[0] ?? ".")
							: ".");
		groupCounts.set(file.group, (groupCounts.get(file.group) ?? 0) + 1);
	}
	const ranked = [...groupCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	const kept = new Set(
		ranked.slice(0, ranked.length > MAX_COMPONENTS ? MAX_COMPONENTS - 1 : MAX_COMPONENTS).map(([group]) => group),
	);
	if (ranked.length > MAX_COMPONENTS)
		state.warnings.add(
			`Overview groups ${ranked.length - kept.size} smaller components under Other to keep at most ${MAX_COMPONENTS} project nodes readable.`,
		);
	const nodes = new Map<string, FlowNode>();
	const binPaths = new Set(state.manifests.flatMap((manifest) => manifest.binPaths));
	for (const file of state.files) {
		const group = kept.has(file.group) ? file.group : "__other__";
		file.componentId = `component:${encodeURIComponent(group)}`;
		let node = nodes.get(file.componentId);
		if (!node) {
			node = {
				id: file.componentId,
				label: componentLabel(group),
				kind: "process",
				boundary: "project",
				description:
					group === "__other__"
						? "Smaller source components grouped for this overview."
						: `Application source grouped by ${group === "." ? "the project root" : group}. Connections are static evidence, not an execution trace.`,
				files: [],
				technologies: [],
			};
			nodes.set(node.id, node);
		}
		node.files.push(file.path);
		if (!node.technologies.includes(file.language)) node.technologies.push(file.language);
		if (
			binPaths.has(file.path) ||
			/(?:^|\/)(?:cli|main|server)\.[cm]?[jt]s$/.test(file.path) ||
			(file.language === "Rust" && /\bfn\s+main\s*\(/.test(file.masked)) ||
			(file.language === "Python" && /if\s+__name__\s*==\s*["']__main__["']/.test(file.content))
		)
			node.kind = "entry";
	}
	return nodes;
}

function componentLabel(group: string): string {
	if (group === ".") return "Application";
	if (group === "__other__") return "Other components";
	const name = posix.basename(group).replace(/[-_]/g, " ");
	if (["ai", "tui", "mcp", "api", "ui", "cli"].includes(name)) return name.toUpperCase();
	return name.charAt(0).toUpperCase() + name.slice(1);
}

function maskNonCode(content: string, language: string): string {
	// Preserve byte-independent JS string offsets and line numbers while ignoring comments and string payloads.
	// Templates are intentionally masked in full; evaluating their expressions is outside this scanner's scope.
	const pattern =
		language === "Python"
			? /"""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|#[^\n]*/g
			: language === "Rust"
				? /r(#+)"[\s\S]*?"\1|"(?:\\[\s\S]|[^"\\])*"|'(?:\\.|[^'\\])'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g
				: /`(?:\\[\s\S]|[^`\\])*`|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
	return content.replace(pattern, (match) => match.replace(/[^\r\n]/g, " "));
}

function extractImports(file: SourceFile): ImportReference[] {
	const references: ImportReference[] = [];
	const pattern =
		file.language === "Python"
			? /\b(?:from\s+([.\w]+)\s+import|import\s+([\w.]+))/g
			: file.language === "Rust"
				? /\b(?:use\s+([\w:]+)|mod\s+(\w+)\s*;)/g
				: /\b(?:from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|(?:import|require)\s*\(\s*["']([^"']+)["']\s*\))/g;
	for (const match of file.content.matchAll(pattern)) {
		const offset = match.index;
		if (!file.masked[offset]?.trim()) continue;
		const specifier = match[1] || match[2] || match[3];
		if (specifier) references.push({ specifier, line: file.content.slice(0, offset).split("\n").length });
	}
	return references;
}

function resolveImport(
	file: SourceFile,
	specifier: string,
	files: Map<string, SourceFile>,
	workspaces: Manifest[],
): SourceFile | undefined {
	const extensions = Object.keys(SOURCE_LANGUAGES);
	const bases: string[] = [];
	if (file.language === "Python") {
		const dots = /^\.+/.exec(specifier)?.[0].length ?? 0;
		const name = specifier.slice(dots).replace(/\./g, "/");
		if (dots) bases.push(posix.join(posix.dirname(file.path), "../".repeat(dots - 1), name));
		else bases.push(name, `src/${name}`, posix.join(posix.dirname(file.path), name));
	} else if (file.language === "Rust") {
		const packageRoot = workspaces.find((item) => file.path.startsWith(`${item.directory}/`))?.directory ?? "";
		const segments = specifier.split("::");
		if (segments[0] === "crate") bases.push(posix.join(packageRoot, "src", ...segments.slice(1)));
		else if (segments[0] === "super") bases.push(posix.join(posix.dirname(file.path), "..", ...segments.slice(1)));
		else if (segments[0] === "self") bases.push(posix.join(posix.dirname(file.path), ...segments.slice(1)));
		else if (!specifier.includes("::")) bases.push(posix.join(posix.dirname(file.path), specifier));
	} else if (specifier.startsWith(".")) {
		bases.push(posix.normalize(posix.join(posix.dirname(file.path), specifier)));
	} else {
		const manifest = workspaces.find((item) => specifier === item.name || specifier.startsWith(`${item.name}/`));
		if (manifest?.name) {
			const suffix = specifier.slice(manifest.name.length).replace(/^\//, "");
			bases.push(
				posix.join(manifest.directory, "src", suffix || "index"),
				posix.join(manifest.directory, suffix || "index"),
			);
			if (!suffix) return [...files.values()].find((target) => target.path.startsWith(`${manifest.directory}/`));
		}
	}
	for (const base of bases) {
		const stem = base.replace(/\.(?:[cm]?[jt]sx?)$/, "");
		const candidates = [
			base,
			stem,
			...extensions.map((extension) => stem + extension),
			...extensions.map((extension) => `${stem}/index${extension}`),
			`${stem}/__init__.py`,
			`${stem}/mod.rs`,
		];
		for (const candidate of candidates) {
			const target = files.get(candidate);
			if (target) return target;
		}
		if (file.language === "Rust") {
			// A use path can end with a symbol rather than a module.
			const parent = files.get(`${posix.dirname(base)}.rs`) ?? files.get(`${posix.dirname(base)}/mod.rs`);
			if (parent) return parent;
		}
	}
	return undefined;
}

const RESOURCES: Readonly<Record<string, Omit<FlowNode, "id" | "files">>> = {
	"host:stdin": {
		label: "Terminal input",
		kind: "entry",
		boundary: "host",
		description: "Standard input and interactive terminal reads detected in source.",
		technologies: ["stdin"],
	},
	"host:stdout": {
		label: "Console / stdout",
		kind: "external",
		boundary: "host",
		description: "Console logging and standard-output writes. Browser console calls may also appear here.",
		technologies: ["stdout", "stderr"],
	},
	"host:filesystem": {
		label: "Local filesystem",
		kind: "store",
		boundary: "host",
		description: "Filesystem reads and mutations. Actual paths are resolved at runtime and are not inferred here.",
		technologies: ["Files"],
	},
	"host:environment": {
		label: "Environment",
		kind: "store",
		boundary: "host",
		description: "Environment-variable access detected in source. Values are never read from this process.",
		technologies: ["Environment variables"],
	},
	"host:processes": {
		label: "OS processes",
		kind: "external",
		boundary: "host",
		description: "Subprocess creation calls. No project commands are executed by this scanner.",
		technologies: ["Subprocesses"],
	},
	"network:services": {
		label: "HTTP / APIs",
		kind: "external",
		boundary: "network",
		description:
			"Network request and SDK call patterns; destinations, payloads and actual execution are not verified.",
		technologies: ["HTTP", "SDKs"],
	},
	"network:clients": {
		label: "Network clients",
		kind: "entry",
		boundary: "network",
		description: "Incoming network connections inferred from listener and HTTP route declarations.",
		technologies: ["HTTP", "TCP"],
	},
	"host:database": {
		label: "Local database",
		kind: "store",
		boundary: "host",
		description: "SQLite query patterns. Query direction is inferred from nearby SQL when available.",
		technologies: ["SQLite"],
	},
};

function analyzeIo(file: SourceFile, nodes: Map<string, FlowNode>, edges: Map<string, FlowEdge>): void {
	const imports = file.imports.map((reference) => reference.specifier).join(" ");
	const js = file.language === "JavaScript" || file.language === "TypeScript";
	const python = file.language === "Python";
	const rust = file.language === "Rust";
	const fsImported = /(?:node:)?fs(?:\/promises)?\b|pathlib|std::fs|tokio::fs/.test(imports);
	const processImported = /child_process|cross-spawn|execa|subprocess|std::process/.test(imports);
	const sdkImported = /anthropic|openai|google-genai|generative-ai|aws-sdk|groq|mistral|cohere/.test(imports);
	const serverImported = /(?:node:)?https?\b|http2|express|fastify|flask|fastapi|aiohttp|axum|hyper/.test(imports);
	const sqliteImported = /sqlite|rusqlite/.test(imports);
	const maskedLines = file.masked.split(/\r?\n/);
	for (let index = 0; index < maskedLines.length; index++) {
		const code = maskedLines[index] ?? "";
		if (!code.trim()) continue;
		const original = file.lines[index] ?? "";
		const sourceEvidence = evidence(file, index + 1);
		const connect = (
			resource: string,
			kind: FlowEdge["kind"],
			incoming: boolean,
			label: string,
			confidence: FlowEdge["confidence"] = "detected",
		) => {
			if (!nodes.has(resource)) {
				const definition = RESOURCES[resource];
				if (!definition) return;
				nodes.set(resource, { id: resource, ...definition, files: [] });
			}
			const source = incoming ? resource : file.componentId;
			const target = incoming ? file.componentId : resource;
			addEdge(edges, source, target, kind, label, confidence, sourceEvidence);
		};
		if (
			(js && /\bprocess\.stdin\b/.test(code)) ||
			(python && /\b(?:input\s*\(|sys\.stdin\b)/.test(code)) ||
			(rust && /\b(?:std::io::)?stdin\s*\(/.test(code))
		)
			connect("host:stdin", "input", true, "Reads input");
		if (
			(js &&
				/\b(?:console\.(?:log|info|warn|error|debug)\s*\(|process\.(?:stdout|stderr)\.write\s*\()/.test(code)) ||
			(python && /\b(?:print\s*\(|sys\.(?:stdout|stderr)\.write\s*\()/.test(code)) ||
			(rust && /\b(?:e?print(?:ln)?!|(?:std::io::)?stdout\s*\()/.test(code))
		)
			connect("host:stdout", "output", false, "Writes output");
		if (
			(js && /\bprocess\.env\b/.test(code)) ||
			(python && /\bos\.(?:environ|getenv)\b/.test(code)) ||
			(rust && /\b(?:std::)?env::vars?(?:_os)?\s*\(/.test(code))
		)
			connect("host:environment", "read", true, "Reads configuration");
		if (
			(js && fsImported && /\b(?:readFile(?:Sync)?|createReadStream|readdir(?:Sync)?)\s*\(/.test(code)) ||
			(python && /\.(?:read_text|read_bytes)\s*\(/.test(code)) ||
			(rust && /\b(?:fs::(?:read|read_to_string|read_dir)|File::open)\s*\(/.test(code))
		)
			connect("host:filesystem", "read", true, "Reads files");
		if (
			(js &&
				fsImported &&
				/\b(?:writeFile(?:Sync)?|appendFile(?:Sync)?|createWriteStream|rename(?:Sync)?|unlink(?:Sync)?|mkdir(?:Sync)?|rm(?:Sync)?)\s*\(/.test(
					code,
				)) ||
			(python && /\.(?:write_text|write_bytes)\s*\(/.test(code)) ||
			(rust && /\b(?:fs::(?:write|rename|remove_file|create_dir(?:_all)?)|File::create)\s*\(/.test(code))
		)
			connect("host:filesystem", "write", false, "Writes files");
		if (python && /\bopen\s*\(/.test(code)) {
			const mode = /\bopen\s*\([^\n]*?,\s*(?:mode\s*=\s*)?["']([rwaxbt+]+)["']/.exec(original)?.[1] ?? "r";
			if (/[r+]/.test(mode)) connect("host:filesystem", "read", true, "Reads files");
			if (/[wax+]/.test(mode)) connect("host:filesystem", "write", false, "Writes files");
		}
		if (
			(js &&
				/\b(?:fetch\s*\(|axios(?:\.(?:get|post|put|patch|delete|request))?\s*\(|(?:https?|http2)\.(?:get|request|connect)\s*\(|new\s+WebSocket\s*\()/.test(
					code,
				)) ||
			(python &&
				/\b(?:requests|httpx|urllib\.request)\.(?:get|post|put|patch|delete|request|urlopen)\s*\(/.test(code)) ||
			(rust && /\b(?:reqwest::(?:get|blocking::get)|TcpStream::connect)\s*\(/.test(code))
		)
			connect("network:services", "network", false, "Calls service");
		if (
			sdkImported &&
			/\.(?:messages\.create|responses\.create|chat\.completions\.create|generateContent|generate_content|invoke_model|send)\s*\(/.test(
				code,
			)
		) {
			connect("network:services", "network", false, "Calls service", "inferred");
		}
		if (
			(js &&
				((processImported && /\b(?:exec(?:File)?(?:Sync)?|spawn(?:Sync)?|execa)\s*\(/.test(code)) ||
					/\bBun\.spawn\s*\(/.test(code))) ||
			(python && /\b(?:subprocess\.(?:run|call|Popen|check_call|check_output)|os\.system)\s*\(/.test(code)) ||
			(rust && /\b(?:std::process::)?Command::new\s*\(/.test(code))
		)
			connect("host:processes", "execute", false, "Starts process");
		if (
			(serverImported && /\b(?:createServer\s*\(|\w+\.(?:listen|route|get|post|put|delete)\s*\()/.test(code)) ||
			(rust && /\b(?:TcpListener::bind|Server::bind)\s*\(/.test(code))
		)
			connect("network:clients", "input", true, "Accepts requests", "inferred");
		if (sqliteImported && /\.(?:prepare|execute|executemany|query|run|exec)\s*\(/.test(code)) {
			if (/\b(?:INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)\b/i.test(original))
				connect("host:database", "write", false, "Writes records", "inferred");
			else connect("host:database", "read", true, "Queries records", "inferred");
		}
	}
}

function evidence(file: SourceFile, line: number): FlowEvidence {
	const text = (file.lines[line - 1] ?? "")
		.trim()
		.replace(
			/\b((?:api[_-]?key|password|secret|access[_-]?token|authorization)\s*[:=]\s*)["'`][^"'`]*["'`]/gi,
			'$1"[redacted]"',
		)
		.replace(/([?&](?:token|key|secret|password)=)[^&\s"'`]+/gi, "$1[redacted]")
		.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
		.slice(0, 240);
	return { file: file.path, line, text };
}

function addEdge(
	edges: Map<string, FlowEdge>,
	source: string,
	target: string,
	kind: FlowEdge["kind"],
	label: string,
	confidence: FlowEdge["confidence"],
	item: FlowEvidence,
): void {
	const id = `${source}>${target}:${kind}`;
	const existing = edges.get(id);
	if (existing) {
		existing.count++;
		if (confidence === "inferred") existing.confidence = "inferred";
		if (
			existing.evidence.length < MAX_EVIDENCE &&
			!existing.evidence.some((entry) => entry.file === item.file && entry.line === item.line)
		)
			existing.evidence.push(item);
	} else edges.set(id, { id, source, target, label, kind, confidence, evidence: [item], count: 1 });
}

async function readGitMetadata(root: string): Promise<{ gitBranch: string; gitCommit?: string }> {
	const [branch, commit] = await Promise.allSettled([
		executeFile("git", ["-C", root, "symbolic-ref", "--short", "HEAD"], { timeout: 3000, maxBuffer: 65536 }),
		executeFile("git", ["-C", root, "rev-parse", "HEAD"], { timeout: 3000, maxBuffer: 65536 }),
	]);
	return {
		gitBranch:
			branch.status === "fulfilled"
				? branch.value.stdout.trim().slice(0, 160)
				: commit.status === "fulfilled"
					? "Detached HEAD"
					: "No Git repository",
		gitCommit: commit.status === "fulfilled" ? commit.value.stdout.trim() : undefined,
	};
}
