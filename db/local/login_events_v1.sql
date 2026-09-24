-- Login events log (staff / POS / website) — safe to re-run
-- Usage: npm run db:patch:login-events

create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  email_attempted text not null,
  success boolean not null default false,
  failure_code text,
  failure_message text,
  client text not null default 'website'
    check (client in ('staff', 'pos', 'website', 'unknown')),
  ip text,
  user_agent text,
  device_key text,
  device_label text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  roles_snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists login_events_created_idx
  on public.login_events (created_at desc);

create index if not exists login_events_user_idx
  on public.login_events (user_id, created_at desc)
  where user_id is not null;

create index if not exists login_events_client_success_idx
  on public.login_events (client, success, created_at desc);

create index if not exists login_events_email_idx
  on public.login_events (lower(email_attempted), created_at desc);

comment on table public.login_events is
  'Login attempts and successes for staff, POS and website users.';
