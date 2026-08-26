-- GST / HSN fields for products, order line snapshots, and seller place-of-supply
-- Safe to re-run. Usage: npm run db:patch:gst-hsn

alter table public.products
  add column if not exists hsn_code text,
  add column if not exists gst_rate numeric(5,2) not null default 5;

comment on column public.products.hsn_code is 'HSN / SAC code (4–8 digits) for GST invoices.';
comment on column public.products.gst_rate is 'GST rate % applied to this product (prices treated as tax-inclusive at retail).';

alter table public.order_items
  add column if not exists hsn_code text,
  add column if not exists gst_rate numeric(5,2);

comment on column public.order_items.hsn_code is 'HSN snapshot at sale time.';
comment on column public.order_items.gst_rate is 'GST rate % snapshot at sale time.';

alter table public.site_settings
  add column if not exists company_state text,
  add column if not exists company_state_code text,
  add column if not exists prices_inclusive_of_gst boolean not null default true;

comment on column public.site_settings.company_state is 'Seller state name for GST place of supply.';
comment on column public.site_settings.company_state_code is '2-digit GST state code (same as first 2 of GSTIN).';
comment on column public.site_settings.prices_inclusive_of_gst is 'When true, listed prices include GST (typical retail textile).';

-- Soft defaults for common textile HSN if empty (sarees / woven fabrics of man-made filament — update per SKU)
update public.products
set hsn_code = coalesce(nullif(trim(hsn_code), ''), '5407'),
    gst_rate = coalesce(gst_rate, 5)
where hsn_code is null or trim(hsn_code) = '';
