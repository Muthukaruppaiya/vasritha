"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { storeReviews } from "../lib/mock-data";
import { useT } from "../lib/i18n/provider";

type StoreReview = (typeof storeReviews)[number];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="review-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < rating ? "is-on" : ""} aria-hidden="true">★</span>
      ))}
    </div>
  );
}

function ReviewChip({
  review,
  onOpen
}: {
  review: StoreReview;
  onOpen: (review: StoreReview) => void;
}) {
  return (
    <button className="review-chip" type="button" onClick={() => onOpen(review)}>
      <span className="review-chip-media">
        <Image src={review.image} alt="" fill sizes="120px" />
      </span>
      <span className="review-chip-body">
        <Stars rating={review.rating} />
        <strong className="review-chip-title">{review.title}</strong>
        <p>“{review.body}”</p>
        <span className="review-meta">
          <strong>{review.name}</strong>
          <span>{review.place}</span>
        </span>
      </span>
    </button>
  );
}

function MarqueeRow({
  items,
  direction,
  onOpen
}: {
  items: StoreReview[];
  direction: "ltr" | "rtl";
  onOpen: (review: StoreReview) => void;
}) {
  const loop = [...items, ...items];

  return (
    <div className={`reviews-marquee reviews-marquee--${direction}`}>
      <div className="reviews-marquee-track">
        {loop.map((review, index) => (
          <ReviewChip
            key={`${direction}-${review.id}-${index}`}
            review={review}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

export function ReviewsSection() {
  const t = useT();
  const [selected, setSelected] = useState<StoreReview | null>(null);
  const midpoint = Math.ceil(storeReviews.length / 2);
  const rowLeftToRight = storeReviews.slice(0, midpoint);
  const rowRightToLeft = storeReviews.slice(midpoint);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

  return (
    <section className="reviews-section" data-reveal>
      <div className="shell reviews-head-wrap">
        <div className="section-head reviews-head">
          <div>
            <div className="eyebrow">{t("home.lovedByClients")}</div>
            <h2>{t("home.storiesInWeave")}</h2>
          </div>
          <p className="muted reviews-summary">{t("home.reviewsTap")}</p>
        </div>
      </div>

      <div className={`reviews-marquee-stack${selected ? " is-paused" : ""}`}>
        <MarqueeRow items={rowLeftToRight} direction="ltr" onOpen={setSelected} />
        <MarqueeRow items={rowRightToLeft} direction="rtl" onOpen={setSelected} />
      </div>

      {selected && (
        <div className="review-modal" role="dialog" aria-modal="true" aria-label={selected.title}>
          <button className="review-modal-backdrop" type="button" aria-label="Close review" onClick={() => setSelected(null)} />
          <div className="review-modal-card">
            <button className="review-modal-close" type="button" aria-label="Close review" onClick={() => setSelected(null)}>
              <X size={20} />
            </button>
            <div className="review-modal-media">
              <Image src={selected.image} alt={selected.title} fill sizes="(max-width: 800px) 90vw, 280px" />
            </div>
            <div className="review-modal-copy">
              <div className="eyebrow">{selected.occasion}</div>
              <Stars rating={selected.rating} />
              <h3>{selected.title}</h3>
              <p>“{selected.body}”</p>
              <div className="review-meta">
                <strong>{selected.name}</strong>
                <span>{selected.place}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
