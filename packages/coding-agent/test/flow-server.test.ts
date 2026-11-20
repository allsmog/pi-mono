import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type FlowServer, startFlowServer } from "../src/flow/server.ts";

const directories: string[] = [];
const servers: FlowServer[] = [];

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.close()));
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture(): Promise<{ directory: string; server: FlowServer }> {
	const directory = await mkdtemp(join(tmpdir(), "pi-flow-server-"));
	directories.push(directory);
	await writeFile(join(directory, "package.json"), JSON.stringify({ name: "flow-server-fixture" }));
	await writeFile(
		join(directory, "main.ts"),
		'import { readFileSync } from "node:fs";\nconsole.log(readFileSync("input.txt", "utf8"));\n',
	);
	const server = await startFlowServer(directory);
	servers.push(server);
	return { directory, server };
}

describe("project flow server", () => {
	it("serves a real project graph and a nonce-protected browser screen", async () => {
		const { server } = await fixture();
		const response = await fetch(server.url);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-security-policy")).toContain("script-src 'nonce-");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(await response.text()).toContain("api/graph");
		const graph = await fetch(new URL("api/graph", server.url)).then((result) => result.json());
		expect(graph.project.name).toBe("flow-server-fixture");
		expect(graph.files.some((file: { path: string }) => file.path === "main.ts")).toBe(true);
		expect(new URL(server.url).hostname).toBe("127.0.0.1");
	});

	it("rejects missing capabilities, cross-origin requests, and rebinding hosts", async () => {
		const { server } = await fixture();
		expect((await fetch(new URL("/api/graph", server.url))).status).toBe(404);
		expect(
			(await fetch(new URL("api/graph", server.url), { headers: { Origin: "https://unrelated.example" } })).status,
		).toBe(403);
		expect((await fetch(server.url, { headers: { "Sec-Fetch-Site": "cross-site" } })).status).toBe(403);
		const status = await new Promise<number | undefined>((resolve, reject) => {
			const req = request(server.url, { headers: { Host: "rebound.example" } }, (response) => {
				response.resume();
				resolve(response.statusCode);
			});
			req.once("error", reject);
			req.end();
		});
		expect(status).toBe(403);
	});

	it("only rescans with POST and refreshes from actual changed files", async () => {
		const { directory, server } = await fixture();
		const endpoint = new URL("api/rescan", server.url);
		expect((await fetch(endpoint)).status).toBe(405);
		expect((await fetch(endpoint, { method: "POST", body: "unexpected" })).status).toBe(400);
		await writeFile(join(directory, "network.ts"), 'export const get = () => fetch("https://example.com");\n');
		const response = await fetch(endpoint, { method: "POST" });
		expect(response.status).toBe(200);
		const graph = await response.json();
		expect(graph.files.some((file: { path: string }) => file.path === "network.ts")).toBe(true);
		expect(server.graph.project.fileCount).toBe(graph.project.fileCount);
	});

	it("does not expose arbitrary source paths or traversal routes", async () => {
		const { server } = await fixture();
		for (const path of ["package.json", "api/source?path=/etc/passwd", "../api/graph", "%2e%2e/%2e%2e/etc/passwd"]) {
			expect((await fetch(new URL(path, server.url))).status).toBe(404);
		}
	});

	it("coalesces concurrent scans and closes idempotently", async () => {
		const { server } = await fixture();
		const first = server.rescan();
		expect(server.rescan()).toBe(first);
		await first;
		await server.close();
		await server.close();
		await expect(server.rescan()).rejects.toThrow("closed");
	});

	it("rejects invalid ports and non-directory roots", async () => {
		await expect(startFlowServer(tmpdir(), { port: -1 })).rejects.toThrow("port");
		await expect(startFlowServer(tmpdir(), { port: 65536 })).rejects.toThrow("port");
		await expect(startFlowServer(tmpdir(), { port: 2.5 })).rejects.toThrow("port");
		const { directory } = await fixture();
		await expect(startFlowServer(join(directory, "package.json"))).rejects.toThrow("directory");
	});

	it("drains an in-progress scan before reporting that the server is closed", async () => {
		const { server } = await fixture();
		let scanFinished = false;
		const scan = server.rescan().finally(() => {
			scanFinished = true;
		});
		await server.close();
		expect(scanFinished).toBe(true);
		expect(await scan).toBe(server.graph);
	});
});
