import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { parseFlowArgs, runFlowCli } from "../src/flow/cli.ts";
import { openFlowBrowser, startFlowServer } from "../src/flow/server.ts";
import type { FlowGraph } from "../src/flow/types.ts";

vi.mock("../src/flow/server.ts", () => ({
	startFlowServer: vi.fn(),
	openFlowBrowser: vi.fn(),
}));

const graph: FlowGraph = {
	version: 1,
	project: {
		name: "fixture",
		root: "/fixture",
		scannedAt: "2026-01-01T00:00:00.000Z",
		gitBranch: "main",
		fileCount: 1,
		lineCount: 10,
		durationMs: 1,
		languages: ["TypeScript"],
	},
	nodes: [],
	edges: [],
	files: [],
	warnings: [],
};

describe("project flow CLI", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("defaults to the launch directory with an automatically allocated port", () => {
		expect(parseFlowArgs([])).toEqual({ port: 0, open: true, help: false });
		expect(parseFlowArgs(["--no-open", "--port", "4319"])).toEqual({ port: 4319, open: false, help: false });
		expect(parseFlowArgs(["--port=0", "-h"])).toEqual({ port: 0, open: true, help: true });
	});

	test.each([undefined, "-1", "65536", "1.2", "abc", "--no-open", ""])(
		"rejects invalid or missing port %j before starting the server",
		(value) => {
			expect(() => parseFlowArgs(value === undefined ? ["--port"] : ["--port", value])).toThrow(
				"--port requires an integer",
			);
			expect(startFlowServer).not.toHaveBeenCalled();
		},
	);

	test.each(["--host=0.0.0.0", "/another/project", "--unknown"])("rejects unknown argument %s", (arg) => {
		expect(() => parseFlowArgs([arg])).toThrow("Unknown flow argument");
	});

	test("help does not scan or open anything", async () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		await runFlowCli(["--help"]);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Usage: pi flow"));
		expect(startFlowServer).not.toHaveBeenCalled();
		expect(openFlowBrowser).not.toHaveBeenCalled();
	});

	test("starts from cwd, honors --no-open, and closes on termination", async () => {
		const close = vi.fn(async () => {});
		vi.mocked(startFlowServer).mockResolvedValue({
			url: "http://127.0.0.1:4319/fixture/",
			graph,
			rescan: async () => graph,
			close,
		});
		vi.spyOn(console, "log").mockImplementation(() => {});
		const previous = new Set(process.listeners("SIGTERM"));
		await runFlowCli(["--no-open", "--port", "4319"]);
		expect(startFlowServer).toHaveBeenCalledWith(process.cwd(), { port: 4319 });
		expect(openFlowBrowser).not.toHaveBeenCalled();
		const stop = process.listeners("SIGTERM").find((listener) => !previous.has(listener));
		expect(stop).toBeDefined();
		stop?.("SIGTERM");
		await Promise.resolve();
		expect(close).toHaveBeenCalledOnce();
		expect(process.listeners("SIGTERM")).not.toContain(stop);
	});
});
