import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "./http/routes.js";

export function createOrderServer() {
  const server = createServer((request, response) => {
    void handleRequest(request, response);
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 5_000;
  server.maxConnections = 128;
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? "4318");
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT must be an integer from 0 to 65535.");
  }
  const server = createOrderServer();
  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    console.log(`Orders example: http://127.0.0.1:${address.port}`);
    console.log("GET /orders · POST /orders · Ctrl+C to stop");
  });
  const stop = () => {
    server.close();
    server.closeIdleConnections();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
