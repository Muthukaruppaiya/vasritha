# Backend API — Full Sprint 1 Surface

Next.js Route Handlers + **local PostgreSQL** + JWT auth (+ Razorpay).  
Auth header: `Authorization: Bearer <access_token>`

> Local DB setup: [`LOCAL_POSTGRES.md`](./LOCAL_POSTGRES.md)

## Database (temporary local)

```env
DATABASE_URL=postgresql://vasritha:vasritha@127.0.0.1:5432/vasritha
USE_LOCAL_POSTGRES=true
JWT_SECRET=vasritha-local-dev-secret-change-me
```

Init:
```bash
npm run db:init
```

Schema: `db/local/schema.sql`  
(Not using Supabase Postgres for now.)

---

## 1. Auth
| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| POST | `/api/auth/forgot-password` | Public |
| GET | `/api/auth/me` | Auth |

## 2. Public storefront
| Method | Path |
|---|---|
| GET | `/api/health` |
| GET | `/api/storefront` (settings, menus, banners, sections, categories) |
| GET | `/api/categories` |
| GET | `/api/products` |
| GET/POST/PATCH | `/api/reviews` |
| POST | `/api/contact` |

## 3. Customer
| Method | Path | Permission |
|---|---|---|
| GET/PATCH | `/api/customer/profile` | profile:own |
| GET/POST | `/api/customer/addresses` | addresses:own |
| GET/POST/DELETE | `/api/customer/cart` | cart:own |
| GET/POST/DELETE | `/api/customer/wishlist` | wishlist:own |
| GET/POST | `/api/customer/orders` | orders:own / checkout:own |
| POST | `/api/customer/coupons/validate` | checkout:own |
| POST | `/api/payments/create` | checkout:own |
| POST | `/api/payments/verify` | checkout:own |

## 4. Admin — users & config
| Method | Path | Permission |
|---|---|---|
| GET/POST | `/api/admin/roles` | roles/users manage |
| GET | `/api/admin/dashboard` | dashboard:* |
| GET | `/api/admin/audit` | audit:read |
| GET/PATCH | `/api/admin/settings` | settings:business |
| GET/POST | `/api/admin/taxes` | settings:business |
| GET/POST | `/api/admin/payment-methods` | settings:business |

## 5. Admin — catalog
| Method | Path | Permission |
|---|---|---|
| GET/POST | `/api/admin/categories` | categories:manage |
| PATCH/DELETE | `/api/admin/categories/:id` | categories:manage |
| GET/POST | `/api/admin/collections` | categories:manage |
| GET/POST | `/api/admin/products` | products:read/manage |
| GET/PATCH/DELETE | `/api/admin/products/:id` | products |
| GET/POST | `/api/admin/products/:id/variants` | products |
| GET/POST | `/api/admin/products/:id/images` | products |

## 6. Admin — orders, stock, billing
| Method | Path | Permission |
|---|---|---|
| GET/PATCH | `/api/admin/orders` | orders view/manage/fulfill |
| GET/POST | `/api/admin/inventory` | stock:operate |
| GET | `/api/admin/customers` | customers search/support |
| GET/POST | `/api/admin/coupons` | pricing |
| GET/POST/PATCH | `/api/admin/returns` | returns / refunds |
| GET | `/api/contact` | customers:support (inbox) |

## 7. Admin — CMS
| Method | Path | Permission |
|---|---|---|
| GET/POST | `/api/admin/cms/menus` | cms:manage |
| GET/POST | `/api/admin/cms/banners` | cms:manage |
| GET/POST | `/api/admin/cms/pages` | cms:manage |
| GET/POST | `/api/admin/cms/sections` | cms:manage |

## Roles (top → bottom)
Super Admin → Business Owner → Manager → Billing Staff → Inventory Staff → Packing & Shipping → Customer Support → Accountant (optional) → Vasritha Customer

See `lib/auth/rbac.ts` for permission matrix.

## Typical flows
1. **Register/Login** → token  
2. **Browse** `/api/storefront` + `/api/products`  
3. **Add cart** → **create order** → **payments/create** → **payments/verify**  
4. **Admin** updates order status / inventory / CMS  

## Not built as separate Nest service
All backend runs inside **Next.js** (`apps/web/app/api`). Supabase is DB + Auth.
