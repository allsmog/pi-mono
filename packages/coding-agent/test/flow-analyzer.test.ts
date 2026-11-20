import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { analyzeProject } from "../src/flow/analyzer.ts";

describe("project flow analyzer", () => {
	let project: string;
	const temporaryDirectories: string[] = [];

	beforeEach(async () => {
		project = await mkdtemp(join(tmpdir(), "pi-flow-test-"));
		temporaryDirectories.push(project);
	});

	afterEach(async () => {
		for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true });
	});

	async function write(path: string, content: string): Promise<void> {
		await mkdir(dirname(join(project, path)), { recursive: true });
		await writeFile(join(project, path), content);
	}

	it("finds evidence-backed I/O in a real mixed-language project and keeps imports separate", async () => {
		await write("package.json", JSON.stringify({ name: "flow-fixture", workspaces: ["packages/*"] }));
		await write("packages/api/package.json", JSON.stringify({ name: "@fixture/api" }));
		await write("packages/store/package.json", JSON.stringify({ name: "@fixture/store" }));
		await write("packages/store/src/index.ts", "export const storage = new Map();\n");
		await write(
			"packages/api/src/server.ts",
			[
				'import { readFile, writeFile } from "node:fs/promises";',
				'import { spawn } from "node:child_process";',
				'import { storage } from "@fixture/store";',
				'const config = await readFile("settings.json", "utf8");',
				'await writeFile("cache.json", config);',
				'await fetch("https://example.invalid/api", { body: config, method: "POST" });',
				'spawn("worker", [config]);',
				'process.stdin.on("data", (input) => storage.set("last", input));',
				"process.stdout.write(config);",
				"const mode = process.env.APP_MODE;",
			].join("\n"),
		);
		await write(
			"workers/task.py",
			[
				"import requests",
				"import subprocess",
				"from pathlib import Path",
				'payload = Path("input.txt").read_text()',
				'requests.post("https://example.invalid", data=payload)',
				'subprocess.run(["worker", payload])',
				'with open("output.txt", "w") as out:',
				"    out.write(payload)",
				"print(payload)",
			].join("\n"),
		);
		await write(
			"src/engine/main.rs",
			[
				"use std::fs;",
				"use std::process::Command;",
				"fn main() {",
				'    let value = fs::read_to_string("state.txt").unwrap();',
				'    fs::write("next.txt", &value).unwrap();',
				'    Command::new("worker").arg(&value).spawn().unwrap();',
				'    println!("{}", value);',
				"}",
			].join("\n"),
		);

		const graph = await analyzeProject(project);
		expect(graph.project.name).toBe("flow-fixture");
		expect(graph.project.fileCount).toBe(4);
		expect(graph.project.lineCount).toBe(28);
		expect(graph.project.languages).toEqual(["Python", "Rust", "TypeScript"]);
		const api = graph.files.find((file) => file.path === "packages/api/src/server.ts")?.componentId;
		const store = graph.files.find((file) => file.path === "packages/store/src/index.ts")?.componentId;
		expect(graph.edges).toContainEqual(expect.objectContaining({ source: api, target: store, kind: "dependency" }));
		expect(graph.edges).toContainEqual(
			expect.objectContaining({ source: "host:filesystem", target: api, kind: "read" }),
		);
		expect(graph.edges).toContainEqual(
			expect.objectContaining({ source: api, target: "host:filesystem", kind: "write" }),
		);
		expect(graph.edges).toContainEqual(
			expect.objectContaining({ source: api, target: "network:services", kind: "network" }),
		);
		expect(graph.edges).toContainEqual(
			expect.objectContaining({ source: api, target: "host:processes", kind: "execute" }),
		);
		expect(graph.edges).toContainEqual(expect.objectContaining({ source: "host:stdin", target: api, kind: "input" }));
		expect(graph.edges).toContainEqual(
			expect.objectContaining({ source: api, target: "host:stdout", kind: "output" }),
		);
		expect(graph.edges).toContainEqual(
			expect.objectContaining({ source: "host:environment", target: api, kind: "read" }),
		);
		for (const path of ["workers/task.py", "src/engine/main.rs"]) {
			const component = graph.files.find((file) => file.path === path)?.componentId;
			expect(graph.edges.some((edge) => edge.source === component && edge.kind === "write")).toBe(true);
			expect(graph.edges.some((edge) => edge.target === component && edge.kind === "read")).toBe(true);
			expect(graph.edges.some((edge) => edge.source === component && edge.kind === "execute")).toBe(true);
		}
		for (const edge of graph.edges) {
			expect(edge.evidence.length).toBeGreaterThan(0);
			expect(edge.count).toBeGreaterThanOrEqual(edge.evidence.length);
			expect(graph.nodes.some((node) => node.id === edge.source)).toBe(true);
			expect(graph.nodes.some((node) => node.id === edge.target)).toBe(true);
			for (const item of edge.evidence) {
				expect(item.line).toBeGreaterThan(0);
				expect(item.text).not.toBe("");
			}
		}
		expect(graph.edges.find((edge) => edge.source === api && edge.kind === "network")?.evidence[0]).toMatchObject({
			file: "packages/api/src/server.ts",
			line: 6,
		});
		expect(graph.warnings.join(" ")).toContain("not runtime tracing");
	});

	it("honors nested ignore rules and excludes secrets, artifacts, tests and symlinks", async () => {
		await write(".gitignore", "ignored/\nsrc/ignored.ts\n");
		await write(".ignore", "scratch/\n");
		await write(".pi-flowignore", "custom/\n");
		await write("src/.gitignore", "nested.ts\n!ignored.ts\n");
		await write("src/main.ts", "console.log('app');\n");
		await write("src/ignored.ts", "console.log('re-included');\n");
		await write("packages/env/package.json", JSON.stringify({ name: "@fixture/env" }));
		await write("packages/env/src/index.ts", "export const config = {};\n");
		const excluded = [
			"ignored/hidden.ts",
			"scratch/hidden.py",
			"custom/hidden.rs",
			"src/nested.ts",
			".git/hooks/code.ts",
			"node_modules/pkg/code.ts",
			"build/code.ts",
			"dist/code.ts",
			"target/code.rs",
			"tests/code.ts",
			"src/code.test.ts",
			"src/types.d.ts",
			"src/code.generated.ts",
			"src/secrets.ts",
			"src/credentials.py",
			".env.ts",
			"examples/example.ts",
			"tmp/scratch.ts",
		];
		for (const path of excluded) await write(path, "fetch('https://should-not-appear.invalid');\n");
		const outside = await mkdtemp(join(tmpdir(), "pi-flow-outside-"));
		temporaryDirectories.push(outside);
		await writeFile(join(outside, "external.ts"), "console.log('outside');");
		await symlink(outside, join(project, "linked-directory"), "dir");
		await symlink(join(outside, "external.ts"), join(project, "linked-file.ts"));
		const graph = await analyzeProject(project);
		expect(graph.files.map((file) => file.path)).toEqual([
			"packages/env/src/index.ts",
			"src/ignored.ts",
			"src/main.ts",
		]);
		expect(graph.project.fileCount).toBe(3);
		expect(graph.project.lineCount).toBe(3);
		expect(graph.nodes.some((node) => node.label === "Env")).toBe(true);
		expect(graph.edges.some((edge) => edge.kind === "network")).toBe(false);
	});

	it("does not confuse comments, documentation or generated-code strings with runtime calls", async () => {
		await write(
			"src/content.ts",
			[
				'import { writeFile } from "node:fs/promises";',
				'// fetch("https://example.invalid");',
				'/* process.stdout.write("example"); */',
				"const code = \"writeFile('a', 'b')\";",
				'const template = `fetch("https://example.invalid"); process.stdin.read();`;',
				"const description = \"from '../fake'\";",
			].join("\n"),
		);
		await write(
			"src/content.py",
			'"""\nprint("documentation")\nrequests.get("https://example.invalid")\n"""\n# open("x", "w")\n',
		);
		const graph = await analyzeProject(project);
		expect(graph.edges).toEqual([]);
		expect(graph.nodes.every((node) => node.boundary === "project")).toBe(true);
	});

	it("resolves relative source imports and Python modules across components", async () => {
		await write("src/api/main.ts", 'import { load } from "../store/index.js";\nload();\n');
		await write("src/store/index.ts", "export function load() { return 1; }\n");
		await write("api/worker.py", "from store.repository import load\nload()\n");
		await write("store/repository.py", "def load():\n    return 1\n");
		await write("apps/web/package.json", JSON.stringify({ name: "@fixture/web" }));
		await write("apps/web/src/index.ts", "export const app = {};\n");
		await write("apps/web/plugins/map/package.json", JSON.stringify({ name: "@fixture/map" }));
		await write("apps/web/plugins/map/src/index.ts", "export const plugin = {};\n");
		const graph = await analyzeProject(project);
		expect(graph.edges.filter((edge) => edge.kind === "dependency")).toHaveLength(2);
		expect(graph.edges.every((edge) => edge.kind === "dependency")).toBe(true);
		expect(graph.nodes.find((node) => node.label === "Web")?.files).toHaveLength(2);
	});

	it("bounds individual reads and identifies an empty or unsupported project honestly", async () => {
		await write("oversized.ts", " ".repeat(512 * 1024 + 1));
		await write("binary.ts", "\0fetch('https://example.invalid')");
		await write("README.md", "A project without supported application source.");
		const graph = await analyzeProject(project);
		expect(graph.project.fileCount).toBe(0);
		expect(graph.nodes).toEqual([]);
		expect(graph.edges).toEqual([]);
		expect(graph.warnings.join(" ")).toContain("Oversized");
		expect(graph.warnings.join(" ")).toContain("No supported application source");
	});

	it("keeps a bounded overview and stable identifiers when many components exist", async () => {
		for (let index = 0; index < 25; index++)
			await write(`src/component-${index}/index.ts`, `console.log(${index});\n`);
		const first = await analyzeProject(project);
		const second = await analyzeProject(project);
		expect(first.nodes.filter((node) => node.boundary === "project")).toHaveLength(18);
		expect(first.files).toHaveLength(25);
		expect(first.nodes.map((node) => node.id)).toEqual(second.nodes.map((node) => node.id));
		expect(first.edges).toEqual(second.edges);
		expect(first.warnings.join(" ")).toContain("Other");
	});

	it("limits evidence samples without losing occurrence counts and redacts common credential literals", async () => {
		await write(
			"src/client.ts",
			Array.from(
				{ length: 14 },
				(_, index) =>
					`const password${index ? "" : " "} = "fixture-secret"; fetch("https://example.invalid?token=fixture-token");`,
			).join("\n"),
		);
		const graph = await analyzeProject(project);
		const network = graph.edges.find((edge) => edge.kind === "network");
		expect(network?.count).toBe(14);
		expect(network?.evidence).toHaveLength(8);
		expect(JSON.stringify(network)).not.toContain("fixture-secret");
		expect(JSON.stringify(network)).not.toContain("fixture-token");
	});
});
