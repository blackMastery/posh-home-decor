-- Tableware SEO update from 2026-10-26-tableware-seo.xlsx (12 products on /shop/decor/tableware).
-- Sets product name, description and main-photo alt text; clears 1 size-only note; fixes 5 flagged URL slugs
-- (the products_after_slug trigger adds a 301 redirect from each old slug).
-- Runs in one transaction and aborts if any slug is missing or a new slug is taken.

begin;

create temp table seo_update (row_no int, old_slug text, new_slug text, name text, description text, alt text, clear_note boolean) on commit drop;
insert into seo_update values
  (1, 'white-botanic-glass-flower-napkin-ring', 'white-botanic-glass-flower-napkin-ring', 'White Glass Flower Napkin Ring', 'Delicate white glass blossoms twine around this botanical napkin ring, adding a fresh, garden-party feel to every place setting. Pair it with crisp linen napkins for weddings, bridal showers, Easter brunch or an elegant everyday table.', 'White glass botanical napkin ring with delicate flower blossoms', false),
  (2, 'green-lucite-napkin-holder-with-pink-weight', 'green-lucite-napkin-holder-with-pink-weight', 'Green Lucite Napkin Holder with Pink Weight', 'This square napkin holder in clear green lucite comes with a pink acrylic weight that keeps paper napkins neatly in place, even outdoors. A cheerful, modern way to set a buffet, kitchen island or patio table, it is just as useful for everyday meals as for parties.', 'Square green lucite napkin holder with pink acrylic weight holding white napkins', false),
  (3, 'blue-lucite-napkin-holder-4pk', 'teal-lucite-napkin-rings-set-of-4', 'Teal Lucite Napkin Rings, Set of 4', 'Crisp, square napkin rings in clear teal lucite bring a bright pop of colour and a modern edge to your table. This set of four is ideal for dinner parties, holiday tables and coastal-inspired place settings.', 'Set of four square teal lucite napkin rings', false),
  (4, 'gold-lucite-napkin-rings-4pk', 'gold-lucite-napkin-rings-4pk', 'Gold Lucite Napkin Rings, Set of 4', 'Square napkin rings in warm, gold-toned lucite catch the light for a glamorous finish on any table. This set of four suits holiday dinners, weddings and elegant entertaining, and pairs beautifully with gold flatware and chargers.', 'Set of four square gold-toned lucite napkin rings', false),
  (5, 'napkin-ring', 'gold-coil-napkin-rings-with-pearls', 'Gold Coil Napkin Rings with Pearls', 'Slim gold coils, finished with pearl accents at each end, wrap around your napkins on these elegant napkin rings. They add a refined, bridal-inspired touch to weddings, anniversaries, showers and holiday tables.', 'Gold coil napkin rings finished with pearl accents', false),
  (6, 'napkin-holder', 'green-glass-flower-napkin-ring', 'Green Glass Flower Napkin Ring', 'Two green glass blossoms bloom from a twisting stem on this botanical napkin ring. It brings a fresh, springtime feel to brunches, garden parties and holiday tables, and pairs beautifully with white or green linens.', 'Green glass botanical napkin ring with two flower blossoms on a twisted stem', false),
  (7, 'red-chargers', 'red-chargers', 'Red Glass Charger Plates', 'Rich red glass with a textured, radiating rim gives these charger plates a festive sparkle. Layer them under dinner plates to frame each place setting for Christmas, Valentine''s Day, weddings or any celebration.', 'Round red glass charger plate with textured radiating rim', false),
  (8, 'pineapple-pink-canister', 'pineapple-ceramic-canister', 'Pineapple Ceramic Canister', 'Shaped like a ripe pineapple, with a golden diamond-pattern body and a green leafy lid, this canister brings tropical fun to a kitchen counter, coffee station or pantry shelf. At 6.5 by 12 inches it is roomy enough for sweets, tea bags or coffee pods.', 'Yellow ceramic pineapple canister with green leaf lid', true),
  (9, 'pear-canister', 'pear-canister', 'Pear Canister, Green & Pink Plaid', 'A sweet pear finial tops this lidded canister, painted in soft green with a hand-drawn pink plaid pattern. Fill it with treats, cotton balls or tea bags. It adds a playful, vintage-inspired note to a kitchen, coffee bar or vanity, and pairs with our apple and pomegranate canisters.', 'Green and pink plaid lidded canister with pear-shaped finial', false),
  (10, 'apple-canister', 'apple-canister', 'Apple Canister, Green Stripe', 'Bold green stripes and a little red apple finial give this lidded canister a cheerful, retro charm. Use it to store sweets, biscuits or coffee pods on a kitchen counter or coffee station. It pairs with our pear and pomegranate canisters.', 'Green striped lidded canister with red apple finial', false),
  (11, 'pomegranate-pink-canister', 'pomegranate-pink-canister', 'Pomegranate Canister, Pink Gingham', 'Pretty pink gingham and a sculpted pomegranate finial make this lidded canister a sweet accent for a kitchen, vanity or coffee bar. Fill it with treats, tea or bath essentials. It pairs with our pear and apple canisters.', 'Pink gingham lidded canister with pomegranate finial', false),
  (12, 'fresh-fruits-canisters', 'strawberry-ceramic-canister', 'Strawberry Ceramic Canister', 'A juicy red strawberry with a speckled seed texture and a green leaf lid with a curled stem, this canister is pure kitchen charm. Use it for sweets, sugar packets or tea bags on a counter, breakfast table or coffee station.', 'Red ceramic strawberry canister with green leaf lid and curled stem', false);

do $$
declare missing text; taken text;
begin
  select string_agg(u.row_no || ' ' || u.old_slug, ', ') into missing
  from seo_update u left join public.products p on p.slug = u.old_slug where p.id is null;
  if missing is not null then raise exception 'Products not found for rows: %', missing; end if;

  select string_agg(u.new_slug, ', ') into taken
  from seo_update u join public.products p on p.slug = u.new_slug
  where u.new_slug <> u.old_slug;
  if taken is not null then raise exception 'New slugs already in use: %', taken; end if;
end $$;

-- Alt text on each product's main (first) photo, matched before slugs change.
update public.product_images i
set alt = u.alt
from seo_update u
join public.products p on p.slug = u.old_slug
where i.id = (
  select i2.id from public.product_images i2
  where i2.product_id = p.id
  order by i2.sort_order, i2.created_at
  limit 1
);

update public.products p
set name = u.name,
    description = u.description,
    slug = u.new_slug,
    note = case when u.clear_note then null else p.note end
from seo_update u
where p.slug = u.old_slug;

-- Expect 12 products updated and 5 redirects added.
select
  (select count(*) from public.products p join seo_update u on p.slug = u.new_slug and p.name = u.name) as products_updated,
  (select count(*) from public.redirects r join seo_update u on r.from_path = '/products/' || u.old_slug and u.new_slug <> u.old_slug) as redirects_added;

commit;
