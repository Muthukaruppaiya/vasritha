"use client";

import { useEffect, useRef, useState } from "react";

type Tip = {
  text: string;
  x: number;
  y: number;
  below: boolean;
};

function tipHost(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>(
    ".admin [data-tooltip], .admin .admin-icon-tip, .admin .admin-action-btn"
  );
}

function tipText(host: HTMLElement) {
  return (
    host.getAttribute("data-tooltip") ||
    host.getAttribute("aria-label") ||
    host.getAttribute("title") ||
    ""
  ).trim();
}

/** Fixed tooltip so button labels stay visible when a panel clips overflow. */
export function AdminHoverTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const place = (host: HTMLElement) => {
      if (hostRef.current === host) return;
      hostRef.current = host;
      const text = tipText(host);
      if (!text || host.hasAttribute("disabled") || host.getAttribute("aria-disabled") === "true") {
        hostRef.current = null;
        setTip(null);
        return;
      }
      const rect = host.getBoundingClientRect();
      const below = rect.top < 72;
      setTip({
        text,
        x: Math.min(window.innerWidth - 12, Math.max(12, rect.left + rect.width / 2)),
        y: below ? rect.bottom + 8 : rect.top - 8,
        below
      });
    };

    const clear = () => {
      hostRef.current = null;
      setTip(null);
    };

    const onOver = (event: MouseEvent) => {
      const host = tipHost(event.target);
      if (!host) return;
      place(host);
    };

    const onOut = (event: MouseEvent) => {
      const host = tipHost(event.target);
      if (!host) return;
      const next = event.relatedTarget;
      if (next instanceof Node && host.contains(next)) return;
      clear();
    };

    const onFocus = (event: FocusEvent) => {
      const host = tipHost(event.target);
      if (!host) return;
      place(host);
    };
    const onBlur = () => clear();
    const hide = () => clear();

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  if (!tip) return null;

  return (
    <div
      className={`admin-hover-tip${tip.below ? " is-below" : ""}`}
      style={{ left: tip.x, top: tip.y }}
      role="tooltip"
    >
      {tip.text}
    </div>
  );
}
