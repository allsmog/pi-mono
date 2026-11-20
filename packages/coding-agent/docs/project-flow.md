# Project flow

This fork adds a native data-flow screen inside the Pi coding-agent harness. It reads source files in the launch directory and draws components, module dependencies, and inferred input/output relationships. Every connection includes file and line evidence. A separate browser companion is also available.

## Open the screen inside Pi

From the project you want to inspect:

```bash
cd /path/to/your/project
pi --flow
```

Or start Pi normally and enter `/flow`. The diagram is a keyboard-driven Pi screen, using the same terminal as the coding agent. Escape returns to the coding agent.

The native screen has three views:

- **Components:** choose Project overview for the full diagram, or a component for its immediate input/output neighborhood and source files. Large overviews show an explicit cap; the lists retain all analyzed components and connections.
- **Connections:** inspect every visible relationship, its direction, and the source lines that support it.
- **Actions:** rescan the launch directory, show or hide import dependencies, or return to Pi.

Default controls are Tab to change views, up/down to select, Enter to inspect or activate, PageUp/PageDown to scroll evidence, left/right to pan wide diagrams, and Escape to return. These use Pi's configurable keybindings. The screen resizes with the terminal.

Pi's normal startup applies to `pi --flow`. The scanner itself makes no model calls and does not execute the project's source or build commands. Running the harness through a web terminal uses this same native screen; it is not a diagram rendered in place of the harness.

## Optional browser companion

For a local browser canvas without creating an agent session:

```bash
pi flow                     # Open the browser companion
pi flow --no-open            # Print the URL without opening a browser
pi flow --port 4319          # Use a particular loopback port
pi flow --help
```

The companion starts a server on `127.0.0.1` with an automatically allocated port. It needs no model or API key. Keep its terminal running while using the screen; press Ctrl+C to stop it. If no desktop browser opener is available, open the printed URL manually. When running Pi on another machine, use a local port forward rather than exposing the server publicly.

## Run from this source checkout

Install the fork's dependencies once:

```bash
cd /path/to/pi-flow
npm ci --ignore-scripts
npm run hydrate:model-data
```

Then launch the actual Pi source entry point from any project:

```bash
cd /path/to/your/project
/path/to/pi-flow/pi-test.sh --flow
```

Use `/path/to/pi-flow/pi-test.sh flow --no-open` for the optional browser companion. The hydration command installs Pi's generated model catalog data required by its source imports; it does not require an API key. The launcher preserves the current working directory. A full monorepo build is not required to use the source launcher.

## Try the runnable example

This fork includes a small dependency-free Orders service at `examples/flow-orders`. It has real HTTP routing, request validation, file persistence, console output, environment configuration, and an optional webhook. To inspect it:

```bash
cd /path/to/pi-flow/examples/flow-orders
../../pi-test.sh --flow
```

See [the example README](../../../examples/flow-orders/README.md) for commands to run the service and submit an order. Outbound network calls are disabled unless `ORDER_WEBHOOK_URL` is explicitly configured.

The hosted graphical companion can display saved analyses of example source. Those snapshots support diagram navigation, evidence, filtering, and exports, but cannot read arbitrary files on your computer. The native `/flow` screen instead scans the filesystem of the running Pi process, including when Pi is hosted in a web terminal.

## Use alongside the coding agent

Inside an interactive Pi session:

```text
/flow
```

The built-in command opens the native terminal screen for `ctx.cwd`, the session's working directory. Use its Actions view to rescan after edits. `/flow web` explicitly opens the optional browser companion; repeating `/flow web` rescans its existing server. `/flow close` closes flow resources.

To open the screen when an interactive session starts:

```bash
pi --flow
```

Print, JSON, and RPC sessions do not open the native screen automatically. Leaving or reloading the interactive session closes its native screen and any companion server.

## Read the diagram

- Project components group related source files.
- Host boundaries identify input/output involving the terminal, filesystem, or child processes.
- Network boundaries identify detected network calls or inferred service use.
- Directional connections show the relationship found in source, with supporting file and line references.
- Module imports are labeled as **dependencies** and can be shown separately. An import alone is not evidence that data passes between two components.

In the native screen, select components or connections to see diagrams and evidence, and use Actions to rescan. The optional browser companion also offers search, zoom, a fit control, and JSON/Mermaid exports.

## Accuracy and scope

This is static, heuristic analysis. A detected source operation shows that the operation appears in scanned code; it does not prove that the operation executes. Inferred network or storage relationships require review. These are not runtime traces, whole-program taint analysis, or a guarantee that all data paths are present.

The initial scanner recognizes common patterns in JavaScript/TypeScript, Python, and Rust, including imports and common file, terminal, network, and process operations. Dynamic dispatch, aliases, dependency injection, generated code, and framework-specific behavior can produce missing or ambiguous relationships. Inspect the evidence before relying on a relationship for a security decision.

The scanner respects supported ignore files, skips symlinks, dependency/build/test artifacts and common secret files, and limits the amount of source it reads. The screen reports scan warnings and limits. Files outside the launch directory are not followed.

The native screen runs in the Pi process and does not send source to a model or diagram service. The optional companion's local URL contains a random access token; treat that URL as access to the current analysis while its server is running.
