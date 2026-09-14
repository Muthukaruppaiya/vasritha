-- Fallback image storage when Supabase Storage env keys are not set on the host.
create table if not exists public.product_image_blobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  mime text not null,
  bytes bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists product_image_blobs_product_id_idx
  on public.product_image_blobs (product_id);
