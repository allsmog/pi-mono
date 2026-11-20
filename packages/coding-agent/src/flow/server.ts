/** Loopback-only project diagram server; it never executes or modifies the scanned project. */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { realpath, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { analyzeProject } from "./analyzer.ts";
import type { FlowGraph } from "./types.ts";
import { renderFlowPage } from "./view.ts";

export interface FlowServer {
	url: string;
	readonly graph: FlowGraph;
	rescan(): Promise<FlowGraph>;
	close(): Promise<void>;
}

/** Analyze a directory and expose its diagram only through an unguessable loopback URL. */
export async function startFlowServer(root: string, options: { port?: number } = {}): Promise<FlowServer> {
	const port = options.port ?? 0;
	if (!Number.isInteger(port) || port < 0 || port > 65535) {
		throw new Error("Flow port must be an integer between 0 and 65535.");
	}
	const directory = await realpath(root);
	if (!(await stat(directory)).isDirectory()) throw new Error("Flow requires a project directory.");
	let graph = await analyzeProject(directory);
	const basePath = `/${randomBytes(24).toString("hex")}/`;
	let origin = "";
	let authority = "";
	let pending: Promise<FlowGraph> | undefined;
	let closing: Promise<void> | undefined;

	const rescan = (): Promise<FlowGraph> => {
		if (closing) return Promise.reject(new Error("The project flow server is closed."));
		pending ??= analyzeProject(directory)
			.then((next) => {
				graph = next;
				return graph;
			})
			.finally(() => {
				pending = undefined;
			});
		return pending;
	};

	const handle = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
		response.setHeader("Cache-Control", "no-store");
		response.setHeader("X-Content-Type-Options", "nosniff");
		response.setHeader("Referrer-Policy", "no-referrer");
		response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
		// The Host and Origin checks prevent other websites from using this source-code reader.
		if (
			request.headers.host !== authority ||
			(request.headers.origin && request.headers.origin !== origin) ||
			request.headers["sec-fetch-site"] === "cross-site"
		) {
			sendJson(response, 403, { error: "This project view is available only from its local URL." });
			return;
		}
		const pathname = new URL(request.url ?? "/", origin).pathname;
		if (!pathname.startsWith(basePath)) {
			sendJson(response, 404, { error: "Project view not found." });
			return;
		}
		const route = pathname.slice(basePath.length);
		if (request.method === "GET" || request.method === "HEAD") {
			if (route === "") {
				const nonce = randomBytes(18).toString("base64");
				response.setHeader(
					"Content-Security-Policy",
					`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
				);
				response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
				response.end(request.method === "HEAD" ? undefined : renderFlowPage(nonce));
				return;
			}
			if (route === "api/graph") {
				response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
				response.end(request.method === "HEAD" ? undefined : JSON.stringify(graph));
				return;
			}
		} else if (request.method === "POST" && route === "api/rescan") {
			if (request.headers["transfer-encoding"] || Number(request.headers["content-length"] ?? 0) > 0) {
				sendJson(response, 400, { error: "Rescan does not accept a request body." });
				return;
			}
			sendJson(response, 200, await rescan());
			return;
		}
		if (["", "api/graph", "api/rescan"].includes(route)) {
			response.setHeader("Allow", route === "api/rescan" ? "POST" : "GET, HEAD");
			sendJson(response, 405, { error: "Method not allowed." });
			return;
		}
		sendJson(response, 404, { error: "Project view not found." });
	};

	const server = createServer((request, response) => {
		void handle(request, response).catch((error: unknown) => {
			if (!response.headersSent) {
				sendJson(response, 500, { error: error instanceof Error ? error.message : "Project analysis failed." });
			} else {
				response.end();
			}
		});
	});
	server.requestTimeout = 15_000;
	server.headersTimeout = 10_000;
	server.keepAliveTimeout = 2_000;
	await new Promise<void>((resolve, reject) => {
		server.once("error", reject);
		server.listen(port, "127.0.0.1", () => {
			server.off("error", reject);
			resolve();
		});
	});
	const address = server.address();
	if (!address || typeof address === "string") {
		server.close();
		throw new Error("Could not determine the local flow server port.");
	}
	authority = `127.0.0.1:${address.port}`;
	origin = `http://${authority}`;
	return {
		url: `${origin}${basePath}`,
		get graph() {
			return graph;
		},
		rescan,
		close() {
			if (!closing) {
				const activeScan = pending;
				closing = new Promise<void>((resolve, reject) => {
					server.close((error) => (error ? reject(error) : resolve()));
					server.closeAllConnections();
				}).then(async () => {
					// The scanner cannot be cancelled; closing drains its current bounded read before returning.
					await activeScan?.catch(() => undefined);
				});
			}
			return closing;
		},
	};
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
	response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
	response.end(JSON.stringify(value));
}

/** Open the view without a shell; callers retain the URL if no browser is available. */
export async function openFlowBrowser(url: string): Promise<boolean> {
	const [command, args]: [string, string[]] =
		process.platform === "darwin"
			? ["open", [url]]
			: process.platform === "win32"
				? ["rundll32", ["url.dll,FileProtocolHandler", url]]
				: ["xdg-open", [url]];
	return new Promise((resolve) => {
		const child = spawn(command, args, { stdio: "ignore", detached: true, cwd: "/" });
		const timeout = setTimeout(() => {
			child.unref();
			resolve(true);
		}, 2_000);
		timeout.unref();
		child.once("error", () => {
			clearTimeout(timeout);
			resolve(false);
		});
		child.once("exit", (code) => {
			clearTimeout(timeout);
			resolve(code === 0);
		});
	});
}
