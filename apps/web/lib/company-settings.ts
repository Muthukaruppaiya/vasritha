import { query } from "./db/pool";

/** Company / GST fields on site_settings used by POS, invoices, GRN print, shops seed. */
export async function ensureCompanySettingsSchema() {
  await query(`
    alter table public.site_settings
      add column if not exists company_legal_name text,
      add column if not exists company_address text,
      add column if not exists company_gstin text,
      add column if not exists company_state text,
      add column if not exists company_state_code text,
      add column if not exists prices_inclusive_of_gst boolean not null default true,
      add column if not exists support_phone text,
      add column if not exists support_email text,
      add column if not exists doc_prefix_invoice text not null default 'VAS',
      add column if not exists doc_prefix_grn text not null default 'GRN',
      add column if not exists doc_prefix_online text not null default 'VAS',
      add column if not exists doc_prefix_product text not null default 'VAS',
      add column if not exists doc_number_pad integer not null default 3,
      add column if not exists doc_number_year_mode text not null default 'calendar',
      add column if not exists social_links jsonb not null default '{}'::jsonb,
      add column if not exists storefront_coming_soon boolean not null default false,
      add column if not exists storefront_coming_soon_title text,
      add column if not exists storefront_coming_soon_message text,
      add column if not exists storefront_coming_soon_media_path text
  `);
  await query(`
    update public.site_settings
    set company_legal_name = coalesce(nullif(trim(company_legal_name), ''), nullif(trim(site_name), ''), 'Vasritha')
    where company_legal_name is null or btrim(company_legal_name) = ''
  `);
}
