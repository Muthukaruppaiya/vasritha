"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type LenisLike = { scrollTo: (target: number, options?: { immediate?: boolean }) => void };

declare global {
  interface Window {
    __vasrithaLenis?: LenisLike;
  }
}

function scrollPageToTop() {
  const lenis = window.__vasrithaLenis;
  if (lenis) {
    lenis.scrollTo(0, { immediate: true });
  }
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

export function ScrollToTop() {
  const pathname = usePathname();

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    scrollPageToTop();
    const frame = requestAnimationFrame(scrollPageToTop);
    const short = window.setTimeout(scrollPageToTop, 40);
    const settle = window.setTimeout(scrollPageToTop, 180);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(short);
      window.clearTimeout(settle);
    };
  }, [pathname]);

  return null;
}
