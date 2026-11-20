import { createOrder, getOrders } from "../orders/service.js";
import { readJsonBody } from "./body.js";
import { HttpError } from "./errors.js";

export async function handleRequest(request, response) {
  try {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok", service: "flow-orders" });
    } else if (request.method === "GET" && url.pathname === "/orders") {
      sendJson(response, 200, { orders: await getOrders() });
    } else if (request.method === "POST" && url.pathname === "/orders") {
      const result = await createOrder(await readJsonBody(request));
      sendJson(response, 201, result);
    } else {
      throw new HttpError(404, "Use GET /health, GET /orders, or POST /orders.");
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) console.error("Order request failed:", error.message);
    sendJson(response, status, { error: status === 500 ? "Order service failed." : error.message });
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(payload));
}
