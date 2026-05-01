"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

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

export function SmoothHashScrollEffects() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    let id: string | null = null;
    try {
      id = window.sessionStorage.getItem("lg_scroll_to");
      if (id) window.sessionStorage.removeItem("lg_scroll_to");
    } catch {
      id = null;
    }
    if (!id) return;

    // Wait for the home page content to mount, then scroll smoothly.
    const t1 = window.setTimeout(() => {
      if (tryScroll(id!)) return;
    }, 50);
    const t2 = window.setTimeout(() => {
      tryScroll(id!);
    }, 200);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  return null;
}

