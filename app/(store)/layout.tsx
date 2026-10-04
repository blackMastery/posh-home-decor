import { Suspense } from "react";
import { getSettings } from "@/lib/data/catalog";
import { SiteHeader } from "@/components/store/header";
import { SiteFooter } from "@/components/store/footer";
import { StoreProvider } from "@/components/store/store-provider";
import { BagDrawer } from "@/components/store/bag-drawer";
import { Toasts } from "@/components/store/toasts";
import { Reveal } from "@/components/store/reveal";

export default async function StoreLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  return (
    <StoreProvider whatsappNumber={settings.whatsapp_number} pricePrefix={settings.price_prefix}>
      <a
        href="#main"
        className="sr-only z-[80] bg-garnet px-4 py-3 text-cream focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <BagDrawer />
      <Toasts />
      <Suspense>
        <Reveal />
      </Suspense>
    </StoreProvider>
  );
}
