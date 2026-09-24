-- Delivery / shipping conditions (site_settings)
-- Runtime also applies via ensureShippingSchema() in lib/shipping.ts

alter table public.site_settings
  add column if not exists default_shipping_fee numeric(12,2) not null default 0,
  add column if not exists delivery_enabled boolean not null default true,
  add column if not exists estimated_delivery_text text,
  add column if not exists order_processing_text text,
  add column if not exists shipping_policy_notes text,
  add column if not exists delivery_pincode_mode text not null default 'all',
  add column if not exists delivery_pincodes text not null default '';

update public.site_settings
set estimated_delivery_text = coalesce(nullif(estimated_delivery_text, ''), '3–7 business days across India'),
    order_processing_text = coalesce(nullif(order_processing_text, ''), 'Orders are packed within 1–2 business days after payment confirmation')
where true;
