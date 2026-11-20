# Project flow

This fork adds a local graphical screen for exploring the project in Pi's current directory. It reads source files and draws components, module dependencies, and inferred input/output relationships. Every connection includes file and line evidence.

## Launch the screen

From the project you want to inspect:

```bash
cd /path/to/your/project
pi flow
```

The command scans that directory, starts a server on `127.0.0.1` with an automatically allocated port, and opens the screen in your browser. It prints the URL as well. Keep the terminal running while using the screen; press Ctrl+C to stop it.

No model, API key, or agent session is required. The scanner does not execute the project's source or build commands.

Options:

```bash
pi flow --no-open            # Print the URL without opening a browser
pi flow --port 4319          # Use a particular loopback port
pi flow --help
```

If no desktop browser opener is available, open the printed URL manually. The server is intentionally local. When running Pi on another machine, use a local port forward rather than exposing the server publicly.

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
/path/to/pi-flow/pi-test.sh flow --no-open
```

The hydration command installs Pi's generated model catalog data required by its source imports; it does not require an API key. The launcher preserves the current working directory. A full monorepo build is not required to use the source launcher. Installed distributions use the same `pi flow` command after the usual Pi build and installation.

## Try the runnable example

This fork includes a small dependency-free Orders service at `examples/flow-orders`. It has real HTTP routing, request validation, file persistence, console output, environment configuration, and an optional webhook. To inspect it:

```bash
cd /path/to/pi-flow/examples/flow-orders
../../pi-test.sh flow
```

See [the example README](../../../examples/flow-orders/README.md) for commands to run the service and submit an order. Outbound network calls are disabled unless `ORDER_WEBHOOK_URL` is explicitly configured.

The hosted Pi Flow demo displays saved analyses of example source. You can test diagram navigation, component and evidence selection, filtering, and exports there. It does not read arbitrary local files or run the Orders service. Use the local `pi flow` command when you want a fresh scan of a project on your computer.

## Use alongside the coding agent

Inside an interactive Pi session:

```text
/flow
```

The built-in command opens the same graphical screen for `ctx.cwd`, the session's working directory. Repeating `/flow` refreshes the existing server's analysis. Use `/flow close` to stop it.

To open the screen when an interactive session starts:

```bash
pi --flow
```

The normal coding-agent startup requirements still apply to `pi --flow`. Use `pi flow` for analysis without configuring a model. Print, JSON, and RPC sessions never open a browser automatically. Leaving or reloading the interactive session closes its flow server.

## Read the diagram

- Project components group related source files.
- Host boundaries identify input/output involving the terminal, filesystem, or child processes.
- Network boundaries identify detected network calls or inferred service use.
- Directional connections show the relationship found in source, with supporting file and line references.
- Module imports are labeled as **dependencies** and can be shown separately. An import alone is not evidence that data passes between two components.

Use search to locate a component or file, select nodes and connections for evidence, and zoom, pan, or fit the canvas. **Rescan** refreshes the project after edits. Exports save the current analysis as JSON or Mermaid.

## Accuracy and scope

This is static, heuristic analysis. A detected source operation shows that the operation appears in scanned code; it does not prove that the operation executes. Inferred network or storage relationships require review. These are not runtime traces, whole-program taint analysis, or a guarantee that all data paths are present.

The initial scanner recognizes common patterns in JavaScript/TypeScript, Python, and Rust, including imports and common file, terminal, network, and process operations. Dynamic dispatch, aliases, dependency injection, generated code, and framework-specific behavior can produce missing or ambiguous relationships. Inspect the evidence before relying on a relationship for a security decision.

The scanner respects supported ignore files, skips symlinks, dependency/build/test artifacts and common secret files, and limits the amount of source it reads. The screen reports scan warnings and limits. Files outside the launch directory are not followed.

The screen runs locally and does not send source to a model or diagram service. Its local URL contains a random access token; treat that URL as access to the current analysis while the server is running.
