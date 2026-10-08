/** Shared between the gallery admin actions and UI. */
export const MAX_LOOK_PRODUCTS = 6;

export type AdminGalleryProduct = { id: string; name: string; imagePath: string | null; status: string };

export type AdminGalleryPhoto = {
  id: string;
  storagePath: string;
  width: number | null;
  height: number | null;
  caption: string;
  alt: string;
  isVisible: boolean;
  products: AdminGalleryProduct[];
};
