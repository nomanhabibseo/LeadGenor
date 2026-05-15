/** Footer hint while Google Sheet download + save runs (vendors/clients/email lists). */
export const SHEET_IMPORT_BUSY_HINT =
  "Fetching the sheet from Google can take time; large spreadsheets may take 1–3 minutes—keep this tab open.";

/** Primary action label during sheet import requests. */
export const SHEET_IMPORT_BUTTON_LABEL = "Importing";

/**
 * Shown when the user closes the import dialog while a CSV or Google Sheet import request is still in flight.
 * OK = abort and dismiss; Back to tab = stay on the dialog.
 */
export const IMPORT_IN_FLIGHT_QUIT_MESSAGE =
  "You are closing this window while an import is still running. The import may stop. Do you want to leave anyway?";
