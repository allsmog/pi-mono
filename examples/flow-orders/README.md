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
../../pi-test.sh flow
```

Or, with this fork installed:

```bash
pi flow
```

The analysis starts at this directory, so it reads the example's actual source files. It does not start the example service or execute any source.

Follow the components: `server` accepts HTTP requests; `http` reads JSON and routes requests; `orders` validates and constructs orders; `storage` reads and writes local files; `integrations` contains the optional webhook. Console output and environment settings are also visible. Enable **Dependencies** to show which components import one another.

The HTTP/API node appears because a `fetch()` call exists in `src/integrations/webhook.js`. That is a possible network relationship inferred from source, even while the webhook is disabled. It is not a claim that a request was sent. The incoming network boundary is similarly inferred from `createServer()` and `listen()`.

The hosted Pi Flow demo uses a saved analysis of this code. Its search, component selection, evidence, diagram controls, and exports can be tested without running this service. Fresh scans of your own files are available through the local CLI.
