"use client";

import Image, { type ImageLoaderProps, type ImageProps } from "next/image";
import { IMAGE_TRANSFORM } from "@/lib/env";
import { renderUrl, storageUrl, type Bucket } from "@/lib/images";

function supabaseLoader({ src, width, quality }: ImageLoaderProps) {
  // "contain" scales proportionally. Supabase's default ("cover") keeps the original
  // height when only width is given, returning a cropped centre strip of the photo.
  return renderUrl(src, { width, quality: quality ?? 75, resize: "contain" });
}

type Props = Omit<ImageProps, "src" | "loader"> & { path: string; bucket?: Bucket };

/**
 * next/image for Supabase Storage objects. Uses Storage image transformations
 * when enabled (Supabase Pro / local), otherwise next/image optimisation.
 */
export function PoshImage({ path, bucket = "product-images", alt, ...props }: Props) {
  const src = storageUrl(path, bucket);
  return <Image {...props} alt={alt} src={src} loader={IMAGE_TRANSFORM ? supabaseLoader : undefined} />;
}
