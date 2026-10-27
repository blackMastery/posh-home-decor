-- Bottles SEO update from 2026-10-26-bottles-seo.xlsx (11 products on /shop/decor/decorative-accents/bottle).
-- Sets product name, description and main-photo alt text; clears 2 size-only notes; fixes 4 flagged URL slugs
-- (the products_after_slug trigger adds a 301 redirect from each old slug).
-- Runs in one transaction and aborts if any slug is missing or a new slug is taken.

begin;

create temp table seo_update (row_no int, old_slug text, new_slug text, name text, description text, alt text, clear_note boolean) on commit drop;
insert into seo_update values
  (1, '9-nicolau-decorative-bowl-silver-cloud', '9-nicolau-decorative-bowl-silver-cloud', 'Nicolau 9" Sculptural Decorative Bowl, Cream', 'The Nicolau bowl has a free-form, wave-like rim that rises and dips like a folded leaf, finished in a soft matte cream. At 9 inches it is a quiet sculptural accent on a coffee table, console or shelf, beautiful left empty or filled with keys, decorative orbs or dried botanicals.', 'Nicolau 9-inch cream sculptural decorative bowl with a wavy, free-form rim', false),
  (2, 'glass-16-metallic-bottle-w-stone-top-silver', 'glass-16-metallic-bottle-w-stone-top-silver', 'Silver Metallic Glass Bottle with Stone Top, 16"', 'Mirror-bright metallic silver glass gives this 16-inch decorative bottle a glamorous, reflective finish, crowned with a ring-shaped stopper set with a natural stone disc. Display it on a console, mantel or bar cart, alone or grouped with other silver and glass accents, for an instant touch of modern glamour.', '16-inch metallic silver glass decorative bottle with ring stopper and stone disc top', false),
  (3, 'sage-green-bottle-glass-nob', 'sage-green-ombre-glass-bottle-with-stopper', 'Sage Green Ombré Glass Bottle with Stopper', 'Soft sage green fades into a smoky blue band on this antiqued glass bottle, finished with a speckled, mercury-style texture. A clear faceted glass stopper on a silver collar completes the look. Style it on a shelf, sideboard or bathroom counter for a calm, coastal-inspired accent.', 'Sage green and blue ombre antiqued glass bottle with clear faceted glass stopper', false),
  (4, 's-2-15-18-ashford', 'ashford-ombre-bottles-set-of-2', 'Ashford Ombré Bottles with Gold Stoppers, Set of 2', 'The Ashford set pairs two flat, rounded bottles glazed in a soft ombré that drifts from misty blue-gray to speckled ivory. Each is topped with a sculptural gold flame-shaped stopper. In 15-inch and 18-inch heights, they make an elegant grouping on a console, mantel or bookshelf.', 'Ashford set of two ombre blue-gray and ivory decorative bottles with gold flame stoppers', false),
  (5, '18-clarimond', 'clarimond-18-amber-glass-bottle', 'Clarimond 18" Amber Glass Bottle', 'Warm amber glass with ribbed, stacked bands gives the Clarimond bottle a vintage apothecary charm. Standing 18 inches tall with a matching amber stopper, it glows beautifully when light passes through it. Display it on a windowsill, shelf or dining table, or add a single stem.', 'Clarimond 18-inch ribbed amber glass decorative bottle with matching stopper', false),
  (6, 'anders-green-glass-bottle', 'anders-green-glass-bottle', 'Anders Green Glass Bottles, Set of 3', 'The Anders set brings together three glass bottles in sage green that deepens to a smoky violet at the base, each topped with a twisted gold-tone sculptural stopper. In 12-, 14- and 18-inch heights, they create an eye-catching, layered display on a console, mantel or open shelving.', 'Anders set of three sage green and violet ombre glass bottles with twisted gold stoppers', true),
  (7, 'reims-antique-gold-bottl', 'reims-antique-gold-bottles-set-of-3', 'Reims Antique Gold Bottles, Set of 3', 'The Reims set mixes three geometric shapes, a tall square, a round disc and a low rectangle, each in a rich antique gold finish with slim spout-style necks. In 10-, 10- and 14-inch heights, they make a striking modern grouping on a coffee table, console or bookshelf.', 'Reims set of three geometric antique gold decorative bottles in square, round and rectangular shapes', true),
  (8, '41-senga-large-floor-bottle', '41-senga-large-floor-bottle', 'Senga 41" Gold & Silver Floor Bottle', 'Standing an impressive 41 inches tall, the Senga floor bottle is a tapered, obelisk-style form with a shimmering silver and gold mosaic-like finish. A sculptural, organic gold finial crowns the top. Place it in an entryway, beside a console or in an empty corner for real height and drama.', 'Senga 41-inch tall tapered floor bottle with silver and gold finish and sculptural gold finial', false),
  (9, '13-beloit-small-gold-bottle', '13-beloit-small-gold-bottle', 'Beloit 13" Faceted Gold Bottle, Small', 'The Beloit bottle is cut with bold, angular facets and finished in a polished gold that catches the light from every side. A green stone stopper on a gold collar adds a rich contrast. At 13 inches it is ideal on a shelf or side table, and it pairs with the 17-inch Beloit for a matched set.', 'Beloit 13-inch faceted polished gold decorative bottle with green stone stopper', false),
  (10, 's-2-12-14-castalia-gold-metal-bottles', 's-2-12-14-castalia-gold-metal-bottles', 'Castalia Gold Metal Bottles, Set of 2', 'Sleek, polished gold metal gives the Castalia bottles a warm, mirror-like glow. Each cylinder is topped with a slim gold neck and a creamy stone-look stopper. In 12- and 14-inch heights, the pair adds modern luxury to a console, mantel or dining sideboard.', 'Castalia set of two polished gold metal cylinder bottles with cream stone-look stoppers', false),
  (11, '17-beloit-large-gold-bottle', '17-beloit-large-gold-bottle', 'Beloit 17" Faceted Gold Bottle, Large', 'The Beloit bottle is cut with bold, angular facets and finished in a polished gold that catches the light from every side. A green stone stopper on a gold collar adds a rich contrast. At 17 inches it makes a confident statement on a console or mantel, and it pairs with the 13-inch Beloit for a matched set.', 'Beloit 17-inch faceted polished gold decorative bottle with green stone stopper', false);

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

-- Expect 11 products updated and 4 redirects added.
select
  (select count(*) from public.products p join seo_update u on p.slug = u.new_slug and p.name = u.name) as products_updated,
  (select count(*) from public.redirects r join seo_update u on r.from_path = '/products/' || u.old_slug and u.new_slug <> u.old_slug) as redirects_added;

commit;
