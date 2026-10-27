-- Clocks SEO update from 2026-10-26-clocks-seo.xlsx (3 products on /shop/decor/decorative-accents/clocks).
-- Sets product name, description and main-photo alt text; clears 1 size-only note; fixes 2 flagged URL slugs
-- (the products_after_slug trigger adds a 301 redirect from each old slug).
-- Runs in one transaction and aborts if any slug is missing or a new slug is taken.

begin;

create temp table seo_update (row_no int, old_slug text, new_slug text, name text, description text, alt text, clear_note boolean) on commit drop;
insert into seo_update values
  (1, 'casperworth-brown-wall-clock-36', 'casperworth-brown-wall-clock-36', 'Casperworth 36" Wood & Metal Wall Clock', 'The Casperworth wall clock frames an open centre with a wide ring of warm, grain-rich wood, edged and divided by brushed silver metal. Slim silver hands sweep from a round wood hub. At 36 inches it is a statement piece above a sofa, console or dining table in modern farmhouse and industrial rooms.', 'Casperworth 36-inch round wall clock with open centre, brown wood ring and silver metal trim', false),
  (2, 'gold-stainless-steel-metal-starburst-decorative-wall-clock-with-black-accents-an', 'gold-starburst-disc-wall-clock-31', 'Gold Starburst Disc Wall Clock, 31"', 'Overlapping gold discs, each etched with a fine starburst pattern, fan out from a ringed clock face with crisp black numerals and hands. At 31 by 15 inches, this wide, sculptural wall clock adds glamorous wall art and timekeeping in one, above a sofa, bed or console.', 'Gold metal starburst wall clock with overlapping etched discs and black numerals', true),
  (3, 'metal-35-fan-style-table-clock-gold-kd', 'fan-style-35-gold-table-clock', 'Fan-Style 35" Gold Table Clock', 'Styled after a vintage desk fan, this 35-inch clock sets a white dial within a black wire cage and curved gold blades, all raised on a turned gold pedestal base. A playful, conversation-starting accent for a console, sideboard or office. Arrives in parts for simple assembly.', '35-inch vintage fan-style clock with black wire cage, gold blades and gold pedestal base', false);

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

-- Expect 3 products updated and 2 redirects added.
select
  (select count(*) from public.products p join seo_update u on p.slug = u.new_slug and p.name = u.name) as products_updated,
  (select count(*) from public.redirects r join seo_update u on r.from_path = '/products/' || u.old_slug and u.new_slug <> u.old_slug) as redirects_added;

commit;
