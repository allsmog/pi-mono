import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import test from "node:test";
import headless from "@xterm/headless";
import { WebSocket } from "ws";
import { startConsole } from "./server.mjs";

async function fixture(context, options = {}) {
  const stateDirectory = await mkdtemp(join(tmpdir(), "pi-console-test-"));
  const instance = await startConsole({ port: 0, stateDirectory, ...options });
  context.after(async () => {
    await deadline(instance.close(), 4000, "Console shutdown did not finish");
    await rm(stateDirectory, { recursive: true, force: true });
  });
  const response = await fetch(instance.url, { redirect: "manual" });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "/");
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie?.includes("HttpOnly"), "The capability cookie must be HttpOnly");
  assert.ok(setCookie?.includes("SameSite=Strict"), "The capability cookie must be same-site");
  const cookie = setCookie.split(";")[0];
  const page = await fetch(instance.origin, { headers: { Cookie: cookie } });
  assert.equal(page.status, 200);
  const html = await page.text();
  const configuration = JSON.parse(html.match(/const configuration = (.+);/)[1]);
  return { instance, cookie, configuration, html };
}

function deadline(promise, timeout, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeout); }),
  ]).finally(() => clearTimeout(timer));
}

function client(instance, cookie, origin = instance.origin) {
  const messages = [];
  let output = "";
  let closed = false;
  let authenticated = false;
  const terminal = new headless.Terminal({ cols: 120, rows: 36 });
  const socket = new WebSocket(instance.origin.replace(/^http/, "ws") + "/terminal", {
    origin,
    headers: cookie ? { Cookie: cookie } : {},
  });
  socket.on("error", () => {});
  socket.on("close", () => { closed = true; terminal.dispose(); });
  socket.on("message", (data) => {
    const message = JSON.parse(data.toString());
    messages.push(message);
    if (message.state === "connected") authenticated = true;
    if (message.type === "output") { output += message.data; terminal.write(message.data); }
  });
  terminal.onData((data) => {
    if (authenticated && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "input", data }));
  });
  const result = {
    socket,
    messages,
    get output() { return output; },
    get plainOutput() { return stripVTControlCharacters(output); },
    async open() { await deadline(once(socket, "open"), 2000, "WebSocket did not open"); },
    hello(csrfToken, cols = 120, rows = 36) { terminal.resize(cols, rows); socket.send(JSON.stringify({ type: "hello", csrfToken, cols, rows })); },
    input(data) { socket.send(JSON.stringify({ type: "input", data })); },
    wait(predicate, timeout = 20000, description = "Expected terminal state was not observed") {
      if (predicate(result)) return Promise.resolve();
      return deadline(new Promise((resolve) => {
        const check = () => { if (predicate(result)) { socket.off("message", check); resolve(); } };
        socket.on("message", check);
      }), timeout, description);
    },
    async close() {
      if (closed || socket.readyState === WebSocket.CLOSED) return;
      const completion = once(socket, "close");
      socket.close(1000, "Test complete");
      await deadline(completion, 2000, "WebSocket did not close");
    },
  };
  return result;
}

async function rejectedUpgrade(instance, headers) {
  return deadline(new Promise((resolve, reject) => {
    const socket = new WebSocket(instance.origin.replace(/^http/, "ws") + "/terminal", { headers });
    socket.on("error", () => {});
    socket.once("open", () => { socket.terminate(); reject(new Error("Unauthorized WebSocket was accepted")); });
    socket.once("unexpected-response", (_request, response) => {
      response.resume();
      socket.terminate();
      resolve(response.statusCode);
    });
  }), 2000, "WebSocket rejection did not finish");
}

test("HTTP requires the capability cookie and rejects foreign hosts and origins", async (context) => {
  const { instance, cookie, html } = await fixture(context);
  const unauthorized = await fetch(instance.origin);
  assert.equal(unauthorized.status, 401);
  const invalidCapability = await fetch(instance.origin + "/auth/invalid", { redirect: "manual" });
  assert.equal(invalidCapability.status, 401);
  const crossOrigin = await fetch(instance.origin, { headers: { Cookie: cookie, Origin: "https://untrusted.example" } });
  assert.equal(crossOrigin.status, 403);
  const crossSite = await fetch(instance.origin, { headers: { Cookie: cookie, "Sec-Fetch-Site": "cross-site" } });
  assert.equal(crossSite.status, 403);
  // Fetch replaces Host; use an HTTP request to actually send the hostile header.
  const wrongHost = await new Promise((resolve, reject) => {
    const outgoing = request(instance.origin, { headers: { Cookie: cookie, Host: "untrusted.example" } }, (response) => {
      response.resume(); resolve(response.statusCode);
    });
    outgoing.once("error", reject); outgoing.end();
  });
  assert.equal(wrongHost, 403);
  const mutation = await fetch(instance.origin, { method: "POST", headers: { Cookie: cookie } });
  assert.equal(mutation.status, 405);
  assert.ok(html.includes("/assets/xterm.js"), "The console must load its local terminal implementation");
  const asset = await fetch(instance.origin + "/assets/xterm.js", { headers: { Cookie: cookie } });
  assert.equal(asset.status, 200);
  assert.equal(asset.headers.get("content-type"), "text/javascript");
  const page = await fetch(instance.origin, { method: "HEAD", headers: { Cookie: cookie } });
  assert.equal(page.status, 200);
  assert.equal(await page.text(), "");
  assert.ok(page.headers.get("content-security-policy").includes("frame-ancestors 'none'"));
  assert.equal(page.headers.get("cache-control"), "no-store");
});

test("WebSocket rejects missing cookies and missing or foreign Origin headers", async (context) => {
  const { instance, cookie } = await fixture(context);
  assert.equal(await rejectedUpgrade(instance, { Origin: instance.origin }), 403);
  assert.equal(await rejectedUpgrade(instance, { Cookie: cookie }), 403);
  assert.equal(await rejectedUpgrade(instance, { Cookie: cookie, Origin: "https://untrusted.example" }), 403);
  assert.equal(await rejectedUpgrade(instance, { Cookie: cookie, Origin: instance.origin, "Sec-Fetch-Site": "cross-site" }), 403);
});

test("WebSocket rejects invalid CSRF, dimensions, and pre-handshake terminal input", async (context) => {
  const { instance, cookie, configuration } = await fixture(context);
  const messages = [
    { type: "hello", csrfToken: "invalid", cols: 120, rows: 36 },
    { type: "hello", csrfToken: configuration.csrfToken, cols: 19, rows: 36 },
    { type: "hello", csrfToken: configuration.csrfToken, cols: 120, rows: 7 },
    { type: "hello", csrfToken: configuration.csrfToken, cols: 501, rows: 36 },
    { type: "hello", csrfToken: configuration.csrfToken, cols: 120, rows: 201 },
    { type: "input", data: "!pwd\r" },
  ];
  for (const message of messages) {
    const connection = client(instance, cookie);
    await connection.open();
    const closed = once(connection.socket, "close");
    connection.socket.send(JSON.stringify(message));
    const [code] = await deadline(closed, 2000, "Invalid handshake was not closed");
    assert.equal(code, 1008);
    assert.equal(connection.output, "");
  }
});

test("failed Python spawn can reconnect and close without waiting for an already-emitted event", async (context) => {
  const { instance, cookie, configuration } = await fixture(context, { python: "/nonexistent-pi-console-test-python" });
  for (let attempt = 0; attempt < 2; attempt++) {
    const connection = client(instance, cookie);
    await connection.open();
    connection.hello(configuration.csrfToken);
    await connection.wait((value) => value.messages.some((message) => message.state === "exited"), 2000);
    assert.ok(connection.messages.some((message) => message.state === "connected"), "Each reconnect should try a fresh process");
    const error = connection.messages.find((message) => message.state === "exited");
    assert.ok(error.message.includes("Could not start the terminal"));
    await connection.close();
  }
  await deadline(instance.close(), 2000, "A failed spawn left shutdown waiting forever");
});

test("real Pi starts its native flow screen, executes !pwd, and survives reconnect", { timeout: 40000 }, async (context) => {
  const { instance, cookie, configuration } = await fixture(context, { idleMs: 700 });
  const first = client(instance, cookie);
  context.after(() => first.close());
  await first.open();
  first.hello(configuration.csrfToken);
  await first.wait((value) => value.plainOutput.includes("PROJECT FLOW"), 20000, "Pi did not open its native flow screen");
  assert.ok(first.plainOutput.includes("inside the Pi harness"));
  assert.ok(first.plainOutput.includes("I/O relationships"));

  let mark = first.output.length;
  first.input("\t");
  await first.wait((value) => stripVTControlCharacters(value.output.slice(mark)).includes("SOURCE EVIDENCE"), 3000, "Tab did not open connection evidence");
  assert.ok(first.plainOutput.includes("Source pattern; not a runtime trace."));
  mark = first.output.length;
  first.input("\u001b");
  await first.wait((value) => value.output.length > mark, 3000, "Escape did not redraw the Pi prompt");

  mark = first.output.length;
  first.input("!pwd; printf 'PI_CONSOLE_PROCESS_%s\\n' \"$PPID\"\r");
  await first.wait((value) => /PI_CONSOLE_PROCESS_\d+/.test(stripVTControlCharacters(value.output.slice(mark))), 10000, "Pi did not execute the !pwd shell command");
  const commandOutput = stripVTControlCharacters(first.output.slice(mark));
  assert.ok(commandOutput.includes(instance.project), "!pwd must execute in the selected example project");
  const originalPid = Number(commandOutput.match(/PI_CONSOLE_PROCESS_(\d+)/)[1]);
  await first.close();

  const second = client(instance, cookie);
  context.after(() => second.close());
  await second.open();
  second.hello(configuration.csrfToken, 100, 30);
  await second.wait((value) => value.plainOutput.includes("PI_CONSOLE_PROCESS_" + originalPid), 3000);
  mark = second.output.length;
  second.input("!printf 'PI_CONSOLE_RECONNECTED_%s\\n' \"$PPID\"\r");
  await second.wait((value) => /PI_CONSOLE_RECONNECTED_\d+/.test(stripVTControlCharacters(value.output.slice(mark))));
  const newOutput = stripVTControlCharacters(second.output.slice(mark));
  const reconnectedPid = Number(newOutput.match(/PI_CONSOLE_RECONNECTED_(\d+)/)[1]);
  assert.equal(reconnectedPid, originalPid, "Reconnect must retain the actual Pi process");

  mark = second.output.length;
  second.input("/flow\r");
  await second.wait((value) => stripVTControlCharacters(value.output.slice(mark)).includes("PROJECT FLOW"));
  await second.close();
  await deadline(new Promise((resolve) => {
    const interval = setInterval(() => {
      try { process.kill(originalPid, 0); } catch (error) {
        if (error.code === "ESRCH") { clearInterval(interval); resolve(); }
      }
    }, 50);
    interval.unref();
  }), 3500, "The Pi process survived its disconnected-session idle deadline");
});
