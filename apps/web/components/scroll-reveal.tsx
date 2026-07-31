"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SELECTOR = "[data-reveal]:not(.is-revealed)";

function supportsViewTimeline() {
  return typeof CSS !== "undefined" && CSS.supports("animation-timeline", "view()");
}

export function ScrollRevealInit() {
  const pathname = usePathname();

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = () => Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reduceMotion) {
      nodes().forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    // Native CSS scroll-driven animations handle the effect when supported.
    if (supportsViewTimeline()) {
      document.documentElement.classList.add("has-view-timeline");
      return;
    }

    document.documentElement.classList.remove("has-view-timeline");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -10% 0px" }
    );

    const observe = () => {
      document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => observer.observe(el));
    };

    observe();
    const timer = window.setTimeout(observe, 120);
    const timer2 = window.setTimeout(observe, 480);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(timer2);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
