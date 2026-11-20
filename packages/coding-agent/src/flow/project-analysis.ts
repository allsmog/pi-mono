/** Run the real CodeBoarding engine and load its architecture into the native Pi screen. */
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, chmod, copyFile, lstat, mkdir, mkdtemp, realpath, rename, rm } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { getAgentDir, getPackageDir } from "../config.ts";
import { spawnProcess, waitForChildProcess } from "../utils/child-process.ts";
import { killProcessTree, trackDetachedChildPid, untrackDetachedChildPid } from "../utils/shell.ts";
import { analyzeProject } from "./analyzer.ts";
import { loadCodeboardingAnalysis } from "./codeboarding.ts";
import type { FlowGraph } from "./types.ts";

export type FlowAnalysisMode = "codeboarding" | "static" | "quick";

export interface ProjectAnalysisOptions {
	signal?: AbortSignal;
	onProgress?: (message: string) => void;
	refresh?: boolean;
	mode?: FlowAnalysisMode;
}

/** Import a saved CodeBoarding result or execute its pinned local Python runtime. */
export async function analyzeProjectFlow(root: string, options: ProjectAnalysisOptions = {}): Promise<FlowGraph> {
	options.signal?.throwIfAborted();
	const directory = await realpath(resolve(root));
	if (!(await lstat(directory)).isDirectory()) throw new Error("Project flow requires a directory.");
	const mode = options.mode ?? "codeboarding";
	if (mode === "quick") {
		options.onProgress?.("Running the optional quick I/O scanner…");
		const graph = await analyzeProject(directory);
		options.signal?.throwIfAborted();
		return graph;
	}

	const projectKey = createHash("sha256").update(directory).digest("hex").slice(0, 24);
	const cache = join(getAgentDir(), "cache", "project-flow", projectKey, mode);
	const saved = join(cache, "analysis.json");
	const importOptions = { mode: mode === "static" ? ("static" as const) : ("architecture" as const) };
	if (!options.refresh) {
		const candidates = mode === "static" ? [saved] : [saved, join(directory, ".codeboarding", "analysis.json")];
		for (const candidate of candidates) {
			if (!(await isRegularFile(candidate))) continue;
			if (candidate !== saved) {
				const actual = await realpath(candidate);
				const path = relative(directory, actual);
				if (path === ".." || path.startsWith(`..${sep}`)) {
					throw new Error("The project's saved CodeBoarding analysis must remain inside the project directory.");
				}
			}
			options.onProgress?.("Loading saved CodeBoarding analysis…");
			const graph = await loadCodeboardingAnalysis(directory, candidate, importOptions);
			options.signal?.throwIfAborted();
			graph.warnings.push("Loaded a saved CodeBoarding analysis. Use Actions → Rescan after changing source files.");
			return graph;
		}
	}

	const installation = join(getAgentDir(), "codeboarding");
	const python =
		process.env.PI_CODEBOARDING_PYTHON ||
		join(
			installation,
			"upstream",
			".venv",
			...(process.platform === "win32" ? ["Scripts", "python.exe"] : ["bin", "python"]),
		);
	try {
		await access(python, constants.X_OK);
	} catch {
		throw new Error(
			"CodeBoarding is not installed. From the Pi fork, run: python3 tools/codeboarding/setup.py\n" +
				"For an existing installation, set PI_CODEBOARDING_PYTHON to its Python 3.12 virtualenv executable.",
		);
	}
	const bridge = (await isRegularFile(join(installation, "bridge.py")))
		? join(installation, "bridge.py")
		: resolve(getPackageDir(), "..", "..", "tools", "codeboarding", "bridge.py");
	if (mode === "static" && !(await isRegularFile(bridge))) {
		throw new Error("CodeBoarding's Pi bridge is missing. Run python3 tools/codeboarding/setup.py again.");
	}

	// Fresh output directories keep upstream pickle caches from untrusted repositories out of the run.
	await mkdir(cache, { recursive: true, mode: 0o700 });
	const output = await mkdtemp(join(cache, "run-"));
	const temporary = join(cache, `analysis-${randomUUID()}.json`);
	try {
		// Isolated Python prevents similarly named modules in the inspected repo from shadowing upstream.
		const args =
			mode === "static"
				? ["-I", bridge, "--project", directory, "--output-dir", output]
				: ["-I", "-m", "codeboarding_cli.main", "full", "--local", directory, "--output-dir", output, "--force"];
		if (process.env.PI_CODEBOARDING_TOOLS_DIR) {
			args.push("--binary-location", process.env.PI_CODEBOARDING_TOOLS_DIR);
		}
		options.onProgress?.(
			mode === "static"
				? "Running CodeBoarding's static analysis and clustering…"
				: "Running CodeBoarding's full architecture analysis…",
		);
		await runCodeboarding(python, args, directory, options);
		options.signal?.throwIfAborted();
		const generated = join(output, "analysis.json");
		const graph = await loadCodeboardingAnalysis(directory, generated, importOptions);
		options.signal?.throwIfAborted();
		await copyFile(generated, temporary, constants.COPYFILE_EXCL);
		await chmod(temporary, 0o600);
		await rename(temporary, saved);
		if (graph.analysis) graph.analysis.sourcePath = saved;
		return graph;
	} finally {
		await rm(temporary, { force: true });
		await rm(output, { recursive: true, force: true });
	}
}

async function isRegularFile(path: string): Promise<boolean> {
	try {
		const info = await lstat(path);
		if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Expected a regular analysis file: ${path}`);
		return true;
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
		throw error;
	}
}

async function runCodeboarding(
	python: string,
	args: string[],
	cwd: string,
	options: ProjectAnalysisOptions,
): Promise<void> {
	options.signal?.throwIfAborted();
	const child = spawnProcess(python, args, {
		cwd,
		detached: process.platform !== "win32",
		windowsHide: true,
		stdio: ["ignore", "pipe", "pipe"],
		env: {
			...process.env,
			CODEBOARDING_TELEMETRY: "false",
			DO_NOT_TRACK: "1",
			PYTHONUNBUFFERED: "1",
			NPM_CONFIG_IGNORE_SCRIPTS: "true",
		},
	});
	if (child.pid) trackDetachedChildPid(child.pid);
	const secrets = Object.entries(process.env)
		.filter(([name, value]) => /(?:key|token|password|secret)/i.test(name) && value && value.length >= 8)
		.map(([, value]) => value ?? "");
	const tails = { stdout: "", stderr: "" };
	let lastProgress = 0;
	const receive = (stream: "stdout" | "stderr", chunk: string): void => {
		tails[stream] = (tails[stream] + chunk).slice(-12000);
		if (Date.now() - lastProgress < 200) return;
		// Never forward arbitrary provider logs into the TUI. They may contain credentials,
		// including values split across chunks. Only known phase labels are displayed live.
		const recent = tails[stream].slice(-1000);
		const phase = /cluster|scope|hierarchy/i.test(recent)
			? "CodeBoarding is grouping source components…"
			: /llm|agent|model|architecture/i.test(recent)
				? "CodeBoarding is analyzing architecture…"
				: /language server|pyright|gopls|lsp/i.test(recent)
					? "CodeBoarding is resolving source symbols…"
					: "CodeBoarding is analyzing the repository…";
		options.onProgress?.(phase);
		lastProgress = Date.now();
	};
	child.stdout.setEncoding("utf8");
	child.stderr.setEncoding("utf8");
	child.stdout.on("data", (chunk: string) => receive("stdout", chunk));
	child.stderr.on("data", (chunk: string) => receive("stderr", chunk));
	const abort = (): void => {
		if (child.pid) killProcessTree(child.pid);
	};
	options.signal?.addEventListener("abort", abort, { once: true });
	if (options.signal?.aborted) abort();
	try {
		const status = await waitForChildProcess(child);
		options.signal?.throwIfAborted();
		if (status !== 0) {
			let tail = `${tails.stdout}\n${tails.stderr}`
				.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, "")
				.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
				.replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
			for (const secret of secrets) tail = tail.split(secret).join("[redacted]");
			tail = tail.replace(/\b(?:sk-|sk-ant-)[A-Za-z0-9_-]{12,}\b/g, "[redacted]");
			if (/No LLM provider selected|LLM provider not configured|Multiple LLM providers selected/i.test(tail)) {
				throw new Error(
					"CodeBoarding needs one configured model provider for AI architecture analysis. " +
						"Configure ~/.codeboarding/config.toml or your provider environment variables. " +
						"Use /flow static to run CodeBoarding's real source analysis without a model.",
				);
			}
			throw new Error(`CodeBoarding exited ${status ?? "after a signal"}. ${tail.trim().slice(-1800)}`);
		}
	} finally {
		options.signal?.removeEventListener("abort", abort);
		if (child.pid) untrackDetachedChildPid(child.pid);
	}
}
