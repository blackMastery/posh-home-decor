import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/env";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Posh Home Decor & Home Styling Studio | Georgetown, Guyana",
    template: "%s | Posh Home Decor",
  },
  description:
    "Curated home decor, furniture and styling from Posh Home Decor & Home Styling Studio in Georgetown, Guyana. Build your bag and order on WhatsApp.",
  openGraph: {
    siteName: "Posh Home Decor",
    type: "website",
    locale: "en_GY",
    images: [{ url: "/images/og-default.jpg", width: 1200, height: 630, alt: "Posh Home Decor" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#FBF7EF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GY" className={`${cormorant.variable} ${jost.variable} antialiased`}>
      <body className="min-h-dvh flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
