/** Built-in project flow command; resources start only after a session begins. */
import type { ExtensionAPI, ExtensionContext } from "../../core/extensions/types.ts";
import { openFlowBrowser, startFlowServer } from "../../flow/server.ts";

type FlowServer = Awaited<ReturnType<typeof startFlowServer>>;

export default function dataFlowExtension(pi: ExtensionAPI): void {
	let running: Promise<FlowServer> | undefined;
	let runningRoot: string | undefined;
	let lifecycle = 0;

	const close = async (): Promise<void> => {
		lifecycle++;
		const pending = running;
		running = undefined;
		runningRoot = undefined;
		// A failed startup has already been reported by the command that initiated it.
		const server = await pending?.catch(() => undefined);
		await server?.close();
	};

	const open = async (ctx: ExtensionContext): Promise<void> => {
		if (ctx.mode !== "tui") {
			ctx.ui.notify("Use /flow in interactive mode, or run pi flow from a terminal.", "warning");
			return;
		}
		try {
			if (running && runningRoot !== ctx.cwd) await close();
			const generation = lifecycle;
			const rescan = running !== undefined;
			if (!running) {
				runningRoot = ctx.cwd;
				running = startFlowServer(ctx.cwd);
			}
			const server = await running;
			if (generation !== lifecycle) return;
			const graph = rescan ? await server.rescan() : server.graph;
			if (generation !== lifecycle) return;
			const opened = await openFlowBrowser(server.url);
			if (generation !== lifecycle) return;
			ctx.ui.setStatus("project-flow", `Flow: ${graph.project.fileCount} files`);
			ctx.ui.notify(`${opened ? "Project flow" : "Open project flow"}: ${server.url}`, "info");
		} catch (error) {
			await close();
			ctx.ui.notify(`Project flow: ${error instanceof Error ? error.message : String(error)}`, "error");
		}
	};

	pi.registerFlag("flow", {
		description: "Open this project's data-flow screen when the interactive session starts",
		type: "boolean",
		default: false,
	});
	pi.registerCommand("flow", {
		description: "Open or refresh this project's data-flow screen (/flow close to stop)",
		handler: async (args, ctx) => {
			if (args.trim() === "close") {
				await close();
				ctx.ui.setStatus("project-flow", undefined);
				ctx.ui.notify("Project flow closed.", "info");
			} else if (args.trim()) {
				ctx.ui.notify("Usage: /flow or /flow close", "warning");
			} else {
				await open(ctx);
			}
		},
	});
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode === "tui" && pi.getFlag("flow") === true) await open(ctx);
	});
	pi.on("session_shutdown", async () => close());
}
