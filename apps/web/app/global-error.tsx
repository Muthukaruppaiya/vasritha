"use client";

/**
 * Must stay independent of root layout providers (i18n, smooth scroll, etc.).
 * See: https://nextjs.org/docs/app/building-your-application/routing/error-handling#global-error
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f8f1ea",
          color: "#4a2f1f",
          fontFamily: "Georgia, serif"
        }}
      >
        <div style={{ textAlign: "center", padding: "24px" }}>
          <h1 style={{ margin: "0 0 8px", fontSize: "1.5rem" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 16px", opacity: 0.8 }}>
            Please refresh the page or try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: "none",
              borderRadius: "999px",
              padding: "10px 18px",
              background: "#7a4f2b",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: "12px", fontSize: "0.75rem", opacity: 0.6 }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
