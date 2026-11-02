-- Garden SEO update from 2026-10-28-garden-seo.xlsx (12 products on /shop/garden).
-- Sets product name, description and main-photo alt text; clears 1 size-only note; fixes 5 flagged URL slugs
-- (the products_after_slug trigger adds a redirect from each old slug).
-- Runs in one transaction and aborts if any slug is missing or a new slug is taken.

begin;

create temp table seo_update (row_no int, old_slug text, new_slug text, name text, description text, alt text, clear_note boolean) on commit drop;
insert into seo_update values
  (1, 'resin-swirl-planters-gre', 'teal-resin-swirl-planters-set-of-2', 'Teal Resin Swirl Planters, Set of 2', 'Deep teal planters wrapped in a raised gold-tinged swirl pattern bring colour and texture to indoor greenery. Made from lightweight resin, this set of two comes in 10-inch and 13-inch diameters, sized for floor plants, herbs or a lush tabletop arrangement.', 'Teal resin planter with a raised swirl wave pattern around the outside', true),
  (2, 'mtl-gld-planter-11x22x11', 'gold-metal-planters-on-stands-set-of-2', 'Gold Metal Planters on Stands, Set of 2', 'Brushed gold metal pots sit in slim, open-frame stands on these two planters, lifting your plants to eye level for an elegant, mid-century look. The small and large heights layer beautifully together in an entryway, beside a sofa or in a bright corner, indoors or on a covered patio.', 'Set of two brushed gold metal planters on slim gold stands holding green plants', false),
  (3, 'brown-water-can', 'mustard-ceramic-watering-can', 'Mustard Ceramic Watering Can', 'This sculptural watering can has a tapered body that rests on stacked, ribbed rings, with a long spout and an angular handle, all in a warm matte mustard. Practical for houseplants and pretty enough to leave out on a windowsill, shelf or kitchen counter.', 'Matte mustard yellow watering can with long spout and ribbed stacked base', false),
  (4, 'grey-plant-pot', 'grey-plant-pot', 'Grey Botanical Relief Ceramic Pot', 'Delicate wildflower stems are raised across the glossy grey glaze of this footed ceramic pot, giving it a soft, cottage-garden charm. Small feet lift it off the surface. Perfect for herbs, succulents or a trailing plant on a windowsill, desk or kitchen counter.', 'Grey glazed footed ceramic plant pot with raised wildflower relief', false),
  (5, 'black-gold-plant-pot', 'black-gold-plant-pot', 'Black & Gold Textured Plant Pots', 'A crosshatched, woven-look texture covers these matte black plant pots, finished with a gleaming gold base band and gold rim. They bring a modern, luxe edge to houseplants on a shelf, console or side table, and look great grouped in two sizes.', 'Two black textured plant pots with gold base bands and gold rims', false),
  (6, 'strawberries-flower-pot-red', 'strawberries-flower-pot-red', 'Red Strawberry Ceramic Plant Pot', 'Plump, glossy strawberries cover this cheerful red plant pot, making it a playful home for herbs, succulents or a small flowering plant. A fun accent for a kitchen windowsill, breakfast nook or children''s room.', 'Glossy red ceramic plant pot covered in raised strawberry shapes', false),
  (7, 'preston-watering-can-14-25-x-6-5-x-10-75', 'preston-watering-can-14-25-x-6-5-x-10-75', 'Preston Large White Metal Watering Can', 'The Preston watering can pairs a tall, tapered white metal body with a long slender spout and a natural wood handle. At 14.25 by 6.5 inches and 10.75 inches high, it holds plenty of water for houseplants and looks smart left out on display. Pairs with the small green Preston.', 'Preston large white metal watering can with long spout and natural wood handle', false),
  (8, 'preston-watering-can-11-5-x-5-x-8-25', 'preston-watering-can-11-5-x-5-x-8-25', 'Preston Small Green Metal Watering Can', 'The Preston watering can pairs a tapered sage green metal body with a long slender spout and a natural wood handle. At 11.5 by 5 inches and 8.25 inches high, it is easy to handle for houseplants and pretty enough to keep on a shelf. Pairs with the large white Preston.', 'Preston small sage green metal watering can with long spout and natural wood handle', false),
  (9, 'elysian-pot-5-x-9', 'elysian-pot-5-x-9', 'Elysian 9" Green Glazed Pedestal Pot, Small', 'A speckled green reactive glaze, with hints of blue and gold, covers the Elysian pot, a cup-shaped planter on a sculpted pedestal base with a round cut-out. At 5 by 9 inches it is just right for a small plant or succulent on a shelf or desk. Pairs with the 11.5-inch Elysian.', 'Elysian small green reactive glaze pedestal plant pot with round cut-out base', false),
  (10, 'elysian-pot-6-5-x-11-5', 'elysian-pot-6-5-x-11-5', 'Elysian 11.5" Green Glazed Pedestal Pot, Large', 'A speckled green reactive glaze, with hints of blue and gold, covers the Elysian pot, a cup-shaped planter on a sculpted pedestal base with a round cut-out. At 6.5 by 11.5 inches it gives a trailing or upright plant real presence on a console or sideboard. Pairs with the 9-inch Elysian.', 'Elysian large green reactive glaze pedestal plant pot with round cut-out base', false),
  (11, 'mtl-wht-planter-s-3-18-14-12h', 'white-metal-planters-gold-stands-set-of-3', 'White Metal Planters on Gold Stands, Set of 3', 'Glossy white metal pots rest in slim gold stands with crossed bases on this set of three planters. In 18-, 14- and 12-inch heights, they create a tiered display for houseplants in a living room, bedroom or entryway, with a clean, modern-glam look.', 'White metal planters on slim gold stands with crossed bases', false),
  (12, 'mtl-gld-planter-s-3-18-14-12h', 'gold-metal-planters-on-stands-set-of-3', 'Gold Metal Planters on Stands, Set of 3', 'Brushed gold metal pots sit on slender gold legs in this set of three planters. In 18-, 14- and 12-inch heights, they create a tiered display of greenery that adds warmth and polish to a living room corner, entryway or covered patio.', 'Set of three brushed gold metal planters on slender gold legs in graduated sizes', false);

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
