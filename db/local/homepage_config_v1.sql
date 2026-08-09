-- Homepage configuration: offer ticker, hero slides, status stories, showcase media
create table if not exists public.offer_ticker_items (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  link_url text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  image_path text not null,
  alt_text text,
  title text,
  subtitle text,
  cta_label text,
  cta_href text,
  cta2_label text,
  cta2_href text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.status_stories (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  image_path text not null,
  href text,
  display_date date not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.showcase_media (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  media_path text not null,
  media_type text not null default 'video' check (media_type in ('video', 'image')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists offer_ticker_active_sort_idx
  on public.offer_ticker_items (is_active, sort_order);
create index if not exists hero_slides_active_sort_idx
  on public.hero_slides (is_active, sort_order);
create index if not exists status_stories_display_idx
  on public.status_stories (display_date, is_active, sort_order);
create index if not exists showcase_media_active_sort_idx
  on public.showcase_media (is_active, sort_order);

comment on table public.offer_ticker_items is 'Homepage top running offer / announcement messages.';
comment on table public.hero_slides is 'Homepage hero carousel slides (max 5 active).';
comment on table public.status_stories is 'Homepage circular status stories; visible only on display_date (1-day validity).';
comment on table public.showcase_media is 'Homepage video/image showcase carousel items.';
