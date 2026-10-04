# Posh Home Decor — storefront & admin

Catalogue storefront where customers build a bag and send their order to the shop on WhatsApp, plus a mobile-first admin. Built from [`posh-spec.md`](posh-spec.md).

**Stack:** Next.js 16 (App Router, Cache Components, Turbopack) · Supabase (Postgres, Auth, Storage) · Tailwind CSS v4 · Vercel.

## Local development

Requires **Node 22+** (`.nvmrc`; current `supabase-js` needs native WebSocket) and **Docker** for local Supabase.

```bash
nvm use
npm install
supabase start          # local Postgres/Auth/Storage in Docker
npm run db:reset        # apply migrations + seed.sql, then create the admin and upload sample photos
npm run dev             # http://localhost:3100
```

- Storefront: http://localhost:3100 · Admin: http://localhost:3100/admin
- Admin login: `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env.local` (dev-only values; `npm run seed:dev` creates the user).
- Supabase Studio: http://127.0.0.1:54323

Copy `.env.example` to `.env.local` and fill it from `supabase status -o env` on a fresh checkout.

### Scripts

| Script | What it does |
|---|---|
| `npm run db:reset` | `supabase db reset` + `seed:dev` |
| `npm run seed:dev` | Creates the shared admin, renders placeholder product photos and static brand images, uploads them (local only) |
| `npm run db:types` | Regenerates `lib/database.types.ts` |
| `npm run check:rls` | Acceptance check: the anon key can't read inquiries or write anything |
| `npm run typecheck` / `npm run lint` | |

## Where things live

```
app/(store)/            storefront routes (home, shop, products, cart, checkout, order, saved)
app/admin/              login + (protected) inquiries, products, categories, settings
app/admin/actions/      admin server actions (re-check is_admin(), zod, updateTag)
app/actions/inquiry.ts  submitInquiry — the critical path (spec §5.7, §6.3)
lib/data/catalog.ts     cached storefront reads ('use cache' + cacheTag)
lib/whatsapp/message.ts order message + length guard (shared by server, preview, fallback)
lib/bag/                localStorage stores (bag, wishlist, customer details)
proxy.ts                admin session refresh/guard + 308 redirects
supabase/migrations/    schema, triggers, RLS, RPCs, storage policies, retention cron
```

## Decisions and deviations from the spec

- **Next 16 conventions:** `middleware.ts` is now `proxy.ts`; caching uses Cache Components (`'use cache'`, `cacheTag`) and admin writes call `updateTag` so changes show immediately.
- **Redirects** are checked in `proxy.ts` *before* rendering rather than "on 404". Equivalent here: the DB deletes any redirect whose source becomes a live path again, so a `from_path` is never live.
- **WhatsApp links** use `https://api.whatsapp.com/send?phone=…&text=…` instead of `wa.me/…`. The `wa.me` short link redirects there and corrupts some emoji (the ✨ in the order message) on the way. It still opens the app on phones.
- **Mobile send flow:** instead of `router.push` then `location.href` in the same tick (which can cancel the navigation), checkout navigates to `/order/{ref}` and the confirmation page opens WhatsApp once (a flag in sessionStorage is consumed), so Back lands on the confirmation and doesn't reopen WhatsApp.
- **Idempotency** uses a unique nullable `client_nonce` column on `inquiries` (one of the two options in §6.3).
- **Unknown product/category URLs** render the not-found page with `noindex`. Because pages stream behind Suspense the HTTP status is 200, not 404.
- **Contrast (§10):** `muted` darkened to `#76655A` (5.2:1 on cream) and `bronze` text to `#8A672B` (4.85:1); the originals measured 4.0:1.
- **Photo reordering:** drag-and-drop on desktop plus ↑/↓ buttons. Touch long-press drag isn't implemented; the buttons cover phones.
- **"Today"** in the inquiry filter and admin timestamps use Guyana time (UTC−4).
- **Prototype design:** the Claude Design artifact wasn't available here, so the UI follows the spec's tokens, typography and layout rules. Logo and sample photos are generated placeholders.

## Production checklist (spec §11)

- Supabase **Pro** (image transformations, no pausing, backups). Without it, set `NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM=false` and add the project host to `images.remotePatterns` (already derived from `NEXT_PUBLIC_SUPABASE_URL`).
- In the dashboard: turn off sign-ups, turn on leaked-password protection, set the minimum password length to 12, enable `pg_cron`.
- Create the single admin in Auth → Users, then `insert into admins (user_id) values ('<uuid>');`.
- Set the real WhatsApp number in Admin → Settings and press **Test**.
- Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `INQUIRY_IP_SALT` (`openssl rand -hex 32`), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM`. Enable Vercel Web Analytics.
