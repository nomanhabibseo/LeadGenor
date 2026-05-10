function escapeRegExp(k: string): string {
  return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Sample data for template preview (aligned with list / merge-tags). */
export function sampleMergeVars(): Record<string, string> {
  return {
    company_name: "Acme Publishing",
    client_name: "Jane Smith",
    vendor_name: "John Vendor",
    niche: "Technology; Marketing",
    country: "United States",
    traffic: "125000",
    dr: "62",
    da: "58",
    authority_score: "45",
    backlinks: "15420",
    referring_domains: "890",
    site_url: "https://example.com/blog",
    website_name: "example",
    "website name": "example",
    emails: "contact@example.com, sales@example.com",
    contact_name: "Jane Smith",
  };
}

export function applyMergePreview(template: string, vars: Record<string, string>): string {
  let out = template;
  const entries = Object.entries(vars).sort((a, b) => b[0].length - a[0].length);
  for (const [k, v] of entries) {
    const re = new RegExp(`\\{\\{\\s*${escapeRegExp(k)}\\s*\\}\\}`, "gi");
    out = out.replace(re, v);
  }
  return out;
}
