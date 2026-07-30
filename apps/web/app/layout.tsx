import type { Metadata } from "next";
import { Playfair_Display, Manrope } from "next/font/google";
import { WhatsAppFloat } from "../components/whatsapp-float";
import "./globals.css";

const heading = Playfair_Display({ subsets: ["latin"], variable: "--font-heading" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Vasritha | Timeless Elegance",
  description: "Sarees, jewelry, apparel, and handcrafted treasures."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${heading.variable} ${body.variable}`}>{children}<WhatsAppFloat /></body></html>;
}
