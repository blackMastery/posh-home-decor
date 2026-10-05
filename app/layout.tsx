import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/env";
import { BRAND_NAME, baseOpenGraph } from "@/lib/seo";
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
const description = `Curated home decor, furniture and styling from ${BRAND_NAME} in Georgetown, Guyana. Build your bag and order on WhatsApp.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Posh Home Decor",
  title: {
    default: title,
    template: "%s | Posh Home Decor",
  },
  description,
  alternates: { canonical: "/" },
  openGraph: { ...baseOpenGraph, title, description, url: "/" },
  twitter: { card: "summary_large_image", title, description },
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
