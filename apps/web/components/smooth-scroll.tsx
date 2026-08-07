"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ScrollToTop } from "./scroll-to-top";

type LenisHandle = {
  scrollTo: (target: number, options?: { immediate?: boolean }) => void;
  raf: (time: number) => void;
  destroy: () => void;
};

type WindowWithLenis = Window & { __vasrithaLenis?: LenisHandle };

function whenIdle(callback: () => void) {
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const id = window.requestIdleCallback(() => callback(), { timeout: 1800 });
    return () => window.cancelIdleCallback(id);
  }
  const id = globalThis.setTimeout(callback, 400);
  return () => globalThis.clearTimeout(id);
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  useEffect(() => {
    const win = window as WindowWithLenis;

    if (isAdmin) {
      document.documentElement.classList.remove("lenis");
      if (win.__vasrithaLenis?.destroy) {
        win.__vasrithaLenis.destroy();
        delete win.__vasrithaLenis;
      }
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    let cancelled = false;
    let frame = 0;
    let lenis: Lenis | null = null;
    let removeIdle: (() => void) | null = null;
    let started = false;

    const start = () => {
      if (cancelled || started) return;
      started = true;

      lenis = new Lenis({
        duration: 1.25,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 1.15,
        wheelMultiplier: 0.92,
        lerp: 0.075
      });

      win.__vasrithaLenis = lenis as unknown as LenisHandle;

      const raf = (time: number) => {
        lenis?.raf(time);
        frame = requestAnimationFrame(raf);
      };
      frame = requestAnimationFrame(raf);
      document.documentElement.classList.add("lenis");
    };

    const onFirstInteract = () => start();
    window.addEventListener("pointerdown", onFirstInteract, { once: true, passive: true });
    window.addEventListener("wheel", onFirstInteract, { once: true, passive: true });
    window.addEventListener("keydown", onFirstInteract, { once: true });
    removeIdle = whenIdle(start);

    return () => {
      cancelled = true;
      removeIdle?.();
      window.removeEventListener("pointerdown", onFirstInteract);
      window.removeEventListener("wheel", onFirstInteract);
      window.removeEventListener("keydown", onFirstInteract);
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("lenis");
      if (lenis) {
        if (win.__vasrithaLenis === (lenis as unknown as LenisHandle)) {
          delete win.__vasrithaLenis;
        }
        lenis.destroy();
      }
    };
  }, [isAdmin]);

  return (
    <>
      <ScrollToTop />
      {children}
    </>
  );
}
