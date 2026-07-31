"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";
import { ScrollToTop } from "./scroll-to-top";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const lenis = new Lenis({
      duration: 1.25,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.15,
      wheelMultiplier: 0.92,
      lerp: 0.075
    });

    window.__vasrithaLenis = lenis;

    let frame = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    document.documentElement.classList.add("lenis");
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.classList.remove("lenis");
      if (window.__vasrithaLenis === lenis) delete window.__vasrithaLenis;
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <ScrollToTop />
      {children}
    </>
  );
}
