-- Internal item code (SKU) and UPC/EAN barcode for products. Both optional, both unique.

alter table public.products
  add column item_code text check (item_code ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{0,39}$'),
  -- UPC-A (12), EAN-8/13, GTIN-14: digits only.
  add column item_upc_code text check (item_upc_code ~ '^[0-9]{8,14}$');

create unique index products_item_code_key on public.products (upper(item_code)) where item_code is not null;
create unique index products_item_upc_code_key on public.products (item_upc_code) where item_upc_code is not null;

-- Expose the codes on the card read model (admin list search). New columns go last.
create or replace view public.product_cards
with (security_invoker = true)
as
select
  p.id,
  p.slug,
  p.name,
  p.note,
  p.price,
  p.compare_at_price,
  p.availability,
  p.status,
  p.first_published_at,
  p.featured_rank,
  p.category_id,
  c.path as category_path,
  c.name as category_name,
  p.created_at,
  p.updated_at,
  (p.availability <> 'coming_soon'
    and p.first_available_at is not null
    and p.first_available_at > now() - make_interval(days => coalesce(s.new_window_days, 30))) as is_new,
  (p.price is not null and p.compare_at_price is not null and p.compare_at_price > p.price) as is_on_sale,
  img.storage_path as image_path,
  img.width as image_width,
  img.height as image_height,
  img.alt as image_alt,
  p.first_available_at,
  -- Available first, then Coming soon, then Sold out.
  (case p.availability when 'available' then 0 when 'coming_soon' then 1 else 2 end)::smallint as availability_rank,
  p.item_code,
  p.item_upc_code
from public.products p
join public.categories c on c.id = p.category_id
left join public.settings s on s.id = 1
left join lateral (
  select i.storage_path, i.width, i.height, i.alt
  from public.product_images i
  where i.product_id = p.id
  order by i.sort_order, i.created_at
  limit 1
) img on true;
