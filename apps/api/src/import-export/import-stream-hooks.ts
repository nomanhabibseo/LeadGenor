import type { Request } from 'express';

export type ImportRowProgress = {
  imported: number;
  /** Valid parsed rows (after validation); used as a rough total for the progress bar. */
  totalRows: number;
};

export type ImportCancelCheck = {
  isCancelled(): boolean;
};

export type ImportStreamHooks = ImportCancelCheck & {
  onProgress?(p: ImportRowProgress): void;
};

/** Stops importing when the HTTP client disconnects (e.g. user cancelled fetch). */
export function requestImportCancelCheck(req: Request): ImportCancelCheck {
  let cancelled = false;
  const flag = () => {
    cancelled = true;
  };
  req.once('close', flag);
  req.once('aborted', flag);
  return { isCancelled: () => cancelled };
}
