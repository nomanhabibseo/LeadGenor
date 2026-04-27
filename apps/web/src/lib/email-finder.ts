import { apiFetch } from "@/lib/api";

export type EmailFinderResult = { emails: string[]; notFound?: boolean };

export async function findEmailsFromUrl(
  token: string | undefined,
  url: string,
): Promise<EmailFinderResult> {
  return apiFetch<EmailFinderResult>("/email-finder/from-url", token, {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function findEmailsFromUrls(
  token: string | undefined,
  urls: string[],
): Promise<{ results: { url: string; emails: string[]; notFound: boolean }[] }> {
  return apiFetch<{ results: { url: string; emails: string[]; notFound: boolean }[] }>(
    "/email-finder/from-urls",
    token,
    {
      method: "POST",
      body: JSON.stringify({ urls }),
    },
  );
}

