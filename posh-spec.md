# Posh Home Decor — Storefront & Admin Build Spec

**Stack:** Next.js (App Router, TypeScript) · Supabase (Postgres, Auth, Storage) · Vercel
**Design reference:** "Posh Storefront Design" artifact (Claude Design prototype)
**Status:** v1 spec, derived from design review + stakeholder interview

---

## 1. What we're building

A catalogue storefront for Posh Home Decor & Home Styling Studio (Georgetown, Guyana) where customers browse pieces, build a bag, and **send their order to the shop on WhatsApp**. There is no online payment, no customer account, and no delivery pricing on the site. The sale is closed by staff in WhatsApp.

Behind it, a **mobile-first admin panel** where staff manage products and categories, and view a log of inquiries the site has sent.

### 1.1 Decisions from the interview

| Area | Decision |
|---|---|
| Order handoff | Site saves an **inquiry** to Supabase, then opens WhatsApp prefilled. Staff match chats to inquiries by reference (e.g. `PH-48213`). |
| Order lifecycle | **No statuses.** Inquiries are a read-only log. |
| Stock | No quantities. Each product is **Available** or **Sold out** (manual toggle). Staff update it after in-store sales. |
| In-store sales | Not recorded in the system. |
| Currency | **GYD** only, whole dollars. |
| Variants / finishes | **None.** Each colour/finish is its own product. Finish swatches are removed from the design. |
| Delivery | Customer picks **Delivery** or **Collection**. **No fee on the site**; delivery cost is quoted in WhatsApp. |
| Payment | Not tracked anywhere in the system. |
| Customer accounts | None. Bag and wishlist live in the browser (localStorage). |
| Stale carts | If a bagged product is now sold out or repriced, **allow sending anyway**; staff handle it in chat. The message flags sold-out lines. |
| Admin access | **One shared admin login.** |
| Categories | Fully editable (add, rename, reorder, nest up to 3 levels). One category per product. Delete is blocked while non-empty; renames keep old URLs working via redirects. |
| New / Sale | **Sale** = product has a "was" price higher than its price (shown crossed out). **New** = automatic for 30 days after first publish. |
| "Style it with" | Hand-picked per product, falling back to the same category. |
| Home page | Fixed layout. "New in the showroom" = newest products automatically. Hero text/image editable in settings (see §5.1). |
| Photos | Staff upload pre-edited photos; the system only resizes/optimises. |
| Catalogue size | 200–1,000 products in year one. |
| Product entry | One at a time in admin (no CSV import). |
| Staff alerts | None. WhatsApp itself is the alert. |
| Spam protection | Rate limiting (plus a honeypot, which is free). |
| Styling Studio | WhatsApp link only; no booking form. |
| Admin device | **Mostly phones.** |
| Product accordions | Details, Care, Delivery & collection are all **per-product**, pre-filled from global defaults. |
| SEO / analytics | SEO basics + lightweight analytics. |
| Hosting | Vercel + Supabase cloud (paid tiers recommended, see §11). |

### 1.2 Out of scope for v1

Online payment · customer accounts/login · stock quantities or reservations · order statuses or fulfilment tracking · in-store POS · product variants · delivery zones/fees · email/SMS/push notifications · Styling Studio booking form · CSV/bulk import · multiple admin users or roles · multi-currency · WhatsApp Business API automation.

---

## 2. Design system (from the prototype)

Port the prototype's inline styles into Tailwind theme tokens (or CSS variables). Do not ship inline styles.

### 2.1 Colour tokens

| Token | Hex | Use |
|---|---|---|
| `cream` | `#FBF7EF` | Page background, header (95% + blur) |
| `cream-raised` | `#FFFDF8` | Inputs, selected cards |
| `sand` | `#F1E6D0` | Summary panels, empty states |
| `sand-image` | `#EFE4CF` | Image placeholders |
| `line` | `#E8DCC4` | Dividers, header border |
| `line-strong` | `#D9C7A4` | Input/chip borders |
| `garnet` | `#6B0F1A` | Primary buttons, prices, active nav |
| `garnet-hover` | `#861726` | Primary hover |
| `garnet-deep` | `#3E0710` | Headings, dark sections, mobile menu |
| `gold` | `#D9B36A` | Gold CTA, eyebrow labels on dark |
| `gold-light` | `#E3C07A` / hover `#E9C98A` | Italic accents on dark |
| `bronze` | `#9A7431` | Eyebrows/italics on light |
| `ink` | `#2A1A16` | Body text |
| `ink-soft` | `#4A3A34` | Secondary body |
| `muted` | `#8A7766` | Notes, meta |
| `error` | `#A3162A` | Field errors |
| `whatsapp` | `#25D366` | WhatsApp glyph only |

### 2.2 Typography

- **Display:** Cormorant Garamond (400/500/600, italic for `<em>` accents).
- **UI/body:** Jost (300/400/500). Uppercase labels use letter-spacing `.14em`–`.28em` at 10–13px.
- Load both via `next/font/google` with `display: swap`; subset Latin.
- Fluid sizes use `clamp()` as in the prototype (e.g. H1 hero `clamp(42px, 6.5vw, 96px)`).

### 2.3 Layout & motion

- Content max width 1320px; horizontal padding `clamp(16px, 4vw, 48px)`.
- Mobile breakpoint at **860px** (hamburger menu, stacked gallery).
- Minimum tap target 44×44px everywhere (prototype already respects this).
- Product imagery is **4:5**; category tiles **3:4**.
- Scroll reveal: the prototype's damped-spring reveal on `[data-reveal]` elements. Keep it as a small client component; it must be a no-op under `prefers-reduced-motion: reduce` and must not hide content if JS fails (apply initial hidden styles from JS, not CSS).
- Hero image uses a CSS scroll-driven parallax (`animation-timeline: view()`); it's progressive enhancement and fine to leave as is.

### 2.4 Changes from the prototype

The prototype is a single-page state machine with `<button>` navigation. The build must:

1. Use **real routes and `<Link>` anchors** (shareable URLs, back button, SEO, open-in-new-tab).
2. **Remove finish swatches** from the product page.
3. **Remove all delivery fees** ($35, "free over $1,000") from cart, checkout, message, and accordion copy. Replace with "Delivery quoted on WhatsApp".
4. Rename checkout "Total" to **"Subtotal"** with a note: *Delivery (if any) is confirmed in the chat.*
5. Fix the WhatsApp number to international format (prototype has `6748619`; must be `5926748619`).
6. Add Sold-out and Sale (crossed-out was-price) presentation (not in prototype).
7. Generate the order reference **on the server** (prototype uses `Math.random` on the client).
8. Make the mega menu data-driven for any top-level category with children (prototype hardcodes Decor).

---

## 3. Routes

### 3.1 Storefront

| Route | Purpose | Rendering |
|---|---|---|
| `/` | Home | Static, revalidated by tag |
| `/shop` | All products | Dynamic on search params, data cached |
| `/shop/[...category]` | Category or subcategory listing, e.g. `/shop/decor/vases-and-jars/glass-vases` | Same |
| `/shop/new` | New arrivals (virtual) | Same |
| `/shop/sale` | Sale (virtual) | Same |
| `/products/[slug]` | Product detail | Static per product (`generateStaticParams` + on-demand), revalidated by tag |
| `/cart` | Full cart (Step 1 of 2) | Client |
| `/checkout` | Details + message preview (Step 2 of 2) | Client |
| `/order/[ref]` | Confirmation ("Almost there, {first name}") | Client; reads last inquiry from sessionStorage, falls back to generic copy |
| `/saved` | Wishlist (device-only) | Client |

`new` and `sale` are reserved slugs; the category editor must reject them.

**Shop query params:** `q` (search), `sort` = `featured | price-asc | price-desc | newest`, `page`. Filter chips (All / top-level categories / New / Sale) navigate between the routes above rather than setting a param, so every filter state has a clean URL.

The **bag drawer** is a client component in the root layout, opened from the header bag icon and the post-add toast.

### 3.2 Admin

| Route | Purpose |
|---|---|
| `/admin/login` | Email + password |
| `/admin` | Redirects to `/admin/inquiries` |
| `/admin/inquiries` | Inquiry log |
| `/admin/inquiries/[id]` | Inquiry detail |
| `/admin/products` | Product list |
| `/admin/products/new` | Create |
| `/admin/products/[id]` | Edit |
| `/admin/categories` | Category tree |
| `/admin/settings` | Shop settings, defaults, hero, password, sign out everywhere |

All `/admin/*` routes except login are protected in `middleware.ts` using `@supabase/ssr` session cookies, and again in every server action (never trust middleware alone). `/admin` is `noindex` and excluded from the sitemap.

---

## 4. Data model (Postgres / Supabase)

All money is `integer` GYD (whole dollars). All timestamps `timestamptz`. Use `uuid` PKs with `gen_random_uuid()`.

### 4.1 `categories`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `parent_id` | uuid null → `categories.id` `on delete restrict` | null = top level |
| `name` | text not null | |
| `slug` | text not null | unique per `(parent_id, slug)`; reserved: `new`, `sale` |
| `path` | text not null unique | e.g. `decor/vases-and-jars/glass-vases`; maintained by trigger |
| `depth` | smallint not null | 1–3, enforced by trigger |
| `sort_order` | integer not null default 0 | |
| `tile_image_path` | text null | Optional home tile image; falls back to newest product image in that category |
| `created_at`, `updated_at` | timestamptz | |

Triggers:
- On insert/update of `parent_id` or `slug`: recompute `depth` and `path` for the row **and all descendants**; reject depth > 3 and cycles.
- On `path` change: insert a row into `redirects` (old → new) for the category and each descendant.

Delete is blocked at the DB level (`on delete restrict` from both `products.category_id` and child `parent_id`), and the UI disables the delete button with an explanation ("Contains 12 products and 2 subcategories").

### 4.2 `products`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `slug` | text unique not null | auto from name, editable; change → `redirects` row |
| `name` | text not null | |
| `note` | text | Short line under the name, e.g. "Woven jute · 38cm" |
| `description` | text | Lead paragraph on product page |
| `price` | integer not null check > 0 | GYD |
| `compare_at_price` | integer null | Sale when `compare_at_price > price` |
| `category_id` | uuid not null → `categories` `on delete restrict` | Any depth |
| `is_available` | boolean not null default true | Available / Sold out |
| `status` | text not null default `'draft'` check in (`draft`,`published`,`archived`) | |
| `first_published_at` | timestamptz null | Set once on first publish; drives "New" |
| `details_text`, `care_text`, `delivery_text` | text | Pre-filled from settings defaults when created |
| `featured_rank` | integer null | Optional manual ordering for "Featured" sort; null = after ranked ones |
| `search` | tsvector generated | `setweight(name,'A') || setweight(note,'B') || setweight(description,'C')`, `simple` config |
| `created_at`, `updated_at` | timestamptz | `updated_at` shown in admin as "Last edited" (the only audit trail with a shared login) |

Indexes: `(status, is_available)`, `(category_id)`, `(first_published_at desc)`, GIN on `search`, `pg_trgm` GIN on `name` for partial-word search.

Derived (in a view `products_public` or computed in queries):
- `is_new` = `first_published_at > now() - settings.new_window_days`
- `is_on_sale` = `compare_at_price > price`

Badge precedence on cards: **Sold out > Sale > New**.

Products are never hard-deleted from the UI; "Delete" sets `status = 'archived'` (hidden everywhere, still restorable). Inquiries keep their own snapshot so nothing breaks either way.

### 4.3 `product_images`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `product_id` | uuid → `products` `on delete cascade` | |
| `storage_path` | text not null | In bucket `product-images` |
| `width`, `height` | integer | Captured on upload; used for aspect warnings and `next/image` |
| `alt` | text null | Defaults to product name |
| `sort_order` | integer not null | First image = card + OG image |

A product needs **at least one image to be published** (enforced in the server action, not the DB).

### 4.4 `product_related`

`(product_id, related_id, sort_order)`, PK on the pair, both → `products` on delete cascade, check `product_id <> related_id`. Max 4 enforced in UI.

**"Style it with" resolution** (server): take hand-picked related products that are published, then fill to 4 with published products from the same category, then the parent category, ordered available-first then newest. Exclude the current product.

### 4.5 `inquiries`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `ref` | text unique not null | `PH-` + 5 random digits, generated server-side with retry on collision |
| `customer_name` | text not null | max 80 |
| `phone_raw` | text not null | As typed |
| `phone_e164` | text not null | Normalised (see §6.4) |
| `fulfilment` | text check in (`delivery`,`collection`) | |
| `address` | text null | Required when delivery; max 300 |
| `note` | text null | max 500 |
| `styling_advice` | boolean not null | |
| `items` | jsonb not null | Snapshot: `[{product_id, slug, name, note, unit_price, qty, line_total, was_available, image_path}]` |
| `item_count` | integer | Sum of qty |
| `subtotal` | integer | GYD, computed server-side from current prices |
| `message_text` | text not null | Exactly what was put in the WhatsApp link |
| `ip_hash` | text | SHA-256 of IP + secret salt; for rate limiting only |
| `created_at` | timestamptz | |

No status column by design. Retention: see §12.

### 4.6 `settings` (single row, `id = 1`)

| Column | Notes |
|---|---|
| `whatsapp_number` | Digits only, international, e.g. `5926748619`; validated `^[1-9]\d{7,14}$` |
| `display_phone` | e.g. `674 8619` (footer) |
| `hero_eyebrow`, `hero_headline`, `hero_headline_accent`, `hero_image_path` | Home hero ("The Autumn Edit" / "Taking your decorations to the" / "next level.") |
| `default_details_text`, `default_care_text`, `default_delivery_text` | Pre-fill for new products |
| `new_window_days` | default 30 |
| `price_prefix` | default `$`; footer and checkout say "All prices in GYD" |
| `styling_studio_message` | Prefill for Styling Studio WhatsApp links |
| `updated_at` | |

### 4.7 `redirects`

`(from_path text PK, to_path text not null, created_at)`. Looked up in middleware for `/shop/*` and `/products/*` 404s only (cache the table in memory with a short TTL; it will be small). Collapse chains on insert (A→B, B→C becomes A→C) and delete a redirect whose `from_path` becomes a live path again.

### 4.8 `admins`

`(user_id uuid PK → auth.users)`. Contains the single shared admin user. Used by RLS via `is_admin()`:

```sql
create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;
```

---

## 5. Storefront behaviour

### 5.1 Home (`/`)

Fixed layout matching the prototype:

1. **Hero:** full-bleed image with garnet gradient, eyebrow + headline + italic gold accent from `settings`, gold CTA "Shop the collection" → `/shop`. The hero is the only editable home content; this keeps seasonal copy like "The Autumn Edit" from going stale without opening up a full page builder.
2. **Shop by category:** top-level categories in `sort_order` (first 4–6), tile image = `tile_image_path` or the newest product image in that subtree, count = published products in subtree ("12 pieces"). Hide categories with zero published products.
3. **New in the showroom:** 4 newest published products (by `first_published_at`), available ones first. "View all" → `/shop/new`. If fewer than 4 are within the New window, still show the 4 newest.
4. **Styling Studio band:** static copy and images; "Chat on WhatsApp" opens `wa.me/{number}?text={styling_studio_message}`.

### 5.2 Header & navigation

- Logo + "POSH" wordmark → `/`.
- Desktop primary nav: Home, Shop, Cart (active underline as prototype). Bag icon with count badge opens drawer.
- Desktop category bar: top-level categories + **New** + **Sale** (New/Sale hidden if empty). Hovering a category with children opens its **mega menu**: title + "Shop all {name}", then one column per child group with its leaf links. Must handle 1–8 groups gracefully (grid wraps; first group may span 2 columns when it has > 8 leaves, as Decor does in the prototype). Mega menu also opens on keyboard focus and closes on Escape/mouse-leave.
- Mobile (<860px): hamburger opens garnet panel with primary nav, then "Shop by category" accordion where each parent expands to its children as chips.

### 5.3 Shop listing

- Header: eyebrow "Shop", H1 = category name / "New arrivals" / "Sale" / "Curated pieces" (all), breadcrumb for nested categories.
- Search input (debounced 300ms, updates `q` with `router.replace`), sort select.
- Filter chips row (horizontal scroll on mobile).
- Result count ("24 pieces").
- Grid of product cards: 4:5 image, badge, quick-add `+` button (becomes `✓` when in bag), name, note, price; on sale show was-price struck through in `muted` before the price.
- **Sold-out products:** shown with "Sold out" badge and image at 70% opacity, sorted after available products in every sort, quick-add hidden.
- Pagination: 24 per page with a "Load more" button that appends (keeps `page` in URL so refresh/back restores position).
- Empty states from prototype: "Nothing matches that search" (with query) / "New pieces arriving soon" (empty category), both with "View all pieces".

**Search:** Postgres full-text on `search` with prefix matching (`to_tsquery('simple', 'gin:*')`) OR `name ilike` trigram match, scoped to the current category subtree. Ranked by `ts_rank` when `q` is present.

**Featured sort:** `featured_rank asc nulls last, first_published_at desc`.

### 5.4 Product page

- Breadcrumb: Home / {category path} / {name}.
- Gallery: thumbnails left on desktop, below on mobile (as prototype); main image swipeable on mobile; heart (wishlist) top-right.
- Eyebrow = category name, H1, price (with was-price if on sale).
- Description.
- **No finish swatches.**
- Quantity stepper (1–20) + "Add to bag · {price × qty}".
- **If sold out:** stepper and add button replaced by a disabled "Sold out" state and the outlined WhatsApp button text becomes "Ask about similar pieces".
- "Ask about this piece" WhatsApp button, prefilled: `Hello Posh! I'd like to ask about the {name} ({product URL}).`
- Accordions: Details / Care / Delivery & collection from the product's own text fields; hide any that are empty. First one open by default.
- "Style it with" row (§4.4).
- Toast on add: "{name} added · View bag" (2.6s), as prototype.

### 5.5 Bag (drawer + `/cart`)

Stored in localStorage key `posh-bag-v1`: `{ items: [{ productId, qty }], updatedAt }`. **Only IDs and quantities are stored**; names, prices, images and availability are always fetched fresh (one batched query by ID list) so the bag always shows current prices.

On load, reconcile:
- Product archived/unpublished or not found → remove it and show a one-time notice: "{n} item(s) are no longer listed and were removed."
- Product sold out → **keep it**, show a "Sold out — we'll suggest alternatives in the chat" note on the line. Customer can still send.
- Price changed → just show the new price (no notice).

Qty per line 1–20; decrementing below 1 removes. Bag syncs across tabs via the `storage` event.

Cart page summary: Subtotal, "Delivery: quoted on WhatsApp", button "Order via WhatsApp" → `/checkout`, plus the 3 "how it works" steps from the prototype.

### 5.6 Checkout (`/checkout`)

Form (as prototype): Full name, WhatsApp number (`inputmode="tel"`), Delivery / Collect toggle (descriptions: "Fee confirmed on WhatsApp" / "From the showroom"), address textarea (delivery only), note (optional, 500 char counter), "Include free styling advice" toggle (default on).

Right column: WhatsApp-style **message preview** that updates live, Subtotal, and the gold "Send order on WhatsApp" button.

Name, phone, address and fulfilment choice are remembered in localStorage (`posh-customer-v1`) for next time; the note is not.

Validation runs on submit and then live (prototype's `coTried` pattern): name required; phone normalises to a valid number (§6.4); address required for delivery; bag not empty.

### 5.7 Send flow (the critical path)

This is the part most likely to break on real phones, so it's specified precisely:

1. User taps **Send order on WhatsApp**. Client validation passes.
2. **Synchronously in the tap handler**, on non-mobile browsers open a placeholder window: `const win = window.open('', '_blank')`. (Opening a window after an `await` is blocked by popup blockers. On mobile, skip this; we'll navigate the current tab instead.)
3. Call server action `submitInquiry({ name, phone, fulfilment, address, note, styling, items: [{productId, qty}], website /*honeypot*/ })`.
4. Server (§6.3) validates, re-prices, builds `message_text`, inserts the inquiry, returns `{ ref, waUrl }`.
5. Client writes `{ ref, firstName, fulfilment, waUrl }` to sessionStorage, **clears the bag**, then:
   - Desktop: `win.location.href = waUrl` (if `win` is null, fall back to step below), and `router.push('/order/' + ref)` in the original tab.
   - Mobile: `router.push('/order/' + ref)` then `window.location.href = waUrl` so WhatsApp opens; when the customer returns with Back, they land on the confirmation page.
6. Confirmation page: "Order PH-48213 / Almost there, {first name}. Your order opened in WhatsApp — just press send." with **"Open WhatsApp again"** (same `waUrl`) and "Keep shopping".

**Failure handling — never block a sale:**
- If the server action fails (network error, 5xx, rate limited), build the message client-side with ref `PH-WEB` (no DB row), still open WhatsApp, and show the confirmation page. Log the failure to analytics. Rate-limited users see no error.
- If WhatsApp isn't installed, `wa.me` shows WhatsApp's own web landing page; nothing extra needed.
- Double-tap: button disables while pending; the server action is idempotent per `clientNonce` (a UUID generated when the checkout page mounts) to prevent duplicate inquiries.

### 5.8 Message format

Built **server-side** only (so it matches what's logged):

```
Hello Posh! I'd like to order (PH-48213):

• 1 × Gilded Lattice Ginger Jar — $6,500
• 2 × Gold Pillar Holders — $7,800
• 1 × Rattan Orb Vase — $4,800 (marked sold out on the site)

Subtotal: $19,100 GYD
Delivery — please quote me for delivery
Name: Aaliyah Persaud
Phone: +592 674 0000
Address: 12 Main St, Georgetown
Note: Weekend delivery please

I'd love some free styling advice too ✨
```

Collection replaces the delivery line with "Collection from the showroom" and omits Address.

**Length guard:** keep the encoded URL under ~4,000 characters. If exceeded (very large bag), drop the `note` and per-item notes first, then collapse lines to `• 2 × Name` without prices, and append "(full list saved under PH-48213)". Staff can always see the full snapshot in admin.

### 5.9 Wishlist (`/saved`)

Heart toggles product ID in localStorage `posh-saved-v1`; toast "Saved to your wishlist" / "Removed from wishlist". `/saved` lists saved products (fresh data, same card component, removed products silently dropped). Linked from the bag drawer footer and the mobile menu. No header icon (keeps the design's header unchanged).

---

## 6. Server logic & security

### 6.1 Supabase clients

- `lib/supabase/server.ts`: `createServerClient` from `@supabase/ssr` with cookies (admin session, RLS as the logged-in user).
- `lib/supabase/public.ts`: anon client for cached storefront reads (no cookies, so pages stay cacheable).
- `lib/supabase/service.ts`: service-role client, `import 'server-only'`, used **only** by `submitInquiry`.

### 6.2 Row Level Security

Enable RLS on every table.

| Table | anon | admin (`is_admin()`) |
|---|---|---|
| `categories` | select | all |
| `products` | select where `status = 'published'` | all |
| `product_images` | select where parent product published | all |
| `product_related` | select | all |
| `settings` | select (all columns are public-safe) | update |
| `redirects` | select | all |
| `inquiries` | **none** | select (no update/delete from UI; retention job deletes) |
| `admins` | none | select own row |

Inquiries are inserted only via the service-role client inside `submitInquiry`, so anon has no insert policy at all.

**Storage:** bucket `product-images` (public read); insert/update/delete only when `is_admin()`. Bucket `site` (public read) for hero/tile images, same write rule.

**Auth:** disable public sign-ups in Supabase. Create the single admin user manually and add it to `admins`. Enable leaked-password protection and set a minimum password length of 12.

### 6.3 `submitInquiry` server action

1. Parse with zod: name 1–80, phone 7–20 chars, fulfilment enum, address ≤300 (required if delivery), note ≤500, items 1–50 lines, qty 1–20, `website` honeypot must be empty (if filled, return a fake success with ref `PH-WEB` and write nothing).
2. Rate limit: hash IP (`x-forwarded-for` first hop) with `INQUIRY_IP_SALT`; reject if ≥5 inquiries from that hash in the last 10 minutes or ≥20 in 24h (query `inquiries` directly; no extra infra needed at this volume).
3. Fetch products by ID (published only). Drop unknown/unpublished IDs. If none remain, return a validation error ("These pieces are no longer listed").
4. Compute line totals and subtotal from **current DB prices**; record `was_available`.
5. Normalise phone (§6.4).
6. Generate `ref`, build `message_text` (§5.8), insert, return `{ ref, waUrl: 'https://wa.me/' + settings.whatsapp_number + '?text=' + encodeURIComponent(message_text) }`.
7. Idempotency: keep `clientNonce → ref` in a small `inquiry_nonces` table (or a unique nullable column on `inquiries`) for 1 hour; a repeat nonce returns the existing ref.

### 6.4 Phone normalisation

- Strip everything except digits and a leading `+`.
- 7 digits → Guyana local → `+592XXXXXXX`.
- 10 digits starting `592` → `+592…`.
- Starts with `+` → keep as is if 8–15 digits.
- Otherwise invalid: "Please enter a valid WhatsApp number".

Use `libphonenumber-js` (min metadata) with default country `GY` rather than hand-rolling.

### 6.5 Admin mutations

All admin writes are server actions that (a) re-check `is_admin()` via the cookie client, (b) validate with zod, (c) call `revalidateTag` for affected tags: `products`, `product:{slug}`, `categories`, `settings`, `home`.

---

## 7. Images

- Staff upload pre-edited photos. The browser **downscales before upload** to max 2000px on the long edge and re-encodes to JPEG q≈0.85 (e.g. `browser-image-compression`), because phone photos are 5–12 MB and staff will be on mobile data. Show per-image progress and allow retry of failed uploads without losing the others.
- Accept jpg/png/webp/heic (HEIC converted client-side; if conversion fails, show "Please export as JPEG").
- Capture width/height; if aspect ratio differs from 4:5 by more than 5%, show a non-blocking warning with a preview of the 4:5 crop the storefront will apply (`object-fit: cover`, centred).
- Storage path: `products/{productId}/{uuid}.jpg`. Removing an image from a product deletes the object.
- Delivery: `next/image` with a custom loader using **Supabase Storage image transformations** (`/render/image/public/...?width=&quality=`), which requires Supabase Pro. If not on Pro, fall back to Vercel image optimisation, keeping in mind its per-plan source-image limits (≈1,000 products × ~4 images).
- `sizes` attributes set for every grid so phones fetch ~400–600px images.

---

## 8. Admin panel (mobile-first)

Design the admin for a phone in one hand. Desktop gets the same UI with a wider container. Use the storefront tokens in a plainer style (Jost only, no Cormorant headings except the wordmark).

### 8.1 Shell

- Bottom tab bar on mobile (Inquiries, Products, Categories, Settings); left rail on ≥1024px.
- Sessions persist (refresh tokens) so staff aren't logging in daily.
- "View site" link in the header.

### 8.2 Inquiries

List (newest first, infinite scroll 30 per page): ref, customer name, item count, subtotal, relative time ("12 min ago"). A dot marks inquiries newer than this device's last visit (timestamp in localStorage; no server state, matching the "no statuses" decision).

Search box matches ref (with or without `PH-`), name, or phone. Date filter: Today / 7 days / 30 days / All.

Detail:
- Ref (tap to copy), time, name, phone with **"Open chat"** button (`wa.me/{customer phone}`) so staff can start the conversation if the customer never pressed send.
- Fulfilment + address, note, styling advice flag.
- Items from the snapshot with thumbnail, qty, price at the time, and a **live comparison** column: current price and current availability, highlighted when different (e.g. "Now sold out", "Now $7,000").
- The exact message text with a Copy button.

No edit or delete.

### 8.3 Products

List: thumbnail, name, price, category, status chip (Draft / Published), and an **inline Available/Sold out switch** (the most frequent action after in-store sales; must be one tap with optimistic update). Filters: status, availability, category; search by name. Sort: recently edited (default), name, newest.

Create/Edit form, in this order (photos first because that's what staff have in hand):

1. **Photos:** multi-select from camera roll, drag/long-press to reorder (with up/down buttons as an accessible fallback), set alt text (optional).
2. **Name** (slug auto-generated, editable under "Advanced").
3. **Price** (`inputmode="numeric"`, thousands separators as you type) and optional **Was price** (validation: must be greater than price, else hint "Was price must be higher to show as Sale").
4. **Category:** searchable picker showing full path ("Decor › Vases and Jars › Glass Vases").
5. **Short note**, **Description**.
6. **Available** switch.
7. **Accordions:** Details, Care, Delivery & collection, pre-filled from settings defaults; "Reset to default" per field.
8. **Style it with:** search-and-add up to 4 products.
9. **Advanced:** slug, featured rank.

Actions: **Save draft**, **Publish** (requires ≥1 image, name, price, category), **Save & add another** (keeps category and accordion text for fast batch entry), **Duplicate** (copies everything except images and slug, opens as draft; useful for the same piece in another colour), **Archive**.

Shows "Last edited {time}" (the only audit trail with a shared login).

**Draft safety:** form state autosaves to localStorage per product ID every few seconds; on reopening an unsaved form, offer "Restore unsaved changes?". Network failures on save keep the form intact with a retry button.

### 8.4 Categories

Indented tree list with per-row: name, product count (subtree), and a menu: Rename, Add subcategory (hidden at depth 3), Move up / Move down, Move to another parent, Set tile image (top level only), Delete.

- Delete disabled with reason when it has products or children.
- Rename asks "Also update the web address?" (default yes) and explains old links will keep working.
- Reorder with up/down buttons (drag-and-drop is unreliable on phones for nested trees).
- Reserved slugs `new`, `sale` rejected.

### 8.5 Settings

WhatsApp number (with a "Test" button that opens `wa.me/{number}`), display phone, hero fields + image, default accordion texts, New window (days), Styling Studio message, **Change password**, **Sign out all devices** (`signOut({ scope: 'global' })`, for when a staff member leaves; pair with a password change).

---

## 9. SEO & analytics

- `generateMetadata` on every page: title pattern `{Product} | Posh Home Decor`, description from note/description, canonical URL.
- Open Graph/Twitter images: product first image (1200×630 crop via the image transform) and a default brand image.
- `app/sitemap.ts`: home, categories with products, published products (with `lastModified`). `app/robots.ts` disallows `/admin`, `/cart`, `/checkout`, `/order`, `/saved`.
- Search result pages (`?q=`) and `page>1` are `noindex, follow`; sort param is canonicalised away.
- JSON-LD: `Product` with `Offer` (`priceCurrency: "GYD"`, `availability` InStock/OutOfStock, `url`) on product pages; `HomeAndConstructionBusiness`/`LocalBusiness` with phone and Georgetown address on home; `BreadcrumbList` on product and category pages.
- Redirects return **308** so search engines update.
- Analytics: Vercel Web Analytics (or Plausible), no cookie banner needed. Custom events: `add_to_bag`, `begin_checkout`, `inquiry_sent` (with `fallback: true` when the DB save failed), `whatsapp_product_question`, `styling_studio_click`.

---

## 10. Accessibility & quality bar

- WCAG 2.1 AA contrast: verify `muted #8A7766` on `cream` for small text (likely fails at 12px; darken to ~`#76655A` if so) and gold-on-garnet labels.
- All interactive elements are real `<a>`/`<button>` with visible focus rings (gold outline).
- Drawer and mobile menu trap focus, close on Escape, restore focus, lock body scroll.
- Toasts in an `aria-live="polite"` region.
- Images have alt text (product name by default; decorative ones `alt=""`).
- Core Web Vitals targets on a mid-range Android over 4G: LCP < 2.5s (hero image `priority`, properly sized), CLS < 0.1 (fixed aspect-ratio boxes for all images), INP < 200ms.

---

## 11. Infrastructure

**Recommended plans:** Supabase **Pro** (no project pausing after inactivity, daily backups, image transformations) and Vercel **Pro** if commercial use (Hobby is non-commercial).

**Environments:** Supabase `dev` and `prod` projects; Vercel preview deployments point at `dev`.

**Env vars:**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # server only
INQUIRY_IP_SALT                  # random 32+ bytes
NEXT_PUBLIC_SITE_URL             # canonical origin
```

**Migrations:** Supabase CLI (`supabase/migrations`), seed file with the prototype's category tree and 8 sample products for dev. Generate DB types with `supabase gen types typescript` into `lib/database.types.ts`.

**Suggested structure:**

```
app/
  (store)/            layout with header, footer, bag drawer
    page.tsx
    shop/[[...category]]/page.tsx
    products/[slug]/page.tsx
    cart/ checkout/ order/[ref]/ saved/
  admin/
    login/ (protected)/inquiries products categories settings
  sitemap.ts robots.ts
components/store/  components/admin/  components/ui/
lib/supabase/ lib/bag/ lib/whatsapp/ lib/phone/ lib/format/
middleware.ts
supabase/migrations/ supabase/seed.sql
```

---

## 12. Edge cases checklist

| Case | Behaviour |
|---|---|
| Customer never presses send in WhatsApp | Inquiry still logged; staff can tap "Open chat" to follow up. |
| Customer edits the WhatsApp text before sending | Fine; staff compare with the logged snapshot via the ref. |
| Customer deletes the ref from the message | Staff search admin by phone or name. |
| Same customer submits twice | Two inquiries (different refs); idempotency only prevents double-taps within one checkout visit. |
| DB down / rate limited | WhatsApp still opens with ref `PH-WEB`. |
| Bagged item sold out | Kept, flagged in bag and message. |
| Bagged item archived / unpublished | Removed from bag with a notice. |
| Price changed since added | New price shown and used. |
| Popup blocked on desktop | Fallback to same-tab navigation; confirmation page has "Open WhatsApp again". |
| Huge bag / long note | Message condensed per §5.8. |
| Product moved to another category | Product URL unchanged (`/products/[slug]`), so nothing breaks. |
| Category renamed / moved | Old URLs 308 to new ones via `redirects`. |
| Product slug changed | Same. |
| Product published, unpublished, republished | `first_published_at` doesn't reset, so it won't re-appear as New. Staff wanting it in New can duplicate it. |
| Was price ≤ price | Treated as not on sale; form warns. |
| Category emptied | Hidden from nav, home tiles and filters; still reachable by URL with the empty state. |
| Two staff edit the same product on the shared login | Last write wins. Mitigate with an `updated_at` check: if the row changed since the form loaded, show "This product was changed on another device — reload?" |
| Shared password leaks / staff leaves | Change password + "Sign out all devices". |
| Phone entered without country code | Assumed Guyana (+592). |
| WhatsApp number misconfigured in settings | Validated format + "Test" button. |
| Inquiry personal data | Delete inquiries older than **12 months** via a nightly `pg_cron` job; mention in a short privacy note in the footer. |

---

## 13. Build milestones

1. **Foundation:** Next.js app, Tailwind tokens, fonts, Supabase projects, migrations, RLS, seed data, typed clients.
2. **Storefront read paths:** layout/header/mega menu/footer, home, shop listing with filters/search/sort/pagination, product page, redirects.
3. **Bag & checkout:** bag store with reconciliation, drawer, cart, checkout form, `submitInquiry`, send flow, confirmation, wishlist.
4. **Admin:** auth + middleware, products CRUD with image upload, categories tree, inquiries log, settings.
5. **Polish:** SEO/JSON-LD/sitemap, analytics events, accessibility pass, reduced-motion, performance budget, retention job.
6. **Launch:** prod env, real WhatsApp number, staff enter catalogue, test on iPhone Safari + Android Chrome (WhatsApp installed and not), domain + Search Console.

### Acceptance tests (minimum)

- Submit inquiry on iOS Safari and Android Chrome → WhatsApp opens with correct text and ref; inquiry appears in admin with matching snapshot; Back returns to confirmation.
- Desktop Chrome with popups blocked → still reaches WhatsApp.
- Toggle a product to Sold out in admin → storefront reflects it within seconds (tag revalidation); a bag containing it flags it.
- Rename a category → old URL 308s to new.
- Anon key cannot read `inquiries` or write anything (test with the Supabase JS client directly).
- 6th inquiry from one IP within 10 minutes is not saved but WhatsApp still opens.
- Lighthouse mobile ≥ 90 performance and ≥ 95 accessibility on home and a product page.

---

## 14. Assumptions to confirm

These weren't explicitly decided in the interview; defaults chosen above:

1. Wishlist gets a simple `/saved` page (the design has a heart but nowhere to see saved items).
2. Inquiries are kept 12 months, then deleted.
3. Refs are random (`PH-48213`) rather than sequential, so they don't reveal order volume.
4. Only the home hero is editable; everything else on the home page is automatic.
5. Prices display as `$12,500` with "All prices in GYD" noted, rather than `G$12,500`.
6. Quantity cap of 20 per line.
7. Product page uses a single category per product for breadcrumbs and "Style it with" fallback.
