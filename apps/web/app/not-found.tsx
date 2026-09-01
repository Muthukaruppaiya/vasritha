import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell" style={{ padding: "80px 24px", textAlign: "center" }}>
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="muted">The page you requested is not available.</p>
      <Link className="btn" href="/">
        Back to home
      </Link>
    </main>
  );
}
