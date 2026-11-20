import { randomUUID } from "node:crypto";
import { notifyOrderCreated } from "../integrations/webhook.js";
import { appendOrder, listOrders } from "../storage/order-store.js";
import { validateOrder } from "./validation.js";

export async function createOrder(input) {
  const items = validateOrder(input);
  const order = { id: randomUUID(), createdAt: new Date().toISOString(), items };
  await appendOrder(order);
  const webhook = await notifyOrderCreated(order);
  console.log(`Created order ${order.id} with ${items.length} item(s).`);
  return { order, webhook };
}

export async function getOrders() {
  return listOrders();
}
