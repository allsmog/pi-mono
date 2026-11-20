# Project flow with CodeBoarding

This fork adds a native project-flow screen to the Pi coding-agent harness. It invokes the actual [CodeBoarding](https://github.com/CodeBoarding/CodeBoarding) engine and displays its component hierarchy, architectural relationships, calls, and source references in Pi's terminal. The project is the directory where you launch Pi.

## Install the fork and engine

Use Node.js 24, Git, and [uv](https://docs.astral.sh/uv/getting-started/installation/). The setup script asks uv to install Python 3.12 when necessary and installs CodeBoarding's frozen dependency lock. The source launcher below is intended for macOS, Linux, or WSL.

```bash
git clone --branch flow/project-data-flow https://github.com/allsmog/pi-mono.git pi-flow
cd pi-flow
npm ci --ignore-scripts
npm run hydrate:model-data
python3 tools/codeboarding/setup.py
```

The setup script downloads the unmodified CodeBoarding repository at commit `b5341f2e2af2dd951a5bbe87cccee4c48eaf8bf8` (version 0.15.6) into `~/.pi/agent/codeboarding/upstream`. It retains the upstream license and source. Pi adds a subprocess runner, a small bridge for the static mode, an importer for the upstream JSON format, and the native screen.

If you already have this fork, update it with `git pull --ff-only` on `flow/project-data-flow`, then rerun the installation commands above. A full monorepo build is not required for the source launcher.

## Run it in your repository

```bash
cd /path/to/your/repository
/path/to/pi-flow/pi-test.sh
```

Then enter one of these commands inside Pi:

| Command | Analysis |
| --- | --- |
| `/flow` | CodeBoarding's full architecture analysis, or a saved CodeBoarding result. Fresh analysis requires a configured model provider. |
| `/flow static` | CodeBoarding's source analysis, language servers, and deterministic clustering. No model or API key is required. |
| `/flow quick` | The earlier lightweight I/O-pattern scanner, explicitly selected. |

`/flow static` is the quickest way to verify the installation without model credentials. The first run may download upstream tools and the language servers required by the project. The screen shows progress while analysis runs; Escape cancels and returns to Pi. Failures remain visible, and Enter retries.

For full architecture analysis, configure a provider using CodeBoarding's own `~/.codeboarding/config.toml` or supported environment variables. Follow the [upstream configuration documentation](https://github.com/CodeBoarding/CodeBoarding/tree/b5341f2e2af2dd951a5bbe87cccee4c48eaf8bf8). Pi's own agent login is separate from CodeBoarding's model configuration. The full mode uses your chosen provider to analyze source and may incur model costs.

Once configured, start directly in the default architecture screen with:

```bash
cd /path/to/your/repository
/path/to/pi-flow/pi-test.sh --flow
```

The launcher preserves the current working directory. You do not need to copy this extension into each target repository. In a running session, `/flow` uses that session's working directory.

## Navigate the native screen

The screen starts at **Project overview**. Its backend label identifies CodeBoarding and whether the analysis is architecture or static.

- **Components:** select a component to inspect its neighborhood and source references. Enter expands a component that has children. The overview entry returns to the containing scope.
- **Connections:** inspect the original relationships, call-site evidence, definitions, and descriptions. The screen distinguishes detected calls from inferred relationships.
- **Actions:** rescan the current directory, toggle dependency visibility where applicable, or return to Pi.

Tab changes views; up/down selects; Enter inspects or activates; PageUp/PageDown scrolls; left/right pans wide diagrams; Escape returns to the agent. These use Pi's configurable keybindings. The screen resizes with the terminal. Large diagrams show their display limits, while the component and connection lists retain the imported graph.

Print, JSON, and RPC sessions do not automatically open the native screen. Leaving or reloading an interactive session closes its flow resources. `/flow close` also closes them.

## What comes from CodeBoarding

Full mode invokes upstream directly:

```text
python -I -m codeboarding_cli.main full --local PROJECT --output-dir PRIVATE_RUN --force
```

Static mode imports upstream `StaticAnalyzer`, `ClusteringService`, `ScopeAssembler`, relation builders, and the canonical `analysis.json` writer and reader. It uses upstream file clustering if an entire small package otherwise collapses into one component. The bridge does not implement a replacement parser, call resolver, or architecture model.

Pi imports CodeBoarding's versioned JSON, retaining nested components, method edges, source positions, and inference labels. Source hashes are checked before displaying saved snippets. A stale source reference is hidden and reported instead of presenting an old line as current evidence.

See [the integration README](../../../tools/codeboarding/README.md) for the source pin, engine details, and runtime overrides.

## Saved results and rescanning

Pi stores successful analysis JSON under `~/.pi/agent/cache/project-flow`, keyed by the real project path and analysis mode. Reopening the screen reuses that result. Default architecture mode can also open a project's existing `.codeboarding/analysis.json`. The UI warns when it loads a saved result.

Use **Actions → Rescan** after changing source files. Rescan invokes the selected engine again. Each run uses a fresh private output directory, and the static bridge disables upstream pickle-cache loading. Pi does not unpickle caches supplied by a target repository. The original project's source files are not rewritten by this integration.

Set `PI_CODING_AGENT_DIR` to relocate Pi's runtime and cache. An existing pinned installation can be selected with `PI_CODEBOARDING_PYTHON=/absolute/path/to/.venv/bin/python`.

## Coverage and limits

You can launch this fork in an arbitrary local repository. Diagram quality and static coverage depend on CodeBoarding's supported languages, available language servers, project configuration, and model configuration. An unsupported language or unresolved dynamic call is a limitation to report, not evidence that the relationship does not exist. No tool can guarantee a complete data-flow diagram for every repository.

The diagrams are architecture and static call views. Arrows do not prove end-to-end value propagation, runtime execution, or taint flow. Full-mode descriptions and inferred architectural relationships require review. Static mode resolves source relationships without a language model; it does not give the same semantic descriptions as full mode.

The adapter bounds document and source reads, excludes source references outside the project, omits secret-named files from displayed evidence, and reports missing or stale references. Upstream analysis has its own language/tool configuration and source-selection behavior. The display filters are not a replacement for controlling what source you send to a model provider.

## Included example and optional older companion

The dependency-free Orders service in `examples/flow-orders` remains available. From its directory, run `../../pi-test.sh`, then `/flow static` for CodeBoarding or `/flow quick` for the original I/O-pattern example. Analysis does not start the Orders service.

The older `pi flow` and `/flow web` browser companion remains an explicit option and uses the lightweight scanner. It is separate from the native CodeBoarding screen. Its server binds to loopback, needs no model, and stops with Ctrl+C or `/flow close`. No web console is required for the workflow above.
