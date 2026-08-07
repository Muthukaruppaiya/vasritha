"use client";

import Image from "next/image";
import Link from "next/link";
import { Camera, ImagePlus, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { isLoggedIn } from "../lib/customer-session";
import { getStoreUser, storeFetch } from "../lib/store-api";
import { CUSTOMER_AUTH_EVENT } from "../lib/customer-auth-event";

type ReviewRow = {
  id: string;
  customer_name: string;
  rating: number;
  title: string | null;
  body: string;
  image_path: string | null;
  created_at: string;
};

function Stars({ rating }: { rating: number }) {
  return (
    <div className="review-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < rating ? "is-on" : ""} aria-hidden="true">
          ★
        </span>
      ))}
    </div>
  );
}

export function ProductReviews({
  productId,
  productSlug,
  productName
}: {
  productId: string;
  productSlug: string;
  productName: string;
}) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const user = useMemo(() => getStoreUser(), [loggedIn, open]);

  const load = async () => {
    setLoading(true);
    const result = await storeFetch<ReviewRow[]>(`/api/reviews?productId=${productId}`);
    setReviews(Array.isArray(result.data) ? result.data : []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    const sync = () => setLoggedIn(isLoggedIn());
    sync();
    window.addEventListener(CUSTOMER_AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(CUSTOMER_AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const onPickFile = (picked: File | null) => {
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (picked.size > 4 * 1024 * 1024) {
      setError("Image must be under 4MB.");
      return;
    }
    setError("");
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    if (galleryRef.current) galleryRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!loggedIn) return;
    setSaving(true);
    setError("");
    setSuccess("");

    const form = new FormData();
    form.set("productId", productId);
    form.set("customerName", user?.fullName || user?.email || "Customer");
    form.set("rating", String(rating));
    form.set("title", title);
    form.set("body", body);
    if (file) form.set("image", file);

    const token = typeof window !== "undefined" ? window.localStorage.getItem("vasritha_customer_token") : null;
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form
    });
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);

    if (!res.ok) {
      setError(payload?.error || "Could not submit review.");
      return;
    }

    setSuccess("Thanks! Your review was submitted and is pending approval.");
    setTitle("");
    setBody("");
    setRating(5);
    clearImage();
    setOpen(false);
  };

  const average = reviews.length
    ? Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10
    : 0;

  return (
    <section className="product-reviews">
      <div className="product-reviews-head">
        <div>
          <div className="eyebrow">Reviews</div>
          <h2>What clients say</h2>
        </div>
        <div className="product-reviews-actions">
          {reviews.length > 0 ? (
            <p className="product-reviews-summary">
              <strong>{average}</strong>
              <span>
                average · {reviews.length} review{reviews.length === 1 ? "" : "s"}
              </span>
            </p>
          ) : null}
          {loggedIn ? (
            <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
              {open ? "Close" : "Write a review"}
            </button>
          ) : (
            <Link className="btn" href={`/login?next=/products/${productSlug}`}>
              Login to review
            </Link>
          )}
        </div>
      </div>

      {success ? <p className="product-review-success">{success}</p> : null}

      {open && loggedIn ? (
        <form className="product-review-form" onSubmit={onSubmit}>
          <p className="muted">
            Sharing your experience for <strong>{productName}</strong>. Reviews appear on the site after
            admin approval.
          </p>
          <label>
            <span>Rating</span>
            <div className="product-review-rating">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value <= rating ? "is-on" : ""}
                  aria-label={`${value} stars`}
                  onClick={() => setRating(value)}
                >
                  ★
                </button>
              ))}
            </div>
          </label>
          <label>
            <span>Title (optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </label>
          <label>
            <span>Your review</span>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Fabric, fit, finish, occasion…"
            />
          </label>

          <div className="product-review-photo">
            <span>Photo (optional)</span>
            <div className="product-review-photo-actions">
              <button type="button" className="btn ghost" onClick={() => galleryRef.current?.click()}>
                <ImagePlus size={16} /> Upload
              </button>
              <button type="button" className="btn ghost" onClick={() => cameraRef.current?.click()}>
                <Camera size={16} /> Camera
              </button>
              {preview ? (
                <button type="button" className="btn ghost" onClick={clearImage}>
                  <X size={16} /> Remove
                </button>
              ) : null}
            </div>
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => onPickFile(e.target.files?.[0] || null)}
            />
            {preview ? (
              <div className="product-review-photo-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Review preview" />
              </div>
            ) : null}
          </div>

          {error ? <p className="product-review-error">{error}</p> : null}
          <button className="btn" type="submit" disabled={saving || body.trim().length < 8}>
            {saving ? "Submitting…" : "Submit for approval"}
          </button>
        </form>
      ) : null}

      {loading ? <p className="muted">Loading reviews…</p> : null}

      {!loading && !reviews.length ? (
        <p className="muted product-reviews-empty">
          No approved reviews for this piece yet. Be the first to share your experience.
        </p>
      ) : null}

      {reviews.length > 0 ? (
        <div className="product-reviews-grid">
          {reviews.map((review, index) => (
            <article
              key={review.id}
              className="product-review-card"
              data-reveal
              data-reveal-delay={String((index % 4) + 1)}
            >
              {review.image_path ? (
                <div className="product-review-card-media">
                  <Image
                    src={review.image_path}
                    alt=""
                    fill
                    sizes="(max-width: 800px) 100vw, 280px"
                  />
                </div>
              ) : null}
              <Stars rating={review.rating} />
              {review.title ? <h3>{review.title}</h3> : null}
              <p>{review.body}</p>
              <div className="review-meta">
                <strong>{review.customer_name}</strong>
                <span>{new Date(review.created_at).toLocaleDateString()}</span>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
