alter table public.categories
  add column if not exists name_i18n jsonb not null default '{}'::jsonb;

comment on column public.categories.name_i18n is
  'Optional storefront labels by locale (en, ta, ml, kn, hi, pa, gu). Empty locales fall back to name / built-in translations.';
