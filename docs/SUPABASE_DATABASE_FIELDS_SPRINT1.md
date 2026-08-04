# Vasritha — Database Fields Reference (Sprint 1)

Detailed field-level schema for Supabase (E-commerce Website + Billing Software).  
Companion to the short table list: [`SUPABASE_DATABASE_STRUCTURE_SPRINT1.md`](./SUPABASE_DATABASE_STRUCTURE_SPRINT1.md)

---

## Enums

| Enum | Values |
|---|---|
| `admin_role` | `owner`, `admin`, `staff` |
| `product_status` | `draft`, `active`, `archived` |
| `stock_status` | `in_stock`, `limited`, `out_of_stock` |
| `order_status` | `new`, `confirmed`, `packed`, `shipped`, `delivered`, `cancelled` |
| `payment_status` | `pending`, `paid`, `failed`, `refunded` |
| `discount_type` | `percentage`, `fixed` |
| `coupon_status` | `active`, `inactive`, `expired` |
| `inventory_movement_type` | `sale`, `return`, `manual_adjustment`, `opening_stock` |
| `return_status` | `requested`, `approved`, `rejected`, `received`, `refunded` |
| `menu_link_type` | `category`, `collection`, `page`, `product`, `custom_url`, `label_only` |
| `section_type` | `hero_slider`, `status_stories`, `video_showcase`, `category_banners`, `collections`, `spotlight`, `reviews`, `rich_text`, `custom` |
| `section_item_type` | `product`, `category`, `collection`, `banner`, `custom` |
| `contact_status` | `new`, `read`, `closed` |

---

## 1. Organization & admin

### `companies`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | default `gen_random_uuid()` |
| name | text | required |
| legal_name | text | nullable |
| gstin | text | nullable (for later GST) |
| email | text | nullable |
| phone | text | nullable |
| address | text | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

### `brands`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | required |
| name | text | required |
| slug | text unique | required |
| logo_path | text | nullable |
| is_active | boolean | default true |
| created_at | timestamptz | |

### `sales_channels`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | required |
| name | text | Website / POS / WhatsApp / Manual |
| code | text unique | e.g. `web`, `pos`, `whatsapp`, `manual` |
| is_active | boolean | default true |
| created_at | timestamptz | |

### `roles`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| code | text unique | `owner`, `admin`, `staff` |
| name | text | required |
| created_at | timestamptz | |

### `user_roles`
| Field | Type | Notes |
|---|---|---|
| user_id | uuid FK → auth.users | PK part |
| role_id | uuid FK → roles | PK part |
| company_id | uuid FK → companies | required |
| created_at | timestamptz | |
| PK | (user_id, role_id, company_id) | |

---

## 2. Catalog

### `categories`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | required |
| name | text | required |
| slug | text unique | required |
| description | text | nullable |
| image_path | text | nullable |
| banner_path | text | nullable |
| sort_order | integer | default 0 |
| is_active | boolean | default true |
| show_in_menu | boolean | default true |
| seo_title | text | nullable |
| seo_description | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `subcategories`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| category_id | uuid FK → categories | cascade |
| name | text | required |
| slug | text unique | required |
| sort_order | integer | default 0 |
| is_active | boolean | default true |
| show_in_menu | boolean | default true |
| unique | (category_id, name) | |

### `collections`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | required |
| name | text | required |
| slug | text unique | required |
| description | text | nullable |
| image_path | text | nullable |
| sort_order | integer | default 0 |
| is_active | boolean | default true |
| show_in_menu | boolean | default false |
| created_at | timestamptz | |

### `products`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | required |
| brand_id | uuid FK → brands | nullable |
| category_id | uuid FK → categories | required |
| subcategory_id | uuid FK → subcategories | nullable |
| name | text | full name |
| short_name | text | card / listing name |
| slug | text unique | required |
| description | text | default `''` |
| status | product_status | default `draft` |
| stock_status | stock_status | default `in_stock` |
| base_price | numeric(12,2) | MRP |
| sale_price | numeric(12,2) | selling price; nullable |
| is_featured | boolean | default false |
| featured_order | integer | default 0 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `product_variants`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products | cascade |
| name | text | e.g. `2.6`, `Free Size` |
| sku | text unique | required |
| barcode | text unique | nullable |
| price | numeric(12,2) | required |
| sale_price | numeric(12,2) | nullable |
| stock_quantity | integer | default 0, >= 0 |
| stock_status | stock_status | default `in_stock` |
| is_active | boolean | default true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `product_images`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products | cascade |
| storage_path | text | required |
| alt_text | text | nullable |
| sort_order | integer | default 0 |
| is_primary | boolean | default false |

### `product_collections`
| Field | Type | Notes |
|---|---|---|
| product_id | uuid FK → products | cascade |
| collection_id | uuid FK → collections | cascade |
| PK | (product_id, collection_id) | |

### `attributes`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | required |
| name | text | Size / Color / Material |
| code | text unique | `size`, `color`, `material` |
| sort_order | integer | default 0 |
| is_active | boolean | default true |

### `attribute_values`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| attribute_id | uuid FK → attributes | cascade |
| value | text | e.g. `2.6`, `Red` |
| sort_order | integer | default 0 |
| is_active | boolean | default true |
| unique | (attribute_id, value) | |

### `variant_attributes`
| Field | Type | Notes |
|---|---|---|
| variant_id | uuid FK → product_variants | cascade |
| attribute_value_id | uuid FK → attribute_values | cascade |
| PK | (variant_id, attribute_value_id) | |

---

## 3. Customers & shopping

### `customers`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK = auth.users.id | |
| full_name | text | required |
| email | text | required |
| phone | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `customer_addresses`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK → customers | cascade |
| label | text | Home / Work |
| recipient_name | text | required |
| phone | text | required |
| line1 | text | required |
| line2 | text | nullable |
| city | text | required |
| state | text | required |
| postal_code | text | required |
| country | text | default `India` |
| is_default | boolean | default false |
| created_at | timestamptz | |

### `carts`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK → customers | nullable for guest later |
| sales_channel_id | uuid FK → sales_channels | |
| updated_at | timestamptz | |

### `cart_items`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| cart_id | uuid FK → carts | cascade |
| product_id | uuid FK → products | required |
| variant_id | uuid FK → product_variants | required |
| quantity | integer | > 0 |
| unique | (cart_id, variant_id) | |
| created_at | timestamptz | |

### `wishlists`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| customer_id | uuid FK → customers | cascade |
| name | text | default `Default` |
| created_at | timestamptz | |

### `wishlist_items`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| wishlist_id | uuid FK → wishlists | cascade |
| product_id | uuid FK → products | required |
| variant_id | uuid FK → product_variants | nullable |
| unique | (wishlist_id, product_id, variant_id) | |
| created_at | timestamptz | |

---

## 4. Orders, billing & payments

### `taxes`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | required |
| name | text | e.g. GST 5% |
| code | text | e.g. `GST5` |
| rate | numeric(5,2) | percent |
| is_inclusive | boolean | default false |
| is_active | boolean | default true |

### `payment_methods`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | required |
| name | text | UPI / Card / Cash / Netbanking |
| code | text unique | `upi`, `card`, `cash`, `netbanking` |
| provider | text | `razorpay`, `manual`, etc. |
| is_online | boolean | default true |
| is_active | boolean | default true |
| sort_order | integer | default 0 |

### `coupons`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | required |
| code | text unique | e.g. `WELCOME10` |
| description | text | nullable |
| discount_type | discount_type | percentage / fixed |
| discount_value | numeric(12,2) | required |
| min_order_amount | numeric(12,2) | default 0 |
| max_discount_amount | numeric(12,2) | nullable |
| usage_limit | integer | nullable |
| usage_limit_per_customer | integer | nullable |
| starts_at | timestamptz | nullable |
| ends_at | timestamptz | nullable |
| status | coupon_status | default `active` |
| created_at | timestamptz | |

### `coupon_usage`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| coupon_id | uuid FK → coupons | |
| customer_id | uuid FK → customers | |
| order_id | uuid FK → orders | |
| discount_amount | numeric(12,2) | |
| used_at | timestamptz | default now() |

### `orders`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_number | text unique | e.g. `VAS-1024` |
| customer_id | uuid FK → customers | required |
| sales_channel_id | uuid FK → sales_channels | required |
| status | order_status | default `new` |
| payment_status | payment_status | default `pending` |
| payment_method_id | uuid FK → payment_methods | nullable |
| coupon_id | uuid FK → coupons | nullable |
| subtotal | numeric(12,2) | >= 0 |
| discount_amount | numeric(12,2) | default 0 |
| tax_amount | numeric(12,2) | default 0 |
| shipping_amount | numeric(12,2) | default 0 |
| total_amount | numeric(12,2) | >= 0 |
| notes | text | nullable |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `order_items`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK → orders | cascade |
| product_id | uuid FK → products | nullable |
| variant_id | uuid FK → product_variants | nullable |
| product_name | text | snapshot |
| variant_name | text | snapshot |
| sku | text | snapshot |
| unit_price | numeric(12,2) | |
| tax_amount | numeric(12,2) | default 0 |
| quantity | integer | > 0 |
| line_total | numeric(12,2) | |

### `order_addresses`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_id | uuid unique FK → orders | one per order |
| recipient_name | text | required |
| phone | text | required |
| line1 | text | required |
| line2 | text | nullable |
| city | text | required |
| state | text | required |
| postal_code | text | required |
| country | text | default `India` |

### `payments`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK → orders | required |
| payment_method_id | uuid FK → payment_methods | nullable |
| provider | text | `razorpay` |
| provider_order_id | text | nullable |
| provider_payment_id | text unique | nullable |
| amount | numeric(12,2) | >= 0 |
| currency | text | default `INR` |
| status | payment_status | default `pending` |
| raw_response | jsonb | nullable |
| created_at | timestamptz | |

### `order_returns`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK → orders | required |
| return_number | text unique | |
| status | return_status | default `requested` |
| reason | text | nullable |
| refund_amount | numeric(12,2) | default 0 |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `return_items`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| return_id | uuid FK → order_returns | cascade |
| order_item_id | uuid FK → order_items | required |
| quantity | integer | > 0 |
| reason | text | nullable |

### `inventory_movements`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_variant_id | uuid FK → product_variants | required |
| type | inventory_movement_type | required |
| quantity | integer | signed or absolute + direction rule |
| reference_type | text | `order`, `return`, `manual`, `opening` |
| reference_id | uuid | nullable |
| note | text | nullable |
| created_by | uuid FK → auth.users | nullable |
| created_at | timestamptz | |

> Rule: website/billing sales create a `sale` movement; returns create `return`; admin stock edits create `manual_adjustment`.

---

## 5. Dynamic website / CMS

### `site_settings`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | usually 1 row |
| site_name | text | |
| tagline | text | |
| logo_path | text | |
| favicon_path | text | |
| support_email | text | |
| support_phone | text | |
| whatsapp_number | text | |
| currency | text | default `INR` |
| free_shipping_min | numeric(12,2) | nullable |
| social_links | jsonb | `{instagram, facebook, ...}` |
| seo_title | text | |
| seo_description | text | |
| updated_at | timestamptz | |

### `menus`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| company_id | uuid FK → companies | |
| code | text unique | `main_nav`, `mobile_drawer`, `footer_shop`, `footer_legal` |
| name | text | |
| is_active | boolean | default true |

### `menu_items`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| menu_id | uuid FK → menus | cascade |
| parent_id | uuid FK → menu_items | nullable submenu |
| label | text | required |
| link_type | menu_link_type | required |
| link_value | text | slug / id / url |
| icon | text | nullable |
| sort_order | integer | default 0 |
| is_active | boolean | default true |
| opens_in_new_tab | boolean | default false |

### `page_sections`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| page_slug | text | usually `home` |
| section_type | section_type | required |
| title | text | |
| subtitle | text | |
| eyebrow | text | |
| cta_label | text | |
| cta_link | text | |
| sort_order | integer | default 0 |
| is_active | boolean | default true |
| settings | jsonb | extra config |

### `section_items`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| section_id | uuid FK → page_sections | cascade |
| item_type | section_item_type | required |
| item_id | uuid | nullable linked entity |
| title | text | |
| subtitle | text | |
| image_path | text | |
| link_url | text | |
| sort_order | integer | default 0 |
| is_active | boolean | default true |

### `banners`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| title | text | |
| subtitle | text | |
| image_path | text | required |
| link_url | text | |
| placement | text | `home_hero`, `home_mid`, `category_top` |
| sort_order | integer | default 0 |
| is_active | boolean | default true |
| starts_at | timestamptz | nullable |
| ends_at | timestamptz | nullable |

### `website_pages`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| slug | text unique | `about`, `contact`, `privacy`, `terms` |
| title | text | required |
| body | text | markdown/html |
| seo_title | text | |
| seo_description | text | |
| is_published | boolean | default false |
| updated_at | timestamptz | |

### `reviews`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| product_id | uuid FK → products | nullable for store-wide |
| customer_id | uuid FK → customers | nullable |
| customer_name | text | required |
| rating | integer | 1–5 |
| body | text | required |
| is_featured | boolean | home marquee |
| is_approved | boolean | moderation |
| created_at | timestamptz | |

### `contact_messages`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text | required |
| email | text | required |
| phone | text | nullable |
| message | text | required |
| status | contact_status | default `new` |
| created_at | timestamptz | |

### `audit_logs`
| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| actor_user_id | uuid | auth user |
| action | text | create / update / delete |
| entity_type | text | product, order, menu_item… |
| entity_id | uuid | |
| before | jsonb | nullable |
| after | jsonb | nullable |
| created_at | timestamptz | |

---

## 6. Storage buckets

| Bucket | Purpose |
|---|---|
| `product-images` | Product gallery |
| `banners` | CMS / hero banners |
| `brand-assets` | Logo, favicon |

---

## 7. Suggested indexes

- `products(category_id)`, `products(slug)`, `products(is_featured, featured_order)`
- `product_variants(sku)`, `product_variants(barcode)`, `product_variants(product_id)`
- `orders(customer_id)`, `orders(order_number)`, `orders(status)`, `orders(sales_channel_id)`
- `payments(provider_payment_id)`, `payments(order_id)`
- `cart_items(cart_id)`, `wishlist_items(wishlist_id)`
- `inventory_movements(product_variant_id, created_at)`
- `menu_items(menu_id, sort_order)`
- `page_sections(page_slug, sort_order)`
- `coupons(code)`

---

## 8. RLS summary

| Role | Access |
|---|---|
| Public | Active catalog, menus, banners, published pages, active sections |
| Customer | Own profile, addresses, carts, wishlists, orders, payments |
| Admin / Staff | Full CRUD on catalog, CMS, orders, billing, inventory, customers |

---

**Document version:** Sprint 1 — Fields reference  
**Related:** short table list for client message → `SUPABASE_DATABASE_STRUCTURE_SPRINT1.md`
