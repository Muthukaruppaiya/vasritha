"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ProductGalleryProps = {
  images: string[];
  alt: string;
};

export function ProductGallery({ images, alt }: ProductGalleryProps) {
  const slides = images.length > 0 ? images : ["/hero-silk.png"];
  const [active, setActive] = useState(0);
  const [zooming, setZooming] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const activeRef = useRef(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef(0);
  const slideWidth = useRef(1);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    activeRef.current = active;
    applyTrack(0);
  }, [active]);

  const applyTrack = (offset: number, animate = true) => {
    const track = trackRef.current;
    if (!track) return;
    track.style.transition =
      animate && !pointerStart.current
        ? "transform .65s cubic-bezier(.22,.61,.36,1)"
        : "none";
    track.style.transform = `translate3d(calc(${-activeRef.current * 100}% + ${offset}px), 0, 0)`;
  };

  const goTo = (index: number) => {
    const next = ((index % slides.length) + slides.length) % slides.length;
    setActive(next);
    setZooming(false);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    slideWidth.current = viewportRef.current?.clientWidth || 1;
    pointerStart.current = { x: event.clientX, y: event.clientY };
    dragOffset.current = 0;
    setDragging(true);
    setZooming(false);
    applyTrack(0, false);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStart.current) {
      updateZoom(event);
      return;
    }

    const dx = event.clientX - pointerStart.current.x;
    const dy = event.clientY - pointerStart.current.y;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && dragOffset.current === 0) return;
    if (Math.abs(dy) > Math.abs(dx) && dragOffset.current === 0) return;

    let next = dx;
    const atStart = activeRef.current === 0;
    const atEnd = activeRef.current === slides.length - 1;
    if (atStart && next > 0) next *= 0.28;
    if (atEnd && next < 0) next *= 0.28;
    dragOffset.current = next;
    applyTrack(next, false);
  };

  const onPointerUp = () => {
    if (!pointerStart.current) return;
    const width = slideWidth.current;
    const threshold = Math.min(72, width * 0.18);
    const offset = dragOffset.current;
    pointerStart.current = null;
    setDragging(false);

    if (offset <= -threshold) goTo(activeRef.current + 1);
    else if (offset >= threshold) goTo(activeRef.current - 1);
    else applyTrack(0);
    dragOffset.current = 0;
  };

  const updateZoom = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging || window.matchMedia("(hover: none)").matches) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin({
      x: Math.min(100, Math.max(0, x)),
      y: Math.min(100, Math.max(0, y))
    });
    setZooming(true);
  };

  const onPointerLeave = () => {
    if (pointerStart.current) onPointerUp();
    setZooming(false);
  };

  return (
    <div className="product-gallery">
      <div
        ref={viewportRef}
        className={`product-gallery-viewport${zooming ? " is-zooming" : ""}${dragging ? " is-dragging" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerEnter={updateZoom}
      >
        <div ref={trackRef} className="product-gallery-track">
          {slides.map((src, index) => (
            <div key={`${src}-${index}`} className="product-gallery-slide">
              <Image
                src={src}
                alt={`${alt} — image ${index + 1}`}
                fill
                priority={index === 0}
                sizes="(max-width: 800px) 100vw, 50vw"
                className="product-gallery-image"
                style={
                  index === active && zooming
                    ? {
                        transform: "scale(2.15)",
                        transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`
                      }
                    : undefined
                }
                draggable={false}
              />
            </div>
          ))}
        </div>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              className="product-gallery-nav product-gallery-nav-prev"
              aria-label="Previous image"
              onClick={() => goTo(active - 1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="product-gallery-nav product-gallery-nav-next"
              aria-label="Next image"
              onClick={() => goTo(active + 1)}
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}

        <div className="product-gallery-hint" aria-hidden="true">
          Hover to zoom · swipe to browse
        </div>
      </div>

      {slides.length > 1 && (
        <div className="product-gallery-thumbs" role="tablist" aria-label="Product images">
          {slides.map((src, index) => (
            <button
              key={`${src}-thumb-${index}`}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={`product-gallery-thumb${index === active ? " is-active" : ""}`}
              onClick={() => goTo(index)}
            >
              <Image src={src} alt="" fill sizes="88px" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
