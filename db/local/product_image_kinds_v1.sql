-- Separate website storefront images from internal reference photos.
-- Existing rows default to 'website' so the shop keeps showing them.

do $$ begin
  create type public.product_image_kind as enum ('website', 'internal');
exception
  when duplicate_object then null;
end $$;

alter table public.product_images
  add column if not exists image_kind public.product_image_kind not null default 'website';

create index if not exists product_images_product_kind_idx
  on public.product_images (product_id, image_kind, sort_order);

comment on column public.product_images.image_kind is
  'website = customer-facing storefront images; internal = staff reference (QR phone upload)';
