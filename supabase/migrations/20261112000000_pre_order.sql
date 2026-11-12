-- Pre-order: a flag on Available products for pieces sold now and delivered later.
--  * products.is_preorder (only meaningful while availability = 'available'; the
--    product_cards view exposes the effective value, so switching a piece to
--    Coming soon / Sold out hides the flag without clearing it)
--  * "Pre-order" shop toggle (?preorder=1, /shop/pre-order) and its facet count
--  * "pre-order" reserved as a category slug (it is a shop route)

alter table public.products add column is_preorder boolean not null default false;

-- ---------------------------------------------------------------------------
-- Read model: product cards (+ is_preorder, appended last)
-- ---------------------------------------------------------------------------

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
  p.item_upc_code,
  coalesce(sw.swatches, '[]'::jsonb) as color_swatches,
  p.height_cm,
  p.width_cm,
  p.depth_cm,
  p.diameter_cm,
  coalesce(sw.value_count, 0)::integer as attribute_value_count,
  -- Pre-order only means something while the piece is Available.
  (p.is_preorder and p.availability = 'available') as is_preorder
from public.products p
join public.categories c on c.id = p.category_id
left join public.settings s on s.id = 1
left join lateral (
  select i.storage_path, i.width, i.height, i.alt
  from public.product_images i
  where i.product_id = p.id
  order by i.sort_order, i.created_at
  limit 1
) img on true
left join lateral (
  select
    jsonb_agg(jsonb_build_object('name', av.name, 'hex', av.hex, 'swatch', av.swatch)
              order by av.sort_order, av.name) filter (where a.kind = 'color') as swatches,
    count(*) as value_count
  from public.product_attribute_values pav
  join public.attribute_values av on av.id = pav.value_id
  join public.attributes a on a.id = av.attribute_id
  where pav.product_id = p.id
) sw on true;

-- ---------------------------------------------------------------------------
-- Shop filtering: 'pre-order' toggle
-- ---------------------------------------------------------------------------

create or replace function public.shop_filtered_ids(
  p_category_path text default null,
  p_q text default null,
  p_values jsonb default '{}',
  p_price_min integer default null,
  p_price_max integer default null,
  p_dims jsonb default '{}',
  p_show text[] default '{}',
  p_hide_sold_out boolean default false,
  p_skip text default null
)
returns setof uuid
language plpgsql
stable
set search_path = public, extensions
as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_tsq tsquery;
  v_like text;
  v_all boolean := p_skip = 'all';
begin
  if v_q is not null then
    v_tsq := shop_tsquery(v_q);
    v_like := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  select pc.id
  from product_cards pc
  join products p on p.id = pc.id
  where pc.status = 'published'
    and (p_category_path is null
         or pc.category_path = p_category_path
         or pc.category_path like p_category_path || '/%')
    and (v_q is null
         or (v_tsq is not null and p.search @@ v_tsq)
         or p.name ilike v_like)
    and (not coalesce(p_hide_sold_out, false) or pc.availability <> 'sold_out')
    -- New / Sale / Coming soon / Pre-order
    and (v_all or p_skip = 'show' or coalesce(cardinality(p_show), 0) = 0
         or ('new' = any (p_show) and pc.is_new)
         or ('sale' = any (p_show) and pc.is_on_sale)
         or ('coming-soon' = any (p_show) and pc.availability = 'coming_soon')
         or ('pre-order' = any (p_show) and pc.is_preorder))
    -- Price ("Price on request" drops out once a range is set)
    and (v_all or p_skip = 'price' or (p_price_min is null and p_price_max is null)
         or (pc.price is not null
             and (p_price_min is null or pc.price >= p_price_min)
             and (p_price_max is null or pc.price <= p_price_max)))
    -- Dimensions
    and (v_all or not exists (
      select 1
      from jsonb_each(coalesce(p_dims, '{}')) d(dim, rng)
      cross join lateral (select product_dim(p, d.dim) as v) x
      where p_skip is distinct from 'dim:' || d.dim
        and jsonb_typeof(d.rng) = 'array'
        and (jsonb_typeof(d.rng -> 0) = 'number' or jsonb_typeof(d.rng -> 1) = 'number')
        and not (x.v is not null
                 and (jsonb_typeof(d.rng -> 0) <> 'number' or x.v >= (d.rng ->> 0)::numeric)
                 and (jsonb_typeof(d.rng -> 1) <> 'number' or x.v <= (d.rng ->> 1)::numeric))
    ))
    -- Attribute values
    and (v_all or not exists (
      select 1
      from jsonb_each(coalesce(p_values, '{}')) f(attr, vals)
      where p_skip is distinct from 'attr:' || f.attr
        and jsonb_typeof(f.vals) = 'array'
        and jsonb_array_length(f.vals) > 0
        and not exists (
          select 1
          from product_attribute_values pav
          join attribute_values av on av.id = pav.value_id
          join attributes a on a.id = av.attribute_id
          where pav.product_id = p.id
            and a.slug = f.attr
            and av.slug in (select jsonb_array_elements_text(f.vals))
        )
    ));
end;
$$;

-- The return table gains is_preorder, so it must be dropped and recreated.
drop function public.shop_products(text, text, jsonb, integer, integer, jsonb, text[], boolean, text, text, integer, integer);

create or replace function public.shop_products(
  p_category_path text default null,
  p_q text default null,
  p_values jsonb default '{}',
  p_price_min integer default null,
  p_price_max integer default null,
  p_dims jsonb default '{}',
  p_show text[] default '{}',
  p_hide_sold_out boolean default false,
  p_sort text default 'featured',
  p_size_dim text default null,
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
  is_preorder boolean,
  image_path text,
  image_width integer,
  image_height integer,
  image_alt text,
  category_path text,
  first_published_at timestamptz,
  color_swatches jsonb,
  total_count bigint
)
language plpgsql
stable
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_tsq tsquery := case when nullif(btrim(coalesce(p_q, '')), '') is not null then shop_tsquery(p_q) end;
begin
  return query
  select
    pc.id, pc.slug, pc.name, pc.note, pc.price, pc.compare_at_price, pc.availability,
    pc.is_new, pc.is_on_sale, pc.is_preorder, pc.image_path, pc.image_width, pc.image_height, pc.image_alt,
    pc.category_path, pc.first_published_at, pc.color_swatches,
    count(*) over () as total_count
  from product_cards pc
  join products p on p.id = pc.id
  where pc.id in (
    select shop_filtered_ids(p_category_path, p_q, p_values, p_price_min, p_price_max, p_dims, p_show, p_hide_sold_out)
  )
  order by
    -- Sold out always last; in price/size sorts Coming soon mixes with Available.
    case when p_sort in ('price-asc', 'price-desc', 'size-asc') then (pc.availability = 'sold_out')::int
         else pc.availability_rank end asc,
    case when v_tsq is not null and p_sort = 'featured' then ts_rank(p.search, v_tsq) end desc nulls last,
    -- Price on request goes after priced pieces in both directions.
    case when p_sort in ('price-asc', 'price-desc') then (pc.price is null)::int end asc,
    case when p_sort = 'price-asc' then pc.price end asc,
    case when p_sort = 'price-desc' then pc.price end desc,
    case when p_sort = 'size-asc' then product_dim(p, p_size_dim) end asc nulls last,
    case when p_sort = 'featured' then pc.featured_rank end asc nulls last,
    pc.first_published_at desc nulls last,
    pc.id
  limit greatest(least(p_limit, 1200), 1)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.shop_products(text, text, jsonb, integer, integer, jsonb, text[], boolean, text, text, integer, integer)
  to anon, authenticated;

create or replace function public.shop_facets(
  p_category_path text default null,
  p_q text default null,
  p_values jsonb default '{}',
  p_price_min integer default null,
  p_price_max integer default null,
  p_dims jsonb default '{}',
  p_show text[] default '{}',
  p_hide_sold_out boolean default false
)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  with
  scope_values as (
    select distinct av.attribute_id, av.id as value_id
    from shop_filtered_ids(p_category_path, p_q, p_values, p_price_min, p_price_max, p_dims, p_show, p_hide_sold_out, 'all') f(id)
    join product_attribute_values pav on pav.product_id = f.id
    join attribute_values av on av.id = pav.value_id
  ),
  value_counts as (
    select a.slug as attribute, av.slug as value, a.sort_order as a_ord, av.sort_order as v_ord, av.name,
           (select count(*)
            from shop_filtered_ids(p_category_path, p_q, p_values, p_price_min, p_price_max, p_dims, p_show,
                                   p_hide_sold_out, 'attr:' || a.slug) f(id)
            join product_attribute_values pav on pav.product_id = f.id and pav.value_id = av.id) as n
    from scope_values sv
    join attributes a on a.id = sv.attribute_id
    join attribute_values av on av.id = sv.value_id
  ),
  show_counts as (
    select
      count(*) filter (where pc.is_new) as n_new,
      count(*) filter (where pc.is_on_sale) as n_sale,
      count(*) filter (where pc.availability = 'coming_soon') as n_soon,
      count(*) filter (where pc.is_preorder) as n_preorder
    from shop_filtered_ids(p_category_path, p_q, p_values, p_price_min, p_price_max, p_dims, p_show, p_hide_sold_out, 'show') f(id)
    join product_cards pc on pc.id = f.id
  ),
  price_bounds as (
    select min(p.price) as lo, max(p.price) as hi
    from shop_filtered_ids(p_category_path, p_q, p_values, p_price_min, p_price_max, p_dims, p_show, p_hide_sold_out, 'price') f(id)
    join products p on p.id = f.id
  ),
  dim_bounds as (
    select d.dim, min(product_dim(p, d.dim)) as lo, max(product_dim(p, d.dim)) as hi
    from unnest(array['height', 'width', 'depth', 'diameter']) d(dim)
    cross join lateral shop_filtered_ids(p_category_path, p_q, p_values, p_price_min, p_price_max, p_dims, p_show,
                                         p_hide_sold_out, 'dim:' || d.dim) f(id)
    join products p on p.id = f.id
    group by d.dim
    having count(product_dim(p, d.dim)) > 0
  )
  select jsonb_build_object(
    'total', (select count(*) from shop_filtered_ids(p_category_path, p_q, p_values, p_price_min, p_price_max, p_dims, p_show, p_hide_sold_out)),
    'values', coalesce((select jsonb_agg(jsonb_build_object('attribute', attribute, 'value', value, 'count', n)
                                         order by a_ord, attribute, v_ord, name) from value_counts), '[]'::jsonb),
    'show', (select jsonb_build_object('new', n_new, 'sale', n_sale, 'coming-soon', n_soon, 'pre-order', n_preorder) from show_counts),
    'price', (select case when lo is null then null else jsonb_build_object('min', lo, 'max', hi) end from price_bounds),
    'dims', coalesce((select jsonb_object_agg(dim, jsonb_build_object('min', lo, 'max', hi)) from dim_bounds), '{}'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Reserve "pre-order" as a category slug
-- ---------------------------------------------------------------------------

alter table public.categories drop constraint categories_slug_not_reserved;
alter table public.categories add constraint categories_slug_not_reserved
  check (slug not in ('new', 'sale', 'coming-soon', 'pre-order'));

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
  if new.slug in ('new', 'sale', 'coming-soon', 'pre-order') then
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
