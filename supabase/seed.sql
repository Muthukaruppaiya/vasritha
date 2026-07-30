insert into public.categories (name, slug, description, sort_order) values
  ('Sarees', 'sarees', 'Timeless drapes for every occasion.', 1),
  ('Jewelry', 'jewelry', 'Finishing touches with enduring radiance.', 2),
  ('Churidhars / Salwars', 'churidhars-salwars', 'Graceful everyday and occasion wear.', 3),
  ('Handcrafted', 'handcrafted', 'Artful pieces for thoughtful homes.', 4)
on conflict (slug) do nothing;

insert into public.subcategories (category_id, name, slug, sort_order)
select id, item.name, item.slug, item.sort_order
from public.categories
join (values
  ('sarees', 'Silk Sarees', 'silk-sarees', 1),
  ('sarees', 'Cotton Sarees', 'cotton-sarees', 2),
  ('sarees', 'Synthetic Sarees', 'synthetic-sarees', 3),
  ('jewelry', 'Bangles', 'bangles', 1),
  ('jewelry', 'Earrings', 'earrings', 2),
  ('jewelry', 'Necklace', 'necklace', 3),
  ('handcrafted', 'Carved Wooden Items', 'carved-wooden-items', 1),
  ('handcrafted', 'Brass / Metal Idols', 'brass-metal-idols', 2)
) as item(category_slug, name, slug, sort_order) on categories.slug = item.category_slug
on conflict (slug) do nothing;

insert into public.collections (name, slug, description) values
  ('Kanchipuram Silk', 'kanchipuram-silk', 'Heritage silk with luminous zari work.'),
  ('Banarasi Silk', 'banarasi-silk', 'Rich woven traditions for celebrations.'),
  ('Soft Silk', 'soft-silk', 'Lightweight grace with a luxurious finish.'),
  ('Tussar Silk', 'tussar-silk', 'Natural texture and understated elegance.'),
  ('Cotton Weaves', 'cotton-weaves', 'Comfortable handwoven beauty.')
on conflict (slug) do nothing;
