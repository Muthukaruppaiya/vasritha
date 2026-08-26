-- Parent-child product grouping (Case 2: design variants under one parent)
-- Case 1 (saree qty + unique barcodes) is unchanged: leave parent_product_id null.

alter table public.products
  add column if not exists parent_product_id uuid references public.products(id) on delete set null;

create index if not exists products_parent_product_id_idx
  on public.products (parent_product_id)
  where parent_product_id is not null;

-- A product cannot be its own parent (DB-level guard)
do $$ begin
  alter table public.products
    add constraint products_parent_not_self
    check (parent_product_id is null or parent_product_id <> id);
exception
  when duplicate_object then null;
end $$;
