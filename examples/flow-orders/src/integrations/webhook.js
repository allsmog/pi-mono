export async function notifyOrderCreated(order) {
  const configured = process.env.ORDER_WEBHOOK_URL;
  if (!configured) return { state: "disabled" };

  try {
    const destination = new URL(configured);
    if (destination.protocol !== "https:" && destination.protocol !== "http:") {
      throw new Error("The webhook must use HTTP or HTTPS.");
    }
    const response = await fetch(destination, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "order.created", order }),
      redirect: "error",
      signal: AbortSignal.timeout(2_000),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}.`);
    return { state: "delivered" };
  } catch (error) {
    console.warn("Order stored, but its optional webhook failed:", error.message);
    return { state: "failed" };
  }
}
