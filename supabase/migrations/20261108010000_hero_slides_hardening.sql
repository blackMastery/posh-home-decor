-- Hero carousel hardening (follow-up to 20261108000000_hero_slides).
--  1. Public reads only see slides inside their schedule; internal_name is staff-only.
--  2. Stats are written only by the server (service role), deduplicated per hashed IP.
--  3. Admin stats are aggregated in the database (no row-limit truncation).
--  4. Site-path links can't be protocol-relative (//host or /\host).
--  5. Reordering is a single atomic statement.

-- ---------------------------------------------------------------------------
-- 1. Scheduled slides stay private until they start
-- ---------------------------------------------------------------------------

drop policy hero_slides_public_read on public.hero_slides;
create policy hero_slides_public_read on public.hero_slides
  for select to anon, authenticated using (
    (is_visible and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()))
    or (select public.is_admin())
  );

-- Anon gets every column except the staff-only name.
revoke select on public.hero_slides from anon;
grant select (
  id, kind, mobile_image_path, mobile_width, mobile_height, desktop_image_path, desktop_width, desktop_height,
  alt, eyebrow, headline, body, cta_label, link_type, product_id, category_id, link_url, show_price,
  text_position, text_tone, scrim, starts_at, ends_at, is_visible, sort_order, created_at, updated_at
) on public.hero_slides to anon;

-- The storefront cache still needs to know when the next scheduled slide starts,
-- without seeing its content. Exposes a timestamp only.
create or replace function public.hero_next_start()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select min(starts_at) from public.hero_slides where is_visible and starts_at > now();
$$;

revoke execute on function public.hero_next_start() from public;
grant execute on function public.hero_next_start() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Stats: server-only writes, per-visitor dedupe
-- ---------------------------------------------------------------------------

-- Per hashed IP, per slide, per Guyana day. Kept for two days, then pruned.
create table public.hero_event_visitors (
  ip_hash text not null check (char_length(ip_hash) = 64),
  slide_id uuid not null references public.hero_slides (id) on delete cascade,
  day date not null,
  views smallint not null default 0,
  clicks smallint not null default 0,
  primary key (ip_hash, slide_id, day)
);

create index hero_event_visitors_day_idx on public.hero_event_visitors (day);

alter table public.hero_event_visitors enable row level security;
-- No policies: only the service role (which bypasses RLS) touches it.
revoke all on public.hero_event_visitors from anon, authenticated;
grant all on public.hero_event_visitors to service_role;

drop function public.record_hero_events(jsonb);

-- Each visitor adds at most 1 view and 5 clicks per slide per day, and only for
-- slides that are live right now. Called only by the /api/hero-events route.
create function public.record_hero_events(p_ip_hash text, p_events jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'America/Guyana')::date;
  v_event jsonb;
  v_id uuid;
  v_prev_views smallint;
  v_prev_clicks smallint;
  v_add_views int;
  v_add_clicks int;
begin
  if p_ip_hash is null or char_length(p_ip_hash) <> 64
     or p_events is null or jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 10 then
    return;
  end if;

  delete from public.hero_event_visitors where day < v_day - 1;

  for v_event in select * from jsonb_array_elements(p_events) loop
    continue when (v_event->>'id') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    v_id := (v_event->>'id')::uuid;

    perform 1 from public.hero_slides s
      where s.id = v_id and s.is_visible
        and (s.starts_at is null or s.starts_at <= now())
        and (s.ends_at is null or s.ends_at > now());
    continue when not found;

    select views, clicks into v_prev_views, v_prev_clicks
      from public.hero_event_visitors
      where ip_hash = p_ip_hash and slide_id = v_id and day = v_day;

    v_add_views := case when coalesce((v_event->>'v')::int, 0) > 0 and coalesce(v_prev_views, 0) = 0 then 1 else 0 end;
    v_add_clicks := least(greatest(coalesce((v_event->>'c')::int, 0), 0), 5 - coalesce(v_prev_clicks, 0));
    continue when v_add_views = 0 and v_add_clicks <= 0;
    v_add_clicks := greatest(v_add_clicks, 0);

    insert into public.hero_event_visitors as ev (ip_hash, slide_id, day, views, clicks)
      values (p_ip_hash, v_id, v_day, v_add_views, v_add_clicks)
      on conflict (ip_hash, slide_id, day) do update
        set views = ev.views + excluded.views, clicks = ev.clicks + excluded.clicks;

    insert into public.hero_slide_stats as st (slide_id, day, views, clicks)
      values (v_id, v_day, v_add_views, v_add_clicks)
      on conflict (slide_id, day) do update
        set views = st.views + excluded.views, clicks = st.clicks + excluded.clicks;
  end loop;
end;
$$;

revoke execute on function public.record_hero_events(text, jsonb) from public, anon, authenticated;
grant execute on function public.record_hero_events(text, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Admin stats summary (RLS on hero_slide_stats still limits this to admins)
-- ---------------------------------------------------------------------------

create or replace function public.hero_stats_summary(p_since7 date, p_since30 date)
returns table (slide_id uuid, views7 bigint, clicks7 bigint, views30 bigint, clicks30 bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    st.slide_id,
    coalesce(sum(st.views) filter (where st.day >= p_since7), 0),
    coalesce(sum(st.clicks) filter (where st.day >= p_since7), 0),
    coalesce(sum(st.views), 0),
    coalesce(sum(st.clicks), 0)
  from public.hero_slide_stats st
  where st.day >= p_since30
  group by st.slide_id;
$$;

revoke execute on function public.hero_stats_summary(date, date) from public, anon;
grant execute on function public.hero_stats_summary(date, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Site paths: "/" or "/x…" with no backslashes or whitespace, never "//"
-- ---------------------------------------------------------------------------

alter table public.hero_slides drop constraint hero_slides_link_columns;
alter table public.hero_slides add constraint hero_slides_link_columns check (
  (link_type = 'product' or product_id is null)
  and (link_type = 'category' or category_id is null)
  and (case link_type
         when 'path' then link_url ~ '^/([^/\\[:space:]][^\\[:space:]]*)?$'
         when 'url' then link_url ~* '^https?://[^[:space:]]+$'
         else link_url is null
       end)
);

-- ---------------------------------------------------------------------------
-- 5. Atomic reorder (RLS admin-write policy applies)
-- ---------------------------------------------------------------------------

create or replace function public.reorder_hero_slides(p_ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.hero_slides s
     set sort_order = o.ord - 1
    from unnest(p_ids) with ordinality as o(id, ord)
   where s.id = o.id;
$$;

revoke execute on function public.reorder_hero_slides(uuid[]) from public, anon;
grant execute on function public.reorder_hero_slides(uuid[]) to authenticated, service_role;
