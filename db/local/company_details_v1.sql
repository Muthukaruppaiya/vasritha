-- Company details fields on site_settings (safe to re-run)
alter table public.site_settings
  add column if not exists company_legal_name text,
  add column if not exists company_address text,
  add column if not exists company_gstin text,
  add column if not exists company_state text,
  add column if not exists company_state_code text,
  add column if not exists prices_inclusive_of_gst boolean not null default true;

comment on column public.site_settings.company_legal_name is 'Registered / legal business name for invoices and GRNs.';
comment on column public.site_settings.company_address is 'Registered business address.';
comment on column public.site_settings.company_gstin is 'GSTIN / tax ID.';
comment on column public.site_settings.company_state is 'Seller state name for GST place of supply.';
comment on column public.site_settings.company_state_code is '2-digit GST state code (same as first 2 of GSTIN).';
comment on column public.site_settings.prices_inclusive_of_gst is 'When true, listed prices include GST (typical retail textile).';

-- Seed legal name from site_name when empty
update public.site_settings
set company_legal_name = coalesce(nullif(company_legal_name, ''), site_name)
where company_legal_name is null or company_legal_name = '';
