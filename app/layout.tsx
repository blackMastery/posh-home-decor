import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/env";
import { BRAND_NAME, DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_KEYWORDS, baseOpenGraph } from "@/lib/seo";
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

const title = `${BRAND_NAME} | Georgetown, Guyana`;
const description = SITE_DESCRIPTION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Posh Home Decor",
  title: {
    default: title,
    template: "%s | Posh Home Decor",
  },
  description,
  keywords: SITE_KEYWORDS,
  authors: [{ name: BRAND_NAME, url: SITE_URL }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  category: "Home decor",
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, address: false, email: false },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: { ...baseOpenGraph, title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description, images: [DEFAULT_OG_IMAGE] },
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
};

export const viewport: Viewport = {
  themeColor: "#F9F5EE",
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
