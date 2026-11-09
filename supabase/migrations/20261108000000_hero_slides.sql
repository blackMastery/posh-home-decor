-- Home page hero carousel: admin-managed slides with scheduling, plus daily view/click stats.
-- Images live in the public `site` bucket under hero/ (existing admin-write storage policies cover it).

create table public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  internal_name text not null check (char_length(internal_name) between 1 and 80),
  -- overlay: photo + live text; artwork: finished graphic, whole slide is the link.
  kind text not null default 'overlay' check (kind in ('overlay', 'artwork')),

  mobile_image_path text not null check (mobile_image_path ~ '^hero/[0-9a-f-]{36}\.jpg$'),
  mobile_width integer check (mobile_width is null or mobile_width > 0),
  mobile_height integer check (mobile_height is null or mobile_height > 0),
  desktop_image_path text check (desktop_image_path is null or desktop_image_path ~ '^hero/[0-9a-f-]{36}\.jpg$'),
  desktop_width integer check (desktop_width is null or desktop_width > 0),
  desktop_height integer check (desktop_height is null or desktop_height > 0),
  alt text not null default '' check (char_length(alt) <= 200),

  eyebrow text not null default '' check (char_length(eyebrow) <= 40),
  headline text not null default '' check (char_length(headline) <= 80),
  body text not null default '' check (char_length(body) <= 200),
  cta_label text not null default '' check (char_length(cta_label) <= 30),

  link_type text not null default 'none' check (link_type in ('none', 'product', 'category', 'path', 'url')),
  -- Deleting the target nulls the FK; the storefront then skips the slide and admin flags it.
  product_id uuid references public.products (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  link_url text check (char_length(link_url) <= 500),
  show_price boolean not null default false,

  text_position text not null default 'bottom-left' check (text_position in ('bottom-left', 'center', 'bottom-center')),
  text_tone text not null default 'light' check (text_tone in ('light', 'dark')),
  scrim text not null default 'soft' check (scrim in ('none', 'soft', 'strong')),

  starts_at timestamptz,
  ends_at timestamptz,
  -- New slides stay hidden until an admin switches them on.
  is_visible boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hero_slides_schedule_order check (starts_at is null or ends_at is null or ends_at > starts_at),
  constraint hero_slides_artwork_alt check (kind <> 'artwork' or char_length(btrim(alt)) > 0),
  constraint hero_slides_overlay_headline check (kind <> 'overlay' or char_length(btrim(headline)) > 0),
  constraint hero_slides_link_columns check (
    (link_type = 'product' or product_id is null)
    and (link_type = 'category' or category_id is null)
    and (case link_type
           when 'path' then link_url ~ '^/([^/]|$)'
           when 'url' then link_url ~* '^https?://'
           else link_url is null
         end)
  ),
  constraint hero_slides_price_needs_product check (not show_price or link_type = 'product')
);

create index hero_slides_visible_order_idx on public.hero_slides (is_visible, sort_order, created_at);
create index hero_slides_product_idx on public.hero_slides (product_id) where product_id is not null;
create index hero_slides_category_idx on public.hero_slides (category_id) where category_id is not null;

create trigger hero_slides_touch before update on public.hero_slides
  for each row execute function public.touch_updated_at();

alter table public.hero_slides enable row level security;

create policy hero_slides_public_read on public.hero_slides
  for select to anon, authenticated using (is_visible or (select public.is_admin()));
create policy hero_slides_admin_write on public.hero_slides
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

grant select on public.hero_slides to anon, authenticated;
revoke insert, update, delete, truncate on public.hero_slides from anon;
grant insert, update, delete on public.hero_slides to authenticated;
grant all on public.hero_slides to service_role;

-- ---------------------------------------------------------------------------
-- Stats: one row per slide per Guyana-local day. Written only via record_hero_events().
-- ---------------------------------------------------------------------------

create table public.hero_slide_stats (
  slide_id uuid not null references public.hero_slides (id) on delete cascade,
  day date not null,
  views integer not null default 0 check (views >= 0),
  clicks integer not null default 0 check (clicks >= 0),
  primary key (slide_id, day)
);

create index hero_slide_stats_day_idx on public.hero_slide_stats (day);

alter table public.hero_slide_stats enable row level security;

create policy hero_slide_stats_admin_read on public.hero_slide_stats
  for select to authenticated using ((select public.is_admin()));

revoke all on public.hero_slide_stats from anon;
revoke insert, update, delete, truncate on public.hero_slide_stats from authenticated;
grant select on public.hero_slide_stats to authenticated;
grant all on public.hero_slide_stats to service_role;

-- Batched counter bump from the storefront beacon. Per call each slide gets at most
-- 1 view and 5 clicks, and only visible slides count, which bounds abuse.
create or replace function public.record_hero_events(p_events jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Guyana')::date;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 10 then
    return;
  end if;

  insert into public.hero_slide_stats as st (slide_id, day, views, clicks)
  select s.id, v_day, least(sum(e.v), 1), least(sum(e.c), 5)
  from (
    select
      (x->>'id') as id,
      greatest(coalesce((x->>'v')::int, 0), 0) as v,
      greatest(coalesce((x->>'c')::int, 0), 0) as c
    from jsonb_array_elements(p_events) x
    where (x->>'id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) e
  join public.hero_slides s on s.id = e.id::uuid and s.is_visible
  group by s.id
  having sum(e.v) > 0 or sum(e.c) > 0
  on conflict (slide_id, day) do update
    set views = st.views + excluded.views,
        clicks = st.clicks + excluded.clicks;
end;
$$;

revoke execute on function public.record_hero_events(jsonb) from public;
grant execute on function public.record_hero_events(jsonb) to anon, authenticated, service_role;
