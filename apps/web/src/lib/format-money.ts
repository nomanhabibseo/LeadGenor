/** Display prices with symbol per agent.md (USD $, PKR Rs, EUR €). */
export function formatPriceLabel(
  amount: number,
  code: string,
  symbol: string,
): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return "—";
  const fixed = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  if (code === "PKR") return `${symbol} ${fixed}`;
  if (code === "USD") return `${symbol}${fixed}`;
  return `${symbol}${fixed}`;
}
