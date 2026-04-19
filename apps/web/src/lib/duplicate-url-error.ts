/** Nest may return `message: { code: 'DUPLICATE_URL', ... }` or string/array variants */
export function isDuplicateUrlResponse(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const j = body as Record<string, unknown>;
  const msg = j.message;
  if (msg && typeof msg === "object" && !Array.isArray(msg) && "code" in msg) {
    return (msg as { code: string }).code === "DUPLICATE_URL";
  }
  if (typeof msg === "string") {
    return msg === "DUPLICATE_URL" || msg.includes("DUPLICATE_URL");
  }
  if (Array.isArray(msg)) {
    return msg.some((x) => String(x).includes("DUPLICATE_URL"));
  }
  return JSON.stringify(body).includes("DUPLICATE_URL");
}
