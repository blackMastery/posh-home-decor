import Link from "next/link";
import { getCategories, getSettings } from "@/lib/data/catalog";
import { WhatsAppIcon } from "@/components/ui/icons";
import { Logo } from "./logo";

export async function SiteFooter() {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()]);
  const top = categories.filter((c) => c.depth === 1 && c.productCount > 0).sort((a, b) => a.sort_order - b.sort_order);
  const link = "inline-flex min-h-10 items-center text-[14px] text-cream/80 hover:text-gold-light";
  return (
    <footer className="mt-auto bg-brown-deep text-cream">
      <div className="container-posh grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo tone="light" className="h-28" />
          <p className="mt-6 max-w-xs font-display text-[22px] leading-snug text-cream/90">
            Home decor &amp; styling studio, <em className="text-gold-light">Georgetown, Guyana.</em>
          </p>
        </div>
        <div>
          <h2 className="eyebrow text-gold">Shop</h2>
          <ul className="mt-4">
            <li>
              <Link href="/shop" className={link}>All pieces</Link>
            </li>
            {top.map((c) => (
              <li key={c.id}>
                <Link href={`/shop/${c.path}`} className={link}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="eyebrow text-gold">Your visit</h2>
          <ul className="mt-4">
            <li><Link href="/cart" className={link}>Your bag</Link></li>
            <li><Link href="/saved" className={link}>Saved pieces</Link></li>
            <li><Link href="/#styling-studio" className={link}>Styling Studio</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="eyebrow text-gold">Talk to us</h2>
          <a
            href={`https://wa.me/${settings.whatsapp_number}`}
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-[15px] hover:text-gold-light"
          >
            <WhatsAppIcon size={18} className="text-whatsapp" />
            WhatsApp {settings.display_phone}
          </a>
          <p className="mt-2 text-[14px] text-cream/70">Showroom in Georgetown, Guyana</p>
          <p className="mt-6 text-[13px] text-cream/70">All prices in GYD. Delivery is quoted on WhatsApp.</p>
        </div>
      </div>
      <div className="border-t border-cream/10">
        <div className="container-posh flex flex-col gap-3 py-6 text-[12px] text-cream/60 md:flex-row md:items-center md:justify-between">
          <p>© Posh Home Decor &amp; Home Styling Studio</p>
          <p className="max-w-xl md:text-right">
            Privacy: when you order, we keep your name, number and order details for up to 12 months to help with your
            purchase. Your bag and saved pieces stay on your device.
          </p>
        </div>
      </div>
    </footer>
  );
}
