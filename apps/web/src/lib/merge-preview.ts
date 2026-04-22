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
    emails: "contact@example.com, sales@example.com",
    contact_name: "Jane Smith",
  };
}

export function applyMergePreview(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    const re = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi");
    out = out.replace(re, v);
  }
  return out;
}
