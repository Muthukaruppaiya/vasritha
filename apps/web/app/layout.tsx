import type { Metadata } from "next";
import {
  Playfair_Display,
  Manrope,
  Noto_Sans_Tamil,
  Noto_Sans_Malayalam,
  Noto_Sans_Kannada,
  Noto_Sans_Devanagari,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Gujarati
} from "next/font/google";
import { ScrollRevealInit } from "../components/scroll-reveal";
import { SmoothScroll } from "../components/smooth-scroll";
import { StorefrontI18n } from "../components/storefront-i18n";
import { GiftVoucherNotice } from "../components/gift-voucher-notice";
import { WhatsAppFloat } from "../components/whatsapp-float";
import "./globals.css";

const heading = Playfair_Display({ subsets: ["latin"], variable: "--font-heading" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });
const tamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ta"
});
const malayalam = Noto_Sans_Malayalam({
  subsets: ["malayalam"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ml"
});
const kannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-kn"
});
const hindi = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hi"
});
const punjabi = Noto_Sans_Gurmukhi({
  subsets: ["gurmukhi"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-pa"
});
const gujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-gu"
});

export const metadata: Metadata = {
  title: "Vasritha | Timeless Elegance",
  description: "Sarees, jewelry, apparel, and handcrafted treasures."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${heading.variable} ${body.variable} ${tamil.variable} ${malayalam.variable} ${kannada.variable} ${hindi.variable} ${punjabi.variable} ${gujarati.variable}`}
        suppressHydrationWarning
      >
        <StorefrontI18n>
          <SmoothScroll>
            {children}
            <WhatsAppFloat />
            <GiftVoucherNotice />
          </SmoothScroll>
          <ScrollRevealInit />
        </StorefrontI18n>
      </body>
    </html>
  );
}
