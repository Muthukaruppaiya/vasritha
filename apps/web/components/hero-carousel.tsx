"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLocale, useT } from "../lib/i18n/provider";
import { cmsOrT } from "../lib/i18n/cms-local";

const FALLBACK_SLIDES = [
  { image: "/hero-silk.png", alt: "Model wearing a Kanchipuram silk saree" },
  { image: "/hero-salwar.png", alt: "Model wearing an embroidered churidhar salwar suit" },
  { image: "/hero-jewelry.png", alt: "Model wearing traditional gold jewelry" }
];

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

export function HeroCarousel() {
  const t = useT();
  const { locale } = useLocale();
  const [slides, setSlides] = useState<HeroSlide[]>(FALLBACK_SLIDES);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef(0);
  const slideWidth = useRef(1);
  const activeRef = useRef(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pausedUntil = useRef(0);

  useEffect(() => {
    fetch("/api/homepage-config")
      .then((res) => res.json())
      .then((payload) => {
        const rows = (payload?.data?.heroSlides || []) as Array<{
          image: string;
          alt: string;
          title?: string | null;
          subtitle?: string | null;
          ctaLabel?: string | null;
          ctaHref?: string | null;
          cta2Label?: string | null;
          cta2Href?: string | null;
        }>;
        if (rows.length) {
          setSlides(
            rows.map((row) => ({
              image: row.image,
              alt: row.alt || "Vasritha",
              title: row.title,
              subtitle: row.subtitle,
              ctaLabel: row.ctaLabel,
              ctaHref: row.ctaHref,
              cta2Label: row.cta2Label,
              cta2Href: row.cta2Href
            }))
          );
          setActiveSlide(0);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    activeRef.current = activeSlide;
    applyTrackTransform(0);
  }, [activeSlide]);

  useEffect(() => {
    if (slides.length < 2) return;
    const interval = window.setInterval(() => {
      if (Date.now() < pausedUntil.current || pointerStart.current) return;
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, [slides.length]);

  const applyTrackTransform = (offset: number, animate = true) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition =
      animate && !pointerStart.current ? "transform .7s cubic-bezier(.22,.61,.36,1)" : "none";
    track.style.transform = `translateX(calc(${-activeRef.current * 100}% + ${offset}px))`;
  };

  const measureSlideWidth = () => {
    const track = trackRef.current;
    if (!track) return sectionRef.current?.clientWidth || 1;
    return track.clientWidth || sectionRef.current?.clientWidth || 1;
  };

  const goTo = (index: number) => {
    const next = (index + slides.length) % slides.length;
    setActiveSlide(next);
    pausedUntil.current = Date.now() + 5000;
  };

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;
    slideWidth.current = measureSlideWidth();
    pointerStart.current = { x: event.clientX, y: event.clientY };
    dragOffset.current = 0;
    setIsDragging(true);
    applyTrackTransform(0, false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointerStart.current) return;
    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && dragOffset.current === 0) return;
    if (Math.abs(dy) > Math.abs(dx) && dragOffset.current === 0) return;

    const width = slideWidth.current;
    const atStart = activeRef.current === 0;
    const atEnd = activeRef.current === slides.length - 1;
    let next = dx;
    if (atStart && next > 0) next *= 0.28;
    if (atEnd && next < 0) next *= 0.28;
    next = Math.max(-width * 0.95, Math.min(width * 0.95, next));
    dragOffset.current = next;
    applyTrackTransform(next, false);
  };

  const onPointerUp = () => {
    if (!pointerStart.current) return;
    const threshold = slideWidth.current * 0.18;
    const offset = dragOffset.current;
    pointerStart.current = null;
    dragOffset.current = 0;
    setIsDragging(false);

    if (offset <= -threshold) goTo(activeRef.current + 1);
    else if (offset >= threshold) goTo(activeRef.current - 1);
    else applyTrackTransform(0, true);
  };

  const active = slides[activeSlide] || slides[0];
  const title = cmsOrT(locale, active?.title, "home.heroTitle");
  const subtitle = cmsOrT(locale, active?.subtitle, "home.heroLead");
  const ctaLabel = cmsOrT(locale, active?.ctaLabel, "home.exploreSarees");
  const ctaHref = active?.ctaHref || "/sarees";
  const cta2Label = cmsOrT(locale, active?.cta2Label, "home.discoverJewelry");
  const cta2Href = active?.cta2Href || "/jewelry";
  const thumbnailSlides = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ index }) => index !== activeSlide)
    .slice(0, 2);

  return (
    <section
      ref={sectionRef}
      className={`hero ${isDragging ? "is-dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div ref={trackRef} className="hero-track">
        {slides.map((slide) => (
          <div className="hero-slide" key={slide.image}>
            <Image
              src={slide.image}
              alt={slide.alt}
              fill
              priority={slide.image === slides[0].image}
              sizes="100vw"
              draggable={false}
            />
          </div>
        ))}
      </div>
      <div className="hero-copy">
        <div className="eyebrow">{t("home.heroEyebrow")}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <Link className="btn" href={ctaHref}>
          {ctaLabel}
        </Link>
        <Link className="btn ghost" href={cta2Href}>
          {cta2Label}
        </Link>
      </div>
      <div className="hero-thumbnails" aria-hidden="true">
        {thumbnailSlides.map(({ slide, index }) => (
          <div className="hero-thumbnail" key={`${slide.image}-${index}`}>
            <Image src={slide.image} alt="" fill sizes="100px" draggable={false} />
          </div>
        ))}
      </div>
      <div className="hero-dots">
        {slides.map((slide, index) => (
          <button
            key={slide.image}
            type="button"
            className={index === activeSlide ? "active" : ""}
            aria-label={`Show slide ${index + 1}`}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </section>
  );
}
