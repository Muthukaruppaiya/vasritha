"use client";

import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../lib/i18n/provider";
import type { MessageKey } from "../lib/i18n/translate";

const STORY_MS = 5200;

const STATUS_DEFS: Array<{ labelKey: MessageKey; image: string; href: string }> = [
  { labelKey: "home.statusNewSarees", image: "/hero-silk.png", href: "/sarees" },
  { labelKey: "home.statusFestive", image: "/hero-salwar.png", href: "/churidhars-salwars" },
  { labelKey: "home.statusJewelry", image: "/hero-jewelry.png", href: "/jewelry" },
  { labelKey: "home.statusCottons", image: "/catalog-cotton-saree.png", href: "/sarees" },
  { labelKey: "home.statusBangles", image: "/catalog-bangles.png", href: "/jewelry" },
  { labelKey: "home.statusHandcrafted", image: "/catalog-wooden-item.png", href: "/handcrafted" },
  { labelKey: "home.statusOffers", image: "/catalog-earrings.png", href: "/checkout" }
];

export function ArrivalStatusBar() {
  const t = useT();
  const statuses = useMemo(
    () =>
      STATUS_DEFS.map((item) => ({
        label: t(item.labelKey),
        image: item.image,
        href: item.href
      })),
    [t]
  );

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const [mounted, setMounted] = useState(false);
  const pausedRef = useRef(false);
  const frameRef = useRef(0);
  const startedAtRef = useRef(0);
  const elapsedRef = useRef(0);

  const isOpen = activeIndex !== null;
  const active = activeIndex != null ? statuses[activeIndex] : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeViewer = useCallback(() => {
    setActiveIndex(null);
    setProgress(0);
    pausedRef.current = false;
    elapsedRef.current = 0;
  }, []);

  const openViewer = useCallback((index: number) => {
    setActiveIndex(index);
    setProgress(0);
    pausedRef.current = false;
    elapsedRef.current = 0;
    startedAtRef.current = performance.now();
    setSeen((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
  }, []);

  const goNext = useCallback(() => {
    setActiveIndex((current) => {
      if (current == null) return current;
      if (current >= statuses.length - 1) return null;
      const next = current + 1;
      setSeen((prev) => {
        const updated = new Set(prev);
        updated.add(next);
        return updated;
      });
      elapsedRef.current = 0;
      startedAtRef.current = performance.now();
      setProgress(0);
      return next;
    });
  }, [statuses.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((current) => {
      if (current == null) return current;
      const ratio = Math.min(1, elapsedRef.current / STORY_MS);
      if (ratio > 0.22 || current === 0) {
        elapsedRef.current = 0;
        startedAtRef.current = performance.now();
        setProgress(0);
        return current;
      }
      const prev = current - 1;
      elapsedRef.current = 0;
      startedAtRef.current = performance.now();
      setProgress(0);
      return prev;
    });
  }, []);

  useEffect(() => {
    if (!isOpen || activeIndex == null) return;

    const tick = (now: number) => {
      if (!pausedRef.current) {
        const delta = now - startedAtRef.current;
        startedAtRef.current = now;
        elapsedRef.current += delta;
        const ratio = Math.min(1, elapsedRef.current / STORY_MS);
        setProgress(ratio);
        if (ratio >= 1) {
          goNext();
          return;
        }
      } else {
        startedAtRef.current = now;
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    startedAtRef.current = performance.now();
    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, [isOpen, activeIndex, goNext]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closeViewer, goNext, goPrev]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
    startedAtRef.current = performance.now();
  };

  const viewer =
    mounted &&
    isOpen &&
    active &&
    activeIndex != null &&
    createPortal(
      <div className="status-story" role="dialog" aria-modal="true" aria-label={active.label}>
        <div className="status-story-backdrop" aria-hidden="true" />
        <div className="status-story-stage">
          <div className="status-story-progress" aria-hidden="true">
            {statuses.map((_, index) => (
              <span key={statuses[index].label} className="status-story-bar">
                <i
                  style={{
                    width:
                      index < activeIndex
                        ? "100%"
                        : index === activeIndex
                          ? `${progress * 100}%`
                          : "0%"
                  }}
                />
              </span>
            ))}
          </div>

          <div className="status-story-top">
            <div className="status-story-meta">
              <span className="status-story-avatar">
                <Image src={active.image} alt="" fill sizes="40px" />
              </span>
              <div>
                <strong>Vasritha</strong>
                <span>{active.label}</span>
              </div>
            </div>
            <button
              className="status-story-close"
              type="button"
              aria-label={t("home.closePreview")}
              onClick={closeViewer}
            >
              <X size={22} />
            </button>
          </div>

          <div
            className="status-story-media"
            onPointerDown={pause}
            onPointerUp={resume}
            onPointerCancel={resume}
            onPointerLeave={resume}
          >
            <Image
              src={active.image}
              alt={active.label}
              fill
              priority
              sizes="(max-width: 800px) 100vw, 480px"
              className="status-story-image"
            />
            <button
              className="status-story-hit status-story-hit--prev"
              type="button"
              aria-label="Previous status"
              onClick={goPrev}
            />
            <button
              className="status-story-hit status-story-hit--next"
              type="button"
              aria-label="Next status"
              onClick={goNext}
            />
          </div>

          <div className="status-story-footer">
            <Link className="btn" href={active.href} onClick={closeViewer}>
              {t("home.exploreNow")}
            </Link>
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <section className="status-section" data-reveal>
      <div className="shell">
        <div className="status-head">
          <div>
            <div className="eyebrow">{t("home.freshFrom")}</div>
            <h2>{t("home.newArrivalsUpdates")}</h2>
          </div>
          <span className="muted">{t("home.arrivalHint")}</span>
        </div>
        <div className="status-list">
          {statuses.map((status, index) => (
            <button
              className={`status-item${seen.has(index) ? " is-seen" : ""}`}
              type="button"
              onClick={() => openViewer(index)}
              key={status.label}
            >
              <span className="status-ring">
                <span className="status-image">
                  <Image src={status.image} alt="" fill sizes="118px" />
                </span>
              </span>
              <span>{status.label}</span>
            </button>
          ))}
        </div>
      </div>
      {viewer}
    </section>
  );
}
