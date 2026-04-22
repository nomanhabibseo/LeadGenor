/** Strip redundant leading zeros while typing (e.g. "020" → "20"). */

export function sanitizeIntTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  return digits.replace(/^0+(?=\d)/, "");
}

export function sanitizeDecimalTyping(raw: string): string {
  let s = raw.replace(/,/g, "");
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  const dot = s.indexOf(".");
  if (dot === -1) {
    const digits = s.replace(/\D/g, "");
    if (digits === "") return neg ? "-" : "";
    const clean = digits.replace(/^0+(?=\d)/, "");
    return neg ? `-${clean}` : clean;
  }
  const intPart = s.slice(0, dot).replace(/\D/g, "");
  const decPart = s.slice(dot + 1).replace(/\D/g, "");
  const intClean = intPart.replace(/^0+(?=\d)/, "");
  const mid = intClean + (decPart.length ? `.${decPart}` : s.endsWith(".") ? "." : "");
  return neg ? `-${mid}` : mid;
}
