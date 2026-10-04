-- Posh Home Decor — initial schema
-- Money is integer GYD (whole dollars). Timestamps are timestamptz. PKs are uuid.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- admins + is_admin()
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- settings (single row)
-- ---------------------------------------------------------------------------

create table public.settings (
  id smallint primary key default 1 check (id = 1),
  whatsapp_number text not null default '5926748619'
    check (whatsapp_number ~ '^[1-9][0-9]{7,14}$'),
  display_phone text not null default '674 8619',
  hero_eyebrow text not null default 'The Autumn Edit',
  hero_headline text not null default 'Taking your decorations to the',
  hero_headline_accent text not null default 'next level.',
  hero_image_path text,
  default_details_text text not null default '',
  default_care_text text not null default '',
  default_delivery_text text not null default '',
  new_window_days integer not null default 30 check (new_window_days between 1 and 365),
  price_prefix text not null default '$',
  styling_studio_message text not null default 'Hello Posh! I''d love to book a styling session.',
  updated_at timestamptz not null default now()
);

create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- redirects
-- ---------------------------------------------------------------------------

create table public.redirects (
  from_path text primary key,
  to_path text not null,
  created_at timestamptz not null default now(),
  check (from_path <> to_path)
);

-- Insert a redirect, collapsing chains (A→B, B→C ⇒ A→C) and dropping any
-- redirect whose source is the now-live target.
create or replace function public.add_redirect(p_from text, p_to text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_from is null or p_to is null or p_from = p_to then
    return;
  end if;
  delete from redirects where from_path = p_to;
  update redirects set to_path = p_to where to_path = p_from;
  delete from redirects where from_path = to_path;
  insert into redirects (from_path, to_path)
  values (p_from, p_to)
  on conflict (from_path) do update set to_path = excluded.to_path, created_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  path text not null unique,
  depth smallint not null check (depth between 1 and 3),
  sort_order integer not null default 0,
  tile_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_parent_slug_key unique nulls not distinct (parent_id, slug),
  constraint categories_slug_not_reserved check (slug not in ('new', 'sale'))
);

create index categories_parent_idx on public.categories (parent_id, sort_order);

-- Recompute depth/path for the row; reject cycles, depth > 3, reserved slugs.
create or replace function public.categories_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent categories;
  v_sub_max smallint;
begin
  new.slug := lower(btrim(new.slug));
  if new.slug in ('new', 'sale') then
    raise exception 'The web address "%" is reserved. Please choose another.', new.slug
      using errcode = 'P0001';
  end if;

  if new.parent_id is null then
    new.depth := 1;
    new.path := new.slug;
  else
    select * into v_parent from categories where id = new.parent_id;
    if not found then
      raise exception 'Parent category not found' using errcode = 'P0001';
    end if;
    if tg_op = 'UPDATE' and (v_parent.id = new.id or v_parent.path like old.path || '/%') then
      raise exception 'A category cannot be moved inside itself' using errcode = 'P0001';
    end if;
    new.depth := v_parent.depth + 1;
    new.path := v_parent.path || '/' || new.slug;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(max(depth), old.depth) into v_sub_max
    from categories where path like old.path || '/%';
    if new.depth + (v_sub_max - old.depth) > 3 then
      raise exception 'Categories can only be nested 3 levels deep' using errcode = 'P0001';
    end if;
  end if;

  if new.depth > 3 then
    raise exception 'Categories can only be nested 3 levels deep' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger categories_before_insert before insert on public.categories
  for each row execute function public.categories_before_write();
create trigger categories_before_update before update of parent_id, slug on public.categories
  for each row execute function public.categories_before_write();
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

-- Cascade path changes to descendants and record redirects for every moved URL.
create or replace function public.categories_after_path_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  d record;
begin
  if pg_trigger_depth() > 1 then
    return null;
  end if;

  for d in select path from categories where path like old.path || '/%' loop
    perform add_redirect('/shop/' || d.path, '/shop/' || new.path || substr(d.path, length(old.path) + 1));
  end loop;
  perform add_redirect('/shop/' || old.path, '/shop/' || new.path);

  update categories
  set path = new.path || substr(path, length(old.path) + 1),
      depth = depth + (new.depth - old.depth)
  where path like old.path || '/%';

  return null;
end;
$$;

create trigger categories_after_update after update on public.categories
  for each row when (old.path is distinct from new.path)
  execute function public.categories_after_path_change();

create or replace function public.categories_after_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from redirects where from_path = '/shop/' || new.path;
  return null;
end;
$$;

create trigger categories_after_insert after insert on public.categories
  for each row execute function public.categories_after_insert();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 120),
  note text,
  description text,
  price integer not null check (price > 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price > 0),
  category_id uuid not null references public.categories (id) on delete restrict,
  is_available boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  first_published_at timestamptz,
  details_text text,
  care_text text,
  delivery_text text,
  featured_rank integer,
  search tsvector generated always as (
    setweight(to_tsvector('simple'::regconfig, coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(note, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_status_available_idx on public.products (status, is_available);
create index products_category_idx on public.products (category_id);
create index products_first_published_idx on public.products (first_published_at desc);
create index products_search_idx on public.products using gin (search);
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);

create or replace function public.products_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.first_published_at is null then
    new.first_published_at := now();
  end if;
  if tg_op = 'UPDATE' then
    -- first_published_at is set once and never reset.
    new.first_published_at := coalesce(old.first_published_at, new.first_published_at);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger products_before_write before insert or update on public.products
  for each row execute function public.products_before_write();

create or replace function public.products_after_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.slug is distinct from new.slug then
    perform add_redirect('/products/' || old.slug, '/products/' || new.slug);
  else
    delete from redirects where from_path = '/products/' || new.slug;
  end if;
  return null;
end;
$$;

create trigger products_after_insert after insert on public.products
  for each row execute function public.products_after_slug();
create trigger products_after_slug after update of slug on public.products
  for each row execute function public.products_after_slug();

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  storage_path text not null,
  width integer,
  height integer,
  alt text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

-- ---------------------------------------------------------------------------
-- product_related
-- ---------------------------------------------------------------------------

create table public.product_related (
  product_id uuid not null references public.products (id) on delete cascade,
  related_id uuid not null references public.products (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (product_id, related_id),
  check (product_id <> related_id)
);

create index product_related_related_idx on public.product_related (related_id);

-- ---------------------------------------------------------------------------
-- inquiries
-- ---------------------------------------------------------------------------

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique check (ref ~ '^PH-[0-9]{5}$'),
  client_nonce uuid unique,
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  phone_raw text not null check (char_length(phone_raw) <= 30),
  phone_e164 text not null,
  fulfilment text not null check (fulfilment in ('delivery', 'collection')),
  address text check (char_length(address) <= 300),
  note text check (char_length(note) <= 500),
  styling_advice boolean not null,
  items jsonb not null,
  item_count integer not null,
  subtotal integer not null,
  message_text text not null,
  ip_hash text,
  created_at timestamptz not null default now(),
  check (fulfilment = 'collection' or address is not null)
);

create index inquiries_created_idx on public.inquiries (created_at desc);
create index inquiries_ip_idx on public.inquiries (ip_hash, created_at desc);
create index inquiries_phone_idx on public.inquiries (phone_e164);
create index inquiries_name_trgm_idx on public.inquiries using gin (customer_name extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Read model: product cards (security invoker so RLS applies to callers)
-- ---------------------------------------------------------------------------

create view public.product_cards
with (security_invoker = true)
as
select
  p.id,
  p.slug,
  p.name,
  p.note,
  p.price,
  p.compare_at_price,
  p.is_available,
  p.status,
  p.first_published_at,
  p.featured_rank,
  p.category_id,
  c.path as category_path,
  c.name as category_name,
  p.created_at,
  p.updated_at,
  (p.first_published_at is not null
    and p.first_published_at > now() - make_interval(days => coalesce(s.new_window_days, 30))) as is_new,
  (p.compare_at_price is not null and p.compare_at_price > p.price) as is_on_sale,
  img.storage_path as image_path,
  img.width as image_width,
  img.height as image_height,
  img.alt as image_alt
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

-- Shop listing: subtree, virtual filter, search, sort, pagination.
create or replace function public.shop_products(
  p_category_path text default null,
  p_filter text default null,
  p_q text default null,
  p_sort text default 'featured',
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid,
  slug text,
  name text,
  note text,
  price integer,
  compare_at_price integer,
  is_available boolean,
  is_new boolean,
  is_on_sale boolean,
  image_path text,
  image_width integer,
  image_height integer,
  image_alt text,
  category_path text,
  first_published_at timestamptz,
  total_count bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_tsq tsquery;
  v_like text;
begin
  if v_q is not null then
    select to_tsquery('simple', string_agg(w || ':*', ' & '))
    into v_tsq
    from regexp_split_to_table(
      lower(regexp_replace(v_q, '[^[:alnum:][:space:]]', ' ', 'g')), '\s+'
    ) as w
    where w <> '';
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select
    pc.id, pc.slug, pc.name, pc.note, pc.price, pc.compare_at_price, pc.is_available,
    pc.is_new, pc.is_on_sale, pc.image_path, pc.image_width, pc.image_height, pc.image_alt,
    pc.category_path, pc.first_published_at,
    count(*) over () as total_count
  from product_cards pc
  join products p on p.id = pc.id
  where pc.status = 'published'
    and (p_category_path is null
         or pc.category_path = p_category_path
         or pc.category_path like p_category_path || '/%')
    and (p_filter is null
         or (p_filter = 'new' and pc.is_new)
         or (p_filter = 'sale' and pc.is_on_sale))
    and (v_q is null
         or (v_tsq is not null and p.search @@ v_tsq)
         or p.name ilike v_like)
  order by
    pc.is_available desc,
    case when v_tsq is not null and p_sort = 'featured' then ts_rank(p.search, v_tsq) end desc nulls last,
    case when p_sort = 'price-asc' then pc.price end asc,
    case when p_sort = 'price-desc' then pc.price end desc,
    case when p_sort = 'featured' then pc.featured_rank end asc nulls last,
    pc.first_published_at desc nulls last,
    pc.id
  limit greatest(least(p_limit, 1200), 1)
  offset greatest(p_offset, 0);
end;
$$;

-- Per-category subtree counts and newest image (for home tiles, nav, admin).
create or replace function public.category_stats(p_published_only boolean default true)
returns table (category_id uuid, product_count bigint, newest_image_path text)
language sql
stable
set search_path = public
as $$
  select
    c.id,
    count(pc.id),
    (array_agg(pc.image_path order by pc.first_published_at desc nulls last, pc.created_at desc)
      filter (where pc.image_path is not null))[1]
  from categories c
  left join product_cards pc
    on (pc.category_path = c.path or pc.category_path like c.path || '/%')
   and (not p_published_only or pc.status = 'published')
  group by c.id;
$$;

-- "Style it with": hand-picked, then same category, then parent subtree.
create or replace function public.style_it_with(p_product_id uuid, p_limit integer default 4)
returns setof public.product_cards
language sql
stable
set search_path = public
as $$
  with me as (
    select p.id, p.category_id, c.parent_id
    from products p join categories c on c.id = p.category_id
    where p.id = p_product_id
  ),
  parent as (
    select c.path from categories c join me on c.id = me.parent_id
  ),
  cand as (
    select pc as card, 0 as tier, r.sort_order as ord
    from product_related r
    join product_cards pc on pc.id = r.related_id
    where r.product_id = p_product_id and pc.status = 'published'
    union all
    select pc, 1, null
    from product_cards pc, me
    where pc.category_id = me.category_id and pc.status = 'published'
    union all
    select pc, 2, null
    from product_cards pc, parent
    where (pc.category_path = parent.path or pc.category_path like parent.path || '/%')
      and pc.status = 'published'
  ),
  dedup as (
    select distinct on ((card).id) card, tier, ord
    from cand
    where (card).id <> p_product_id
    order by (card).id, tier, ord nulls last
  )
  select (card).*
  from dedup
  order by tier,
           ord nulls last,
           (card).is_available desc,
           (card).first_published_at desc nulls last
  limit p_limit;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.redirects enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_related enable row level security;
alter table public.inquiries enable row level security;

-- admins: an admin can see their own row; nobody else sees anything.
create policy admins_select_own on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

-- settings
create policy settings_public_read on public.settings
  for select to anon, authenticated using (true);
create policy settings_admin_update on public.settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- redirects
create policy redirects_public_read on public.redirects
  for select to anon, authenticated using (true);
create policy redirects_admin_write on public.redirects
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- categories
create policy categories_public_read on public.categories
  for select to anon, authenticated using (true);
create policy categories_admin_write on public.categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- products
create policy products_public_read on public.products
  for select to anon, authenticated using (status = 'published' or (select public.is_admin()));
create policy products_admin_write on public.products
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- product_images
create policy product_images_public_read on public.product_images
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
    or (select public.is_admin())
  );
create policy product_images_admin_write on public.product_images
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- product_related
create policy product_related_public_read on public.product_related
  for select to anon, authenticated using (true);
create policy product_related_admin_write on public.product_related
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- inquiries: admin read only. Inserts happen through the service role only.
create policy inquiries_admin_read on public.inquiries
  for select to authenticated using ((select public.is_admin()));

-- Explicit grants (don't rely on default privileges).
revoke all on public.inquiries, public.admins from anon;
revoke insert, update, delete, truncate on public.inquiries from authenticated;
revoke insert, update, delete, truncate on public.admins from authenticated;
grant select on public.admins to authenticated;
grant select on public.inquiries to authenticated;

grant select on public.settings, public.redirects, public.categories, public.products,
  public.product_images, public.product_related, public.product_cards to anon, authenticated;
revoke insert, update, delete, truncate on public.settings, public.redirects, public.categories,
  public.products, public.product_images, public.product_related from anon;
grant insert, update, delete on public.redirects, public.categories, public.products,
  public.product_images, public.product_related to authenticated;
grant update on public.settings to authenticated;

grant all on all tables in schema public to service_role;

revoke execute on function public.add_redirect(text, text) from public, anon;
grant execute on function public.add_redirect(text, text) to authenticated, service_role;
grant execute on function public.shop_products(text, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.category_stats(boolean) to anon, authenticated;
grant execute on function public.style_it_with(uuid, integer) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets + policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('site', 'site', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "posh admin read" on storage.objects
  for select to authenticated
  using (bucket_id in ('product-images', 'site') and (select public.is_admin()));
create policy "posh admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('product-images', 'site') and (select public.is_admin()));
create policy "posh admin update" on storage.objects
  for update to authenticated
  using (bucket_id in ('product-images', 'site') and (select public.is_admin()));
create policy "posh admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id in ('product-images', 'site') and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Retention: delete inquiries older than 12 months, nightly.
-- ---------------------------------------------------------------------------

select cron.schedule(
  'purge-old-inquiries',
  '15 3 * * *',
  $$delete from public.inquiries where created_at < now() - interval '12 months'$$
);

-- Settings row always exists.
insert into public.settings (id) values (1) on conflict (id) do nothing;
