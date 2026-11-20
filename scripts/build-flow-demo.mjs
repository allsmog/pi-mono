#!/usr/bin/env node
// Build the hosted example screen from the same analyzer and renderer used by Pi.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeProject } from "../packages/coding-agent/src/flow/analyzer.ts";
import { renderFlowPage } from "../packages/coding-agent/src/flow/view.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(process.argv[2] ?? join(repositoryRoot, "dist", "flow-demo"));
const examples = [
	{ id: "orders", label: "Order processing", directory: "examples/flow-orders" },
	{ id: "pi", label: "Pi coding agent", directory: "packages/coding-agent" },
];
await mkdir(join(destination, "examples"), { recursive: true });
const summaries = [];
for (const example of examples) {
	const graph = await analyzeProject(join(repositoryRoot, example.directory));
	// Hosted snapshots show a portable source location, never the builder's machine path.
	graph.project.root = example.directory;
	await writeFile(join(destination, "examples", `${example.id}.json`), `${JSON.stringify(graph, null, 2)}\n`);
	summaries.push({
		example: example.label,
		files: graph.project.fileCount,
		nodes: graph.nodes.length,
		relationships: graph.edges.length,
		commit: graph.project.gitCommit,
	});
}
await writeFile(
	join(destination, "index.html"),
	renderFlowPage("pi-flow-hosted-example", {
		hosted: true,
		examples: examples.map(({ id, label }) => ({ id, label, url: `./examples/${id}.json` })),
	}),
);
await writeFile(join(destination, "provenance.json"), `${JSON.stringify({
	upstream: "https://github.com/earendil-works/pi",
	fork: "https://github.com/allsmog/pi-mono/tree/flow/project-data-flow",
	generatedAt: new Date().toISOString(),
	analysis: "Static source scan, not a runtime trace. Use pi flow locally for a fresh scan of your own project.",
	examples: summaries,
}, null, 2)}\n`);
console.log(JSON.stringify({ destination, examples: summaries }));
