# Tech stack

## Current stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.3** (App Router, Turbopack, Cache Components) | `proxy.ts` replaces `middleware.ts`. Reads use `'use cache'` with `cacheTag`, and admin writes call `updateTag`. Read `node_modules/next/dist/docs/` before writing code (see `AGENTS.md`). |
| UI | **React 19.2**, **Tailwind CSS v4** | Design tokens follow spec §2, with contrast tweaks noted in the README. |
| Motion | `motion` v14 | Respect `prefers-reduced-motion`. |
| Drag and drop | `@dnd-kit` | Admin photo and gallery reordering. |
| Database, Auth, Storage | **Supabase** (Postgres, Auth, Storage, `pg_cron`) | RLS on every table. `admins` table with `is_admin()`. Retention cron job. Migrations live in `supabase/migrations/`. |
| Supabase clients | `@supabase/ssr`, `@supabase/supabase-js` | Generated types are in `lib/database.types.ts` (`npm run db:types`). |
| Validation | **zod** v4 | Every server action and admin mutation. |
| Phone numbers | `libphonenumber-js` | Normalise to E.164 and default to Guyana (+592). Must accept international numbers for diaspora buyers. |
| Images | Supabase image transformations (Pro), `browser-image-compression`, `heic2any` | Compressed on the client before upload. iPhone HEIC files are converted. |
| Analytics | `@vercel/analytics` | Custom events via `components/store/tracked-link.tsx` and the bag and checkout components. |
| Hosting | **Vercel** + Supabase cloud (Pro) | |
| Runtime | Node ≥ 22 | Pinned in `.nvmrc`. |
| Tooling | TypeScript 5, ESLint 9 (`eslint-config-next`), Supabase CLI | Docker for local Supabase. |

## Gaps to close

### Adding now: automated testing

- **Vitest** for pure logic:
  - `lib/whatsapp/message.ts`: message format, length guard, unpriced and pre-order flags.
  - Phone normalisation, including international numbers.
  - Bag and wishlist stores: reconciliation, the quantity cap of 20, sold-out flags.
  - `displayName` and price formatting.
- **Playwright** for end-to-end tests against local Supabase. It should cover the spec §13 acceptance tests that can be automated:
  - Bag → checkout → inquiry saved → WhatsApp URL opened, with Back landing on the confirmation page.
  - The flow still reaches WhatsApp with popups blocked.
  - An item marked sold out in admin is flagged in the storefront and the bag.
  - A renamed category's old URL returns a 308 to the new one.
  - The 6th inquiry from one IP within 10 minutes isn't saved, but WhatsApp still opens.
  - Mobile viewports for iPhone Safari (WebKit) and Android Chrome.
- `npm run check:rls` remains the RLS acceptance check.
- New scripts: `test` (Vitest) and `test:e2e` (Playwright).

### Known gaps, not adopted yet

- **CI.** Nothing runs typecheck, lint, tests or `check:rls` automatically yet. Add it once the test suite exists if review starts missing regressions.
- **Error monitoring.** There's no Sentry or similar. Production errors in `submitInquiry` and admin uploads would only show up in the Vercel logs.
- **E-commerce stack.** A payment provider, customer auth and email delivery aren't chosen yet. Decide when the payments phase is scheduled. Supabase Auth would be the default for customer accounts.

## Constraints

- **Database writes are human-only.** Agents may write migration files but must not run `supabase db push`, `db reset`, `migration up` or any SQL that writes. See `CLAUDE.md`.
- Use library docs from Context7 rather than training data, because Next 16 differs from earlier versions.
- Keep secrets in `.env.local` and Vercel env. Never commit them.
