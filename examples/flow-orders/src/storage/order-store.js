import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

let writeQueue = Promise.resolve();

export async function listOrders() {
  await writeQueue;
  return readOrders();
}

export function appendOrder(order) {
  const operation = writeQueue.then(async () => {
    const orders = await readOrders();
    if (orders.length >= 1000) throw new Error("This example stores at most 1,000 orders.");
    orders.push(order);
    const directory = resolve(process.env.ORDER_DATA_DIR ?? "data");
    await mkdir(directory, { recursive: true });
    const temporaryPath = join(directory, `orders-${randomUUID()}.tmp`);
    await writeFile(temporaryPath, JSON.stringify(orders, null, 2), { mode: 0o600 });
    await rename(temporaryPath, join(directory, "orders.json"));
  });
  // Serialize writes so concurrent requests cannot overwrite each other's orders.
  writeQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

async function readOrders() {
  const path = join(resolve(process.env.ORDER_DATA_DIR ?? "data"), "orders.json");
  try {
    const orders = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(orders)) throw new Error("Order data must contain an array.");
    return orders;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
