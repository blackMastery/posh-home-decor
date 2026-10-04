"use client";

export type PreparedImage = { blob: Blob; width: number; height: number };

const MAX_EDGE = 2000;

function isHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/**
 * Downscale to 2000px on the long edge and re-encode as JPEG q≈0.85 before
 * upload (phone photos are 5–12 MB and staff are often on mobile data).
 */
export async function prepareImage(file: File, onProgress: (pct: number) => void): Promise<PreparedImage> {
  let source: Blob = file;
  if (isHeic(file)) {
    try {
      const { default: heic2any } = await import("heic2any");
      const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      source = Array.isArray(out) ? out[0] : out;
    } catch {
      throw new Error("Please export as JPEG");
    }
  } else if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
    throw new Error("Use a JPG, PNG, WebP or HEIC photo");
  }

  const { default: imageCompression } = await import("browser-image-compression");
  const asFile = source instanceof File ? source : new File([source], "photo.jpg", { type: "image/jpeg" });
  const compressed = await imageCompression(asFile, {
    maxWidthOrHeight: MAX_EDGE,
    initialQuality: 0.85,
    fileType: "image/jpeg",
    useWebWorker: true,
    maxSizeMB: 2,
    alwaysKeepResolution: true,
    onProgress,
  });

  const bitmap = await createImageBitmap(compressed);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return { blob: compressed, ...dims };
}
