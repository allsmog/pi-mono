# Run the Pi fork in a development container

This configuration opens the checked-out fork with Node 24, Python 3, Git,
ripgrep, and fd. Setup installs the locked dependencies with lifecycle scripts
disabled, hydrates Pi's model metadata, and installs the browser terminal's
dependencies. It does not start Pi or log in to a provider automatically.

## GitHub Codespaces

1. Open [allsmog/pi-mono, branch flow/project-data-flow](https://github.com/allsmog/pi-mono/tree/flow/project-data-flow).
2. Choose **Code → Codespaces → Create codespace on flow/project-data-flow**.
3. Wait for the container setup to finish, then open a terminal in VS Code.
4. From the repository root, launch the actual Pi harness in the example project:

   ```sh
   cd examples/flow-orders
   ../../pi-test.sh --flow
   ```

The native project flow screen opens inside Pi. Press **Escape** to return to
the normal Pi prompt; enter `/flow` to reopen it. In the flow screen, use
**Up/Down** to select, **Tab** to change views, and **Enter** to inspect. Select
**Project overview** above the component list to see the complete example
graph. **Actions → Rescan project** reads the current project files again.

The graph uses local static analysis and needs no model credentials. Pi's
model-backed coding features use the normal `/login` workflow when you choose
to use them. Codespace creation uses the GitHub account and plan shown in
GitHub's creation dialog.

## Open the dedicated browser terminal

From the repository root in a second terminal:

```sh
bash .devcontainer/start-console.sh
```

Open the **Private console** URL printed by the process. Port **4317** is
forwarded by the configuration. Keep its visibility **Private** in the
Codespaces Ports panel: this is your live Pi process with shell access to your
checkout. The launch link carries the console's access token; opening only the
bare port URL does not authenticate the console.

The launcher supplies the exact Codespaces HTTPS origin from GitHub's
environment variables. The backend listens on loopback and accepts requests
through that origin. The browser terminal starts a separate Pi session in
`examples/flow-orders`, with the native flow screen already open. Stop the
server with **Ctrl+C** in the terminal that launched it.

To launch the browser terminal in a different project, pass its path:

```sh
bash .devcontainer/start-console.sh /workspaces/your-project
```

## Local VS Code Dev Containers

Open this checkout in VS Code with the Dev Containers extension and Docker
available, then run **Dev Containers: Reopen in Container**. Use the same
terminal commands above. Outside Codespaces, the console launcher prints a
loopback URL for the forwarded local port.

To run the native Pi screen against another checkout, change to that project's
directory and call this fork's `pi-test.sh --flow` by its absolute path. Pi
scans the directory it was launched in.

## Configuration references

- [Official Node.js and TypeScript image variants](https://github.com/devcontainers/images/blob/main/src/typescript-node/README.md), including `24-bookworm`.
- [Dev container metadata and lifecycle commands](https://github.com/devcontainers/spec/blob/main/docs/specs/devcontainerjson-reference.md).
- [Creating a codespace for a repository branch](https://docs.github.com/en/codespaces/developing-in-a-codespace/creating-a-codespace-for-a-repository).
- [Codespaces environment variables](https://docs.github.com/en/codespaces/developing-in-a-codespace/default-environment-variables-for-your-codespace) and [port forwarding](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace).

The [console guide](../tools/flow-console/README.md) explains the live terminal
and deployment options. The [project flow guide](../packages/coding-agent/docs/project-flow.md)
documents the graph's source evidence and analysis limits.
