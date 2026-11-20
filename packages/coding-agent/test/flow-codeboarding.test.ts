import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { importCodeboardingAnalysis, loadCodeboardingAnalysis } from "../src/flow/codeboarding.ts";

type MethodRow = [number, number, string, string, string];
type EdgeRow = [string, string, [number, number][]];
interface Component {
	name: string;
	component_id: string;
	description: string;
	key_entities: {
		qualified_name: string;
		reference_file: string;
		reference_start_line: number;
		reference_end_line: number;
	}[];
	source_cluster_ids: string[];
	can_expand: boolean;
	file_methods: string[] | null;
	components: Component[];
	components_relations: ReturnType<typeof relation>[];
}

function component(id: string, symbols: string[], children: Component[] = []): Component {
	return {
		name: id,
		component_id: id,
		description: `The ${id} component.`,
		key_entities: [],
		source_cluster_ids: [],
		can_expand: children.length > 0,
		file_methods: children.length ? null : symbols,
		components: children,
		components_relations: [],
	};
}

function relation(source: string, target: string, keys: [string, string][] = []) {
	return {
		relation: "calls",
		src_name: source,
		dst_name: target,
		evidence: "Static method edge.",
		src_id: source,
		dst_id: target,
		is_static: true,
		key_edges: keys,
	};
}

// The tuple layouts and scope membership match CodeBoarding v0.15.6's
// diagram_analysis/analysis_json.py, including root relations between leaves.
function analysis() {
	const server = component("server", [], [component("request", ["handle"]), component("router", ["route"])]);
	server.components_relations = [relation("request", "router", [["handle", "route"]])];
	server.key_entities = [
		{
			qualified_name: "app.Handle",
			reference_file: "router.go",
			reference_start_line: 3,
			reference_end_line: 5,
		},
	];
	const files: Record<string, { content_hash: string; module_hash: string; methods: Record<string, MethodRow> }> = {
		"router.go": { content_hash: "", module_hash: "", methods: { "app.Handle": [3, 5, "function", "", "handle"] } },
		"tree.go": { content_hash: "", module_hash: "", methods: { "app.Route": [3, 5, "function", "", "route"] } },
		"store.go": { content_hash: "", module_hash: "", methods: { "app.Persist": [3, 5, "function", "", "persist"] } },
	};
	return {
		metadata: {
			format_version: "v1",
			generated_at: "2026-11-20T10:00:00+00:00",
			source_tree_hash: "",
			repo_name: "analysis-target",
			depth_level: 2,
			depth_cap: 2,
			file_coverage_summary: { total_files: 3, analyzed: 3, not_analyzed: 0, not_analyzed_by_reason: {} },
			tree_spec: {},
		},
		description: "A source-backed call graph.",
		files,
		components: [server, component("store", ["persist"])],
		components_relations: [
			relation("request", "router", [["handle", "route"]]),
			relation("router", "store", [["route", "persist"]]),
		],
		edges: [
			["handle", "route", [[4, 11]]],
			["route", "persist", [[4, 11]]],
		] as EdgeRow[],
	};
}

describe("CodeBoarding analysis import", () => {
	let project: string;
	const directories: string[] = [];

	beforeEach(async () => {
		project = await mkdtemp(join(tmpdir(), "pi-codeboarding-test-"));
		directories.push(project);
		await write("router.go", "package app\n\nfunc Handle() string {\n    return Route()\n}\n");
		await write("tree.go", "package app\n\nfunc Route() string {\n    return Persist()\n}\n");
		await write("store.go", 'package app\n\nfunc Persist() string {\n    return "ok"\n}\n');
	});

	afterEach(async () => {
		for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
	});

	async function write(path: string, content: string | Uint8Array): Promise<void> {
		await mkdir(dirname(join(project, path)), { recursive: true });
		await writeFile(join(project, path), content);
	}

	it("retains the genuine hierarchy, leaf relations, scoped relations and Go call-site evidence", async () => {
		const graph = await importCodeboardingAnalysis(project, analysis(), { mode: "static" });
		expect(graph.analysis).toMatchObject({
			engine: "codeboarding",
			mode: "static",
			summary: "A source-backed call graph.",
		});
		expect(graph.project).toMatchObject({ root: project, fileCount: 3, lineCount: 15, languages: ["Go"] });
		expect(graph.nodes.map((node) => [node.id, node.parentId])).toEqual([
			["server", undefined],
			["request", "server"],
			["router", "server"],
			["store", undefined],
		]);
		expect(graph.nodes[0].files).toEqual(["router.go", "tree.go"]);
		expect(graph.nodes[0].references).toContainEqual(
			expect.objectContaining({ file: "router.go", line: 3, endLine: 5, kind: "reference" }),
		);
		expect(graph.nodes[1].references).toContainEqual(
			expect.objectContaining({ file: "router.go", line: 3, endLine: 5, kind: "definition" }),
		);
		expect(graph.files.find((file) => file.path === "router.go")?.componentId).toBe("request");
		expect(graph.edges).toHaveLength(3);
		const requestCalls = graph.edges.filter((edge) => edge.source === "request" && edge.target === "router");
		expect(requestCalls).toHaveLength(2);
		for (const edge of requestCalls) {
			expect(edge).toMatchObject({ kind: "call", confidence: "detected", count: 1 });
			expect(edge.evidence).toEqual([
				{ file: "router.go", line: 4, kind: "call", text: "app.Handle → app.Route: return Route()" },
			]);
		}
		expect(graph.warnings.join(" ")).toContain("not runtime traces");
	});

	it("keeps inferred relationships without inventing source evidence or occurrence counts", async () => {
		const document = analysis();
		document.components_relations.push({
			...relation("store", "request"),
			is_static: false,
			relation: "returns result",
			evidence: "Architectural inference.",
		});
		const graph = await importCodeboardingAnalysis(project, document);
		expect(graph.analysis?.mode).toBe("architecture");
		expect(graph.edges.find((edge) => edge.source === "store")).toMatchObject({
			kind: "flow",
			confidence: "inferred",
			count: 0,
			evidence: [],
			description: "Architectural inference.",
		});
		expect(graph.warnings.join(" ")).toContain("no verified local call-site evidence");
	});

	it("does not promote an unsupported static label into a detected call", async () => {
		const document = analysis();
		document.components_relations.push(relation("store", "request"));
		const graph = await importCodeboardingAnalysis(project, document);
		expect(graph.edges.find((edge) => edge.source === "store")).toMatchObject({
			kind: "flow",
			confidence: "inferred",
			count: 0,
		});
	});

	it("marks definitions honestly when upstream has no call-site position", async () => {
		const document = analysis();
		document.edges[0][2] = [];
		const graph = await importCodeboardingAnalysis(project, document);
		expect(graph.edges[0].evidence).toEqual([
			{ file: "router.go", line: 3, endLine: 5, kind: "definition", text: "app.Handle: func Handle() string {" },
		]);
	});

	it("bounds evidence samples while preserving full occurrence counts", async () => {
		await write("router.go", "Route()\n".repeat(30));
		const document = analysis();
		document.edges[0][2] = Array.from({ length: 60 }, (_, index) => [Math.floor(index / 2) + 1, 0]);
		const graph = await importCodeboardingAnalysis(project, document);
		expect(graph.edges[0].count).toBe(60);
		expect(graph.edges[0].evidence).toHaveLength(24);
		expect(new Set(graph.edges[0].evidence.map((item) => item.line)).size).toBe(24);
	});

	it("checks upstream content hashes before showing source snippets", async () => {
		const document = analysis();
		const original = "package app\n\nfunc Handle() string {\n    return Route()\n}";
		document.files["router.go"].content_hash = createHash("sha256").update(original).digest("hex").slice(0, 16);
		await write("router.go", `${original.replace(/\n/g, "\r\n")}\r\n`);
		const fresh = await importCodeboardingAnalysis(project, document);
		expect(fresh.edges[0].evidence).toHaveLength(1);
		await write("router.go", `${original.replace("return Route()", "return Different()")}\n`);
		const stale = await importCodeboardingAnalysis(project, document);
		expect(stale.nodes[0].references).toEqual([]);
		expect(stale.edges[0].evidence).toEqual([]);
		expect(stale.warnings.join(" ")).toContain("changed since this CodeBoarding analysis");
	});

	it("loads a disk artifact and records its source path", async () => {
		await write(".codeboarding/analysis.json", JSON.stringify(analysis()));
		const graph = await loadCodeboardingAnalysis(project, undefined, { mode: "static" });
		expect(graph.analysis?.sourcePath).toBe(join(project, ".codeboarding", "analysis.json"));
		expect(graph.analysis?.mode).toBe("static");
		await write(".codeboarding/analysis.json", "{ invalid");
		await expect(loadCodeboardingAnalysis(project)).rejects.toThrow("not valid JSON");
	});

	it.skipIf(process.platform === "win32")("rejects a pipe artifact without waiting for a writer", async () => {
		const path = join(project, "analysis.pipe");
		await promisify(execFile)("mkfifo", [path]);
		await expect(loadCodeboardingAnalysis(project, path)).rejects.toThrow("regular UTF-8 JSON file");
	});

	it("rejects unexpected document versions and malformed external data", async () => {
		await expect(importCodeboardingAnalysis(project, null)).rejects.toThrow("Invalid CodeBoarding v1 analysis");
		await expect(
			importCodeboardingAnalysis(project, { ...analysis(), metadata: { format_version: "v2" } }),
		).rejects.toThrow("Invalid CodeBoarding v1 analysis");
		await expect(
			importCodeboardingAnalysis(project, { ...analysis(), edges: [["handle", "route", [["4", 1]]]] }),
		).rejects.toThrow("Invalid CodeBoarding v1 analysis");
		const invalidComponent = analysis();
		invalidComponent.components[0].name = "x".repeat(16385);
		await expect(importCodeboardingAnalysis(project, invalidComponent)).rejects.toThrow(
			"Invalid CodeBoarding component",
		);
		invalidComponent.components[0].name = "server";
		invalidComponent.components[0].component_id = "server\u001b[2J";
		await expect(importCodeboardingAnalysis(project, invalidComponent)).rejects.toThrow(
			"Invalid CodeBoarding component",
		);
	});

	it("rejects inconsistent component and symbol ownership", async () => {
		const duplicateComponent = analysis();
		duplicateComponent.components[0].components[0].component_id = "server";
		await expect(importCodeboardingAnalysis(project, duplicateComponent)).rejects.toThrow("repeats component ID");
		const duplicateMethod = analysis();
		duplicateMethod.files["tree.go"].methods["app.Route"][4] = "handle";
		await expect(importCodeboardingAnalysis(project, duplicateMethod)).rejects.toThrow("repeats method ID");
		const duplicateOwner = analysis();
		duplicateOwner.components[1].file_methods = ["persist", "handle"];
		await expect(importCodeboardingAnalysis(project, duplicateOwner)).rejects.toThrow("multiple leaf components");
		const parentMembership = analysis();
		parentMembership.components[0].file_methods = ["handle"];
		await expect(importCodeboardingAnalysis(project, parentMembership)).rejects.toThrow(
			"contains leaf method membership",
		);
		const unknownMethod = analysis();
		unknownMethod.components[1].file_methods = ["unknown"];
		await expect(importCodeboardingAnalysis(project, unknownMethod)).rejects.toThrow("unknown method");
	});

	it("rejects broken edge citations and key edges belonging to other component pairs", async () => {
		const unknownMethod = analysis();
		unknownMethod.edges[0][0] = "missing";
		await expect(importCodeboardingAnalysis(project, unknownMethod)).rejects.toThrow("edge cites an unknown method");
		const duplicateEdge = analysis();
		duplicateEdge.edges.push(duplicateEdge.edges[0]);
		await expect(importCodeboardingAnalysis(project, duplicateEdge)).rejects.toThrow("repeats a method edge");
		const unknownComponent = analysis();
		unknownComponent.components_relations[0].src_id = "missing";
		await expect(importCodeboardingAnalysis(project, unknownComponent)).rejects.toThrow("unknown component");
		const unknownKey = analysis();
		unknownKey.components_relations[0].key_edges = [["persist", "handle"]];
		await expect(importCodeboardingAnalysis(project, unknownKey)).rejects.toThrow("unknown key edge");
		const wrongPair = analysis();
		wrongPair.components_relations[0].key_edges = [["route", "persist"]];
		await expect(importCodeboardingAnalysis(project, wrongPair)).rejects.toThrow("outside its component pair");
	});

	it("bounds component depth and rejects recursive component objects", async () => {
		const document = analysis();
		let nested = component("leaf", []);
		for (let index = 0; index < 35; index++) nested = component(`level-${index}`, [], [nested]);
		document.components = [nested];
		await expect(importCodeboardingAnalysis(project, document)).rejects.toThrow("nesting exceeds 32 levels");
		const recursive = component("recursive", []);
		recursive.components.push(recursive);
		document.components = [recursive];
		await expect(importCodeboardingAnalysis(project, document)).rejects.toThrow("repeats component ID");
	});

	it("omits traversal, outside paths, symlink escapes and secret-named files", async () => {
		const outside = await mkdtemp(join(tmpdir(), "pi-codeboarding-outside-"));
		directories.push(outside);
		await writeFile(join(outside, "private.go"), "OUTSIDE_CONTENT_MUST_NOT_APPEAR\n");
		await symlink(join(outside, "private.go"), join(project, "linked.go"));
		await symlink(outside, join(project, "linked-directory"), "dir");
		await write(".env.go", "SECRET_CONTENT_MUST_NOT_APPEAR\n");
		await write("secrets/private.go", "SECRET_CONTENT_MUST_NOT_APPEAR\n");
		await write(".git/private.go", "SECRET_CONTENT_MUST_NOT_APPEAR\n");
		const document = analysis();
		const paths = [
			relative(project, join(outside, "private.go")),
			join(outside, "private.go"),
			"linked.go",
			"linked-directory/private.go",
			".env.go",
			"secrets/private.go",
			".git/private.go",
		];
		for (const [index, path] of paths.entries()) {
			const symbol = `excluded-${index}`;
			document.files[path] = {
				content_hash: "",
				module_hash: "",
				methods: { [symbol]: [1, 1, "function", "", symbol] },
			};
			document.components.push(component(symbol, [symbol]));
		}
		const graph = await importCodeboardingAnalysis(project, document);
		expect(graph.files.map((file) => file.path)).toEqual(["router.go", "tree.go", "store.go"]);
		expect(JSON.stringify(graph)).not.toContain("CONTENT_MUST_NOT_APPEAR");
		expect(graph.nodes.slice(4).every((node) => node.files.length === 0 && node.references?.length === 0)).toBe(true);
		expect(graph.warnings.join(" ")).toContain("out-of-project source references were omitted");
	});

	it("bounds source reads, skips binary data and labels missing evidence", async () => {
		await write("router.go", " ".repeat(512 * 1024 + 1));
		await write("tree.go", new Uint8Array([0, 1, 2]));
		const graph = await importCodeboardingAnalysis(project, analysis());
		expect(graph.files.map((file) => file.path)).toEqual(["store.go"]);
		expect(graph.edges.every((edge) => edge.evidence.length === 0)).toBe(true);
		expect(graph.warnings.join(" ")).toContain("files over 512 KiB");
	});

	it("redacts common credentials and removes terminal controls in imported text", async () => {
		await write(
			"router.go",
			'package app\n\nfunc Handle() string {\n    password = "test-secret"; Route("https://example.invalid?token=test-token")\n}\n',
		);
		const document = analysis();
		document.components[0].name = "Server\u001b[2J\u0007";
		document.description = 'Architecture\u0007 api_key="model-secret"';
		const graph = await importCodeboardingAnalysis(project, document);
		const serialized = JSON.stringify(graph);
		expect(serialized).not.toContain("test-secret");
		expect(serialized).not.toContain("test-token");
		expect(serialized).not.toContain("model-secret");
		expect(serialized).not.toContain("\\u001b");
		expect(serialized).not.toContain("\\u0007");
		expect(serialized).toContain("[redacted]");
	});
});
