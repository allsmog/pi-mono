#!/usr/bin/env node
import { setupCli } from "./cli/setup.ts";
import { runFlowCli } from "./flow/cli.ts";
import { main } from "./main.ts";

setupCli();
const args = process.argv.slice(2);
if (args[0] === "flow") {
	runFlowCli(args.slice(1)).catch((error: unknown) => {
		console.error(`Project flow: ${error instanceof Error ? error.message : String(error)}`);
		process.exitCode = 1;
	});
} else {
	main(args);
}
