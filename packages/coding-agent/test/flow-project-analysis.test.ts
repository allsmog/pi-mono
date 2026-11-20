/** Exercise the CodeBoarding subprocess and cache boundary with a small executable test fixture. */
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeProjectFlow } from "../src/flow/project-analysis.ts";

const document = {
	metadata: { format_version: "v1", generated_at: "2026-11-20T10:00:00Z", repo_name: "fixture" },
	description: "Executable unit-test fixture; not a real engine analysis.",
	files: {},
	components: [],
	components_relations: [],
	edges: [],
};

describe("CodeBoarding project analysis execution", () => {
	let workspace: string;
	let project: string;
	let agent: string;
	let executable: string;
	let cache: string;

	beforeEach(async () => {
		workspace = await realpath(await mkdtemp(join(tmpdir(), "pi-flow-runner-")));
		project = join(workspace, "project with spaces ; literal");
		agent = join(workspace, "agent");
		executable = join(workspace, "fixture-python");
		await mkdir(project);
		const key = createHash("sha256").update(project).digest("hex").slice(0, 24);
		cache = join(agent, "cache", "project-flow", key, "codeboarding");
		vi.stubEnv("PI_CODING_AGENT_DIR", agent);
		vi.stubEnv("PI_CODEBOARDING_PYTHON", executable);
		vi.stubEnv("PI_CODEBOARDING_TOOLS_DIR", "");
	});

	afterEach(async () => {
		vi.unstubAllEnvs();
		await rm(workspace, { recursive: true, force: true });
	});

	async function savedAnalysis(contents = JSON.stringify(document)): Promise<void> {
		await mkdir(join(project, ".codeboarding"));
		await writeFile(join(project, ".codeboarding", "analysis.json"), contents);
	}

	async function childFixture(body: string): Promise<void> {
		await writeFile(executable, `#!${process.execPath}\n${body}\n`);
		await chmod(executable, 0o700);
	}

	it("loads a project JSON artifact without starting Python and reports the saved result", async () => {
		await savedAnalysis();
		const graph = await analyzeProjectFlow(project);
		expect(graph.analysis).toMatchObject({ engine: "codeboarding", mode: "architecture" });
		expect(graph.analysis?.sourcePath).toBe(join(project, ".codeboarding", "analysis.json"));
		expect(graph.warnings.join(" ")).toContain("saved CodeBoarding analysis");
	});

	it("fails closed on invalid or symlinked project artifacts", async () => {
		await savedAnalysis("{bad-json");
		await expect(analyzeProjectFlow(project)).rejects.toThrow("not valid JSON");
		await rm(join(project, ".codeboarding", "analysis.json"));
		await writeFile(join(workspace, "outside.json"), JSON.stringify(document));
		await symlink(join(workspace, "outside.json"), join(project, ".codeboarding", "analysis.json"));
		await expect(analyzeProjectFlow(project)).rejects.toThrow("regular analysis file");
	});

	it("gives an installation command instead of silently substituting the quick scanner", async () => {
		await expect(analyzeProjectFlow(project)).rejects.toThrow("python3 tools/codeboarding/setup.py");
		await savedAnalysis();
		await expect(analyzeProjectFlow(project, { refresh: true })).rejects.toThrow("CodeBoarding is not installed");
	});

	it.skipIf(process.platform === "win32")(
		"passes literal argv, uses private fresh output and reuses only validated JSON",
		async () => {
			const tools = join(workspace, "tools with spaces");
			vi.stubEnv("PI_CODEBOARDING_TOOLS_DIR", tools);
			await childFixture(`
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
fs.writeFileSync(path.join(process.cwd(), 'arguments.json'), JSON.stringify({args, cwd:process.cwd(), telemetry:process.env.CODEBOARDING_TELEMETRY}));
fs.writeFileSync(path.join(args[args.indexOf('--output-dir') + 1], 'analysis.json'), ${JSON.stringify(JSON.stringify(document))});
`);
			const graph = await analyzeProjectFlow(project);
			const record = JSON.parse(await readFile(join(project, "arguments.json"), "utf8"));
			expect(record).toMatchObject({ cwd: project, telemetry: "false" });
			expect(record.args).toEqual([
				"-I",
				"-m",
				"codeboarding_cli.main",
				"full",
				"--local",
				project,
				"--output-dir",
				expect.stringContaining(join(cache, "run-")),
				"--force",
				"--binary-location",
				tools,
			]);
			expect(graph.analysis?.sourcePath).toBe(join(cache, "analysis.json"));
			expect(await readdir(cache)).toEqual(["analysis.json"]);
			await rm(executable);
			const cached = await analyzeProjectFlow(project);
			expect(cached.analysis?.summary).toBe(document.description);
		},
	);

	it.skipIf(process.platform === "win32")("aborts the child and leaves no successful or partial cache", async () => {
		await childFixture("process.stdout.write('Analyzing source\\n'); setInterval(() => {}, 1000);");
		const controller = new AbortController();
		const operation = analyzeProjectFlow(project, {
			signal: controller.signal,
			onProgress: (message) => {
				if (message.includes("is analyzing")) controller.abort();
			},
		});
		await expect(operation).rejects.toThrow(/abort/i);
		expect(await readdir(cache)).toEqual([]);
	});

	it.skipIf(process.platform === "win32")(
		"redacts credentials split across subprocess chunks and uses safe progress labels",
		async () => {
			vi.stubEnv("CODEBOARDING_TEST_API_KEY", "test-sensitive-provider-credential");
			await childFixture(`
const key = process.env.CODEBOARDING_TEST_API_KEY;
process.stderr.write('provider failed: ' + key.slice(0, 12));
setTimeout(() => { process.stderr.write(key.slice(12) + '\\x1b[2J'); process.exit(1); }, 250);
`);
			const progress: string[] = [];
			const failure = await analyzeProjectFlow(project, { onProgress: (value) => progress.push(value) }).catch(
				(error: unknown) => error,
			);
			expect(failure).toBeInstanceOf(Error);
			expect(String(failure)).toContain("[redacted]");
			expect(`${failure} ${progress.join(" ")}`).not.toContain("test-sensitive");
			expect(String(failure)).not.toContain("\u001b");
		},
	);

	it.skipIf(process.platform === "win32")(
		"explains the actual model requirement and the explicit static alternative",
		async () => {
			await childFixture("process.stderr.write('No LLM provider selected'); process.exit(1);");
			await expect(analyzeProjectFlow(project)).rejects.toThrow("Use /flow static");
		},
	);
});
