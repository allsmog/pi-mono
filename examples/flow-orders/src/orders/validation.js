import { HttpError } from "../http/errors.js";

export function validateOrder(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.items)) {
    throw new HttpError(400, "Provide an items array.");
  }
  if (input.items.length < 1 || input.items.length > 50) {
    throw new HttpError(400, "An order needs between 1 and 50 items.");
  }
  return input.items.map((item) => {
    if (!item || typeof item !== "object" || typeof item.sku !== "string" || !/^[A-Z0-9_-]{1,40}$/.test(item.sku)) {
      throw new HttpError(400, "Each sku must contain 1–40 uppercase letters, digits, underscores, or hyphens.");
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      throw new HttpError(400, "Each quantity must be an integer from 1 to 99.");
    }
    return { sku: item.sku, quantity: item.quantity };
  });
}
