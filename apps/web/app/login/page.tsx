import Link from "next/link";
import { Footer, Header } from "../../components/storefront";

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="shell section login-page">
        <section className="login-card">
          <div className="eyebrow">Welcome back</div>
          <h1>Sign in to Vasritha</h1>
          <p className="muted">Access your orders, wishlist, and saved addresses.</p>
          <form className="login-form">
            <label>
              <span>Email</span>
              <input type="email" name="email" placeholder="you@example.com" autoComplete="email" required />
            </label>
            <label>
              <span>Password</span>
              <input type="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
            </label>
            <button className="btn" type="submit">Sign in</button>
          </form>
          <p className="login-footnote">New here? <Link href="/sarees">Continue shopping</Link></p>
        </section>
      </main>
      <Footer />
    </>
  );
}
