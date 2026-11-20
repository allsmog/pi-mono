# Pi in a browser terminal

This console runs the **actual forked Pi TUI** in a POSIX pseudo-terminal and
forwards its input, output, and resize events over a private WebSocket. It is
not an RPC chat replacement or a saved diagram viewer.

The process starts in `examples/flow-orders` with `--flow`. The project flow
screen is part of Pi itself: Escape returns to Pi, and `/flow` opens it again.
Use arrows and Tab in the flow screen to inspect components, connections, and
source evidence. Try `!pwd` or `!node src/server.js` at the normal Pi prompt to
run commands in the example project. Ctrl+C stops the example server.

## Run from this checkout

Requirements: Node 24 or newer, Python 3, and a POSIX host (Linux or macOS).

```sh
npm ci --ignore-scripts
npm run hydrate:model-data
npm --prefix tools/flow-console ci --ignore-scripts
node tools/flow-console/server.mjs
```

Open the private console URL printed by the server. Supervisors that capture
stdout can read the same URL in `tools/flow-console/.state/console-url.txt`.
That URL grants control of the process; keep it private. The server exchanges
the launch token for an HttpOnly, SameSite cookie and redirects to `/`.

To work in another project:

```sh
node tools/flow-console/server.mjs --project /absolute/path/to/project --port 4317
```

The scanner does not need a provider account. To use Pi's model-backed coding
agent, run `/login` inside Pi and select your provider. The console does not
inherit provider keys or deployment tokens from its server environment.

## Deploy on a Linux server

Run as a dedicated, unprivileged user or in the supplied Docker container.
This is a **single-owner development console**: Pi has the filesystem and shell
permissions of that user. It is not a sandbox for unrelated public visitors.
Put it behind HTTPS and the host's access control; do not expose a shell over
plain HTTP.

```sh
docker build -f tools/flow-console/Dockerfile -t pi-flow-console .
```

Supply these deployment secrets/settings through the host's secret manager:

| Variable | Meaning |
| --- | --- |
| `PI_CONSOLE_TOKEN` | 64 lowercase hexadecimal characters; generate with `openssl rand -hex 32` |
| `PI_CONSOLE_ORIGIN` | Exact HTTPS origin, for example `https://pi.example.com` |
| `PI_CONSOLE_HOST` | `0.0.0.0` inside the container; the default outside Docker is loopback |
| `PI_CONSOLE_STATE` | Writable directory for Pi settings, sessions, and login state |

Forward HTTPS and WebSocket upgrades to container port 4317. Preserve the
original Host and Origin headers. Mount a persistent volume at
`/home/node/pi-state` to retain Pi sessions and provider logins. The example
project is writable inside the container; mount a project directory and pass
`--project` if those edits must survive container replacement.

Each console instance runs one Pi process. Opening a second tab transfers
control to it. Reconnecting resumes the live process, with bounded terminal
replay; after ten disconnected minutes the process is stopped. Pi session
files remain in the state directory. Reconnecting after a process exit starts
a new Pi process. The browser and server validate origin, authorization,
handshake, message size, and terminal dimensions.

## Focused verification

```sh
node --test tools/flow-console/test.mjs
```

Tests cover the authorization boundary, the real PTY and Pi process,
reconnection, and shutdown. No provider API calls are used.

The [native flow documentation](../../packages/coding-agent/docs/project-flow.md)
describes the static analysis limits and the optional companion browser graph.
