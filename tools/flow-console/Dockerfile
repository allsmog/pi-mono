FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 git ca-certificates ripgrep fd-find \
    && ln -s /usr/bin/fdfind /usr/local/bin/fd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/pi
COPY --chown=node:node . .
RUN npm ci --ignore-scripts --no-audit --no-fund \
    && npm run hydrate:model-data \
    && npm --prefix tools/flow-console ci --ignore-scripts --no-audit --no-fund \
    && mkdir -p /home/node/pi-state \
    && chown node:node /home/node/pi-state

USER node
ENV PI_CONSOLE_HOST=0.0.0.0
ENV PI_CONSOLE_STATE=/home/node/pi-state
EXPOSE 4317
CMD ["node", "tools/flow-console/server.mjs"]
