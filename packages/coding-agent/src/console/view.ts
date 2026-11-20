export interface ConsolePageOptions {
	projectName: string;
	websocketPath: string;
	csrfToken: string;
}

/** Render a browser terminal whose input and output connect to the real Pi process. */
export function renderConsolePage(nonce: string, options: ConsolePageOptions): string {
	const escapedNonce = nonce.replace(/[&<>"']/g, (character) => {
		switch (character) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			default:
				return "&#39;";
		}
	});
	const configuration = JSON.stringify(options)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
	return String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="referrer" content="no-referrer">
<title>Pi · Live console</title>
<link rel="stylesheet" href="/assets/xterm.css">
<style nonce="${escapedNonce}">
:root{color-scheme:dark;--background:#0c1118;--panel:#121a25;--border:#2a3544;--text:#e1e9f4;--muted:#8e9eb5;--accent:#8edcc5;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--text);background:var(--background);font-size:14px}*{box-sizing:border-box}body{margin:0;height:100vh;height:100dvh;overflow:hidden}button,a{touch-action:manipulation}button{font:inherit;color:inherit;cursor:pointer;background:none;border:1px solid transparent}button:disabled{cursor:not-allowed;opacity:.45}button:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:3px}button:hover:not(:disabled){background:#253243}button,a{border-radius:7px}a{color:inherit;text-decoration:none}a:hover{color:var(--accent)}h1,p{margin:0}svg{display:block;flex-shrink:0}.mono{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace}.topbar{height:66px;display:flex;align-items:center;gap:25px;padding:0 27px;border-bottom:1px solid var(--border);background:#111822}.brand{display:flex;align-items:center;gap:13px;white-space:nowrap}.brand-symbol{font-family:Georgia,serif;font-size:37px;color:var(--accent);font-weight:bold;line-height:1}.brand-divider{color:#536176;font-size:23px;font-weight:200}.brand-name{font-size:12px;letter-spacing:2.4px;font-weight:600}.project{display:flex;align-items:center;gap:9px;font-size:13px;color:#b8c6d9;min-width:0}.project svg{width:16px;height:16px;color:#7f94ae}.project-name{max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.header-right{display:flex;align-items:center;gap:18px;margin-left:auto}.source-link{display:flex;align-items:center;gap:7px;font-size:12px;color:#93a4bc;white-space:nowrap}.source-link svg{width:16px;height:16px}.session-pill{display:flex;align-items:center;gap:7px;border:1px solid #314338;background:#19271f;color:#a4cbb7;border-radius:5px;padding:6px 9px;font-size:11px;white-space:nowrap}.session-pill svg{width:12px;height:12px}.workspace{height:calc(100% - 66px);display:flex;flex-direction:column;padding:26px 27px 18px;min-height:0;background:radial-gradient(ellipse at 15% 0,#17243255,transparent 60%)}.heading{display:flex;align-items:center;justify-content:space-between;gap:25px;margin-bottom:23px}.eyebrow{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#7891aa;margin-bottom:9px}.heading h1{font-size:27px;letter-spacing:-.7px;font-weight:550;line-height:1.3}.description{color:var(--muted);font-size:13px;line-height:1.7;margin-top:6px}.connection{display:flex;align-items:center;gap:9px;font-size:12px;color:#9ba9bd;white-space:nowrap}.connection-dot{height:7px;width:7px;border-radius:50%;background:#8fa0b4;box-shadow:0 0 0 4px #90a1b410}.connection[data-state=connected]{color:#b4d8c8}.connection[data-state=connected] .connection-dot{background:#8ddcba;box-shadow:0 0 0 4px #8ddcba10}.connection[data-state=error],.connection[data-state=exited]{color:#d9b28d}.connection[data-state=error] .connection-dot,.connection[data-state=exited] .connection-dot{background:#d5a978;box-shadow:0 0 0 4px #d5a97810}.console-frame{display:flex;flex-direction:column;flex:1;min-height:0;border:1px solid #344154;border-radius:11px;background:#0c1118;overflow:hidden;box-shadow:0 14px 65px #0003}.toolbar{display:flex;align-items:center;gap:9px;flex-shrink:0;padding:10px 14px;border-bottom:1px solid #2b3748;background:#151e2b;min-height:54px}.button{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:12px;line-height:1.5;padding:7px 11px;border:1px solid #36465a;background:#1c2838;white-space:nowrap}.button svg{width:15px;height:15px}.button.primary{background:#203b33;border-color:#3a6254;color:#bbedd9}.button.primary:hover:not(:disabled){background:#294b3f}.button.subtle{background:transparent;border-color:transparent;color:#a6b6cc}.toolbar-separator{height:22px;border-left:1px solid #344154;margin:0 5px}.toolbar-caption{font-size:11px;color:#7991af;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.toolbar-caption code{padding:3px 6px;border:1px solid #3b4a60;background:#1b2939;border-radius:4px;color:#abc2db;font-size:10px;margin:0 3px}.toolbar-right{margin-left:auto;display:flex;align-items:center;gap:8px}.font-controls{display:flex;align-items:center;gap:2px;padding:2px;border:1px solid #344256;border-radius:6px;background:#111a26}.font-controls button{height:28px;width:29px;font-size:13px;color:#a7b9d1}.font-controls span{font-size:10px;color:#7e94ae;width:24px;text-align:center}.icon-button{height:34px;width:34px;display:flex;align-items:center;justify-content:center;border:1px solid #344256;background:#182231}.icon-button svg{height:16px;width:16px}.terminal-wrap{position:relative;display:flex;flex:1;min-height:0;background:#0c1118;padding:18px 19px 11px}.terminal{width:100%;height:100%;min-height:0}.terminal .xterm{height:100%}.terminal .xterm-viewport{background-color:#0c1118!important;scrollbar-width:thin;scrollbar-color:#36485f #0c1118}.terminal .xterm-screen{padding:0}.terminal .xterm-helper-textarea{caret-color:transparent}.connection-overlay{position:absolute;inset:0;z-index:5;background:#0c1118f5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:32px;text-align:center}.connection-overlay[hidden]{display:none}.overlay-symbol{height:52px;width:52px;display:flex;align-items:center;justify-content:center;border:1px solid #375148;border-radius:13px;background:#192c27;color:#a3d9c6}.overlay-symbol svg{height:26px;width:26px}.overlay-title{font-size:21px;font-weight:500;letter-spacing:-.2px}.overlay-description{font-size:13px;color:#8fa4bf;line-height:1.8;max-width:460px}.overlay-reconnect[hidden]{display:none}.terminal-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:35px;padding:9px 15px;flex-shrink:0;border-top:1px solid #283548;background:#111a26;font-size:10px;color:#7890af}.terminal-footer-left{display:flex;align-items:center;gap:15px}.footer-dot{width:4px;height:4px;background:#526c8a;border-radius:50%}.terminal-footer .keyboard-hint{color:#7e94af}.footer-key{font-family:monospace;border:1px solid #344359;border-radius:3px;padding:1px 4px;font-size:9px;color:#a4b4ca;margin-right:4px}.bottom-note{font-size:11px;line-height:1.6;color:#7389a4;margin-top:13px;display:flex;align-items:flex-start;gap:7px}.bottom-note svg{height:13px;width:13px;margin-top:2px;color:#7e97b2}.bottom-note strong{font-weight:500;color:#9bb1ca}.message-bar{display:flex;align-items:center;gap:12px;padding:10px 15px;background:#33291b;border-bottom:1px solid #5b4930;color:#d6bb8d;font-size:12px;line-height:1.7}.message-bar[hidden]{display:none}.message-bar p{flex:1}.message-bar button{font-size:11px;white-space:nowrap;color:#d8c3a4;padding:4px 8px}.console-frame:fullscreen{border:none;border-radius:0;width:100vw;height:100vh;height:100dvh;background:#0c1118}.console-frame:fullscreen .terminal-wrap{padding:18px 23px}.toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);z-index:30;max-width:min(600px,85vw);padding:11px 17px;font-size:12px;line-height:1.6;background:#20372f;color:#c2e7d8;border:1px solid #456756;border-radius:7px;box-shadow:0 8px 40px #0007}.toast[hidden]{display:none}
@media(min-width:1700px){.workspace{padding:32px 40px 21px}.topbar{padding:0 40px}.heading{margin-bottom:27px}.heading h1{font-size:31px}.description{font-size:14px}.toolbar{padding:12px 18px}.terminal-wrap{padding:22px 24px 14px}.button{font-size:13px}.terminal-footer{font-size:11px}.bottom-note{font-size:12px}}
@media(max-width:1050px){.topbar{gap:18px;padding:0 20px}.workspace{padding:22px 20px 15px}.session-pill{display:none}.toolbar-caption{display:none}.header-right{gap:10px}.terminal-wrap{padding:14px 15px 10px}.description{font-size:12px}}
@media(max-width:700px){.topbar{height:58px;padding:0 14px;gap:14px}.brand{gap:8px}.brand-symbol{font-size:30px}.brand-divider{font-size:19px}.brand-name{font-size:10px;letter-spacing:1.6px}.project{font-size:11px;gap:6px}.project-name{max-width:220px}.project svg{width:13px;height:13px}.source-link span{display:none}.source-link{padding:5px}.source-link svg{width:17px;height:17px}.workspace{height:calc(100% - 58px);padding:18px 10px 10px}.heading{margin:0 6px 16px;gap:12px;align-items:flex-start}.heading h1{font-size:23px}.eyebrow{font-size:9px;margin-bottom:7px}.description{font-size:11px;max-width:340px}.connection{font-size:10px;gap:7px;margin-top:6px}.toolbar{padding:8px;gap:5px;flex-wrap:wrap;min-height:50px}.button{font-size:11px;gap:5px;padding:6px 8px}.button svg{height:13px;width:13px}.toolbar-right{gap:5px}.font-controls{display:none}.toolbar-separator{display:none}.terminal-wrap{padding:11px 8px 8px}.terminal-footer{font-size:9px;gap:9px;flex-wrap:wrap;padding:8px 10px}.terminal-footer-left{gap:9px}.terminal-footer .keyboard-hint{display:none}.icon-button{height:31px;width:31px}.bottom-note{font-size:10px;margin:10px 6px 0}.message-bar{font-size:11px;padding:8px 10px}.overlay-title{font-size:18px}.overlay-description{font-size:12px}.connection-overlay{padding:25px}}
@media(max-width:420px){.project-name{max-width:130px}.brand-name{font-size:9px}.topbar{gap:9px}.heading .connection{position:absolute;right:17px;top:73px}.eyebrow{padding-right:100px}.description{font-size:10px}.toolbar .button{font-size:10px}.button-label-optional{display:none}.toolbar-right{gap:3px}.terminal-footer{font-size:8px}.bottom-note{font-size:9px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
.description{font-size:14px}.button{font-size:14px}.message-bar p{max-height:105px;overflow:auto;white-space:pre-wrap}.overlay-description{white-space:pre-wrap}
@media(max-width:700px){.description{font-size:12px}.button{font-size:12px}}
</style>
</head>
<body>
<header class="topbar">
 <div class="brand" aria-label="Pi console"><span class="brand-symbol" aria-hidden="true">π</span><span class="brand-divider" aria-hidden="true">/</span><span class="brand-name">CONSOLE</span></div>
 <div class="project"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 7h7l2 2h9v11H3Z"/><path d="M3 7V4h7l2 3"/></svg><span class="project-name" id="project-name">Opening project</span></div>
 <div class="header-right"><span class="session-pill"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="8" width="14" height="10" rx="2"/><path d="M6 8V6a4 4 0 0 1 8 0v2m-4 4v3"/></svg>Private session</span><a class="source-link" href="https://github.com/allsmog/pi-mono/tree/flow/project-data-flow" target="_blank" rel="noopener noreferrer" aria-label="View the Pi fork on GitHub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 20"/></svg><span>View fork</span></a></div>
</header>
<main class="workspace">
 <section class="heading" aria-label="Session details"><div><div class="eyebrow">Interactive agent harness</div><h1>Live Pi console</h1><p class="description">Explore the project, inspect its data flow, and work directly in Pi.</p></div><div class="connection" id="connection" data-state="connecting" role="status" aria-live="polite"><span class="connection-dot"></span><span id="connection-label">Connecting</span></div></section>
 <section class="console-frame" id="console-frame" aria-label="Pi terminal workspace">
  <div class="toolbar" role="toolbar" aria-label="Pi session controls">
   <button class="button primary" id="data-flow" type="button" disabled title="Send /flow to Pi"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="1" y="7" width="5" height="6" rx="1"/><rect x="14" y="1" width="5" height="6" rx="1"/><rect x="14" y="13" width="5" height="6" rx="1"/><path d="M6 10h5V4h3m-3 6v6h3"/></svg>Data flow</button>
   <button class="button subtle" id="pi-console" type="button" disabled title="Press Escape in Pi"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="m3 5 5 5-5 5m7 0h7"/></svg>Pi console</button>
   <span class="toolbar-separator" aria-hidden="true"></span><span class="toolbar-caption">Type <code>/flow</code> to inspect this project</span>
   <div class="toolbar-right"><div class="font-controls" aria-label="Terminal font size"><button type="button" id="font-smaller" aria-label="Decrease terminal font size">A−</button><span class="mono" id="font-size">14</span><button type="button" id="font-larger" aria-label="Increase terminal font size">A+</button></div><button class="button" id="reconnect" type="button"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M17 5v5h-5M3 15v-5h5M4.6 5.6a6 6 0 0 1 10.1-1L17 10M3 10l2.3 5.4a6 6 0 0 0 10.1-1"/></svg><span class="button-label-optional">Reconnect</span></button><button class="icon-button" id="fullscreen" type="button" aria-label="Enter full screen" title="Full screen"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M2 7V2h5m6 0h5v5M2 13v5h5m6 0h5v-5"/></svg></button></div>
  </div>
  <div class="message-bar" id="message-bar" role="status" hidden><p id="message-text"></p><button id="dismiss-message" type="button" aria-label="Dismiss message">Dismiss</button></div>
  <div class="terminal-wrap" id="terminal-wrap"><div class="terminal" id="terminal" role="application" aria-label="Live Pi terminal" aria-describedby="terminal-help"></div><div class="connection-overlay" id="connection-overlay"><div class="overlay-symbol"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="m6 8 4 4-4 4m7 0h5"/></svg></div><h2 class="overlay-title" id="overlay-title">Starting your Pi session</h2><p class="overlay-description" id="overlay-description">Connecting to the live terminal in the example project.</p><button class="button primary overlay-reconnect" id="overlay-reconnect" type="button" hidden>Reconnect</button></div></div>
  <footer class="terminal-footer"><div class="terminal-footer-left"><span class="mono" id="terminal-state">Opening terminal</span><span class="footer-dot" aria-hidden="true"></span><span class="mono" id="dimensions">— columns × — rows</span></div><span class="keyboard-hint"><span class="footer-key">Esc</span>Return to Pi prompt</span><span class="mono" id="session-kind">Live process · interactive terminal</span></footer>
 </section>
 <p class="bottom-note" id="terminal-help"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 9v5m0-8v1"/></svg><span>Click inside the console to type. <strong>Pi console</strong> returns to the prompt; <strong>Data flow</strong> opens the project's diagram.</span></p>
</main>
<div class="toast" id="toast" role="status" hidden></div>
<script nonce="${escapedNonce}" src="/assets/xterm.js"></script>
<script nonce="${escapedNonce}" src="/assets/addon-fit.js"></script>
<script nonce="${escapedNonce}">
(() => {
 'use strict';
 const configuration = ${configuration};
 const $ = (id) => document.getElementById(id);
 let terminal;
 let fitAddon;
 let socket = null;
 let connected = false;
 let receivedOutput = false;
 let fontSize = window.innerWidth < 700 ? 12 : 14;
 let fitFrame = null;
 let toastTimer = null;
 let connectionTimer = null;
 let disposed = false;

 $('project-name').textContent = configuration.projectName;
 $('project-name').title = configuration.projectName;
 document.title = configuration.projectName + ' · Pi console';

 function setStatus(state, label) {
  $('connection').dataset.state = state;
  $('connection-label').textContent = label;
  $('terminal-state').textContent = state === 'connected' ? 'Connected to Pi' : state === 'connecting' ? 'Connecting to Pi' : state === 'exited' ? 'Pi process exited' : 'Terminal disconnected';
  const ready = state === 'connected';
  $('data-flow').disabled = !ready;
  $('pi-console').disabled = !ready;
 }
 function overlay(title, description, retry) {
  $('overlay-title').textContent = title;
  $('overlay-description').textContent = description;
  $('overlay-reconnect').hidden = !retry;
  $('connection-overlay').hidden = false;
 }
 function showMessage(message) {
  $('message-text').textContent = message;
  $('message-bar').hidden = false;
 }
 function announce(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { $('toast').hidden = true; }, 3200);
 }
 function dimensions() {
  return { cols: Math.max(20, Math.min(500, terminal.cols)), rows: Math.max(8, Math.min(200, terminal.rows)) };
 }
 function send(message) {
  if (!connected || !socket || socket.readyState !== WebSocket.OPEN) return false;
  socket.send(JSON.stringify(message));
  return true;
 }
 function sendInput(data) {
  if (!connected) return;
  // Small chunks bound JSON frame size, including escaped control characters.
  for (let offset = 0; offset < data.length;) {
   let end = Math.min(offset + 4096, data.length);
   const lastCodeUnit = data.charCodeAt(end - 1);
   if (end < data.length && lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff) end--;
   if (!send({ type: 'input', data: data.slice(offset, end) })) return;
   offset = end;
  }
 }
 function fit() {
  if (!terminal || !fitAddon || disposed) return;
  const bounds = $('terminal').getBoundingClientRect();
  if (bounds.width < 20 || bounds.height < 20) return;
  fitAddon.fit();
  const size = dimensions();
  if (size.cols !== terminal.cols || size.rows !== terminal.rows) terminal.resize(size.cols, size.rows);
  $('dimensions').textContent = size.cols + ' columns × ' + size.rows + ' rows';
  send({ type: 'resize', ...size });
 }
 function scheduleFit() {
  if (fitFrame !== null) window.cancelAnimationFrame(fitFrame);
  fitFrame = window.requestAnimationFrame(() => { fitFrame = null; fit(); });
 }

 function connect() {
  if (!terminal || disposed) return;
  connected = false;
  receivedOutput = false;
  window.clearTimeout(connectionTimer);
  if (socket) { const previous = socket; socket = null; previous.close(1000, 'Reconnecting'); }
  terminal.reset();
  $('message-bar').hidden = true;
  setStatus('connecting', 'Connecting');
  overlay('Starting your Pi session', 'Connecting to the live terminal in the example project.', false);
  fit();
  let url;
  try {
   url = new URL(configuration.websocketPath, window.location.href);
   if (url.origin !== window.location.origin) throw new Error('The terminal endpoint must use this site\'s origin.');
   url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  } catch (error) {
   setStatus('error', 'Connection unavailable');
   overlay('Cannot connect to Pi', error.message, false);
   return;
  }
  const next = new WebSocket(url);
  socket = next;
  connectionTimer = window.setTimeout(() => {
   if (socket !== next || connected) return;
   setStatus('error', 'Still connecting');
   overlay('Pi is taking longer to connect', 'The terminal service has not finished opening this session. You can retry the connection.', true);
  }, 15000);
  next.addEventListener('open', () => {
   if (socket !== next) return;
   next.send(JSON.stringify({ type: 'hello', csrfToken: configuration.csrfToken, ...dimensions() }));
  });
  next.addEventListener('message', (event) => {
   if (socket !== next || disposed) return;
   let message;
   // WebSocket data is a transport boundary, independent of the PTY stream.
   try { message = JSON.parse(event.data); } catch { showMessage('The terminal server sent an unreadable message.'); return; }
   if (!message || typeof message !== 'object') return;
   if (message.type === 'output' && typeof message.data === 'string') {
    receivedOutput = true;
    $('connection-overlay').hidden = true;
    // All terminal contents come from the backing Pi process.
    terminal.write(message.data);
   } else if (message.type === 'status' && message.state === 'connected') {
    window.clearTimeout(connectionTimer);
    connected = true;
    setStatus('connected', 'Connected');
    if (!receivedOutput) overlay('Pi is starting', 'The terminal is connected. Waiting for the harness to render.', false);
    fit();
    terminal.focus();
   } else if (message.type === 'status' && message.state === 'exited') {
    window.clearTimeout(connectionTimer);
    connected = false;
    setStatus('exited', 'Process exited');
    const details = typeof message.exitCode === 'number' ? ' (exit code ' + message.exitCode + ')' : '';
    const description = typeof message.message === 'string' && message.message.trim() ? message.message : 'Pi has exited' + details + '. Reconnect to open a new session.';
    if (receivedOutput) showMessage(description);
    else overlay('Pi session ended', description, true);
   } else if (message.type === 'error' && typeof message.message === 'string') {
    showMessage(message.message);
   }
  });
  next.addEventListener('error', () => {
   if (socket !== next || disposed) return;
   setStatus('error', 'Connection error');
  });
  next.addEventListener('close', (event) => {
   if (socket !== next || disposed) return;
   window.clearTimeout(connectionTimer);
   connected = false;
   const exited = $('connection').dataset.state === 'exited';
   if (exited) return;
   setStatus('error', 'Disconnected');
   const description = event.code === 1008 ? 'This session could not be authorized. Reopen the console launch link to establish a session.' : 'The connection to Pi closed. Reconnect to open a new terminal session.';
   if (receivedOutput) showMessage(description);
   else overlay('Pi is disconnected', description, true);
  });
 }

 try {
  if (typeof Terminal !== 'function' || typeof FitAddon === 'undefined' || typeof FitAddon.FitAddon !== 'function') throw new Error('The terminal assets could not be loaded. Reload the page and try again.');
  terminal = new Terminal({
   cursorBlink: true,
   cursorStyle: 'bar',
   fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
   fontSize,
   lineHeight: 1.15,
   letterSpacing: 0,
   scrollback: 5000,
   screenReaderMode: true,
   convertEol: false,
   allowProposedApi: false,
   theme: {
    background: '#0c1118', foreground: '#d5e0ef', cursor: '#a6e4c9', cursorAccent: '#0c1118', selectionBackground: '#486b9055', selectionInactiveBackground: '#486b9033',
    black: '#1e2a39', red: '#e69a98', green: '#91d2ae', yellow: '#dbc38e', blue: '#8cb8e5', magenta: '#baa5df', cyan: '#8dd2cf', white: '#d2dce9',
    brightBlack: '#7c91ad', brightRed: '#edb2b0', brightGreen: '#b2e5ca', brightYellow: '#ead9b0', brightBlue: '#accff0', brightMagenta: '#d2c0ed', brightCyan: '#a9e1dd', brightWhite: '#edf3fb',
   },
  });
  fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open($('terminal'));
  terminal.onData(sendInput);
  terminal.onResize((size) => { const cols = Math.max(20, Math.min(500, size.cols)); const rows = Math.max(8, Math.min(200, size.rows)); $('dimensions').textContent = cols + ' columns × ' + rows + ' rows'; send({ type: 'resize', cols, rows }); });
  $('font-size').textContent = fontSize;
  new ResizeObserver(scheduleFit).observe($('terminal-wrap'));
  connect();
 } catch (error) {
  setStatus('error', 'Terminal unavailable');
  overlay('Cannot open the terminal', error.message, false);
 }

 $('data-flow').addEventListener('click', () => { sendInput('/flow\r'); if (terminal) terminal.focus(); });
 $('pi-console').addEventListener('click', () => { sendInput('\u001b'); if (terminal) terminal.focus(); });
 $('reconnect').addEventListener('click', connect);
 $('overlay-reconnect').addEventListener('click', connect);
 $('dismiss-message').addEventListener('click', () => { $('message-bar').hidden = true; scheduleFit(); if (terminal) terminal.focus(); });
 function changeFontSize(delta) {
  if (!terminal) return;
  fontSize = Math.max(10, Math.min(24, fontSize + delta));
  terminal.options.fontSize = fontSize;
  $('font-size').textContent = fontSize;
  fit(); terminal.focus();
 }
 $('font-smaller').addEventListener('click', () => changeFontSize(-1));
 $('font-larger').addEventListener('click', () => changeFontSize(1));
 $('fullscreen').addEventListener('click', async () => {
  try {
   if (document.fullscreenElement) await document.exitFullscreen();
   else await $('console-frame').requestFullscreen();
  } catch { announce('Full screen is unavailable in this browser.'); }
  scheduleFit(); if (terminal) terminal.focus();
 });
 document.addEventListener('fullscreenchange', () => { $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit full screen' : 'Enter full screen'); scheduleFit(); });
 window.addEventListener('pagehide', () => { disposed = true; connected = false; window.clearTimeout(connectionTimer); window.clearTimeout(toastTimer); if (socket) socket.close(1000, 'Page closed'); if (terminal) terminal.dispose(); });
})();
</script>
</body>
</html>`;
}
