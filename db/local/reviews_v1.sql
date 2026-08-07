-- Product review extras (safe to re-run)
alter table public.reviews
  add column if not exists title text,
  add column if not exists image_path text,
  add column if not exists reviewer_email text;

comment on column public.reviews.title is 'Optional short review headline.';
comment on column public.reviews.image_path is 'Optional customer photo path under /uploads/reviews.';
comment on column public.reviews.reviewer_email is 'Customer email snapshot at submit time.';

create index if not exists reviews_approval_created_idx
  on public.reviews (is_approved, created_at desc);

create index if not exists reviews_product_approved_idx
  on public.reviews (product_id, is_approved, created_at desc)
  where product_id is not null;
