import { productReviews } from "../lib/mock-data";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="review-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < rating ? "is-on" : ""} aria-hidden="true">★</span>
      ))}
    </div>
  );
}

export function ProductReviews({ productSlug }: { productSlug: string }) {
  const reviews = productReviews.filter((review) => review.productSlug === productSlug);

  if (!reviews.length) {
    return (
      <section className="product-reviews">
        <div className="section-head">
          <div>
            <div className="eyebrow">Reviews</div>
            <h2>What clients say</h2>
          </div>
        </div>
        <p className="muted">No reviews for this piece yet. Be the first to share your experience.</p>
      </section>
    );
  }

  const average =
    Math.round((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) * 10) / 10;

  return (
    <section className="product-reviews">
      <div className="section-head product-reviews-head">
        <div>
          <div className="eyebrow">Reviews</div>
          <h2>What clients say</h2>
        </div>
        <p className="muted product-reviews-summary">
          {average} average · {reviews.length} review{reviews.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="product-reviews-grid">
        {reviews.map((review) => (
          <article key={`${review.name}-${review.title}`} className="product-review-card">
            <Stars rating={review.rating} />
            <h3>{review.title}</h3>
            <p>{review.body}</p>
            <div className="review-meta">
              <strong>{review.name}</strong>
              <span>{review.place}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
