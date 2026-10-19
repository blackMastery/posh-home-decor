-- Dev seed: category tree, settings defaults, 10 sample products and their attributes.
-- Product photos are generated + uploaded by `npm run seed:dev` (scripts/seed-dev.mjs).

update public.settings set
  whatsapp_number = '5926748619',
  display_phone = '674 8619',
  hero_eyebrow = '',
  hero_headline = 'Taking your decorations to the',
  hero_headline_accent = 'next level.',
  default_details_text = 'Each piece is selected by our Georgetown team. Dimensions are approximate; natural materials vary slightly from piece to piece.',
  default_care_text = 'Dust with a soft, dry cloth. Keep out of direct sunlight and away from moisture. Avoid abrasive cleaners.',
  default_delivery_text = 'Delivery within Georgetown and surrounding areas is quoted on WhatsApp once we confirm your order. Collection is free from the showroom during opening hours.'
where id = 1;

-- Category tree --------------------------------------------------------------
-- Inserted top-down; triggers compute path and depth.

insert into public.categories (name, slug, sort_order) values
  ('Decor', 'decor', 1),
  ('Furniture', 'furniture', 2),
  ('Lighting', 'lighting', 3),
  ('Textiles', 'textiles', 4),
  ('Tableware', 'tableware', 5);

insert into public.categories (parent_id, name, slug, sort_order)
select c.id, v.name, v.slug, v.sort_order
from (values
  ('decor', 'Decorative Accents', 'decorative-accents', 1),
  ('decor', 'Vases and Jars', 'vases-and-jars', 2),
  ('decor', 'Candles and Holders', 'candles-and-holders', 3),
  ('decor', 'Wall Decor', 'wall-decor', 4),
  ('furniture', 'Accent Chairs', 'accent-chairs', 1),
  ('furniture', 'Side Tables', 'side-tables', 2),
  ('furniture', 'Consoles', 'consoles', 3),
  ('furniture', 'Ottomans and Poufs', 'ottomans-and-poufs', 4),
  ('lighting', 'Table Lamps', 'table-lamps', 1),
  ('lighting', 'Floor Lamps', 'floor-lamps', 2),
  ('lighting', 'Pendants', 'pendants', 3),
  ('textiles', 'Cushions', 'cushions', 1),
  ('textiles', 'Throws', 'throws', 2),
  ('textiles', 'Rugs', 'rugs', 3),
  ('tableware', 'Serveware', 'serveware', 1),
  ('tableware', 'Glassware', 'glassware', 2)
) as v(parent, name, slug, sort_order)
join public.categories c on c.path = v.parent;

insert into public.categories (parent_id, name, slug, sort_order)
select c.id, v.name, v.slug, v.sort_order
from (values
  ('decor/decorative-accents', 'Bowls and Trays', 'bowls-and-trays', 1),
  ('decor/decorative-accents', 'Orbs and Spheres', 'orbs-and-spheres', 2),
  ('decor/decorative-accents', 'Sculptures', 'sculptures', 3),
  ('decor/decorative-accents', 'Bookends', 'bookends', 4),
  ('decor/decorative-accents', 'Baskets', 'baskets', 5),
  ('decor/decorative-accents', 'Faux Florals', 'faux-florals', 6),
  ('decor/decorative-accents', 'Picture Frames', 'picture-frames', 7),
  ('decor/decorative-accents', 'Decorative Boxes', 'decorative-boxes', 8),
  ('decor/decorative-accents', 'Coffee Table Books', 'coffee-table-books', 9),
  ('decor/decorative-accents', 'Diffusers', 'diffusers', 10),
  ('decor/vases-and-jars', 'Glass Vases', 'glass-vases', 1),
  ('decor/vases-and-jars', 'Ceramic Vases', 'ceramic-vases', 2),
  ('decor/vases-and-jars', 'Ginger Jars', 'ginger-jars', 3),
  ('decor/vases-and-jars', 'Woven Vases', 'woven-vases', 4),
  ('decor/candles-and-holders', 'Pillar Holders', 'pillar-holders', 1),
  ('decor/candles-and-holders', 'Candlesticks', 'candlesticks', 2),
  ('decor/candles-and-holders', 'Lanterns', 'lanterns', 3),
  ('decor/wall-decor', 'Mirrors', 'mirrors', 1),
  ('decor/wall-decor', 'Wall Art', 'wall-art', 2)
) as v(parent, name, slug, sort_order)
join public.categories c on c.path = v.parent;

-- Products ---------------------------------------------------------------------
-- Fixed ids so scripts/seed-dev.mjs can attach generated photos.

insert into public.products
  (id, slug, name, note, description, price, compare_at_price, category_id, availability, status,
   first_published_at, first_available_at, featured_rank, details_text, care_text, delivery_text)
select
  v.id::uuid, v.slug, v.name, v.note, v.description, v.price, v.compare_at_price, c.id, v.availability,
  'published', now() - (v.age_days || ' days')::interval,
  case when v.availability <> 'coming_soon' then now() - (v.age_days || ' days')::interval end,
  v.featured_rank,
  s.default_details_text, s.default_care_text, s.default_delivery_text
from (values
  ('a0000000-0000-4000-8000-000000000001', 'gilded-lattice-ginger-jar', 'Gilded Lattice Ginger Jar',
   'Glazed ceramic · 42cm', 'A statement ginger jar with a hand-gilded lattice over deep ivory glaze. Beautiful alone on a console or paired for symmetry.',
   6500, null, 'decor/vases-and-jars/ginger-jars', 'available', 3, 1),
  ('a0000000-0000-4000-8000-000000000002', 'gold-pillar-holders', 'Gold Pillar Holders',
   'Brushed brass · set of 2', 'Weighted pillar holders in brushed brass with a softly flared base. Sized for 7cm pillar candles.',
   3900, null, 'decor/candles-and-holders/pillar-holders', 'available', 6, 2),
  ('a0000000-0000-4000-8000-000000000003', 'rattan-orb-vase', 'Rattan Orb Vase',
   'Hand-woven rattan · 30cm', 'A sculptural woven orb with a glass insert, so it works with fresh stems as well as dried.',
   4800, null, 'decor/vases-and-jars/woven-vases', 'sold_out', 9, null),
  ('a0000000-0000-4000-8000-000000000004', 'woven-jute-basket', 'Woven Jute Basket',
   'Woven jute · 38cm', 'A generous jute basket with leather handles. Throws, plants, magazines — it takes everything.',
   5200, null, 'decor/decorative-accents/baskets', 'available', 12, null),
  ('a0000000-0000-4000-8000-000000000005', 'smoked-glass-bud-vase', 'Smoked Glass Bud Vase',
   'Mouth-blown glass · 24cm', 'Mouth-blown in a warm smoked amber. Catches the afternoon light beautifully.',
   3200, 4200, 'decor/vases-and-jars/glass-vases', 'available', 20, null),
  ('a0000000-0000-4000-8000-000000000006', 'marble-serving-tray', 'Marble Serving Tray',
   'White marble · 40 × 25cm', 'Solid white marble with brass handles. Styled on an ottoman or used for serving.',
   8900, 11500, 'decor/decorative-accents/bowls-and-trays', 'available', 45, null),
  ('a0000000-0000-4000-8000-000000000007', 'garnet-velvet-cushion', 'Garnet Velvet Cushion',
   'Cotton velvet · 50 × 50cm', 'Plush cotton velvet in our signature garnet with a feather-blend insert.',
   4500, null, 'textiles/cushions', 'available', 50, null),
  ('a0000000-0000-4000-8000-000000000008', 'arched-brass-table-lamp', 'Arched Brass Table Lamp',
   'Brass and linen · 58cm', 'An arched brass stem with an ivory linen shade. Gives a warm, low glow for reading corners.',
   18500, null, 'lighting/table-lamps', 'available', 60, null),
  ('a0000000-0000-4000-8000-000000000009', 'carved-teak-console', 'Carved Teak Console',
   'Solid teak · 120cm', 'A hand-carved teak console with a softly aged finish. Each piece is one of a kind, so ask us for today''s price.',
   null, null, 'decor/decorative-accents/bowls-and-trays', 'available', 15, null),
  ('a0000000-0000-4000-8000-000000000010', 'pleated-silk-floor-lamp', 'Pleated Silk Floor Lamp',
   'Brass and silk · 160cm', 'A slim brass floor lamp with a pleated silk shade. Arriving soon — pre-order to reserve yours.',
   24500, null, 'lighting/floor-lamps', 'coming_soon', 2, null)
) as v(id, slug, name, note, description, price, compare_at_price, category_path, availability, age_days, featured_rank)
join public.categories c on c.path = v.category_path
cross join public.settings s;

insert into public.product_related (product_id, related_id, sort_order) values
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 0),
  ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 1);

-- Attributes -------------------------------------------------------------------

insert into public.attributes (name, slug, kind, sort_order) values
  ('Colour', 'color', 'color', 1),
  ('Material', 'material', 'standard', 2),
  ('Room', 'room', 'standard', 3);

insert into public.attribute_values (attribute_id, name, slug, hex, swatch, sort_order)
select a.id, v.name, v.slug, v.hex, v.swatch, v.sort_order
from (values
  ('color', 'Gold', 'gold', '#C9A24B', 'metallic', 1),
  ('color', 'Ivory', 'ivory', '#F3EDE0', 'solid', 2),
  ('color', 'White', 'white', '#FFFFFF', 'solid', 3),
  ('color', 'Black', 'black', '#1D1D1B', 'solid', 4),
  ('color', 'Natural', 'natural', '#C8A97E', 'solid', 5),
  ('color', 'Amber', 'amber', '#B86B25', 'solid', 6),
  ('color', 'Garnet', 'garnet', '#7A1F2B', 'solid', 7),
  ('material', 'Brass', 'brass', null, 'solid', 1),
  ('material', 'Ceramic', 'ceramic', null, 'solid', 2),
  ('material', 'Glass', 'glass', null, 'solid', 3),
  ('material', 'Jute', 'jute', null, 'solid', 4),
  ('material', 'Linen', 'linen', null, 'solid', 5),
  ('material', 'Marble', 'marble', null, 'solid', 6),
  ('material', 'Rattan', 'rattan', null, 'solid', 7),
  ('material', 'Silk', 'silk', null, 'solid', 8),
  ('material', 'Teak', 'teak', null, 'solid', 9),
  ('material', 'Velvet', 'velvet', null, 'solid', 10),
  ('room', 'Living room', 'living-room', null, 'solid', 1),
  ('room', 'Bedroom', 'bedroom', null, 'solid', 2),
  ('room', 'Dining room', 'dining-room', null, 'solid', 3),
  ('room', 'Entryway', 'entryway', null, 'solid', 4),
  ('room', 'Office', 'office', null, 'solid', 5)
) as v(attr, name, slug, hex, swatch, sort_order)
join public.attributes a on a.slug = v.attr;

insert into public.product_attribute_values (product_id, value_id)
select v.product_id::uuid, av.id
from (values
  ('a0000000-0000-4000-8000-000000000001', 'color', 'ivory'),
  ('a0000000-0000-4000-8000-000000000001', 'color', 'gold'),
  ('a0000000-0000-4000-8000-000000000001', 'material', 'ceramic'),
  ('a0000000-0000-4000-8000-000000000001', 'room', 'living-room'),
  ('a0000000-0000-4000-8000-000000000001', 'room', 'entryway'),
  ('a0000000-0000-4000-8000-000000000002', 'color', 'gold'),
  ('a0000000-0000-4000-8000-000000000002', 'material', 'brass'),
  ('a0000000-0000-4000-8000-000000000002', 'room', 'dining-room'),
  ('a0000000-0000-4000-8000-000000000002', 'room', 'living-room'),
  ('a0000000-0000-4000-8000-000000000003', 'color', 'natural'),
  ('a0000000-0000-4000-8000-000000000003', 'material', 'rattan'),
  ('a0000000-0000-4000-8000-000000000003', 'material', 'glass'),
  ('a0000000-0000-4000-8000-000000000003', 'room', 'living-room'),
  ('a0000000-0000-4000-8000-000000000004', 'color', 'natural'),
  ('a0000000-0000-4000-8000-000000000004', 'material', 'jute'),
  ('a0000000-0000-4000-8000-000000000004', 'room', 'living-room'),
  ('a0000000-0000-4000-8000-000000000004', 'room', 'bedroom'),
  ('a0000000-0000-4000-8000-000000000005', 'color', 'amber'),
  ('a0000000-0000-4000-8000-000000000005', 'material', 'glass'),
  ('a0000000-0000-4000-8000-000000000005', 'room', 'bedroom'),
  ('a0000000-0000-4000-8000-000000000005', 'room', 'office'),
  ('a0000000-0000-4000-8000-000000000006', 'color', 'white'),
  ('a0000000-0000-4000-8000-000000000006', 'color', 'gold'),
  ('a0000000-0000-4000-8000-000000000006', 'material', 'marble'),
  ('a0000000-0000-4000-8000-000000000006', 'material', 'brass'),
  ('a0000000-0000-4000-8000-000000000006', 'room', 'living-room'),
  ('a0000000-0000-4000-8000-000000000006', 'room', 'dining-room'),
  ('a0000000-0000-4000-8000-000000000007', 'color', 'garnet'),
  ('a0000000-0000-4000-8000-000000000007', 'material', 'velvet'),
  ('a0000000-0000-4000-8000-000000000007', 'room', 'living-room'),
  ('a0000000-0000-4000-8000-000000000007', 'room', 'bedroom'),
  ('a0000000-0000-4000-8000-000000000008', 'color', 'gold'),
  ('a0000000-0000-4000-8000-000000000008', 'color', 'ivory'),
  ('a0000000-0000-4000-8000-000000000008', 'material', 'brass'),
  ('a0000000-0000-4000-8000-000000000008', 'material', 'linen'),
  ('a0000000-0000-4000-8000-000000000008', 'room', 'living-room'),
  ('a0000000-0000-4000-8000-000000000008', 'room', 'office'),
  ('a0000000-0000-4000-8000-000000000008', 'room', 'bedroom'),
  ('a0000000-0000-4000-8000-000000000009', 'color', 'natural'),
  ('a0000000-0000-4000-8000-000000000009', 'material', 'teak'),
  ('a0000000-0000-4000-8000-000000000009', 'room', 'living-room'),
  ('a0000000-0000-4000-8000-000000000009', 'room', 'entryway'),
  ('a0000000-0000-4000-8000-000000000010', 'color', 'gold'),
  ('a0000000-0000-4000-8000-000000000010', 'color', 'ivory'),
  ('a0000000-0000-4000-8000-000000000010', 'material', 'brass'),
  ('a0000000-0000-4000-8000-000000000010', 'material', 'silk'),
  ('a0000000-0000-4000-8000-000000000010', 'room', 'living-room'),
  ('a0000000-0000-4000-8000-000000000010', 'room', 'bedroom')
) as v(product_id, attr, value)
join public.attributes a on a.slug = v.attr
join public.attribute_values av on av.attribute_id = a.id and av.slug = v.value;

-- Dimensions (cm) ----------------------------------------------------------------

update public.products p set
  height_cm = v.h, width_cm = v.w, depth_cm = v.d, diameter_cm = v.dia
from (values
  ('a0000000-0000-4000-8000-000000000001', 42, null, null, 24),
  ('a0000000-0000-4000-8000-000000000002', 12, null, null, 10),
  ('a0000000-0000-4000-8000-000000000003', 30, null, null, 30),
  ('a0000000-0000-4000-8000-000000000004', 38, null, null, 40),
  ('a0000000-0000-4000-8000-000000000005', 24, null, null, 9),
  ('a0000000-0000-4000-8000-000000000006', 4, 40, 25, null),
  ('a0000000-0000-4000-8000-000000000007', 50, 50, 15, null),
  ('a0000000-0000-4000-8000-000000000008', 58, null, null, 30),
  ('a0000000-0000-4000-8000-000000000009', 80, 120, 40, null),
  ('a0000000-0000-4000-8000-000000000010', 160, null, null, 45)
) as v(id, h, w, d, dia)
where p.id = v.id::uuid;

-- Which dimensions each department filters on (children inherit).
update public.categories c set filter_dims = v.dims, primary_dim = v.primary_dim
from (values
  ('decor', array['height', 'width', 'diameter'], 'height'),
  ('furniture', array['height', 'width', 'depth'], 'width'),
  ('lighting', array['height', 'diameter'], 'height'),
  ('textiles', array['width', 'height'], 'width'),
  ('tableware', array['height', 'diameter'], 'height')
) as v(path, dims, primary_dim)
where c.path = v.path;
