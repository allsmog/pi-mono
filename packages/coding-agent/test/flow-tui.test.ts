import { KeybindingsManager, TUI_KEYBINDINGS, visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, test, vi } from "vitest";
import { ProjectFlowScreen, ProjectFlowView } from "../src/flow/tui.ts";
import type { FlowGraph } from "../src/flow/types.ts";

function graph(): FlowGraph {
	return {
		version: 1,
		project: {
			name: "Orders",
			root: "/project",
			gitBranch: "main",
			scannedAt: "2026-01-01",
			fileCount: 2,
			lineCount: 20,
			durationMs: 4,
			languages: ["JavaScript"],
		},
		nodes: [
			{
				id: "app",
				label: "Order service",
				kind: "entry",
				boundary: "project",
				description: "Validates and stores orders.",
				files: ["src/server.js"],
				technologies: ["JavaScript"],
			},
			{
				id: "store",
				label: "Storage",
				kind: "process",
				boundary: "project",
				description: "Persists order records.",
				files: ["src/storage.js"],
				technologies: ["JavaScript"],
			},
			{
				id: "clients",
				label: "HTTP clients",
				kind: "entry",
				boundary: "network",
				description: "Incoming requests.",
				files: [],
				technologies: ["HTTP"],
			},
		],
		edges: [
			{
				id: "input",
				source: "clients",
				target: "app",
				label: "Accepts requests",
				kind: "input",
				confidence: "inferred",
				count: 1,
				evidence: [{ file: "src/server.js", line: 12, text: "const server = createServer(handleRequest);" }],
			},
			{
				id: "import",
				source: "app",
				target: "store",
				label: "Imports module",
				kind: "dependency",
				confidence: "detected",
				count: 1,
				evidence: [{ file: "src/server.js", line: 2, text: "import { saveOrder } from './storage.js';" }],
			},
		],
		files: [],
		warnings: ["Static source patterns are not runtime traces."],
	};
}

function screen(
	options: {
		rows?: number;
		rescan?: () => Promise<FlowGraph>;
		graph?: FlowGraph;
		keybindings?: KeybindingsManager;
	} = {},
) {
	const done = vi.fn();
	const requestRender = vi.fn();
	const view = new ProjectFlowScreen({
		graph: options.graph ?? graph(),
		theme: { fg: (_color, text) => text, bold: (text) => text },
		keybindings: options.keybindings ?? new KeybindingsManager(TUI_KEYBINDINGS),
		getRows: () => options.rows ?? 40,
		requestRender,
		done,
		rescan: options.rescan ?? (async () => graph()),
	});
	return { view, done, requestRender };
}

describe("native project flow screen", () => {
	test.each([
		[120, 40],
		[80, 24],
		[45, 18],
	])("fits a %i-column, %i-row terminal and starts at the project overview", (width, rows) => {
		const { view } = screen({ rows });
		const lines = view.render(width);
		expect(lines).toHaveLength(rows);
		expect(lines.every((line) => visibleWidth(line) <= width)).toBe(true);
		expect(lines.join("\n")).toContain("PROJECT FLOW");
		expect(lines.join("\n")).toContain("PROJECT OVERVIEW");
		expect(lines.join("\n")).not.toContain("flowchart LR");
		if (width >= 80) {
			expect(lines.join("\n")).toContain("Order service");
			expect(lines.join("\n")).toContain("HTTP clients");
		} else {
			view.handleInput("\x1b[B");
			expect(view.render(width).join("\n")).toContain("Order service");
		}
	});

	test("enter opens connection evidence and escape returns to the harness", () => {
		const { view, done } = screen();
		view.handleInput("\r");
		const text = view.render(120).join("\n");
		expect(text).toContain("[ Connections ]");
		expect(text).toContain("HTTP clients → Order service");
		expect(text).toContain("src/server.js:12");
		expect(text).toContain("createServer(handleRequest)");
		view.handleInput("\x1b");
		expect(done).toHaveBeenCalledOnce();
	});

	test("the project overview is available above the focused component list", () => {
		const { view } = screen();
		view.handleInput("\x1b[B");
		view.handleInput("\x1b[A");
		const text = view.render(120).join("\n");
		expect(text).toContain("PROJECT OVERVIEW");
		expect(text).toContain("3 nodes · 1 visible relationships · 2 files");
		expect(text).toContain("Project overview");
	});

	test("CodeBoarding leaf relationships are aggregated for an expandable component overview", () => {
		const nested = graph();
		nested.analysis = {
			engine: "codeboarding",
			mode: "architecture",
			generatedAt: "2026-01-01",
			summary: "Architecture generated from source references.",
		};
		nested.nodes.push(
			{ ...nested.nodes[0], id: "handler", label: "Request handler", parentId: "app" },
			{ ...nested.nodes[1], id: "save", label: "Save order", parentId: "store" },
		);
		nested.edges = [{ ...nested.edges[0], source: "handler", target: "save", kind: "flow", label: "Passes order" }];
		const { view } = screen({ graph: nested });
		let text = view.render(150).join("\n");
		expect(text).toContain("CodeBoarding · architecture");
		expect(text).toContain("3 nodes · 1 visible relationships");
		expect(text).not.toContain("Request handler");
		view.handleInput("\x1b[B");
		view.handleInput("\r");
		text = view.render(150).join("\n");
		expect(text).toContain("Order service · OVERVIEW");
		expect(text).toContain("Request handler");
		view.handleInput("\r");
		expect(view.render(150).join("\n")).toContain("PROJECT OVERVIEW");
		view.handleInput("\t");
		text = view.render(150).join("\n");
		expect(text).toContain("Request handler → Save order");
		expect(text).toContain("SOURCE REFERENCES");
		expect(text).not.toContain("Source pattern;");
		expect(nested.edges[0].source).toBe("handler");
	});

	test("Actions can show dependencies and refresh the actual graph", async () => {
		const refreshed = graph();
		refreshed.project.fileCount = 3;
		const rescan = vi.fn(async () => refreshed);
		const { view } = screen({ rescan });
		view.handleInput("\t");
		view.handleInput("\t");
		view.handleInput("\x1b[B");
		view.handleInput("\r");
		expect(view.render(120).join("\n")).toContain("dependencies visible");
		view.handleInput("\x1b[A");
		view.handleInput("\r");
		await vi.waitFor(() => expect(view.render(120).join("\n")).toContain("Rescanned 3 files"));
		expect(rescan).toHaveBeenCalledOnce();
	});

	test("configured keys work without hardcoded Tab or Escape requirements", () => {
		const keybindings = new KeybindingsManager(TUI_KEYBINDINGS, {
			"tui.input.tab": "ctrl+t",
			"tui.select.cancel": "ctrl+q",
		});
		const { view, done } = screen({ keybindings });
		view.handleInput("\x14");
		expect(view.render(120).join("\n")).toContain("[ Connections ]");
		view.handleInput("\x11");
		expect(done).toHaveBeenCalledOnce();
	});

	test("rescan completion after closing cannot redraw a disposed screen", async () => {
		let finish: ((value: FlowGraph) => void) | undefined;
		const pending = new Promise<FlowGraph>((resolve) => {
			finish = resolve;
		});
		const { view, requestRender, done } = screen({ rescan: () => pending });
		view.handleInput("\t");
		view.handleInput("\t");
		view.handleInput("\r");
		view.handleInput("\x1b");
		const renders = requestRender.mock.calls.length;
		finish?.(graph());
		await pending;
		await Promise.resolve();
		expect(done).toHaveBeenCalledOnce();
		expect(requestRender).toHaveBeenCalledTimes(renders);
	});

	test("source strings cannot inject terminal control sequences", () => {
		const unsafe = graph();
		unsafe.edges[0].evidence[0].text = "readFile(path);\x1b]52;c;secret\x07";
		const { view } = screen({ graph: unsafe });
		view.handleInput("\r");
		const text = view.render(120).join("\n");
		expect(text).not.toContain("\x1b");
		expect(text).not.toContain("\x07");
		expect(text).toContain("readFile(path)");
	});
});

function analysisView(analyze: ConstructorParameters<typeof ProjectFlowView>[0]["analyze"]) {
	const done = vi.fn();
	const requestRender = vi.fn();
	const view = new ProjectFlowView({
		project: "/project",
		mode: "codeboarding",
		theme: { fg: (_color, text) => text, bold: (text) => text },
		keybindings: new KeybindingsManager(TUI_KEYBINDINGS),
		getRows: () => 30,
		requestRender,
		done,
		analyze,
	});
	return { view, done, requestRender };
}

describe("native project flow analysis lifecycle", () => {
	test("shows progress and aborts analysis when the user leaves, ignoring late completion", async () => {
		let finish: ((value: FlowGraph) => void) | undefined;
		const pending = new Promise<FlowGraph>((resolve) => {
			finish = resolve;
		});
		let signal: AbortSignal | undefined;
		const { view, done, requestRender } = analysisView((options) => {
			signal = options.signal;
			options.onProgress("Resolving source relationships…");
			return pending;
		});
		const loading = view.load();
		const lines = view.render(80);
		expect(lines).toHaveLength(30);
		expect(lines.every((line) => visibleWidth(line) <= 80)).toBe(true);
		expect(lines.join("\n")).toContain("Resolving source relationships");
		view.handleInput("\x1b");
		expect(signal?.aborted).toBe(true);
		expect(done).toHaveBeenCalledOnce();
		const renders = requestRender.mock.calls.length;
		finish?.(graph());
		await loading;
		expect(requestRender).toHaveBeenCalledTimes(renders);
	});

	test.each([
		"Install CodeBoarding to continue; /flow static uses its static engine.",
		"Invalid CodeBoarding v1 analysis: missing edges.",
	])("keeps an analysis error visible and retries fresh output: %s", async (message) => {
		const analyze = vi
			.fn<ConstructorParameters<typeof ProjectFlowView>[0]["analyze"]>()
			.mockRejectedValueOnce(new Error(message))
			.mockResolvedValueOnce(graph());
		const { view } = analysisView(analyze);
		await view.load();
		expect(view.render(100).join("\n")).toContain(message);
		expect(analyze).toHaveBeenCalledTimes(1);
		expect(analyze.mock.calls[0][0].refresh).toBe(false);
		view.handleInput("\r");
		await vi.waitFor(() => expect(view.render(100).join("\n")).toContain("PROJECT OVERVIEW"));
		expect(analyze).toHaveBeenCalledTimes(2);
		expect(analyze.mock.calls[1][0].refresh).toBe(true);
		view.close();
	});

	test("rescan requests fresh analysis and aborts the same lifecycle on close", async () => {
		const analyze = vi.fn<ConstructorParameters<typeof ProjectFlowView>[0]["analyze"]>().mockResolvedValue(graph());
		const { view } = analysisView(analyze);
		await view.load();
		view.handleInput("\t");
		view.handleInput("\t");
		view.handleInput("\r");
		await vi.waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
		expect(analyze.mock.calls[0][0].refresh).toBe(false);
		expect(analyze.mock.calls[1][0].refresh).toBe(true);
		view.close();
		expect(analyze.mock.calls[1][0].signal.aborted).toBe(true);
	});
});
