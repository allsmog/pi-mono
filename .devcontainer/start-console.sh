#!/usr/bin/env bash
set -euo pipefail

if (( $# > 1 )); then
  printf 'Usage: bash .devcontainer/start-console.sh [project-directory]\n' >&2
  exit 2
fi

FLOW_CHECKOUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLOW_CONSOLE_ARGS=(--port 4317 --host 127.0.0.1)

if [[ "${CODESPACES:-}" == "true" ]]; then
  : "${CODESPACE_NAME:?GitHub Codespaces did not supply CODESPACE_NAME}"
  : "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:?GitHub Codespaces did not supply its forwarding domain}"
  FLOW_CONSOLE_ARGS+=(--origin "https://${CODESPACE_NAME}-4317.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}")
fi

if (( $# == 1 )); then
  FLOW_CONSOLE_ARGS+=(--project "$1")
fi

exec node "$FLOW_CHECKOUT/tools/flow-console/server.mjs" "${FLOW_CONSOLE_ARGS[@]}"
