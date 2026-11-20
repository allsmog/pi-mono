# CodeBoarding runtime for Pi

This integration executes the real [CodeBoarding](https://github.com/CodeBoarding/CodeBoarding)
codebase. It pins commit `b5341f2e2af2dd951a5bbe87cccee4c48eaf8bf8`, package version
`0.15.6`, and installs the upstream `uv.lock` without changing its source.

## Install

Install Git, Python 3, and [uv](https://docs.astral.sh/uv/getting-started/installation/),
then run from this Pi fork's root:

```sh
python3 tools/codeboarding/setup.py
```

The setup script asks uv for Python 3.12, creates an isolated environment, and copies
the bridge alongside the checkout. Its default paths are:

```text
~/.pi/agent/codeboarding/upstream/.venv/bin/python
~/.pi/agent/codeboarding/bridge.py
```

If `PI_CODING_AGENT_DIR` is set, installation goes under its `codeboarding` directory.
On Windows the environment's Python executable is `.venv/Scripts/python.exe`.
`--install-dir PATH` chooses another location; `PI_CODEBOARDING_PYTHON` can point the
Pi runner at that environment. Re-running setup preserves a checkout at the pinned
commit and refuses to overwrite tracked source changes or a different revision.

The extra pinned package `socksio==1.0.0` lets upstream HTTP clients use configured
SOCKS proxies. Language servers and the Tokei scanner are installed by CodeBoarding
as needed. Language-specific SDKs and a project's dependencies may also be required.

An existing CodeBoarding tool bundle can be selected with
`PI_CODEBOARDING_TOOLS_DIR=/absolute/path/to/servers` (or the bridge's
`--binary-location` option). This uses upstream's binary-location configuration and
skips downloads. The bundle must contain the platform-specific Tokei binary and
the language servers needed for the inspected project. Node must remain available
for JavaScript-based language servers. This is useful when a desktop and container
share the runtime checkout but have different home directories. A failed automatic
Tokei download is reported as a setup error; TLS verification is never disabled.

## Run inside the Pi terminal UI

Launch this Pi fork in the repository to inspect, then enter:

```text
/flow static
```

This runs local static analysis, or loads its saved result, without a model credential. Use
Actions → Rescan for a fresh run after source changes. The screen
shows source call relationships between components. These arrows describe which
code calls other code; they do not establish runtime value propagation or security
taint paths. Unsupported languages, dynamic calls, generated code, missing types,
and missing SDKs can reduce coverage or prevent analysis. This is not a claim of
complete data-flow analysis for every possible repository.

For CodeBoarding's model-assisted architectural analysis, configure a provider using
the [upstream configuration instructions](https://github.com/CodeBoarding/CodeBoarding),
then enter:

```text
/flow
```

That path invokes CodeBoarding's own CLI and requires its own model configuration.
It may send code context to the configured provider. Pi's model login is not
automatically a CodeBoarding provider credential. A missing provider produces an
error; the integration does not fabricate a model response.

See [the project flow guide](../../packages/coding-agent/docs/project-flow.md) for
the fork's launch commands and terminal controls.

## What the static bridge reuses

The bridge imports these upstream implementations:

1. `StaticAnalyzer`: language detection, language servers, symbol discovery,
   call resolution, and reference analysis.
2. `ClusteringService`: deterministic component hierarchy from real analyzed symbols.
3. `ScopeAssembler` and `build_global_relations`: exact component membership and
   source-backed inter-component call edges.
4. `file_leaf_clusters`: a file-level view when the architectural clustering keeps
   an entire small package as one component. Names come from source filenames.
5. `build_unified_analysis_json` and `parse_unified_analysis`: the official v1
   writer and reader, including their graph consistency checks.

Pi supplies the bridge and its TUI adapter, not a replacement parser. The bridge
uses a fresh temporary analysis cache with `skip_cache=True`; it does not load a
pickle file supplied by the inspected repository. Upstream telemetry is disabled
and npm lifecycle scripts are disabled. The upstream optional JavaScript workspace
dependency installer runs only when `CODEBOARDING_INSTALL_DEPENDENCIES` is explicitly
enabled. Its package manager can still read repository configuration.

For a direct diagnostic run:

```sh
~/.pi/agent/codeboarding/upstream/.venv/bin/python \
  -I \
  ~/.pi/agent/codeboarding/bridge.py \
  --project /absolute/path/to/repository \
  --output-dir /absolute/path/to/new/output
```

The result contains `analysis.json` in CodeBoarding's native format and
`pi-flow-provenance.json` with the upstream pin, source revision/hash, languages,
symbol and edge counts, grouping method, and `llmUsed: false`. Diagnostic logs go
to stderr. `--depth-cap` defaults to 3.

The full upstream CLI can also be run from any working directory after setup:

```sh
~/.pi/agent/codeboarding/upstream/.venv/bin/python \
  -I -m codeboarding_cli.main full \
  --local /absolute/path/to/repository \
  --output-dir /absolute/path/to/new/output \
  --force
```

## Validation

Fresh upstream-engine runs were checked through both the canonical upstream reader
and Pi's adapter:

| Repository and revision | Engine output | Rendered component graph |
| --- | --- | --- |
| `pallets/flask` at `49943b5a94413a530761350f04e896f76e8d620e` | 25 Python files, 441 graph symbols, 603 call edges | 9 components; 34 global relations and 17 nested relations; 242 cross-component method edges |
| `pallets/itsdangerous` at `672971d66a2ef9f85151e53283113f33d642dabd` | 9 Python files, 76 graph symbols, 112 call edges | 7 file components, 14 relations, 57 cross-component method edges |

These were static runs. The full CLI's missing-provider error was verified, but
model-assisted generation was not executed in that environment. A Go attempt was
stopped while its language server waited for workspace readiness; it is not counted
as a successful Go validation.

## License

CodeBoarding is copyright (c) 2025 CodeBoarding and licensed under MIT. See
[NOTICE.md](NOTICE.md) and [CODEBOARDING_LICENSE](CODEBOARDING_LICENSE). The installed
upstream checkout retains its own license and dependency notices.
