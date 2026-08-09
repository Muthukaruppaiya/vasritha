-- Listing title for product cards (optional; falls back to truncated name)
alter table public.products
  add column if not exists short_name text not null default '';

-- Backfill known catalogue short names when empty
update public.products set short_name = 'Aarohi Kanchipuram'
where slug = 'aarohi-kanchipuram-silk' and coalesce(trim(short_name), '') = '';

update public.products set short_name = 'Nandini Banarasi'
where slug = 'nandini-banarasi-weave' and coalesce(trim(short_name), '') = '';

update public.products set short_name = 'Meera Soft'
where slug = 'meera-soft-silk' and coalesce(trim(short_name), '') = '';

update public.products set short_name = 'Sundari Cotton'
where slug = 'sundari-cotton-weave' and coalesce(trim(short_name), '') = '';

update public.products set short_name = 'Lakshmi Bangles'
where slug = 'lakshmi-temple-bangles' and coalesce(trim(short_name), '') = '';

update public.products set short_name = 'Chandrika Earrings'
where slug = 'chandrika-earrings' and coalesce(trim(short_name), '') = '';

update public.products set short_name = 'Navratna Necklace'
where slug = 'navratna-temple-necklace' and coalesce(trim(short_name), '') = '';

update public.products set short_name = 'Lotus Panel'
where slug = 'hand-carved-lotus-panel' and coalesce(trim(short_name), '') = '';

update public.products set short_name = 'Brass Ganesha'
where slug = 'brass-ganesha-idol' and coalesce(trim(short_name), '') = '';
