/** Must match server merge-tags.ts */
export const MERGE_FIELDS = [
  { key: "company_name", label: "Company name" },
  { key: "client_name", label: "Client name" },
  { key: "vendor_name", label: "Vendor name" },
  { key: "niche", label: "Niche" },
  { key: "country", label: "Country" },
  { key: "traffic", label: "Traffic" },
  { key: "dr", label: "DR" },
  { key: "da", label: "DA" },
  { key: "authority_score", label: "AS (Authority score)" },
  { key: "backlinks", label: "Backlinks" },
  { key: "referring_domains", label: "Referring domains" },
  { key: "site_url", label: "Site URL" },
  { key: "website_name", label: "Website name" },
  { key: "emails", label: "Emails" },
] as const;
