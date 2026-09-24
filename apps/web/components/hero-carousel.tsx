"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "../lib/i18n/provider";
import { cmsOrT } from "../lib/i18n/cms-local";
import { fetchPublicJson } from "../lib/public-fetch-cache";

const FALLBACK_SLIDES = [
  { image: "/hero-silk.png", alt: "Model wearing a Kanchipuram silk saree" },
  { image: "/hero-salwar.png", alt: "Model wearing an embroidered churidhar salwar suit" },
  { image: "/hero-jewelry.png", alt: "Model wearing traditional gold jewelry" },
  { image: "/gallery/gallery-saree-crimson.png", alt: "Crimson silk saree detail" }
];

/** How long each single panel stays before the next panel changes */
const PANEL_CHANGE_MS = 4200;
const PAUSE_MS = 9000;

type HeroSlide = {
  image: string;
  alt: string;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  cta2Label?: string | null;
  cta2Href?: string | null;
};

function nextUnusedIndex(current: number[], panel: number, total: number) {
  if (total <= 1) return 0;
  const used = new Set(current.filter((_, i) => i !== panel));
  let next = (current[panel] + 1) % total;
  let guard = 0;
  while (used.has(next) && guard < total) {
    next = (next + 1) % total;
    guard += 1;
  }
  return next;
}

function HeroPanel({
  slides,
  visibleIndex,
  priority = false,
  className = ""
}: {
  slides: HeroSlide[];
  visibleIndex: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={`hero-panel ${className}`.trim()}>
      {slides.map((slide, index) => (
        <div
          key={slide.image}
          className={`hero-layer${index === visibleIndex ? " is-on" : ""}`}
          aria-hidden={index !== visibleIndex}
        >
          <Image
            src={slide.image}
            alt={index === visibleIndex ? slide.alt : ""}
            fill
            priority={priority && index === 0}
            sizes="(min-width: 1101px) 34vw, (min-width: 901px) 50vw, 100vw"
            draggable={false}
          />
        </div>
      ))}
    </div>
  );
}

export function HeroCarousel() {
  const { locale } = useLocale();
  const [slides, setSlides] = useState<HeroSlide[]>(FALLBACK_SLIDES);
  const [panelIndexes, setPanelIndexes] = useState([0, 1, 2]);
  const [panelCursor, setPanelCursor] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [entered, setEntered] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef(0);
  const panelIndexesRef = useRef(panelIndexes);
  const panelCursorRef = useRef(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const pausedUntil = useRef(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    panelIndexesRef.current = panelIndexes;
  }, [panelIndexes]);

  useEffect(() => {
    panelCursorRef.current = panelCursor;
  }, [panelCursor]);

  useEffect(() => {
    fetchPublicJson<{
      data?: {
        heroSlides?: Array<{
          image: string;
          alt: string;
          title?: string | null;
          subtitle?: string | null;
          ctaLabel?: string | null;
          ctaHref?: string | null;
          cta2Label?: string | null;
          cta2Href?: string | null;
        }>;
      };
    }>("/api/homepage-config")
      .then((payload) => {
        const rows = payload?.data?.heroSlides || [];
        if (rows.length >= 2) {
          const mapped = rows.map((row) => ({
            image: row.image,
            alt: row.alt || "Vasritha",
            title: row.title,
            subtitle: row.subtitle,
            ctaLabel: row.ctaLabel,
            ctaHref: row.ctaHref,
            cta2Label: row.cta2Label,
            cta2Href: row.cta2Href
          }));
          setSlides(mapped);
          setPanelIndexes([0, Math.min(1, mapped.length - 1), Math.min(2, mapped.length - 1)]);
          setPanelCursor(0);
        }
      })
      .catch(() => undefined);
  }, []);

  const [visiblePanels, setVisiblePanels] = useState(1);

  useEffect(() => {
    const mqWide = window.matchMedia("(min-width: 1101px)");
    const mqDuo = window.matchMedia("(min-width: 901px)");
    const update = () => {
      if (mqWide.matches && slides.length >= 3) setVisiblePanels(3);
      else if (mqDuo.matches && slides.length >= 2) setVisiblePanels(2);
      else setVisiblePanels(1);
    };
    update();
    mqWide.addEventListener("change", update);
    mqDuo.addEventListener("change", update);
    return () => {
      mqWide.removeEventListener("change", update);
      mqDuo.removeEventListener("change", update);
    };
  }, [slides.length]);

  const panelCount = visiblePanels;

  /** Auto: change one panel at a time, left → middle → right → left… */
  useEffect(() => {
    if (slides.length < 2) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (Date.now() < pausedUntil.current || pointerStart.current) return;

      const count = panelCount;
      const panel = panelCursorRef.current % count;
      setPanelIndexes((current) => {
        const next = [...current];
        next[panel] = nextUnusedIndex(current.slice(0, count), panel, slides.length);
        return next;
      });
      setPanelCursor((c) => (c + 1) % count);
    };

    const interval = window.setInterval(tick, PANEL_CHANGE_MS);
    return () => window.clearInterval(interval);
  }, [slides.length, panelCount]);

  const advanceAll = (direction: 1 | -1) => {
    pausedUntil.current = Date.now() + PAUSE_MS;
    setPanelIndexes((current) => {
      const count = panelCount;
      return current.map((idx, i) => {
        if (i >= count) return idx;
        if (slides.length <= count) {
          return (idx + direction + slides.length) % slides.length;
        }
        return (idx + direction + slides.length) % slides.length;
      });
    });
  };

  const goToDot = (index: number) => {
    pausedUntil.current = Date.now() + PAUSE_MS;
    const count = panelCount;
    setPanelIndexes((current) => {
      const next = [...current];
      next[0] = index;
      for (let i = 1; i < count; i += 1) {
        next[i] = (index + i) % slides.length;
      }
      return next;
    });
    setPanelCursor(0);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    dragOffset.current = 0;
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointerStart.current) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && dragOffset.current === 0) return;
    if (Math.abs(dy) > Math.abs(dx) && dragOffset.current === 0) return;
    dragOffset.current = dx;
  };

  const onPointerUp = () => {
    if (!pointerStart.current) return;
    const width = sectionRef.current?.clientWidth || 1;
    const threshold = width * 0.12;
    const offset = dragOffset.current;
    pointerStart.current = null;
    dragOffset.current = 0;
    setIsDragging(false);
    if (offset <= -threshold) advanceAll(1);
    else if (offset >= threshold) advanceAll(-1);
  };

  const primary = slides[panelIndexes[0]] || slides[0];
  const layout =
    panelCount >= 3 ? "hero--trio" : panelCount === 2 ? "hero--duo" : "hero--solo";

  const title = cmsOrT(locale, primary?.title, "home.heroTitle");
  const subtitle = cmsOrT(locale, primary?.subtitle, "home.heroLead");
  const ctaLabel = cmsOrT(locale, primary?.ctaLabel, "home.exploreSarees");
  const ctaHref = primary?.ctaHref || "/sarees";
  const cta2Label = cmsOrT(locale, primary?.cta2Label, "home.discoverJewelry");
  const cta2Href = primary?.cta2Href || "/jewelry";

  return (
    <section
      ref={sectionRef}
      className={`hero${isDragging ? " is-dragging" : ""}${entered ? " is-ready" : ""} ${layout}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-roledescription="carousel"
      aria-label="Vasritha featured looks"
    >
      <div className="hero-stage">
        <HeroPanel
          slides={slides}
          visibleIndex={panelIndexes[0]}
          priority
          className="hero-panel--primary"
        />
        {panelCount > 1 ? (
          <HeroPanel
            slides={slides}
            visibleIndex={panelIndexes[1]}
            className="hero-panel--secondary"
          />
        ) : null}
        {panelCount > 2 ? (
          <HeroPanel
            slides={slides}
            visibleIndex={panelIndexes[2]}
            className="hero-panel--tertiary"
          />
        ) : null}
      </div>

      <div className="hero-veil" aria-hidden="true" />

      <div className="hero-copy">
        <p className="hero-brand">Vasritha</p>
        <h1>{title}</h1>
        <p className="hero-lead">{subtitle}</p>
        <div className="hero-cta">
          <Link className="btn" href={ctaHref}>
            {ctaLabel}
          </Link>
          <Link className="btn ghost" href={cta2Href}>
            {cta2Label}
          </Link>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="hero-dots" role="tablist" aria-label="Hero looks">
          {slides.map((slide, index) => (
            <button
              key={slide.image}
              type="button"
              role="tab"
              aria-selected={panelIndexes[0] === index}
              className={panelIndexes[0] === index ? "active" : ""}
              aria-label={`Show look ${index + 1}`}
              onClick={() => goToDot(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
