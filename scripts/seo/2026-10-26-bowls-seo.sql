-- Bowls SEO update from 2026-10-26-bowls-seo.xlsx (24 products on /shop/decor/decorative-accents/bowls).
-- Sets product name, description and main-photo alt text; clears 6 size-only notes; fixes 6 flagged URL slugs
-- (the products_after_slug trigger adds a 301 redirect from each old slug).
-- Runs in one transaction and aborts if any slug is missing or a new slug is taken.

begin;

create temp table seo_update (row_no int, old_slug text, new_slug text, name text, description text, alt text, clear_note boolean) on commit drop;
insert into seo_update values
  (1, 'elliotton-red-bowl', 'elliotton-red-bowl', 'Elliotton Red Art Glass Bowl', 'Rich ruby-red glass flows into a soft, wavy rim on the Elliotton bowl, glowing like stained glass when the light shines through. Display it empty as a sculptural centrepiece on a dining or coffee table, or fill it with fruit or decorative orbs for a bold pop of colour.', 'Elliotton red art glass decorative bowl with a wavy rim', false),
  (2, 'syllable-bowl', 'syllable-bowl', 'Syllable Gold Fluted Bowl', 'Finely pleated ridges radiate from the centre of the Syllable bowl to a ruffled, scalloped edge, finished in a warm champagne gold. This shallow, sculptural bowl catches the light beautifully on a coffee table, console or dining table, empty or holding a few decorative orbs.', 'Syllable shallow round bowl with radiating fluted ridges in champagne gold', false),
  (3, 'sylvia-bowl', 'sylvia-bowl', 'Sylvia Ivory Ruffled Ceramic Bowl', 'Organic, coral-like ruffles form the rim of the Sylvia bowl, finished in a speckled ivory glaze with a natural, textured feel. Measuring 18.25 by 15 inches and 4.75 inches high, it makes a statement centrepiece for a dining table, console or coffee table.', 'Sylvia ivory ceramic bowl with an organic coral-like ruffled rim', true),
  (4, 'peytonwick-set-of-2-purple-bowls-4', 'peytonwick-set-of-2-purple-bowls-4', 'Peytonwick Plum Bowls, Set of 2', 'Glossy plum glaze gives these two shallow Peytonwick bowls a rich, jewel-toned finish. Use them as decorative catch-alls on a vanity, entry table or coffee table, or layer them with neutral pieces for a modern pop of colour.', 'Peytonwick set of two shallow round bowls in glossy plum purple', false),
  (5, 's-2-metal-round-plates-ivory', 's-2-metal-round-plates-ivory', 'Ivory & Gold Metal Platters, Set of 2', 'These two round metal platters feature an ivory finish with a fine, hand-drawn grid pattern and gleaming gold rims. In 18-inch and 21-inch sizes, they work as decorative chargers, wall decor or styling bases on a coffee table or console.', 'Set of two round ivory metal platters with gold rims and fine grid pattern', true),
  (6, 'metal-cut-out-trays-gold', 'gold-coral-cut-out-metal-bowls-set-of-2', 'Gold Coral Cut-Out Metal Bowls, Set of 2', 'Branching, coral-inspired cut-outs give these gold metal bowls an airy, sculptural look, raised on small feet. In 14-inch and 16-inch sizes, they are perfect for fruit, decorative orbs or simply on their own as coastal-glam accents.', 'Gold metal bowl with coral-inspired branching cut-outs on small feet', true),
  (7, 'vania-bowl', 'vania-bowl', 'Vania Smoked Glass Pedestal Bowl', 'A wide, smoky taupe glass bowl rests on a dark sculpted glass foot on the Vania centrepiece. At 12.5 inches across and 5.5 inches high, it brings refined, mid-century style to a dining table, sideboard or console, empty or filled with fruit.', 'Vania smoked taupe glass bowl on a dark glass pedestal foot', true),
  (8, 'fringe-bowl', 'fringe-bowl', 'Fringe Bronze Glazed Bowl', 'Layered, fringe-like texture wraps the outside of this low bowl, while a speckled bronze glaze pools inside. At 14.25 inches across and 3.5 inches high, it adds earthy, handcrafted character to a coffee table, console or shelf.', 'Fringe low round bowl with textured fringe exterior and speckled bronze glaze', true),
  (9, 'tomar-trough', 'tomar-trough', 'Tomar Ribbed White Trough Bowl', 'The Tomar trough has a long, low oval shape with finely ribbed sides in a soft white finish. At 14 by 5.25 inches and 5 inches high, it is ideal for succulents, a row of candles or a simple run of greenery on a dining table or mantel.', 'Tomar long oval white ribbed trough bowl', true),
  (10, '19-salerno-small-italian-art-glass-t', 'salerno-19-italian-art-glass-platter-gray', 'Salerno 19" Italian Art Glass Platter, Gray', 'Smoky gray Italian art glass with a delicate textured surface forms this wide, shallow Salerno platter. At 19 inches across it is an elegant centrepiece for a dining table or console, and it looks beautiful catching the light on a shelf.', 'Salerno 19-inch smoky gray Italian art glass shallow platter', false),
  (11, '16x5-varena-red-bowl', '16x5-varena-red-bowl', 'Varena 16" Red Freeform Bowl', 'Glossy red glaze and a soft, wavy freeform shape make the Varena bowl a bold sculptural accent. At 16 inches across and 5 inches high, it shines on a dining table, console or coffee table, and pairs with the Varena red vases.', 'Varena 16-inch glossy red freeform decorative bowl with wavy rim', false),
  (12, 'atwood-vase-14-75-x-9', 'atwood-vase-14-75-x-9', 'Atwood 14.75" Striped Bowl Vase', 'Bold cream brushstroke stripes run over a rich brown body on the Atwood, a wide, round bowl vase with an earthy, handmade feel. At 14.75 by 9 inches, it works as a statement vessel on a console or coffee table, with or without a few dried stems.', 'Atwood round brown bowl vase with cream brushstroke stripes', false),
  (13, 'rhea-bowl-20-25-x-8-25', 'rhea-bowl-20-25-x-8-25', 'Rhea 20" White Footed Bowl', 'Rows of raised rectangular blocks wrap around the rim of the Rhea bowl, giving a simple white footed form a bold architectural texture. At 20.25 inches across and 8.25 inches high, it is a striking centrepiece for a dining table, island or console.', 'Rhea 20-inch white footed bowl with raised rectangular block relief around the rim', false),
  (14, 'iliad-bowl-23-5-x-8', 'iliad-bowl-23-5-x-8', 'Iliad 23.5" Reactive Glaze Bowl', 'A ribbed body crowned with a ring of sculpted points gives the Iliad bowl a dramatic, crown-like silhouette. A rich reactive glaze in browns, rust and smoky blue makes every piece unique. At 23.5 inches across and 8 inches high, it is a true statement centrepiece.', 'Iliad 23.5-inch ribbed bowl with pointed rim in brown and blue reactive glaze', false),
  (15, 'imagine-bowl-17-5-x-17-x-3-75', 'imagine-bowl-17-5-x-17-x-3-75', 'Imagine White Wavy Shallow Bowl', 'A soft, wavy rim and a pale, textured white finish give the Imagine bowl an organic, coastal feel. At 17.5 by 17 inches and just 3.75 inches deep, it works as a low centrepiece, a styling base for candles or a catch-all on a coffee table.', 'Imagine shallow white decorative bowl with a wavy organic rim', false),
  (16, 'pleated-glass-bowl-15-5-x-14-5-x', 'pleated-blush-glass-bowl', 'Pleated Blush Glass Bowl', 'Ruffled, pleated glass in a soft blush tint forms this romantic, shell-like bowl. At 15.5 by 14.5 inches, it adds a delicate, vintage-inspired accent to a dining table, vanity or console, beautiful on its own or holding fruit or flowers.', 'Pleated blush pink glass decorative bowl with ruffled shell-like edges', false),
  (17, 's-2-15-20-salzburg-white-bowls', 's-2-15-20-salzburg-white-bowls', 'Salzburg White Oval Bowls, Set of 2', 'Long, low and gently curved, the Salzburg bowls are finished in white with finely ribbed rims. In 15-inch and 20-inch lengths, they are ideal for a run of greenery, fruit or decorative orbs along a dining table, mantel or console.', 'Salzburg set of two long low white oval bowls with ribbed rims', false),
  (18, '16-kony-white-bowl', '16-kony-white-bowl', 'Kony 16" White Shell Bowl', 'Sculpted like a curling seashell, with deep ribbed ridges and a glossy white finish, the Kony bowl is a coastal statement piece. At 16 inches it is beautiful on a console, coffee table or shelf, empty or holding a few natural treasures.', 'Kony 16-inch glossy white ribbed seashell-shaped decorative bowl', false),
  (19, '18x6-mungur-bowl-w-legs', '18x6-mungur-bowl-w-legs', 'Mungur 18" Wood Footed Bowl', 'Warm, richly grained wood forms the wide, shallow Mungur bowl, raised on three chunky round legs. At 18 inches across and 6 inches high, it is a natural, modern centrepiece for fruit on a dining table or kitchen island.', 'Mungur 18-inch shallow wood bowl raised on three round wooden legs', false),
  (20, '14-mantra-palimanan-stone-bowel', 'mantra-14-palimanan-stone-bowl', 'Mantra 14" Palimanan Stone Bowl', 'Carved from Palimanan sandstone, the Mantra bowl shows soft, natural banding in warm sand and caramel tones, with a gently wavy rim. At 14 inches it brings an earthy, spa-like calm to a coffee table, console or bathroom counter.', 'Mantra 14-inch carved Palimanan sandstone bowl with a wavy rim', false),
  (21, '14x7-oval-pedestal-bowl-w-enamel-wht', '14x7-oval-pedestal-bowl-w-enamel-wht', 'Oval Pedestal Bowl, Pewter & White Enamel, 14"', 'A hammered, pewter-toned metal exterior contrasts with a lustrous white enamel interior on this oval pedestal bowl. At 14 by 7 inches, it makes an elegant centrepiece for a dining table or sideboard, empty or filled with fruit.', '14-inch oval pedestal bowl with hammered pewter exterior and white enamel interior', false),
  (22, '20x8-v-shaped-metal-bowl-gold-ta', 'v-shaped-champagne-metal-bowl-20', 'V-Shaped Champagne Metal Bowl, 20"', 'Sweeping up into two tapered points, this V-shaped metal bowl has a sleek, boat-like silhouette and a polished champagne finish. At 20 inches long and 8 inches high, it is a modern sculptural accent for a console, sideboard or coffee table.', '20-inch V-shaped boat-style metal bowl in polished champagne finish', false),
  (23, '21x20-free-form-metal-bowl-tan-mul', 'free-form-metal-bowl-cream-gold-21', 'Free-Form Metal Bowl, Cream & Gold, 21"', 'Twisting, shell-like folds give this free-form metal bowl an organic, sculptural shape, finished in cream with gold and silver highlights. At 21 by 20 inches, it is a dramatic centrepiece for a dining table or console.', '21-inch free-form shell-like metal bowl in cream with gold and silver highlights', false),
  (24, '14-lorvao-portugal-bowl', '14-lorvao-portugal-bowl', 'Lorvao 14" Black Ribbed Glazed Bowl', 'Part of our Portugal collection, the Lorvao bowl has a rounded, pumpkin-like ribbed body in a glossy speckled black and gray glaze. At 14 inches it makes a moody, handcrafted accent on a coffee table, shelf or console.', 'Lorvao 14-inch round ribbed bowl in glossy speckled black and gray glaze', false);

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

-- Expect 24 products updated and 6 redirects added.
select
  (select count(*) from public.products p join seo_update u on p.slug = u.new_slug and p.name = u.name) as products_updated,
  (select count(*) from public.redirects r join seo_update u on r.from_path = '/products/' || u.old_slug and u.new_slug <> u.old_slug) as redirects_added;

commit;
