FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 git ripgrep fd-find \
    && if ! command -v fd >/dev/null 2>&1; then ln -s /usr/bin/fdfind /usr/local/bin/fd; fi \
    && rm -rf /var/lib/apt/lists/*

USER node
