-- Staff login security flags (master off by default for testing)
alter table site_settings
  add column if not exists staff_login_security_enabled boolean not null default false,
  add column if not exists staff_login_require_ip boolean not null default false,
  add column if not exists staff_login_require_device boolean not null default false,
  add column if not exists staff_login_require_geo boolean not null default false,
  add column if not exists staff_login_allowed_ips text not null default '',
  add column if not exists staff_login_store_lat numeric(10,7),
  add column if not exists staff_login_store_lng numeric(10,7),
  add column if not exists staff_login_store_radius_m integer not null default 300;

create table if not exists public.staff_login_devices (
  id uuid primary key default gen_random_uuid(),
  device_key text not null unique,
  label text,
  user_agent text,
  last_ip text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'blocked')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_login_devices_status_idx
  on public.staff_login_devices (status);
