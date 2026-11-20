/** Import CodeBoarding's versioned analysis documents into Pi's native project graph. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { type Static, Type } from "typebox";
import { Compile } from "typebox/compile";
import type { FlowEdge, FlowEvidence, FlowFile, FlowGraph, FlowNode } from "./types.ts";

export interface CodeboardingImportOptions {
	mode?: "architecture" | "static";
}

const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024;
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;
const MAX_SOURCE_FILE_BYTES = 512 * 1024;
const MAX_COMPONENTS = 1000;
const MAX_METHODS = 100000;
const MAX_EVIDENCE = 24;
const text = Type.String({ maxLength: 16384 });
const identifier = Type.String({ minLength: 1, maxLength: 2048, pattern: "^[^\\u0000-\\u001f\\u007f-\\u009f]+$" });
const position = Type.Integer({ minimum: 0, maximum: 100000000 });
const callSites = Type.Array(Type.Tuple([position, position]), { maxItems: 100000 });
const referenceSchema = Type.Object({
	qualified_name: text,
	reference_file: Type.Optional(Type.Union([text, Type.Null()])),
	reference_start_line: Type.Optional(Type.Union([position, Type.Null()])),
	reference_end_line: Type.Optional(Type.Union([position, Type.Null()])),
});
const relationSchema = Type.Object({
	relation: text,
	src_name: text,
	dst_name: text,
	evidence: text,
	src_id: identifier,
	dst_id: identifier,
	is_static: Type.Boolean(),
	key_edges: Type.Array(
		Type.Union([Type.Tuple([identifier, identifier]), Type.Tuple([identifier, identifier, text])]),
		{ maxItems: 100000 },
	),
});
const componentSchema = Type.Object({
	name: text,
	component_id: identifier,
	description: text,
	key_entities: Type.Array(referenceSchema, { maxItems: 10000 }),
	can_expand: Type.Boolean(),
	file_methods: Type.Optional(Type.Union([Type.Array(identifier, { maxItems: MAX_METHODS }), Type.Null()])),
	components: Type.Array(Type.Unknown(), { maxItems: MAX_COMPONENTS }),
	components_relations: Type.Array(relationSchema, { maxItems: 100000 }),
});
const documentSchema = Type.Object({
	metadata: Type.Object({
		format_version: Type.Literal("v1"),
		generated_at: text,
		repo_name: text,
		file_coverage_summary: Type.Optional(
			Type.Object({
				analyzed: position,
				not_analyzed: position,
				total_files: position,
			}),
		),
	}),
	description: text,
	files: Type.Record(
		Type.String({ maxLength: 4096 }),
		Type.Object({
			content_hash: text,
			methods: Type.Record(identifier, Type.Tuple([position, position, text, text, identifier]), {
				maxProperties: MAX_METHODS,
			}),
		}),
		{ maxProperties: 20000 },
	),
	components: Type.Array(Type.Unknown(), { maxItems: MAX_COMPONENTS }),
	components_relations: Type.Array(relationSchema, { maxItems: 100000 }),
	edges: Type.Array(
		Type.Union([
			Type.Tuple([identifier, identifier, callSites]),
			Type.Tuple([identifier, identifier, callSites, text]),
		]),
		{ maxItems: 200000 },
	),
});
const validateDocument = Compile(documentSchema);
const validateComponent = Compile(componentSchema);
type RelationDocument = Static<typeof relationSchema>;
type EdgeRow = Static<typeof documentSchema>["edges"][number];
type ComponentDocument = Omit<Static<typeof componentSchema>, "components"> & { components: ComponentDocument[] };
interface Method {
	file: string;
	name: string;
	start: number;
	end: number;
}
interface Source {
	path: string;
	lines: string[];
	fresh: boolean;
}

/** Load the genuine CodeBoarding v1 artifact, normally written by its local CLI. */
export async function loadCodeboardingAnalysis(
	root: string,
	path = join(root, ".codeboarding", "analysis.json"),
	options: CodeboardingImportOptions = {},
): Promise<FlowGraph> {
	const absolute = resolve(path);
	const document = await readBoundedFile(absolute, MAX_DOCUMENT_BYTES);
	if (document === undefined)
		throw new Error("CodeBoarding analysis must be a regular UTF-8 JSON file of at most 32 MiB.");
	let data: unknown;
	try {
		data = JSON.parse(document);
	} catch {
		throw new Error("CodeBoarding analysis is not valid JSON.");
	}
	const graph = await importCodeboardingAnalysis(root, data, options);
	if (graph.analysis) graph.analysis.sourcePath = absolute;
	return graph;
}

/** Validate an upstream document and retain its hierarchy, calls, inferred flows, and local source evidence. */
export async function importCodeboardingAnalysis(
	root: string,
	data: unknown,
	options: CodeboardingImportOptions = {},
): Promise<FlowGraph> {
	const startedAt = performance.now();
	// CodeBoarding JSON is an external trust boundary. Unknown versions fail instead of being partly interpreted.
	if (!validateDocument.Check(data)) {
		const error = validateDocument.Errors(data)[0];
		throw new Error(
			`Invalid CodeBoarding v1 analysis at ${clean(error?.instancePath || "root").slice(0, 240)}: ${clean(error?.message || "invalid document")}`,
		);
	}
	const projectRoot = await realpath(resolve(root));
	if (!(await lstat(projectRoot)).isDirectory()) throw new Error("The project root must be a directory.");
	const warnings = new Set([
		"CodeBoarding architecture and call relationships are static analysis, not runtime traces or proof of end-to-end value flow.",
		"Detected calls come from CodeBoarding's language analysis. Inferred relationships and component descriptions require review.",
	]);
	const components = parseComponents(data.components);
	const methods = new Map<string, Method>();
	const sources = new Map<string, Source>();
	let sourceBytes = 0;
	for (const [path, entry] of Object.entries(data.files)) {
		for (const [name, row] of Object.entries(entry.methods)) {
			if (methods.has(row[4])) throw new Error(`CodeBoarding repeats method ID ${clean(row[4])}.`);
			if (methods.size >= MAX_METHODS) throw new Error("CodeBoarding analysis exceeds 100,000 methods.");
			methods.set(row[4], { file: path, name, start: row[0], end: row[1] });
		}
		if (!path) continue; // Upstream uses the empty path for unresolved symbols; it is not a source file.
		const sourcePath = await localSourcePath(projectRoot, path);
		if (!sourcePath) {
			warnings.add("Unavailable, secret-named, symlinked or out-of-project source references were omitted.");
			continue;
		}
		const content = await readBoundedFile(
			join(projectRoot, sourcePath),
			Math.min(MAX_SOURCE_FILE_BYTES, MAX_SOURCE_BYTES - sourceBytes),
		);
		if (content === undefined) {
			warnings.add(
				"Source evidence is partial: unreadable or binary files, files over 512 KiB, and source beyond 32 MiB were omitted.",
			);
			continue;
		}
		sourceBytes += Buffer.byteLength(content);
		const lines = content
			? content
					.replace(/\r\n|\r/g, "\n")
					.replace(/\n$/, "")
					.split("\n")
			: [];
		// Upstream agents/content_hash.py normalizes line endings and stores the first 16 SHA-256 hex digits.
		const fresh =
			!/^[0-9a-f]{16}$/.test(entry.content_hash) ||
			createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16) === entry.content_hash;
		if (!fresh)
			warnings.add(
				"Some files changed since this CodeBoarding analysis; their stale source snippets are hidden. Regenerate the analysis.",
			);
		sources.set(path, { path: sourcePath, lines, fresh });
	}
	const nodes: FlowNode[] = [];
	const componentIndex = new Map<string, FlowNode>();
	const owners = new Map<string, string>();
	const fileOwners = new Map<string, string>();
	const lineage = new Map<string, string[]>();
	const scopes: { id: string; relations: RelationDocument[] }[] = [{ id: "", relations: data.components_relations }];
	const visit = (level: ComponentDocument[], ancestors: string[]): void => {
		for (const component of level) {
			const id = component.component_id;
			const references: FlowEvidence[] = [];
			for (const reference of component.key_entities) {
				if (references.length >= MAX_EVIDENCE) break;
				const source = reference.reference_file ? sources.get(reference.reference_file) : undefined;
				const item = sourceEvidence(
					source,
					reference.reference_start_line ?? 0,
					"reference",
					reference.qualified_name,
					reference.reference_end_line ?? undefined,
				);
				if (item) references.push(item);
			}
			const node: FlowNode = {
				id,
				label: clean(component.name),
				kind: "process",
				boundary: "project",
				description: clean(component.description),
				files: [],
				technologies: [],
				references,
				...(ancestors.length ? { parentId: ancestors[ancestors.length - 1] } : {}),
			};
			nodes.push(node);
			componentIndex.set(id, node);
			lineage.set(id, [...ancestors, id]);
			scopes.push({ id, relations: component.components_relations });
			if (component.components.length) {
				if (component.file_methods?.length)
					throw new Error(`CodeBoarding parent ${clean(id)} contains leaf method membership.`);
				visit(component.components, [...ancestors, id]);
				node.files = [
					...new Set(component.components.flatMap((child) => componentIndex.get(child.component_id)?.files ?? [])),
				];
			} else {
				for (const symbol of component.file_methods ?? []) {
					const method = methods.get(symbol);
					if (!method) throw new Error(`CodeBoarding component cites unknown method ${clean(symbol)}.`);
					if (owners.has(symbol))
						throw new Error(`CodeBoarding assigns method ${clean(symbol)} to multiple leaf components.`);
					owners.set(symbol, id);
					const source = sources.get(method.file);
					if (source) {
						node.files.push(source.path);
						if (!fileOwners.has(source.path)) fileOwners.set(source.path, id);
					}
					if (node.references && node.references.length < MAX_EVIDENCE) {
						const item = sourceEvidence(source, method.start, "definition", method.name, method.end);
						if (item && !node.references.some((entry) => entry.file === item.file && entry.line === item.line))
							node.references.push(item);
					}
				}
				node.files = [...new Set(node.files)];
			}
			node.technologies = [...new Set(node.files.map(languageFor))].sort();
		}
	};
	visit(components, []);
	const held = new Map<string, EdgeRow[]>();
	const hold = (key: string, row: EdgeRow): void => {
		const rows = held.get(key);
		if (rows) rows.push(row);
		else held.set(key, [row]);
	};
	const edgeRows = new Map<string, EdgeRow>();
	for (const row of data.edges) {
		if (!methods.has(row[0]) || !methods.has(row[1])) throw new Error("CodeBoarding edge cites an unknown method.");
		const pair = JSON.stringify(row.slice(0, 2));
		if (edgeRows.has(pair)) throw new Error("CodeBoarding repeats a method edge.");
		edgeRows.set(pair, row);
		const source = owners.get(row[0]);
		const target = owners.get(row[1]);
		if (!source || !target) continue;
		const rootKey = JSON.stringify(["", source, target]);
		hold(rootKey, row);
		const sourceLine = lineage.get(source) ?? [];
		const targetLine = lineage.get(target) ?? [];
		let depth = 0;
		while (depth < Math.min(sourceLine.length, targetLine.length) && sourceLine[depth] === targetLine[depth]) depth++;
		if (depth > 0 && depth < Math.min(sourceLine.length, targetLine.length)) {
			const key = JSON.stringify([sourceLine[depth - 1], sourceLine[depth], targetLine[depth]]);
			hold(key, row);
		}
	}
	const edges: FlowEdge[] = [];
	for (const scope of scopes) {
		for (const relation of scope.relations) {
			if (!componentIndex.has(relation.src_id) || !componentIndex.has(relation.dst_id))
				throw new Error("CodeBoarding relation cites an unknown component.");
			const rows = held.get(JSON.stringify([scope.id, relation.src_id, relation.dst_id])) ?? [];
			const pairs = new Set(rows.map((row) => JSON.stringify(row.slice(0, 2))));
			for (const key of relation.key_edges) {
				const pair = JSON.stringify(key.slice(0, 2));
				if (!edgeRows.has(pair)) throw new Error("CodeBoarding relation cites an unknown key edge.");
				if (!pairs.has(pair)) throw new Error("CodeBoarding relation cites a key edge outside its component pair.");
			}
			const evidence: FlowEvidence[] = [];
			let count = 0;
			for (const row of rows) {
				const sourceMethod = methods.get(row[0]);
				const targetMethod = methods.get(row[1]);
				if (!sourceMethod || !targetMethod) continue;
				count += Math.max(1, row[2].length);
				const source = sources.get(sourceMethod.file);
				for (const site of row[2]) {
					if (evidence.length >= MAX_EVIDENCE) break;
					if (evidence.some((entry) => entry.file === source?.path && entry.line === site[0])) continue;
					const item = sourceEvidence(source, site[0], "call", `${sourceMethod.name} → ${targetMethod.name}`);
					if (item) evidence.push(item);
				}
				if (!row[2].length && evidence.length < MAX_EVIDENCE) {
					const item = sourceEvidence(
						source,
						sourceMethod.start,
						"definition",
						sourceMethod.name,
						sourceMethod.end,
					);
					if (item) evidence.push(item);
				}
			}
			edges.push({
				id: `codeboarding:${JSON.stringify([scope.id, relation.src_id, relation.dst_id, edges.length])}`,
				source: relation.src_id,
				target: relation.dst_id,
				label: clean(relation.relation),
				kind: relation.is_static && rows.length ? "call" : "flow",
				confidence: relation.is_static && rows.length ? "detected" : "inferred",
				description: clean(relation.evidence),
				evidence,
				count,
			});
		}
	}
	if (edges.some((edge) => !edge.evidence.length))
		warnings.add(
			"Some relationships have no verified local call-site evidence; their descriptions remain upstream analysis claims.",
		);
	const files: FlowFile[] = [...sources.values()].map((source) => ({
		path: source.path,
		language: languageFor(source.path),
		lines: source.lines.length,
		componentId: fileOwners.get(source.path) ?? "",
	}));
	const metadata = await readGitMetadata(projectRoot);
	const coverage = data.metadata.file_coverage_summary;
	if (coverage?.not_analyzed)
		warnings.add(
			`CodeBoarding reports ${coverage.analyzed} analyzed and ${coverage.not_analyzed} excluded files out of ${coverage.total_files}.`,
		);
	return {
		version: 1,
		analysis: {
			engine: "codeboarding",
			mode: options.mode ?? "architecture",
			generatedAt: clean(data.metadata.generated_at),
			summary: clean(data.description),
		},
		project: {
			name: basename(projectRoot),
			root: projectRoot,
			scannedAt: new Date().toISOString(),
			...metadata,
			fileCount: files.length,
			lineCount: files.reduce((count, file) => count + file.lines, 0),
			durationMs: Math.round(performance.now() - startedAt),
			languages: [...new Set(files.map((file) => file.language))].sort(),
		},
		nodes,
		edges,
		files,
		warnings: [...warnings],
	};
}

function parseComponents(input: unknown[]): ComponentDocument[] {
	const ids = new Set<string>();
	const visit = (values: unknown[], depth: number): ComponentDocument[] => {
		if (depth > 32) throw new Error("CodeBoarding component nesting exceeds 32 levels.");
		return values.map((value) => {
			if (!validateComponent.Check(value)) throw new Error("Invalid CodeBoarding component document.");
			if (ids.has(value.component_id))
				throw new Error(`CodeBoarding repeats component ID ${clean(value.component_id)}.`);
			if (ids.size >= MAX_COMPONENTS) throw new Error("CodeBoarding analysis exceeds 1,000 components.");
			ids.add(value.component_id);
			return { ...value, components: visit(value.components, depth + 1) };
		});
	};
	return visit(input, 0);
}

async function localSourcePath(root: string, path: string): Promise<string | undefined> {
	if (/[\u0000-\u001f\u007f]/.test(path) || path.includes("\\")) return undefined;
	const absolute = isAbsolute(path) ? path : resolve(root, path);
	const rel = relative(root, absolute);
	if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return undefined;
	const parts = rel.split(sep);
	if (
		parts.some(
			(part) =>
				part === ".git" ||
				/^(?:\.env(?:\.|$)|secrets?(?:[._-]|$)|credentials?(?:[._-]|$)|id_(?:rsa|ed25519)$)/i.test(part),
		)
	)
		return undefined;
	try {
		let current = root;
		for (const part of parts) {
			current = join(current, part);
			if ((await lstat(current)).isSymbolicLink()) return undefined;
		}
		if ((await realpath(absolute)) !== absolute) return undefined;
		return parts.join("/");
	} catch {
		return undefined;
	}
}

async function readBoundedFile(path: string, maximum: number): Promise<string | undefined> {
	if (maximum <= 0) return undefined;
	try {
		// Nonblocking open lets the regular-file check reject FIFOs without waiting for a writer.
		const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		try {
			const stat = await handle.stat();
			if (!stat.isFile() || stat.size > maximum) return undefined;
			const bytes = Buffer.alloc(Math.min(maximum + 1, stat.size + 1));
			let total = 0;
			while (total < bytes.length) {
				const result = await handle.read(bytes, total, bytes.length - total, null);
				if (!result.bytesRead) break;
				total += result.bytesRead;
			}
			if (total > maximum || total === bytes.length) return undefined;
			const content = bytes.subarray(0, total);
			if (content.includes(0)) return undefined;
			return new TextDecoder("utf-8", { fatal: true }).decode(content);
		} finally {
			await handle.close();
		}
	} catch {
		return undefined;
	}
}

function sourceEvidence(
	source: Source | undefined,
	line: number,
	kind: FlowEvidence["kind"],
	symbol: string,
	endLine?: number,
): FlowEvidence | undefined {
	if (!source?.fresh || line < 1 || line > source.lines.length) return undefined;
	return {
		file: source.path,
		line,
		...(endLine && endLine >= line && endLine <= source.lines.length ? { endLine } : {}),
		kind,
		text: `${clean(symbol).slice(0, 160)}: ${clean(source.lines[line - 1].trim()).slice(0, 240)}`,
	};
}

function clean(value: string): string {
	return value
		.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
		.replace(
			/\b((?:api[_-]?key|password|secret|access[_-]?token|authorization)\s*[:=]\s*)["'`][^"'`]*["'`]/gi,
			'$1"[redacted]"',
		)
		.replace(/([?&](?:token|key|secret|password)=)[^&\s"'`]+/gi, "$1[redacted]");
}

function languageFor(path: string): string {
	const names: Record<string, string> = {
		js: "JavaScript",
		jsx: "JavaScript",
		mjs: "JavaScript",
		cjs: "JavaScript",
		ts: "TypeScript",
		tsx: "TypeScript",
		mts: "TypeScript",
		cts: "TypeScript",
		py: "Python",
		go: "Go",
		rs: "Rust",
		java: "Java",
		kt: "Kotlin",
		kts: "Kotlin",
		php: "PHP",
		cs: "C#",
		dart: "Dart",
		c: "C",
		h: "C/C++",
		cpp: "C++",
		cc: "C++",
		cxx: "C++",
		hpp: "C++",
		cu: "CUDA",
		rb: "Ruby",
		swift: "Swift",
		scala: "Scala",
	};
	return names[extname(path).slice(1).toLowerCase()] ?? "Other";
}

async function readGitMetadata(root: string): Promise<{ gitBranch: string; gitCommit?: string }> {
	const execute = promisify(execFile);
	const [branch, commit] = await Promise.allSettled([
		execute("git", ["-C", root, "symbolic-ref", "--short", "HEAD"], { timeout: 3000, maxBuffer: 65536 }),
		execute("git", ["-C", root, "rev-parse", "HEAD"], { timeout: 3000, maxBuffer: 65536 }),
	]);
	return {
		gitBranch:
			branch.status === "fulfilled"
				? clean(branch.value.stdout.trim())
				: commit.status === "fulfilled"
					? "Detached HEAD"
					: "No Git repository",
		gitCommit: commit.status === "fulfilled" ? commit.value.stdout.trim() : undefined,
	};
}
