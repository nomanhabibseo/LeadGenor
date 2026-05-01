"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DashboardPlansOverlay } from "@/components/pricing/dashboard-plans-overlay";

type DashboardPlansModalContextValue = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const DashboardPlansModalContext = createContext<DashboardPlansModalContextValue | null>(null);

export function DashboardPlansModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({
      open: openModal,
      close: closeModal,
      isOpen: open,
    }),
    [open, openModal, closeModal],
  );

  return (
    <DashboardPlansModalContext.Provider value={value}>
      {children}
      <DashboardPlansOverlay open={open} onClose={closeModal} />
    </DashboardPlansModalContext.Provider>
  );
}

export function useDashboardPlansModal(): DashboardPlansModalContextValue {
  const ctx = useContext(DashboardPlansModalContext);
  if (!ctx) {
    return {
      open: () => {
        /* not mounted inside provider */
      },
      close: () => {},
      isOpen: false,
    };
  }
  return ctx;
}
