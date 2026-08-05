"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n/provider";

const slides = [
  { image: "/hero-silk.png", alt: "Model wearing a Kanchipuram silk saree" },
  { image: "/hero-salwar.png", alt: "Model wearing an embroidered churidhar salwar suit" },
  { image: "/hero-jewelry.png", alt: "Model wearing traditional gold jewelry" }
];

export function HeroCarousel() {
  const t = useT();
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
    activeRef.current = activeSlide;
    applyTrackTransform(0);
  }, [activeSlide]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (Date.now() < pausedUntil.current || pointerStart.current) return;
      setActiveSlide((current) => (current + 1) % slides.length);
    }, 4000);
    return () => window.clearInterval(interval);
  }, []);

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
        <h1>{t("home.heroTitle")}</h1>
        <p>{t("home.heroLead")}</p>
        <Link className="btn" href="/sarees">
          {t("home.exploreSarees")}
        </Link>
        <Link className="btn ghost" href="/jewelry">
          {t("home.discoverJewelry")}
        </Link>
      </div>
      <div className="hero-thumbnails" aria-hidden="true">
        {slides.map((slide, index) => (
          <div className={`hero-thumbnail ${index === activeSlide ? "is-active" : ""}`} key={slide.image}>
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
