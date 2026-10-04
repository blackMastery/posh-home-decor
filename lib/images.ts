import { SUPABASE_URL } from "@/lib/env";

export type Bucket = "product-images" | "site";

export function storageUrl(path: string, bucket: Bucket = "product-images") {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Supabase Storage image transformation URL (used by the next/image loader and OG). */
export function renderUrl(objectUrl: string, opts: { width?: number; height?: number; quality?: number; resize?: "cover" | "contain" }) {
  const u = new URL(objectUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/"));
  if (opts.width) u.searchParams.set("width", String(opts.width));
  if (opts.height) u.searchParams.set("height", String(opts.height));
  u.searchParams.set("quality", String(opts.quality ?? 75));
  if (opts.resize) u.searchParams.set("resize", opts.resize);
  return u.toString();
}
