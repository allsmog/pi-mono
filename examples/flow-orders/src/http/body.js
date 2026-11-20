import { HttpError } from "./errors.js";

const MAX_BODY_BYTES = 16 * 1024;

export function readJsonBody(request) {
  if (!(request.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
    return Promise.reject(new HttpError(415, "Use Content-Type: application/json."));
  }
  return new Promise((resolve, reject) => {
    let chunks = [];
    let length = 0;
    let finished = false;
    const fail = (error) => {
      if (finished) return;
      finished = true;
      chunks = [];
      reject(error);
    };
    request.on("data", (chunk) => {
      if (finished) return;
      length += chunk.length;
      if (length > MAX_BODY_BYTES) {
        fail(new HttpError(413, "Request body exceeds 16 KiB."));
      } else {
        chunks.push(chunk);
      }
    });
    request.once("end", () => {
      if (finished) return;
      finished = true;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "Request body must be valid JSON."));
      }
    });
    request.once("error", fail);
    request.once("aborted", () => fail(new HttpError(400, "Request was interrupted.")));
  });
}
