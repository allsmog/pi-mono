// A single-owner web console for the real Pi TUI, using a POSIX PTY instead of emulated command output.
import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WebSocket, WebSocketServer } from "ws";
import { renderConsolePage } from "../../packages/coding-agent/src/console/view.ts";

const consoleDirectory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(consoleDirectory, "../..");
const assetFiles = new Map([
  ["/assets/xterm.js", ["node_modules/@xterm/xterm/lib/xterm.js", "text/javascript"]],
  ["/assets/xterm.css", ["node_modules/@xterm/xterm/css/xterm.css", "text/css"]],
  ["/assets/addon-fit.js", ["node_modules/@xterm/addon-fit/lib/addon-fit.js", "text/javascript"]],
]);

function sameSecret(value, expected) {
  if (typeof value !== "string") return false;
  const supplied = Buffer.from(value);
  const wanted = Buffer.from(expected);
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted);
}

function dimensions(message) {
  return Number.isInteger(message.cols) && message.cols >= 20 && message.cols <= 500 &&
    Number.isInteger(message.rows) && message.rows >= 8 && message.rows <= 200;
}

function cookieValue(request) {
  return (request.headers.cookie ?? "").split(";").map((part) => part.trim())
    .find((part) => part.startsWith("pi_console="))?.slice("pi_console=".length);
}

/** Start a private console; the selected project is fixed by the server operator. */
export async function startConsole(options = {}) {
  const project = await realpath(options.project ?? join(repository, "examples/flow-orders"));
  if (!(await stat(project)).isDirectory()) throw new Error("The console project must be a directory.");
  const stateDirectory = resolve(options.stateDirectory ?? join(consoleDirectory, ".state"));
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  const token = options.token ?? randomBytes(32).toString("hex");
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("PI_CONSOLE_TOKEN must contain 64 lowercase hexadecimal characters.");
  const csrfToken = randomBytes(32).toString("hex");
  const host = options.host ?? "127.0.0.1";
  if (!["127.0.0.1", "localhost", "::1"].includes(host) && !options.origin) {
    throw new Error("A non-loopback console requires --origin with its HTTPS public URL.");
  }
  if (options.origin && new URL(options.origin).protocol !== "https:") {
    throw new Error("A public console origin must use HTTPS behind an authenticated reverse proxy.");
  }
  let origin = options.origin ? new URL(options.origin).origin : "";
  let session;
  let viewer;
  let idleTimer;
  let closing;
  let replay = "";
  let replayBytes = 0;
  let lastState = { type: "status", state: "disconnected" };
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 131072, perMessageDeflate: false });

  function send(socket, value) {
    if (socket.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 2 * 1024 * 1024) {
      socket.close(1013, "Terminal output exceeded the client buffer");
      return;
    }
    socket.send(JSON.stringify(value));
  }

  function stopSession() {
    clearTimeout(idleTimer);
    if (session) session.kill("SIGTERM");
  }

  function writeSession(value) {
    if (session?.stdin.writable && !session.stdin.destroyed) {
      if (session.stdin.writableLength > 262144) {
        viewer?.close(1013, "Terminal input exceeded the server buffer");
        return;
      }
      session.stdin.write(`${JSON.stringify(value)}\n`);
    }
  }

  function startSession(cols, rows) {
    replay = "";
    replayBytes = 0;
    // Do not expose the web server's deployment tokens or provider credentials to terminal tools.
    const env = Object.fromEntries(["PATH", "LANG", "LC_ALL", "LC_CTYPE", "TMPDIR", "USER", "LOGNAME"]
      .filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
    Object.assign(env, {
      TERM: "xterm-256color", COLORTERM: "truecolor", FORCE_COLOR: "3",
      PI_CODING_AGENT_DIR: stateDirectory, PI_SKIP_VERSION_CHECK: "1",
    });
    const child = spawn(options.python ?? "python3", [join(consoleDirectory, "pty_bridge.py")], {
      stdio: ["pipe", "pipe", "pipe"], env, cwd: project,
    });
    session = child;
    child.stdin.on("error", () => {});
    child.stdin.write(`${JSON.stringify({
      command: process.execPath,
      args: [process.execPath, "--import", join(repository, "packages/coding-agent/src/experimental/source-resolver.ts"),
        join(repository, "packages/coding-agent/src/cli.ts"), "--flow"],
      cwd: project, env, cols, rows,
    })}\n`);
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      if (session !== child) return;
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.type === "output" && typeof message.data === "string") {
        replay += message.data;
        replayBytes += Buffer.byteLength(message.data);
        if (replayBytes > 1024 * 1024) {
          replay = replay.slice(-262144);
          replayBytes = Buffer.byteLength(replay);
        }
      } else if (message.type === "status") {
        lastState = message;
      }
      if (viewer) send(viewer, message);
    });
    let stderr = "";
    child.stderr.on("data", (data) => { stderr = (stderr + data.toString()).slice(-4096); });
    child.once("error", (error) => {
      if (session !== child) return;
      session = undefined;
      lastState = { type: "status", state: "exited", message: `Could not start the terminal: ${error.message}` };
      if (viewer) send(viewer, lastState);
    });
    child.once("close", (code) => {
      if (session !== child) return;
      session = undefined;
      if (lastState.state !== "exited") {
        lastState = { type: "status", state: "exited", exitCode: code, message: stderr || "Pi exited. Reconnect to start again." };
        if (viewer) send(viewer, lastState);
      }
    });
    lastState = { type: "status", state: "connected" };
  }

  function allowedOrigin(request) {
    return request.headers.host === new URL(origin).host &&
      (!request.headers.origin || request.headers.origin === origin) &&
      request.headers["sec-fetch-site"] !== "cross-site";
  }

  const server = createServer((request, response) => {
    void (async () => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      const pathname = new URL(request.url ?? "/", origin).pathname;
      if (!allowedOrigin(request)) {
        response.writeHead(403).end("Origin not allowed");
        return;
      }
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.setHeader("Allow", "GET, HEAD");
        response.writeHead(405).end("Method not allowed");
        return;
      }
      if (pathname === "/healthz") {
        response.writeHead(200, { "Content-Type": "application/json" }).end('{"ok":true}');
        return;
      }
      if (pathname.startsWith("/auth/") && sameSecret(pathname.slice(6), token)) {
        response.setHeader("Set-Cookie", `pi_console=${token}; Path=/; HttpOnly; SameSite=Strict${origin.startsWith("https:") ? "; Secure" : ""}`);
        response.writeHead(303, { Location: "/" }).end();
        return;
      }
      if (!sameSecret(cookieValue(request), token)) {
        response.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" }).end("Open the private console link printed by the server to connect to Pi.");
        return;
      }
      if (pathname === "/") {
        const nonce = randomBytes(18).toString("base64");
        const socketOrigin = origin.replace(/^http/, "ws");
        response.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${socketOrigin}; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(request.method === "HEAD" ? undefined : renderConsolePage(nonce, {
          projectName: options.projectName ?? "Order processing example", websocketPath: "/terminal", csrfToken,
        }));
        return;
      }
      const asset = assetFiles.get(pathname);
      if (asset) {
        const bytes = await readFile(join(consoleDirectory, asset[0]));
        response.writeHead(200, { "Content-Type": asset[1] });
        response.end(request.method === "HEAD" ? undefined : bytes);
        return;
      }
      response.writeHead(404).end("Not found");
    })().catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end("Could not load the console");
    });
  });
  server.on("upgrade", (request, socket, head) => {
    if (closing || request.url !== "/terminal" || !allowedOrigin(request) ||
        request.headers.origin !== origin || !sameSecret(cookieValue(request), token)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    sockets.handleUpgrade(request, socket, head, (websocket) => sockets.emit("connection", websocket));
  });
  sockets.on("connection", (socket) => {
    let authenticated = false;
    const helloTimeout = setTimeout(() => socket.close(1008, "Handshake required"), 5000);
    socket.on("error", () => {});
    socket.on("message", (data, binary) => {
      let message;
      try { message = binary ? undefined : JSON.parse(data.toString()); } catch { /* Reject malformed input below. */ }
      if (!message || typeof message !== "object" || Array.isArray(message)) {
        socket.close(1008, "Invalid message");
        return;
      }
      if (!authenticated) {
        if (message.type !== "hello" || !sameSecret(message.csrfToken, csrfToken) || !dimensions(message)) {
          socket.close(1008, "Invalid handshake");
          return;
        }
        authenticated = true;
        clearTimeout(helloTimeout);
        clearTimeout(idleTimer);
        if (viewer && viewer !== socket) viewer.close(1000, "Console opened in another tab");
        viewer = socket;
        if (!session) startSession(message.cols, message.rows);
        else writeSession({ type: "resize", cols: message.cols, rows: message.rows });
        send(socket, lastState);
        if (replay) send(socket, { type: "output", data: `\u001bc${replay}` });
        return;
      }
      if (viewer !== socket) return;
      if (message.type === "input" && typeof message.data === "string" && Buffer.byteLength(message.data) <= 65536) {
        writeSession({ type: "input", data: message.data });
      } else if (message.type === "resize" && dimensions(message)) {
        writeSession({ type: "resize", cols: message.cols, rows: message.rows });
      } else {
        socket.close(1008, "Invalid terminal message");
      }
    });
    socket.once("close", () => {
      clearTimeout(helloTimeout);
      if (viewer === socket) {
        viewer = undefined;
        idleTimer = setTimeout(stopSession, options.idleMs ?? 10 * 60 * 1000);
        idleTimer.unref();
      }
    });
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 4317, host, () => { server.off("error", reject); resolveListening(); });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not determine console address.");
  origin ||= `http://${host === "::1" ? "[::1]" : host}:${address.port}`;
  // Also record the private launch URL for supervisors that capture stdout.
  await writeFile(join(stateDirectory, "console-url.txt"), `${origin}/auth/${token}\n`, { mode: 0o600 });
  return {
    url: `${origin}/auth/${token}`, origin, project,
    close() {
      if (!closing) {
        closing = (async () => {
          clearTimeout(idleTimer);
          for (const socket of sockets.clients) socket.terminate();
          const child = session;
          const childClosed = child ? new Promise((resolveExit) => child.once("close", resolveExit)) : Promise.resolve();
          stopSession();
          sockets.close();
          await new Promise((resolveClosed) => { server.close(resolveClosed); server.closeAllConnections(); });
          await childClosed;
        })();
      }
      return closing;
    },
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const options = { token: process.env.PI_CONSOLE_TOKEN, origin: process.env.PI_CONSOLE_ORIGIN, host: process.env.PI_CONSOLE_HOST, stateDirectory: process.env.PI_CONSOLE_STATE };
  for (let i = 0; i < args.length; i++) {
    const name = args[i];
    // Managed preview adds Vite's flag; this server always fails when its requested port is occupied.
    if (name === "--strictPort") continue;
    if (!["--project", "--port", "--host", "--origin"].includes(name) || !args[i + 1]) throw new Error(`Unknown console option ${name}`);
    const value = args[++i];
    if (name === "--port") {
      if (!/^\d+$/.test(value) || Number(value) > 65535) throw new Error("Invalid port");
      options.port = Number(value);
    } else options[name.slice(2)] = value;
  }
  const consoleServer = await startConsole(options);
  console.log(`Pi TUI console\nProject: ${consoleServer.project}\nPrivate console: ${consoleServer.url}\nKeep the private link secret: it controls the Pi process.`);
  const shutdown = () => { void consoleServer.close(); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
