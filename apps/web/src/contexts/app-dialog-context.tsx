"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type AlertState = { kind: "alert"; message: string; resolve: () => void };
type ConfirmState = {
  kind: "confirm";
  message: string;
  resolve: (ok: boolean) => void;
};

type DialogState = AlertState | ConfirmState | null;

type AppDialogContextValue = {
  showAlert: (message: string) => Promise<void>;
  showConfirm: (message: string) => Promise<boolean>;
};

const AppDialogContext = createContext<AppDialogContextValue | null>(null);

function AppDialogLayer({
  state,
  closeAlert,
  confirmYes,
  confirmNo,
}: {
  state: DialogState;
  closeAlert: () => void;
  confirmYes: () => void;
  confirmNo: () => void;
}) {
  if (!state) return null;
  const isAlert = state.kind === "alert";
  return (
    <div
      className="fixed inset-0 z-[2147483000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px] dark:bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-dialog-title"
    >
      <div
        className={`max-h-[min(90vh,520px)] w-full max-w-md overflow-y-auto rounded-2xl border shadow-2xl ${
          isAlert
            ? "border-slate-200 bg-white p-8 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            : "border-slate-200 bg-white p-6 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isAlert ? (
          <div className="flex flex-col items-center text-center">
            <p
              id="app-dialog-title"
              className="whitespace-pre-wrap text-sm leading-relaxed text-slate-900 dark:text-white"
            >
              {state.message}
            </p>
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                onClick={closeAlert}
              >
                OK
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p
              id="app-dialog-title"
              className="whitespace-pre-wrap text-left text-sm leading-relaxed text-slate-900 dark:text-white"
            >
              {state.message}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                className="px-1 py-1 text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
                onClick={confirmNo}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
                onClick={confirmYes}
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showAlert = useCallback((message: string) => {
    return new Promise<void>((resolve) => {
      setState({ kind: "alert", message, resolve });
    });
  }, []);

  const showConfirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", message, resolve });
    });
  }, []);

  const value = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm]);

  function closeAlert() {
    if (state?.kind === "alert") {
      const r = state.resolve;
      setState(null);
      r();
    }
  }

  function confirmYes() {
    if (state?.kind === "confirm") {
      const r = state.resolve;
      setState(null);
      r(true);
    }
  }

  function confirmNo() {
    if (state?.kind === "confirm") {
      const r = state.resolve;
      setState(null);
      r(false);
    }
  }

  const layer = <AppDialogLayer state={state} closeAlert={closeAlert} confirmYes={confirmYes} confirmNo={confirmNo} />;

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      {mounted && state ? createPortal(layer, document.body) : null}
    </AppDialogContext.Provider>
  );
}

export function useAppDialog(): AppDialogContextValue {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error("useAppDialog must be used within AppDialogProvider");
  }
  return ctx;
}
