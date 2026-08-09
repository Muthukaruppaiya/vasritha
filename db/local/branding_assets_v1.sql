-- Category listing / banner background image
alter table public.categories
  add column if not exists image_path text;

-- Website header logo (PNG preferred) vs general brand logo (admin + other surfaces)
alter table public.site_settings
  add column if not exists header_logo_path text;
