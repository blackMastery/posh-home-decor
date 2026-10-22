# Roadmap

Built from the remaining work in [`posh-spec.md`](../posh-spec.md): §13 milestones 5–6, the §13 acceptance tests, the §14 assumptions and the README production checklist. There's no `TODO.md` yet. If one is added, reconcile this file with it.

Spec milestones 1–4 (foundation, storefront, bag and checkout, admin) are done. So are the extras added since: gallery, product codes, attributes, faceted filters and header search. Each phase below is small enough to ship as one PR.

## Done

- [x] Foundation: Next 16, Tailwind tokens, Supabase migrations, RLS, seed data, typed clients
- [x] Storefront: home, shop with filters, search and sort, product page, redirects, About, Gallery
- [x] Bag, checkout, `submitInquiry`, send flow, confirmation, wishlist (`/saved`)
- [x] Admin: auth with `proxy.ts`, products, categories, attributes, gallery, inquiries, settings
- [x] SEO basics: `sitemap.ts`, `robots.ts`, JSON-LD, metadata. Analytics events. Reduced motion. Retention cron job

## Phase 1: Test harness

1. Add Vitest with an `npm run test` script and one smoke test.
2. Unit test `lib/whatsapp/message.ts`: format, length guard, unpriced, pre-order and sold-out lines.
3. Unit test phone normalisation, covering Guyana numbers and international (diaspora) numbers.
4. Unit test the bag store: reconciliation, the quantity cap of 20 and stale or sold-out items.
5. Add Playwright with an `npm run test:e2e` script, running against local Supabase on mobile WebKit and Chromium projects.

## Phase 2: Acceptance tests (spec §13)

1. E2E: the happy path. Bag → checkout → inquiry row saved → WhatsApp URL with the correct ref and text.
2. E2E: Back from WhatsApp lands on `/order/{ref}` and doesn't reopen WhatsApp.
3. E2E: with popups blocked, the flow still reaches WhatsApp.
4. E2E: marking a product sold out in admin shows on the storefront within seconds, and the bag flags it.
5. E2E: renaming a category makes the old URL return a 308.
6. E2E: the 6th inquiry from one IP within 10 minutes isn't saved, but WhatsApp still opens.
7. Confirm `npm run check:rls` passes, and document it next to the tests.

## Phase 3: Quality bar (spec §10)

1. Run Lighthouse mobile on the home page and a product page, and record the scores.
2. Fix performance until it scores ≥ 90 (images, fonts, JS size).
3. Fix accessibility until it scores ≥ 95, then do a manual keyboard and screen-reader pass of the send flow.
4. Check that reduced motion works across hero, reveal and gallery animations.

## Phase 4: Settle the open assumptions (spec §14)

1. Confirm with stakeholders: the 12-month retention, random refs, price display (`$12,500` with "All prices in GYD") and the quantity cap of 20.
2. Check the delivery and collection copy and phone handling for diaspora and gift buyers.
3. Update `posh-spec.md` and the code for any answers that differ from the defaults.

## Phase 5: Production setup (human-run steps marked 👤)

1. 👤 Create the Supabase Pro project and push migrations (`supabase db push`, run by a human).
2. 👤 In the Supabase dashboard: turn off sign-ups, turn on leaked-password protection, set the minimum password length to 12, enable `pg_cron`.
3. 👤 Create the admin user, then add them with `insert into admins (user_id) values (...)`.
4. 👤 Set the Vercel env vars (`NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`, `INQUIRY_IP_SALT`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_IMAGE_TRANSFORM`) and enable Web Analytics.
5. Deploy a preview build and run the smoke checks against it.

## Phase 6: Launch

1. 👤 Set the real WhatsApp number in Admin → Settings and press **Test**.
2. 👤 Staff enter the starting catalogue, using the admin on phones.
3. Test on real devices: iPhone Safari and Android Chrome, each with WhatsApp installed and without it.
4. 👤 Connect the domain, then submit the sitemap to Google Search Console.
5. Check that the retention cron job is scheduled in production.

## Later (not scheduled)

The path to e-commerce (see [`mission.md`](mission.md)): CI, error monitoring, then online payment, customer accounts, stock quantities, order statuses, delivery zones and fees, notifications. These need a stakeholder decision before they get phases here.
