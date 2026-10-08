-- Optional price ("Price on request") and three-way availability with "Coming soon".

-- ---------------------------------------------------------------------------
-- Drop read models that depend on the columns being changed
-- ---------------------------------------------------------------------------

drop function public.style_it_with(uuid, integer);
drop function public.shop_products(text, text, text, text, integer, integer);
drop function public.category_stats(boolean);
drop view public.product_cards;

-- ---------------------------------------------------------------------------
-- products: optional price, availability, first_available_at
-- ---------------------------------------------------------------------------

alter table public.products alter column price drop not null;
alter table public.products drop constraint products_price_check;
alter table public.products add constraint products_price_check check (price is null or price > 0);
alter table public.products add constraint products_compare_at_needs_price
  check (compare_at_price is null or price is not null);

alter table public.products
  add column availability text not null default 'available'
    check (availability in ('available', 'coming_soon', 'sold_out')),
  add column first_available_at timestamptz;

update public.products
set availability = case when is_available then 'available' else 'sold_out' end,
    first_available_at = first_published_at;

drop index public.products_status_available_idx;
alter table public.products drop column is_available;
create index products_status_availability_idx on public.products (status, availability);

-- first_available_at: set once, when the product is first published as
-- something other than "Coming soon". Drives the "New" window.
create or replace function public.products_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published' and new.first_published_at is null then
    new.first_published_at := now();
  end if;
  if new.status = 'published' and new.availability <> 'coming_soon' and new.first_available_at is null then
    new.first_available_at := now();
  end if;
  if tg_op = 'UPDATE' then
    -- first_published_at / first_available_at are set once and never reset.
    new.first_published_at := coalesce(old.first_published_at, new.first_published_at);
    new.first_available_at := coalesce(old.first_available_at, new.first_available_at);
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reserve "coming-soon" as a category slug (it is a shop filter)
-- ---------------------------------------------------------------------------

alter table public.categories drop constraint categories_slug_not_reserved;
alter table public.categories add constraint categories_slug_not_reserved
  check (slug not in ('new', 'sale', 'coming-soon'));

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
  if new.slug in ('new', 'sale', 'coming-soon') then
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

-- ---------------------------------------------------------------------------
-- Read model: product cards
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
  (case p.availability when 'available' then 0 when 'coming_soon' then 1 else 2 end)::smallint as availability_rank
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
  availability text,
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
    pc.id, pc.slug, pc.name, pc.note, pc.price, pc.compare_at_price, pc.availability,
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
         or (p_filter = 'sale' and pc.is_on_sale)
         or (p_filter = 'coming-soon' and pc.availability = 'coming_soon'))
    and (v_q is null
         or (v_tsq is not null and p.search @@ v_tsq)
         or p.name ilike v_like)
  order by
    -- Sold out always last; in price sorts Coming soon mixes with Available.
    case when p_sort in ('price-asc', 'price-desc') then (pc.availability = 'sold_out')::int
         else pc.availability_rank end asc,
    case when v_tsq is not null and p_sort = 'featured' then ts_rank(p.search, v_tsq) end desc nulls last,
    -- Price on request goes after priced pieces in both directions.
    case when p_sort in ('price-asc', 'price-desc') then (pc.price is null)::int end asc,
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
           (card).availability_rank,
           (card).first_published_at desc nulls last
  limit p_limit;
$$;

grant select on public.product_cards to anon, authenticated;
grant all on public.product_cards to service_role;
grant execute on function public.shop_products(text, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.category_stats(boolean) to anon, authenticated;
grant execute on function public.style_it_with(uuid, integer) to anon, authenticated;
