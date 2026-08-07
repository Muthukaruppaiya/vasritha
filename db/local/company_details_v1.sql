-- Company details fields on site_settings (safe to re-run)
alter table public.site_settings
  add column if not exists company_legal_name text,
  add column if not exists company_address text,
  add column if not exists company_gstin text;

comment on column public.site_settings.company_legal_name is 'Registered / legal business name for invoices and GRNs.';
comment on column public.site_settings.company_address is 'Registered business address.';
comment on column public.site_settings.company_gstin is 'GSTIN / tax ID.';

-- Seed legal name from site_name when empty
update public.site_settings
set company_legal_name = coalesce(nullif(company_legal_name, ''), site_name)
where company_legal_name is null or company_legal_name = '';
