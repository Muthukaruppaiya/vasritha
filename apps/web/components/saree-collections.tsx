"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { collections } from "../lib/mock-data";

const MOBILE_QUERY = "(max-width: 800px)";

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function SareeCollections() {
  const pinRef = useRef<HTMLElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [pinHeight, setPinHeight] = useState<number>();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const syncMode = () => setIsMobile(media.matches);
    syncMode();
    media.addEventListener("change", syncMode);
    return () => media.removeEventListener("change", syncMode);
  }, []);

  useEffect(() => {
    const pin = pinRef.current;
    const sticky = stickyRef.current;
    const track = trackRef.current;
    if (!pin || !sticky || !track) return;

    let frame = 0;
    let currentShift = 0;
    let targetShift = 0;
    let running = true;

    const getOverflow = () => {
      const viewport = track.parentElement;
      const visible = viewport?.clientWidth || sticky.clientWidth;
      return Math.max(0, track.scrollWidth - visible);
    };

    const measure = () => {
      if (!isMobile) {
        setPinHeight(undefined);
        track.style.transform = "";
        currentShift = 0;
        targetShift = 0;
        return;
      }

      const overflow = getOverflow();
      // Extra travel distance makes horizontal motion feel smoother
      setPinHeight(sticky.offsetHeight + overflow * 1.45 + 48);
    };

    const readTarget = () => {
      if (!isMobile) return 0;
      const overflow = getOverflow();
      if (overflow <= 0) return 0;

      const travel = Math.max(1, pin.offsetHeight - sticky.offsetHeight);
      const raw = -pin.getBoundingClientRect().top;
      const progress = Math.min(1, Math.max(0, raw / travel));
      return easeInOutCubic(progress) * overflow;
    };

    const tick = () => {
      if (!running) return;

      if (isMobile) {
        targetShift = readTarget();
        const delta = targetShift - currentShift;
        // High damping for buttery horizontal motion
        currentShift += delta * (Math.abs(delta) < 0.15 ? 1 : 0.085);
        if (Math.abs(delta) < 0.15) currentShift = targetShift;

        track.style.transform = `translate3d(${-currentShift}px,0,0)`;

        const card = track.querySelector(".collection-card") as HTMLElement | null;
        const step = (card?.offsetWidth || 280) + 14;
        const index = Math.min(collections.length - 1, Math.round(currentShift / Math.max(step, 1)));
        setActiveIndex((current) => (current === index ? current : index));
      }

      frame = requestAnimationFrame(tick);
    };

    measure();
    targetShift = readTarget();
    currentShift = targetShift;
    frame = requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver(() => {
      measure();
      targetShift = readTarget();
    });
    resizeObserver.observe(sticky);
    resizeObserver.observe(track);
    window.addEventListener("resize", measure);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [isMobile]);

  return (
    <section
      ref={pinRef}
      className={`collections-pin ${isMobile ? "is-mobile" : ""}`}
      style={isMobile && pinHeight ? { height: pinHeight } : undefined}
    >
      <div ref={stickyRef} className="shell section collections-edit">
        <div className="collections-edit-head">
          <div className="collections-edit-intro">
            <div className="eyebrow">Signature edit</div>
            <h2>Saree Collections</h2>
            <p className="muted collections-edit-lead">Five heirloom weaves, curated for every occasion.</p>
            <Link className="collections-edit-link" href="/sarees">Shop all sarees →</Link>
          </div>
        </div>

        <div className="collection-strip-viewport">
          <div ref={trackRef} className="collection-strip">
            {collections.map((collection) => (
              <Link className="collection-card" href="/sarees" key={collection.name}>
                <span className="collection-card-media">
                  <Image src={collection.image} alt={collection.name} fill sizes="(max-width:800px) 78vw, 20vw" />
                </span>
                <span className="collection-card-copy">
                  <strong>{collection.name}</strong>
                  <small>{collection.blurb}</small>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <div className="collection-progress" aria-hidden={!isMobile}>
          {collections.map((collection, index) => (
            <span key={collection.name} className={index === activeIndex ? "active" : ""} />
          ))}
        </div>
      </div>
    </section>
  );
}
