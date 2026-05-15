"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

function reducedMotionPreferred() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function setHash(id: string) {
  try {
    const url = new URL(window.location.href);
    url.hash = encodeURIComponent(id);
    window.history.replaceState({}, "", url.toString());
  } catch {
    /* ignore */
  }
}

function tryScroll(id: string) {
  let el: HTMLElement | null = null;
  try {
    el = document.getElementById(id);
  } catch {
    return false;
  }
  if (!el) return false;

  const behavior: ScrollBehavior = reducedMotionPreferred() ? "auto" : "smooth";
  el.scrollIntoView({ behavior, block: "start", inline: "nearest" });
  setHash(id);
  return true;
}

/**
 * Smoothly scrolls to an element `id` on the home page.
 * - If you're already on `/`, it prevents the default hash jump and animates.
 * - If you're on another page, it navigates to `/` first, then animates.
 */
export function SmoothHashLink({
  id,
  className,
  children,
  onNavigate,
}: {
  id: string;
  className?: string;
  children: React.ReactNode;
  /** Runs after navigation / scroll begins (e.g. close mobile menu). */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      if (typeof window === "undefined") return;

      if (pathname === "/") {
        // Avoid the default instant jump; do our own smooth scroll.
        if (!tryScroll(id)) {
          // If target isn't mounted yet, retry once.
          window.setTimeout(() => tryScroll(id), 50);
        }
        onNavigate?.();
        return;
      }

      // Cross-page: store target and navigate home without hash (prevents snap).
      try {
        window.sessionStorage.setItem("lg_scroll_to", id);
      } catch {
        /* ignore */
      }
      router.push("/");
      onNavigate?.();
    },
    [id, onNavigate, pathname, router],
  );

  return (
    <Link href={`/#${encodeURIComponent(id)}`} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

