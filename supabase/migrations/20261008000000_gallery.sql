-- Showroom gallery: admin-uploaded photos with optional "Shop this look" products.
-- Files live in the public `site` bucket under gallery/.

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique check (storage_path ~ '^gallery/[0-9a-f-]{36}\.jpg$'),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  caption text check (char_length(caption) <= 200),
  alt text check (char_length(alt) <= 200),
  -- New uploads stay hidden until an admin switches them on.
  is_visible boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gallery_photos_visible_order_idx on public.gallery_photos (is_visible, sort_order, created_at);

create trigger gallery_photos_touch before update on public.gallery_photos
  for each row execute function public.touch_updated_at();

create table public.gallery_photo_products (
  photo_id uuid not null references public.gallery_photos (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (photo_id, product_id)
);

create index gallery_photo_products_product_idx on public.gallery_photo_products (product_id);

alter table public.gallery_photos enable row level security;
alter table public.gallery_photo_products enable row level security;

create policy gallery_photos_public_read on public.gallery_photos
  for select to anon, authenticated using (is_visible or (select public.is_admin()));
create policy gallery_photos_admin_write on public.gallery_photos
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Product visibility is still enforced by products' own RLS when joined.
create policy gallery_photo_products_public_read on public.gallery_photo_products
  for select to anon, authenticated using (
    exists (select 1 from public.gallery_photos g where g.id = photo_id and g.is_visible)
    or (select public.is_admin())
  );
create policy gallery_photo_products_admin_write on public.gallery_photo_products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.gallery_photos, public.gallery_photo_products to anon, authenticated;
revoke insert, update, delete, truncate on public.gallery_photos, public.gallery_photo_products from anon;
grant insert, update, delete on public.gallery_photos, public.gallery_photo_products to authenticated;
grant all on public.gallery_photos, public.gallery_photo_products to service_role;
