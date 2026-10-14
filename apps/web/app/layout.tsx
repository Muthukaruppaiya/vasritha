import type { Metadata } from "next";
import { ScrollRevealInit } from "../components/scroll-reveal";
import { SmoothScroll } from "../components/smooth-scroll";
import { StorefrontI18n } from "../components/storefront-i18n";
import { GiftVoucherNotice } from "../components/gift-voucher-notice";
import { LoyaltyPopup } from "../components/loyalty-popup";
import { WhatsAppFloat } from "../components/whatsapp-float";
import "./globals.css";

/**
 * Fonts load at runtime via Google CSS (see <link> below), not next/font/google.
 * next/font/google intermittently fails Turbopack builds when Google returns
 * extensionless /l/font?kit=…&skey=… URLs (vercel/next.js#99114).
 */
const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Manrope:wght@400;500;600;700",
    "family=Noto+Sans+Devanagari:wght@400;500;600;700",
    "family=Noto+Sans+Gujarati:wght@400;500;600;700",
    "family=Noto+Sans+Gurmukhi:wght@400;500;600;700",
    "family=Noto+Sans+Kannada:wght@400;500;600;700",
    "family=Noto+Sans+Malayalam:wght@400;500;600;700",
    "family=Noto+Sans+Tamil:wght@400;500;600;700",
    "family=Playfair+Display:wght@400;500;600;700;800"
  ].join("&") +
  "&display=swap";

export const metadata: Metadata = {
  title: "Vasritha | Timeless Elegance",
  description: "Sarees, jewelry, apparel, and handcrafted treasures."
};

// Storefront + admin always read live DB (local Postgres or Supabase).
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_FONTS_CSS} />
      </head>
      <body suppressHydrationWarning>
        <StorefrontI18n>
          <SmoothScroll>
            {children}
            <WhatsAppFloat />
            <GiftVoucherNotice />
            <LoyaltyPopup />
          </SmoothScroll>
          <ScrollRevealInit />
        </StorefrontI18n>
      </body>
    </html>
  );
}
