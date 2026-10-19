-- Structured product attributes (Color, Material, Room…), numeric dimensions,
-- faceted shop filtering and header search suggestions.

-- ---------------------------------------------------------------------------
-- attributes / attribute_values / product_attribute_values
-- ---------------------------------------------------------------------------

create table public.attributes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  -- Used as the shop URL param (?color=gold), so it must not collide with other params.
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null default 'standard' check (kind in ('standard', 'color')),
  sort_order integer not null default 0,
  show_on_pdp boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attributes_slug_not_reserved
    check (slug not in ('q', 'sort', 'page', 'price', 'h', 'w', 'd', 'dia', 'new', 'sale', 'soon', 'instock'))
);

create trigger attributes_touch before update on public.attributes
  for each row execute function public.touch_updated_at();

create table public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.attributes (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  -- Stable once created: renaming a value keeps its slug so shared links keep working.
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  hex text check (hex is null or hex ~ '^#[0-9A-Fa-f]{6}$'),
  swatch text not null default 'solid' check (swatch in ('solid', 'metallic', 'multi')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attribute_id, slug)
);

create index attribute_values_attribute_idx on public.attribute_values (attribute_id, sort_order);
create index attribute_values_name_trgm_idx on public.attribute_values using gin (name extensions.gin_trgm_ops);

create trigger attribute_values_touch before update on public.attribute_values
  for each row execute function public.touch_updated_at();

create table public.product_attribute_values (
  product_id uuid not null references public.products (id) on delete cascade,
  -- restrict: a value in use can't be deleted, only merged into another.
  value_id uuid not null references public.attribute_values (id) on delete restrict,
  primary key (product_id, value_id)
);

create index product_attribute_values_value_idx on public.product_attribute_values (value_id);

-- ---------------------------------------------------------------------------
-- Dimensions (cm) and per-category filter configuration
-- ---------------------------------------------------------------------------

alter table public.products
  add column height_cm numeric(6, 1) check (height_cm is null or height_cm > 0),
  add column width_cm numeric(6, 1) check (width_cm is null or width_cm > 0),
  add column depth_cm numeric(6, 1) check (depth_cm is null or depth_cm > 0),
  add column diameter_cm numeric(6, 1) check (diameter_cm is null or diameter_cm > 0);

-- null = inherit from the parent category.
alter table public.categories
  add column filter_dims text[]
    check (filter_dims is null or filter_dims <@ array['height', 'width', 'depth', 'diameter']::text[]),
  add column primary_dim text
    check (primary_dim is null or primary_dim in ('height', 'width', 'depth', 'diameter'));

create or replace function public.product_dim(p public.products, p_dim text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case p_dim
    when 'height' then p.height_cm
    when 'width' then p.width_cm
    when 'depth' then p.depth_cm
    when 'diameter' then p.diameter_cm
    -- No dimension named: the largest one (greatest() ignores nulls).
    else greatest(p.height_cm, p.width_cm, p.depth_cm, p.diameter_cm)
  end;
$$;

-- ---------------------------------------------------------------------------
-- Search vector: name, note, category names and attribute values
-- ---------------------------------------------------------------------------
-- A generated column can't read other tables, so `search` becomes a plain
-- column maintained by triggers. Every refresh path goes through the
-- products BEFORE trigger, so there is one place that builds the vector.

alter table public.products alter column search drop expression;

create or replace function public.products_set_search()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_categories text;
  v_values text;
begin
  select string_agg(a.name, ' ')
  into v_categories
  from categories c
  join categories a on c.path = a.path or c.path like a.path || '/%'
  where c.id = new.category_id;

  select string_agg(av.name, ' ')
  into v_values
  from product_attribute_values pav
  join attribute_values av on av.id = pav.value_id
  where pav.product_id = new.id;

  new.search :=
    setweight(to_tsvector('simple'::regconfig, coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(new.note, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(v_categories, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(v_values, '')), 'B') ||
    setweight(to_tsvector('simple'::regconfig, coalesce(new.description, '')), 'C');
  return new;
end;
$$;

create trigger products_set_search before insert or update on public.products
  for each row execute function public.products_set_search();

-- Re-run the BEFORE trigger for affected products.
create or replace function public.product_attribute_values_after_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update products set search = null where id = coalesce(new.product_id, old.product_id);
  return null;
end;
$$;

create trigger product_attribute_values_after_change
  after insert or delete on public.product_attribute_values
  for each row execute function public.product_attribute_values_after_change();

create or replace function public.attribute_values_after_rename()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update products set search = null
  where id in (select product_id from product_attribute_values where value_id = new.id);
  return null;
end;
$$;

create trigger attribute_values_after_rename after update of name on public.attribute_values
  for each row when (old.name is distinct from new.name)
  execute function public.attribute_values_after_rename();

create or replace function public.categories_after_rename()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update products set search = null
  where category_id in (select id from categories where path = new.path or path like new.path || '/%');
  return null;
end;
$$;

create trigger categories_after_rename after update of name, path on public.categories
  for each row when (old.name is distinct from new.name or old.path is distinct from new.path)
  execute function public.categories_after_rename();

-- Backfill.
update public.products set search = null;

-- ---------------------------------------------------------------------------
-- Read model: product cards (+ colour swatches, dimensions, attribute count)
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
  coalesce(sw.value_count, 0)::integer as attribute_value_count
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
-- Faceted shop filtering
-- ---------------------------------------------------------------------------

-- Prefix query from free text: "gold vas" → 'gold:* & vas:*'.
create or replace function public.shop_tsquery(p_q text)
returns tsquery
language sql
immutable
set search_path = public, extensions
as $$
  select to_tsquery('simple', string_agg(w || ':*', ' & '))
  from regexp_split_to_table(
    lower(regexp_replace(coalesce(p_q, ''), '[^[:alnum:][:space:]]', ' ', 'g')), '\s+'
  ) as w
  where w <> '';
$$;

-- Ids of published products matching every filter except the one named by
-- p_skip ('attr:<slug>' | 'price' | 'dim:<name>' | 'show' | 'all'), which is
-- how facet counts stay disjunctive. 'all' keeps only category, search and
-- "hide sold out" (the scope facets are drawn from).
--   p_values: {"color": ["gold", "black"], "material": ["glass"]}  OR within, AND across
--   p_dims:   {"height": [20, 40]}  either bound may be null; missing dimension = excluded
--   p_show:   any of 'new', 'sale', 'coming-soon' (OR'd together)
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
    -- New / Sale / Coming soon
    and (v_all or p_skip = 'show' or coalesce(cardinality(p_show), 0) = 0
         or ('new' = any (p_show) and pc.is_new)
         or ('sale' = any (p_show) and pc.is_on_sale)
         or ('coming-soon' = any (p_show) and pc.availability = 'coming_soon'))
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

-- Shop listing: filters, search, sort, pagination.
drop function public.shop_products(text, text, text, text, integer, integer);

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
    pc.is_new, pc.is_on_sale, pc.image_path, pc.image_width, pc.image_height, pc.image_alt,
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

-- Facet counts and range bounds for the current filters.
-- {
--   "total": 12,
--   "values": [{"attribute": "color", "value": "gold", "count": 4}, …],  -- values used in scope; count may be 0
--   "show":   {"new": 3, "sale": 1, "coming-soon": 0},
--   "price":  {"min": 3200, "max": 24500} | null,
--   "dims":   {"height": {"min": 4, "max": 160}, …}                        -- only dims with data
-- }
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
      count(*) filter (where pc.availability = 'coming_soon') as n_soon
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
    'show', (select jsonb_build_object('new', n_new, 'sale', n_sale, 'coming-soon', n_soon) from show_counts),
    'price', (select case when lo is null then null else jsonb_build_object('min', lo, 'max', hi) end from price_bounds),
    'dims', coalesce((select jsonb_object_agg(dim, jsonb_build_object('min', lo, 'max', hi)) from dim_bounds), '{}'::jsonb)
  );
$$;

-- Header search: a few products and matching categories.
create or replace function public.search_suggest(p_q text, p_limit integer default 6)
returns jsonb
language sql
stable
set search_path = public, extensions
as $$
  with
  q as (
    select nullif(btrim(coalesce(p_q, '')), '') as text,
           shop_tsquery(p_q) as tsq
  ),
  prods as (
    select pc.id, pc.slug, pc.name, pc.price, pc.availability, pc.image_path, pc.image_width, pc.image_height,
           pc.image_alt, pc.category_name
    from q
    cross join lateral shop_filtered_ids(null, q.text) f(id)
    join product_cards pc on pc.id = f.id
    join products p on p.id = pc.id
    where q.text is not null
    order by pc.availability_rank,
             case when q.tsq is not null then ts_rank(p.search, q.tsq) end desc nulls last,
             pc.featured_rank nulls last,
             pc.first_published_at desc nulls last
    limit greatest(least(p_limit, 12), 1)
  ),
  cats as (
    select c.name, c.path, parent.name as parent_name, c.depth
    from q
    join categories c on c.name ilike '%' || replace(replace(replace(q.text, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    left join categories parent on parent.id = c.parent_id
    where q.text is not null
      and exists (
        select 1 from product_cards pc
        where pc.status = 'published' and (pc.category_path = c.path or pc.category_path like c.path || '/%')
      )
    order by c.depth, c.name
    limit 4
  )
  select jsonb_build_object(
    'products', coalesce((select jsonb_agg(to_jsonb(prods)) from prods), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(cats)) from cats), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Admin helpers
-- ---------------------------------------------------------------------------

-- "Did you mean…?" before creating a value.
create or replace function public.similar_attribute_values(p_attribute_id uuid, p_name text)
returns table (id uuid, name text, slug text, score real)
language sql
stable
set search_path = public, extensions
as $$
  select av.id, av.name, av.slug, similarity(av.name, p_name) as score
  from attribute_values av
  where av.attribute_id = p_attribute_id
    and (similarity(av.name, p_name) > 0.4
         or lower(av.name) = lower(btrim(p_name))
         or av.slug = lower(regexp_replace(btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g')))
  order by score desc
  limit 3;
$$;

-- How many products use each value (admin attribute manager).
create or replace function public.attribute_value_usage()
returns table (value_id uuid, product_count bigint)
language sql
stable
set search_path = public
as $$
  select value_id, count(*) from product_attribute_values group by value_id;
$$;

-- Move every product from one value to another (same attribute), then delete the source.
create or replace function public.merge_attribute_value(p_from uuid, p_into uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_from = p_into then
    raise exception 'Choose a different value to merge into' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from attribute_values a join attribute_values b on a.attribute_id = b.attribute_id
    where a.id = p_from and b.id = p_into
  ) then
    raise exception 'Values must belong to the same attribute' using errcode = 'P0001';
  end if;

  insert into product_attribute_values (product_id, value_id)
  select product_id, p_into from product_attribute_values where value_id = p_from
  on conflict do nothing;
  delete from product_attribute_values where value_id = p_from;
  delete from attribute_values where id = p_from;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security + grants
-- ---------------------------------------------------------------------------

alter table public.attributes enable row level security;
alter table public.attribute_values enable row level security;
alter table public.product_attribute_values enable row level security;

create policy attributes_public_read on public.attributes
  for select to anon, authenticated using (true);
create policy attributes_admin_write on public.attributes
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy attribute_values_public_read on public.attribute_values
  for select to anon, authenticated using (true);
create policy attribute_values_admin_write on public.attribute_values
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy product_attribute_values_public_read on public.product_attribute_values
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
    or (select public.is_admin())
  );
create policy product_attribute_values_admin_write on public.product_attribute_values
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.attributes, public.attribute_values, public.product_attribute_values to anon, authenticated;
revoke insert, update, delete, truncate on public.attributes, public.attribute_values,
  public.product_attribute_values from anon;
grant insert, update, delete on public.attributes, public.attribute_values,
  public.product_attribute_values to authenticated;
grant all on public.attributes, public.attribute_values, public.product_attribute_values to service_role;
grant select on public.product_cards to anon, authenticated;
grant all on public.product_cards to service_role;

grant execute on function public.product_dim(public.products, text) to anon, authenticated;
grant execute on function public.shop_tsquery(text) to anon, authenticated;
grant execute on function public.shop_filtered_ids(text, text, jsonb, integer, integer, jsonb, text[], boolean, text)
  to anon, authenticated;
grant execute on function public.shop_products(text, text, jsonb, integer, integer, jsonb, text[], boolean, text, text, integer, integer)
  to anon, authenticated;
grant execute on function public.shop_facets(text, text, jsonb, integer, integer, jsonb, text[], boolean)
  to anon, authenticated;
grant execute on function public.search_suggest(text, integer) to anon, authenticated;
revoke execute on function public.similar_attribute_values(uuid, text) from public, anon;
grant execute on function public.similar_attribute_values(uuid, text) to authenticated, service_role;
revoke execute on function public.attribute_value_usage() from public, anon;
grant execute on function public.attribute_value_usage() to authenticated, service_role;
revoke execute on function public.merge_attribute_value(uuid, uuid) from public, anon;
grant execute on function public.merge_attribute_value(uuid, uuid) to authenticated, service_role;
