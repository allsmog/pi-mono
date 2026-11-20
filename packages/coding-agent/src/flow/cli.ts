/** Launches the project flow screen without creating a model or agent session. */
import { openFlowBrowser, startFlowServer } from "./server.ts";

export interface FlowCliOptions {
	port: number;
	open: boolean;
	help: boolean;
}

/** Validate command-line arguments before scanning files or starting a server. */
export function parseFlowArgs(args: string[]): FlowCliOptions {
	const options: FlowCliOptions = { port: 0, open: true, help: false };
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--no-open") options.open = false;
		else if (arg === "--help" || arg === "-h") options.help = true;
		else if (arg === "--port" || arg.startsWith("--port=")) {
			const value = arg === "--port" ? args[++i] : arg.slice("--port=".length);
			if (value === undefined || !/^\d+$/.test(value) || Number(value) > 65535) {
				throw new Error("--port requires an integer from 0 to 65535 (0 selects an available port).");
			}
			options.port = Number(value);
		} else {
			throw new Error(`Unknown flow argument ${JSON.stringify(arg)}. Use "pi flow --help".`);
		}
	}
	return options;
}

/** Serve the launch directory until the user stops the process. */
export async function runFlowCli(args: string[]): Promise<void> {
	const options = parseFlowArgs(args);
	if (options.help) {
		console.log(`Usage: pi flow [--port N] [--no-open]

Analyze the current directory and open its project data-flow screen.
No model, API key, or project execution is needed.

  --port N     Listen on loopback port N (default: an available port)
  --no-open    Print the URL without launching a browser
  --help, -h   Show this help

Inside an interactive Pi session, use /flow or start Pi with --flow.`);
		return;
	}

	const server = await startFlowServer(process.cwd(), { port: options.port });
	let stopping = false;
	const stop = (): void => {
		if (stopping) return;
		stopping = true;
		process.off("SIGINT", stop);
		process.off("SIGTERM", stop);
		void server.close().catch((error: unknown) => {
			console.error(`Could not close project flow: ${error instanceof Error ? error.message : String(error)}`);
			process.exitCode = 1;
		});
	};
	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);

	const { project, nodes, edges } = server.graph;
	console.log(`Pi project flow — ${project.name}`);
	console.log(`Directory: ${project.root}`);
	console.log(`${project.fileCount} source files · ${nodes.length} components · ${edges.length} relationships`);
	console.log(`Screen: ${server.url}`);
	console.log("Static source analysis; relationships are not runtime traces. Press Ctrl+C to stop.");
	if (options.open && !(await openFlowBrowser(server.url))) {
		console.log("Open the Screen URL in your browser.");
	}
}
