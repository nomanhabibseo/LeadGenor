import type { QueryClient } from "@tanstack/react-query";

/**
 * After any template or folder create/update/delete, sync React Query caches for folder counts,
 * folder item lists, “all templates” (campaign pickers), and trash.
 * Refetches with `type: "all"` so **inactive** lists (e.g. main templates page while you are in a folder) update in the background.
 */
export async function invalidateTemplateRelatedQueries(
  qc: QueryClient,
  userKey: string,
  options?: { folderId?: string | null; templateId?: string | null },
) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["template-folders", userKey] }),
    qc.invalidateQueries({ queryKey: ["templates-all", userKey] }),
    qc.invalidateQueries({ queryKey: ["template-folders-trash", userKey] }),
  ]);
  if (options?.templateId) {
    await qc.invalidateQueries({ queryKey: ["template", userKey, options.templateId] });
  }
  if (options?.folderId) {
    const fid = options.folderId;
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["template-items", userKey, fid] }),
      qc.invalidateQueries({ queryKey: ["template-folder-meta", userKey, fid] }),
    ]);
  }
  const refetchAll = { type: "all" as const };
  await Promise.all([
    qc.refetchQueries({ queryKey: ["template-folders", userKey], ...refetchAll }),
    qc.refetchQueries({ queryKey: ["templates-all", userKey], ...refetchAll }),
  ]);
  if (options?.folderId) {
    await qc.refetchQueries({ queryKey: ["template-items", userKey, options.folderId!], ...refetchAll });
  }
}
