import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getProductBySlug, getSettings } from "@/lib/data/catalog";
import { IMAGE_TRANSFORM, PRODUCTION_URL } from "@/lib/env";
import { formatPrice, PRICE_ON_REQUEST } from "@/lib/format/money";
import { displayName } from "@/lib/format/text";
import { renderUrl, storageUrl } from "@/lib/images";

/**
 * 1200×630 share card for a product (Facebook, WhatsApp, X…). Product photos are often
 * portrait or smaller than 1200px, so they're letterboxed onto a branded card instead of
 * being cropped/upscaled by a third party. Referenced from the product page's metadata.
 */

const SIZE = { width: 1200, height: 630 };

const logoSrc = `data:image/png;base64,${await readFile(join(process.cwd(), "public/images/logo-full.png"), "base64")}`;

const STATUS: Record<string, string> = { sold_out: "Sold out", coming_soon: "Coming soon" };

/** Google Fonts TTF subset to just the glyphs used; null (default font) if unreachable. */
async function loadFont(family: string, weight: number, text: string) {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`,
    ).then((r) => r.text());
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return src ? await fetch(src).then((r) => r.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

async function loadPhoto(path: string) {
  const url = storageUrl(path);
  const src = IMAGE_TRANSFORM ? renderUrl(url, { width: 1000, height: 1000, resize: "contain", quality: 85, format: "origin" }) : url;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: RouteContext<"/og/products/[slug]">) {
  const { slug } = await ctx.params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (!product) return new Response("Not found", { status: 404 });

  const name = displayName(product.name);
  const price = product.price == null ? PRICE_ON_REQUEST : formatPrice(product.price, settings.price_prefix);
  const wasPrice =
    product.price != null && product.compare_at_price != null && product.compare_at_price > product.price
      ? formatPrice(product.compare_at_price, settings.price_prefix)
      : null;
  const status = STATUS[product.availability];
  const eyebrow = product.category.name.toUpperCase();
  const footer = `Order on WhatsApp · ${new URL(PRODUCTION_URL).host.replace(/^www\./, "")}`;

  const [photo, display, sans] = await Promise.all([
    product.images[0] ? loadPhoto(product.images[0].storage_path) : null,
    loadFont("Cormorant Garamond", 500, name),
    loadFont("Jost", 400, `${eyebrow}${price}${wasPrice ?? ""}${status ?? ""}${footer}`),
  ]);

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#f9f5ee", fontFamily: "Jost" }}>
        <div style={{ display: "flex", width: 630, height: 630, alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" style={{ width: 570, height: 570, objectFit: "contain" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoSrc} alt="" style={{ width: 360, height: 185 }} />
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: 570,
            padding: "56px 56px 48px",
            borderLeft: "1px solid #e6dbc8",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} alt="" style={{ width: 175, height: 90 }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 20, letterSpacing: 4, color: "#8a672b" }}>{eyebrow}</div>
            <div
              style={{
                marginTop: 16,
                fontFamily: "Cormorant Garamond",
                fontSize: name.length > 40 ? 48 : 60,
                lineHeight: 1.05,
                color: "#3b2314",
              }}
            >
              {name}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", marginTop: 28, fontSize: 32, color: "#774622" }}>
              {wasPrice && <span style={{ marginRight: 14, fontSize: 24, color: "#76655a", textDecoration: "line-through" }}>{wasPrice}</span>}
              <span>{price}</span>
              {status && (
                <span style={{ marginLeft: 18, padding: "4px 12px", fontSize: 18, letterSpacing: 2, color: "#f9f5ee", background: "#3b2314" }}>
                  {status.toUpperCase()}
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 20, color: "#76655a" }}>{footer}</div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      fonts: [
        ...(display ? [{ name: "Cormorant Garamond", data: display, weight: 500 as const, style: "normal" as const }] : []),
        ...(sans ? [{ name: "Jost", data: sans, weight: 400 as const, style: "normal" as const }] : []),
      ],
    },
  );
}
