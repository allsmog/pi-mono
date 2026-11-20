# Orders example

A real, small Node.js service for trying Pi's project-flow screen. There are no dependencies or model calls. Source and documentation use the repository's MIT license.

## Run the service

```bash
cd examples/flow-orders
node src/server.js
```

The service listens on `http://127.0.0.1:4318`. Set `PORT=0` to choose an available loopback port, or use another port explicitly. The chosen URL is printed in the terminal.

Create and retrieve an order:

```bash
curl -s http://127.0.0.1:4318/orders \
  -H 'Content-Type: application/json' \
  -d '{"items":[{"sku":"PI-NOTEBOOK","quantity":2}]}'

curl -s http://127.0.0.1:4318/orders
```

The POST returns an order with a generated ID and creation time, plus `"webhook":{"state":"disabled"}`. GET returns the saved order. Requests with invalid quantities, malformed JSON, or bodies larger than 16 KiB are rejected. `GET /health` checks that the service is running.

Data is saved under `data/orders.json`, with serialized writes and atomic file replacement. Set `ORDER_DATA_DIR` to choose another directory. This is a single-process demonstration, not a production order system.

The service makes **no outbound network requests by default**. Setting `ORDER_WEBHOOK_URL` explicitly enables an HTTP POST of each newly stored order to that endpoint. Webhook failures are reported but do not discard a stored order.

## Explore the source with Pi

In another terminal, from this directory:

```bash
../../pi-test.sh
```

After [installing CodeBoarding](../../packages/coding-agent/docs/project-flow.md), enter `/flow static` to analyze the example with its real source-analysis engine. Enter `/flow` for CodeBoarding's full architecture analysis, which requires its own configured model provider.

To open full architecture analysis at startup, with this fork installed:

```bash
pi --flow
```

The diagram opens inside the actual harness terminal, with component and connection views, source evidence, and a rescan action. Escape returns to the coding agent. The selected backend is labeled in the screen.

The analysis starts at this directory, so it reads the example's actual source files. Analysis does not start the example service.

### Original I/O-pattern example

Use `/flow quick` for the original lightweight scanner, or `pi flow` / `/flow web` for its optional browser companion. These do not require CodeBoarding or a model. The relationships below describe this scanner's output, rather than promising the same grouping from CodeBoarding.

Follow the components: `server` accepts HTTP requests; `http` reads JSON and routes requests; `orders` validates and constructs orders; `storage` reads and writes local files; `integrations` contains the optional webhook. Console output and environment settings are also visible. Enable **Dependencies** to show which components import one another.

The HTTP/API node appears because a `fetch()` call exists in `src/integrations/webhook.js`. That is a possible network relationship inferred from source, even while the webhook is disabled. It is not a claim that a request was sent. The incoming network boundary is similarly inferred from `createServer()` and `listen()`.

The graphical companion can also use a saved analysis of this code. Neither analysis mode starts the Orders service.
