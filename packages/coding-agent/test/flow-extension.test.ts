import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	SessionShutdownEvent,
	SessionStartEvent,
} from "../src/core/extensions/types.ts";
import dataFlowExtension from "../src/extensions/data-flow/index.ts";
import { openFlowBrowser, startFlowServer } from "../src/flow/server.ts";
import { showProjectFlow } from "../src/flow/tui.ts";
import type { FlowGraph } from "../src/flow/types.ts";

vi.mock("../src/flow/server.ts", () => ({
	startFlowServer: vi.fn(),
	openFlowBrowser: vi.fn(),
}));
vi.mock("../src/flow/tui.ts", () => ({ showProjectFlow: vi.fn() }));

const graph: FlowGraph = {
	version: 1,
	project: {
		name: "fixture",
		root: "/fixture",
		scannedAt: "2026-01-01T00:00:00.000Z",
		gitBranch: "main",
		fileCount: 2,
		lineCount: 20,
		durationMs: 1,
		languages: ["TypeScript"],
	},
	nodes: [],
	edges: [],
	files: [],
	warnings: [],
};

function harness(flag = false) {
	type Event = SessionStartEvent | SessionShutdownEvent;
	const commands = new Map<string, Parameters<ExtensionAPI["registerCommand"]>[1]>();
	const handlers = new Map<string, (event: Event, ctx: ExtensionContext) => Promise<void>>();
	const api = {
		registerFlag: vi.fn(),
		getFlag: () => flag,
		registerCommand: (name: string, command: Parameters<ExtensionAPI["registerCommand"]>[1]) => {
			commands.set(name, command);
		},
		on: (event: string, handler: (event: Event, ctx: ExtensionContext) => Promise<void>) => {
			handlers.set(event, handler);
		},
	} as unknown as ExtensionAPI;
	// The extension uses only these context fields; missing agent APIs must never be called.
	const ctx = {
		cwd: "/fixture",
		mode: "tui",
		hasUI: true,
		ui: { notify: vi.fn(), setStatus: vi.fn() },
	} as unknown as ExtensionCommandContext;
	dataFlowExtension(api);
	return { api, ctx, commands, handlers };
}

describe("built-in project flow extension", () => {
	const close = vi.fn(async () => {});
	const rescan = vi.fn(async () => graph);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(startFlowServer).mockResolvedValue({
			url: "http://127.0.0.1:4319/fixture/",
			graph,
			close,
			rescan,
		});
		vi.mocked(openFlowBrowser).mockResolvedValue(true);
		vi.mocked(showProjectFlow).mockResolvedValue(undefined);
	});

	test("registration and normal session startup perform no scan or browser launch", async () => {
		const { api, ctx, handlers } = harness();
		expect(api.registerFlag).toHaveBeenCalledWith("flow", expect.objectContaining({ default: false }));
		await handlers.get("session_start")?.({ type: "session_start", reason: "startup" }, ctx);
		expect(startFlowServer).not.toHaveBeenCalled();
		expect(openFlowBrowser).not.toHaveBeenCalled();
		expect(showProjectFlow).not.toHaveBeenCalled();
	});

	test("/flow opens the native harness screen without starting a browser or HTTP server", async () => {
		const { ctx, commands } = harness();
		await commands.get("flow")?.handler("", ctx);
		expect(showProjectFlow).toHaveBeenCalledWith(ctx, expect.any(AbortSignal));
		expect(startFlowServer).not.toHaveBeenCalled();
		expect(openFlowBrowser).not.toHaveBeenCalled();
	});

	test("the command reuses the running project server, rescans, and closes on session shutdown", async () => {
		const { ctx, commands, handlers } = harness();
		await commands.get("flow")?.handler("web", ctx);
		await commands.get("flow")?.handler("web", ctx);
		expect(startFlowServer).toHaveBeenCalledExactlyOnceWith("/fixture");
		expect(rescan).toHaveBeenCalledOnce();
		expect(openFlowBrowser).toHaveBeenCalledTimes(2);
		await handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" }, ctx);
		expect(close).toHaveBeenCalledOnce();
	});

	test("--flow opens only an interactive TUI session, never RPC", async () => {
		const { ctx, handlers } = harness(true);
		ctx.mode = "rpc";
		await handlers.get("session_start")?.({ type: "session_start", reason: "startup" }, ctx);
		expect(showProjectFlow).not.toHaveBeenCalled();
		ctx.mode = "tui";
		await handlers.get("session_start")?.({ type: "session_start", reason: "startup" }, ctx);
		expect(showProjectFlow).toHaveBeenCalledWith(ctx, expect.any(AbortSignal));
		expect(startFlowServer).not.toHaveBeenCalled();
		await handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" }, ctx);
	});

	test("switching the launch directory closes the old server before opening the new project", async () => {
		const { ctx, commands } = harness();
		await commands.get("flow")?.handler("web", ctx);
		ctx.cwd = "/other-project";
		await commands.get("flow")?.handler("web", ctx);
		expect(close).toHaveBeenCalledOnce();
		expect(startFlowServer).toHaveBeenLastCalledWith("/other-project");
		await commands.get("flow")?.handler("close", ctx);
		expect(close).toHaveBeenCalledTimes(2);
	});

	test("a failed startup can be retried and the error is visible", async () => {
		const { ctx, commands } = harness();
		vi.mocked(startFlowServer).mockRejectedValueOnce(new Error("Directory is unreadable"));
		await commands.get("flow")?.handler("web", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith("Project flow: Directory is unreadable", "error");
		await commands.get("flow")?.handler("web", ctx);
		expect(openFlowBrowser).toHaveBeenCalledOnce();
		await commands.get("flow")?.handler("close", ctx);
	});

	test.each(["session shutdown", "/flow close"])(
		"does not restore status or announce a closed URL when %s occurs during browser launch",
		async (stop) => {
			const { ctx, commands, handlers } = harness();
			let finishOpen: ((opened: boolean) => void) | undefined;
			vi.mocked(openFlowBrowser).mockReturnValueOnce(
				new Promise<boolean>((resolve) => {
					finishOpen = resolve;
				}),
			);
			const opening = commands.get("flow")?.handler("web", ctx);
			await vi.waitFor(() => expect(openFlowBrowser).toHaveBeenCalledOnce());
			if (stop === "session shutdown") {
				await handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" }, ctx);
			} else {
				await commands.get("flow")?.handler("close", ctx);
			}
			expect(close).toHaveBeenCalledOnce();
			const statusCalls = vi.mocked(ctx.ui.setStatus).mock.calls.slice();
			const notifications = vi.mocked(ctx.ui.notify).mock.calls.slice();
			finishOpen?.(true);
			await opening;
			expect(vi.mocked(ctx.ui.setStatus).mock.calls).toEqual(statusCalls);
			expect(vi.mocked(ctx.ui.notify).mock.calls).toEqual(notifications);
		},
	);

	test("session shutdown aborts an open native screen", async () => {
		const { ctx, commands, handlers } = harness();
		vi.mocked(showProjectFlow).mockImplementationOnce(
			(_ctx, signal) =>
				new Promise<void>((resolve) => {
					signal?.addEventListener("abort", () => resolve(), { once: true });
				}),
		);
		const opening = commands.get("flow")?.handler("", ctx);
		await vi.waitFor(() => expect(showProjectFlow).toHaveBeenCalledOnce());
		await handlers.get("session_shutdown")?.({ type: "session_shutdown", reason: "quit" }, ctx);
		await opening;
		expect(vi.mocked(showProjectFlow).mock.calls[0][1]?.aborted).toBe(true);
	});
});
