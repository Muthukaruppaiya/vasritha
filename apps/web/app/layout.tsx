import type { Metadata } from "next";
import {
  Playfair_Display,
  Manrope,
  Noto_Sans_Tamil,
  Noto_Sans_Malayalam,
  Noto_Sans_Kannada
} from "next/font/google";
import { ScrollRevealInit } from "../components/scroll-reveal";
import { SmoothScroll } from "../components/smooth-scroll";
import { StorefrontI18n } from "../components/storefront-i18n";
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

export const metadata: Metadata = {
  title: "Vasritha | Timeless Elegance",
  description: "Sarees, jewelry, apparel, and handcrafted treasures."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${heading.variable} ${body.variable} ${tamil.variable} ${malayalam.variable} ${kannada.variable}`}
        suppressHydrationWarning
      >
        <StorefrontI18n>
          <SmoothScroll>
            {children}
            <WhatsAppFloat />
          </SmoothScroll>
          <ScrollRevealInit />
        </StorefrontI18n>
      </body>
    </html>
  );
}
