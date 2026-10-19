-- Canonical storefront taxonomy (matches admin Categories screen)

insert into public.categories (name, slug, description, sort_order) values
  ('Sarees', 'sarees', 'Timeless drapes for every occasion.', 1),
  ('Jewelry', 'jewelry', 'Finishing touches with enduring radiance.', 2),
  ('Suits / Churidhars / Salwars/Palazzo', 'churidhars-salwars', 'Graceful everyday and occasion wear.', 3),
  ('Lehengas', 'lehengas', 'Festive and bridal lehengas.', 4),
  ('Nighty', 'nighty', 'Nighty', 5),
  ('Handcrafted', 'handcrafted', 'Artful pieces for thoughtful homes.', 6)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- Optional shipping columns (applied when present via later patches)
do $$ begin
  update public.categories
  set shipping_is_free = true,
      shipping_charge = 0,
      shipping_rate_active = true
  where slug = 'lehengas';
exception when undefined_column then null;
end $$;

do $$ begin
  update public.categories set is_published = true;
exception when undefined_column then null;
end $$;

insert into public.subcategories (category_id, name, slug, sort_order)
select id, item.name, item.slug, item.sort_order
from public.categories
join (values
  -- Sarees
  ('sarees', 'Cotton Saree', 'sarees-cotton-saree', 1),
  ('sarees', 'Cotton Blend Saree', 'sarees-cotton-blend-saree', 2),
  ('sarees', 'Silk Saree', 'sarees-silk-saree', 3),
  ('sarees', 'Fancy Saree', 'sarees-fancy-saree', 4),
  ('sarees', 'Synthetic Saree', 'sarees-synthetic-saree', 5),
  ('sarees', 'Linen Saree', 'sarees-linen-saree', 6),
  ('sarees', 'Polyester Saree', 'sarees-polyester-saree', 7),
  ('sarees', 'Crepe Saree', 'sarees-crepe-saree', 8),
  ('sarees', 'Chiffon Saree', 'sarees-chiffon-saree', 9),
  ('sarees', 'Chanderi Saree', 'sarees-chanderi-saree', 10),
  ('sarees', 'Banarasi Silk Saree', 'sarees-banarasi-silk-saree', 11),
  ('sarees', 'Poly Tissue Saree', 'sarees-poly-tissue-saree', 12),
  ('sarees', 'Rayon Saree', 'sarees-rayon-saree', 13),
  ('sarees', 'Viscose Saree', 'sarees-viscose-saree', 14),
  ('sarees', 'Art Silk Saree', 'sarees-art-silk-saree', 15),
  ('sarees', 'Velvet Saree', 'sarees-velvet-saree', 16),
  ('sarees', 'Satin Saree', 'sarees-satin-saree', 17),
  -- Jewelry
  ('jewelry', 'Ear Rings', 'jewelry-ear-rings', 1),
  ('jewelry', 'Bracelets', 'jewelry-bracelets', 2),
  ('jewelry', 'Necklaces', 'jewelry-necklaces', 3),
  ('jewelry', 'Pendants', 'jewelry-pendants', 4),
  ('jewelry', 'Rings', 'jewelry-rings', 5),
  ('jewelry', 'Bangles', 'jewelry-bangles', 6),
  ('jewelry', 'Chains', 'jewelry-chains', 7),
  ('jewelry', 'Plain Chains', 'jewelry-plain-chains', 8),
  ('jewelry', 'Cable Chain', 'jewelry-cable-chain', 9),
  ('jewelry', 'Rope Chain', 'jewelry-rope-chain', 10),
  ('jewelry', 'Nose Pins', 'jewelry-nose-pins', 11),
  -- Suits / Churidhars / Salwars / Palazzo
  ('churidhars-salwars', 'Churidar', 'churidhars-salwars-churidar', 1),
  ('churidhars-salwars', 'Lucknowi Chickenkari', 'churidhars-salwars-lucknowi-chickenkari', 2),
  ('churidhars-salwars', 'Chanderi Silk', 'churidhars-salwars-chanderi-silk', 3),
  ('churidhars-salwars', 'Leggings', 'churidhars-salwars-leggings', 4),
  ('churidhars-salwars', 'Kurta', 'churidhars-salwars-kurta', 5),
  ('churidhars-salwars', 'Suit/Churidar - Unstitched Material', 'churidhars-salwars-suit-churidar-unstitched-material', 6),
  ('churidhars-salwars', 'Kurti', 'churidhars-salwars-kurti', 7),
  ('churidhars-salwars', 'Cotton Readymade sets', 'churidhars-salwars-cotton-readymade-sets', 8),
  ('churidhars-salwars', 'Co-ord Set', 'churidhars-salwars-co-ord-set', 9),
  -- Lehengas
  ('lehengas', 'Silk', 'lehengas-silk', 1),
  ('lehengas', 'Velvets', 'lehengas-velvets', 2),
  ('lehengas', 'Georgette', 'lehengas-georgette', 3),
  ('lehengas', 'Synthetic', 'lehengas-synthetic', 4),
  -- Nighty
  ('nighty', 'Pure Cotton', 'nighty-pure-cotton', 1),
  ('nighty', 'Cotton Blend', 'nighty-cotton-blend', 2),
  ('nighty', 'Rayon', 'nighty-rayon', 3),
  ('nighty', 'Satin', 'nighty-satin', 4),
  ('nighty', 'Maternity Nighty', 'nighty-maternity-nighty', 5)
) as item(category_slug, name, slug, sort_order)
  on categories.slug = item.category_slug
on conflict (slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  sort_order = excluded.sort_order;

insert into public.collections (name, slug, description) values
  ('Kanchipuram Silk', 'kanchipuram-silk', 'Heritage silk with luminous zari work.'),
  ('Banarasi Silk', 'banarasi-silk', 'Rich woven traditions for celebrations.'),
  ('Soft Silk', 'soft-silk', 'Lightweight grace with a luxurious finish.'),
  ('Tussar Silk', 'tussar-silk', 'Natural texture and understated elegance.'),
  ('Cotton Weaves', 'cotton-weaves', 'Comfortable handwoven beauty.')
on conflict (slug) do nothing;
