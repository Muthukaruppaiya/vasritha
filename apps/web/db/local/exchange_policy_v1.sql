-- Exchange / no-refund policy columns (also applied via ensureExchangePolicySchema)
alter table public.site_settings
  add column if not exists no_refund_policy boolean not null default true,
  add column if not exists exchange_enabled boolean not null default true,
  add column if not exists exchange_window_days integer not null default 7,
  add column if not exists exchange_charge numeric(12,2) not null default 0,
  add column if not exists exchange_condition_text text,
  add column if not exists exchange_non_eligible_text text,
  add column if not exists exchange_process_text text,
  add column if not exists exchange_policy_notes text;

alter table public.order_returns
  add column if not exists request_type text not null default 'exchange',
  add column if not exists admin_notes text;
