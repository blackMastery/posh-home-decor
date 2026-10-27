-- Trays & Plates SEO update from 2026-10-26-trays-plates-seo.xlsx (20 products on /shop/decor/decorative-accents/trays-and-plates).
-- Sets product name, description and main-photo alt text; clears 2 size-only notes; fixes 6 flagged URL slugs
-- (the products_after_slug trigger adds a 301 redirect from each old slug).
-- Runs in one transaction and aborts if any slug is missing or a new slug is taken.

begin;

create temp table seo_update (row_no int, old_slug text, new_slug text, name text, description text, alt text, clear_note boolean) on commit drop;
insert into seo_update values
  (1, 'hayesway-green-tray-2', 'hayesway-green-tray-2', 'Hayesway Green Stone Mosaic Tray', 'The Hayesway tray sets a pill-shaped mosaic of deep green stone, with natural veining and warm copper seams, on slim gold metal bracket feet. It is part tray, part sculpture: use it to corral perfume bottles on a dresser, candles on a coffee table or keys on a console.', 'Hayesway oval green stone mosaic tray with gold metal bracket feet', false),
  (2, 'metal-20-leaf-decorative-table-decor-multi-colored', 'metal-20-leaf-decorative-table-decor-multi-colored', 'Champagne Metal Leaf Tray, 20"', 'Cast in metal with a hammered, organic texture and a curling stem, this 20-inch leaf tray is finished in a soft champagne gold. Use it as a sculptural centrepiece on a dining or coffee table, or to hold fruit, candles and small treasures. A natural, elegant accent for modern and glam rooms.', '20-inch champagne gold hammered metal leaf-shaped decorative tray with curled stem', false),
  (3, 'metal-s-3-16-19-21-round-trays-gold-black', 'metal-s-3-16-19-21-round-trays-gold-black', 'Round Gold Mirror Trays, Set of 3', 'This nesting set of three round trays pairs mirrored bases with richly textured gold rims that look like wrapped wire. In 16-, 19- and 21-inch sizes, they layer beautifully on an ottoman or coffee table, or display perfume, candles and glassware on a dresser or bar.', 'Set of three nesting round trays with textured gold rims and mirrored bases', false),
  (4, '14-komi-green-mal', 'komi-14-green-stone-oval-tray', 'Komi 14" Green Stone Oval Tray', 'The Komi tray presents an oval of green stone mosaic, with natural veining and warm seams, raised on a sculptural gold metal stand. At 14 inches it is perfect for a vanity, entry console or bar cart, lifting perfume, jewellery or barware into a little display.', 'Komi 14-inch oval green stone mosaic tray on gold metal stand', false),
  (5, 'selbyway-white-tray-6', 'selbyway-white-tray-6', 'Selbyway White Wavy Sculptural Tray', 'Soft, rippling curves give the Selbyway tray a fluid, almost fabric-like form, finished in a clean matte white. It is a striking sculptural accent on a coffee table or console, and just as lovely holding fruit, candles or a few decorative orbs.', 'Selbyway white freeform wavy sculptural decorative tray', false),
  (6, 'brownwood-tray', 'brownwood-tray', 'Brownwood Round Wood Tray with Handles', 'Rich, dark-stained wood gives the Brownwood tray a warm, natural character. Its round shape with a low raised rim and two rounded handles makes it easy to carry, so it works as a serving tray for drinks and snacks or as a styling base for candles and greenery on a coffee table.', 'Round dark brown wood tray with raised rim and two side handles', false),
  (7, 'peaked-glass-vase-16-x-21-5-copy', 'reverie-14-white-scalloped-tray', 'Reverie 14" White Scalloped Tray', 'The Reverie tray has a crisp white finish and a sculpted, scalloped rim that gives a simple round shape a playful, architectural edge. At 14.25 inches across and 1.75 inches deep, it is ideal for a vanity, coffee table or bedside, holding candles, jewellery or small plants.', 'Reverie 14-inch round white decorative tray with sculpted scalloped rim', false),
  (8, 'stowe-tray-12-x-2-copy', 'stowe-15-round-gold-tray-large', 'Stowe 15.75" Round Gold Tray, Large', 'A plump, rounded rim in a lustrous antique gold finish frames the shallow base of the Stowe tray. At 15.75 inches across and 2.5 inches deep, it suits a coffee table or ottoman for candles, books or a vase. Pair it with the 12-inch Stowe for a layered look.', 'Stowe 15.75-inch round antique gold decorative tray with thick rounded rim', false),
  (9, 'stowe-tray-12-x-2', 'stowe-tray-12-x-2', 'Stowe 12" Round Gold Tray, Small', 'A plump, rounded rim in a lustrous antique gold finish frames the shallow base of the Stowe tray. At 12 inches across and 2 inches deep, it is just right on a vanity, nightstand or console for jewellery, keys or a candle. Pair it with the 15.75-inch Stowe for a layered look.', 'Stowe 12-inch round antique gold decorative tray with thick rounded rim', false),
  (10, 'calliope-abstract-tray-tan', 'calliope-abstract-tray-tan', 'Calliope 17" Abstract Fluted Tray', 'The Calliope tray encircles a shallow round base with a ring of sculpted fins, creating a bold, abstract form that reads as art on a coffee table or console. At 17 inches across, it is generous enough for candles, decorative orbs or a small arrangement.', 'Calliope 17-inch round abstract tray with sculpted fluted fins around the rim', true),
  (11, 'timor-green-small-agate-tray', 'timor-green-small-agate-tray', 'Timor 18" Green Agate Tray with Gold Handles', 'The Timor tray showcases a rectangular base of green agate-look stone with natural veining, framed and finished with polished gold handles. At 18 inches it is a luxurious way to serve drinks or style an ottoman, vanity or coffee table.', 'Timor 18-inch rectangular green agate tray with polished gold handles', true),
  (12, '16-foss-large-gold-tray', '16-foss-large-gold-tray', 'Foss 16" Round Gold Tray, Large', 'The Foss tray has a softly hammered, light-catching base framed by a raised gold rim with a textured edge. At 16 inches it is a handsome base for candles, a vase or a stack of books on a coffee table, dining table or ottoman.', 'Foss 16-inch round gold decorative tray with hammered base and textured rim', false),
  (13, 'mtl-tray-s-217-14-w', 'pierced-bronze-metal-oval-trays-set-of-2', 'Pierced Bronze Metal Oval Trays, Set of 2', 'This pair of oval metal trays has a warm bronze finish, a pierced lattice gallery and side handles for easy carrying. The larger tray is 17 inches wide and the smaller 14 inches. Use them to serve drinks or to bring order to an ottoman, kitchen counter or dresser.', 'Set of two oval bronze metal trays with pierced lattice gallery rims and side handles', false),
  (14, 's-2-18-13-aluminum-wavy-org-tray-gol', 'wavy-gold-aluminum-trays-set-of-2', 'Wavy Gold Aluminum Trays, Set of 2', 'Cast in aluminum with a hammered, organic surface and softly rippling edges, these two gold-tone trays feel almost molten. In 18-inch and 13-inch sizes, they make a sculptural centrepiece for a dining or coffee table, or an elegant way to serve fruit and bites.', 'Set of two hammered gold aluminum trays with wavy organic edges', false),
  (15, 's-2-18-14-colchester-wood-tray', 's-2-18-14-colchester-wood-tray', 'Colchester White Wood Trays, Set of 2', 'The Colchester set pairs two oval trays in a soft white wood finish with sleek silver-tone handles. In 18-inch and 14-inch sizes, they work as serving trays or as tidy styling bases on a coffee table, kitchen island or vanity.', 'Set of two oval white wood trays with silver metal handles', false),
  (16, 'resin-s-3-13-18-24-brss-inlay-r', 'black-resin-brass-inlay-trays-set-of-3', 'Black Resin Brass-Inlay Trays, Set of 3', 'Glossy black resin is inlaid with fine brass lines on this nesting set of three rectangular trays. In 13-, 18- and 24-inch sizes, they stack neatly when stored and look sharp layered on an ottoman, coffee table or bar, adding modern contrast to any room.', 'Set of three nesting black resin rectangular trays with brass inlay lines', false),
  (17, 's-2-12-16-coquette-bow-trays-gold', 's-2-12-16-coquette-bow-trays-gold', 'Coquette Gold Bow Mirror Trays, Set of 2', 'Ornate gold frames with sculpted bows and scrolls surround mirrored bases on the Coquette trays. In 12-inch and 16-inch sizes, they are made for a vanity, dresser or bar, where they show off perfume bottles, jewellery and glassware with romantic, vintage-inspired charm.', 'Set of two oval mirrored trays with ornate gold bow and scroll frames', false),
  (18, 'metal-18-curled-leaf-ivory-gold', 'metal-18-curled-leaf-ivory-gold', 'Curled Leaf Tray, 18", Ivory & Gold', 'This 18-inch metal leaf curls and folds in on itself, with a glossy ivory exterior that opens to reveal a rich gold interior. A sculptural centrepiece for a coffee or dining table, it also makes an elegant catch-all for keys, jewellery or wrapped sweets.', '18-inch curled metal leaf tray with ivory exterior and gold interior', false),
  (19, '16x20-teakwood-natural-tray', '16x20-teakwood-natural-tray', 'Teak Wood Free-Form Tray, 16" x 20"', 'Carved from natural teak, this free-form tray follows the organic shape of the wood, with a warm grain and soft, rolling edges. At 16 by 20 inches it is a beautiful centrepiece for a dining or coffee table, filled with fruit, greenery or decorative orbs.', '16 by 20-inch natural teak wood free-form carved tray', false),
  (20, 's-3-18-22-26-kazu-wood-trays-brown', 's-3-18-22-26-kazu-wood-trays-brown', 'Kazu Brown Wood Trays, Set of 3', 'The Kazu set brings together three rectangular nesting trays in a rich brown wood, each with raised slatted handles. In 18-, 22- and 26-inch sizes, they are ideal for serving, for styling an ottoman or coffee table, or for layering together on a console.', 'Set of three nesting rectangular brown wood trays with raised slatted handles', false);

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

-- Expect 20 products updated and 6 redirects added.
select
  (select count(*) from public.products p join seo_update u on p.slug = u.new_slug and p.name = u.name) as products_updated,
  (select count(*) from public.redirects r join seo_update u on r.from_path = '/products/' || u.old_slug and u.new_slug <> u.old_slug) as redirects_added;

commit;
