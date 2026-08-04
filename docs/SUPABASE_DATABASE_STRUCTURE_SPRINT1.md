# Vasritha — DB Structure (Sprint 1)

> Detailed fields: [`SUPABASE_DATABASE_FIELDS_SPRINT1.md`](./SUPABASE_DATABASE_FIELDS_SPRINT1.md)  
> Backend APIs by role: [`BACKEND_API_ROLES.md`](./BACKEND_API_ROLES.md)

## Auth
- Supabase `auth.users` (Register / Login / Forgot password)

## Organization & admin
1. companies  
2. brands  
3. sales_channels  
4. roles  
5. user_roles  

## Catalog
6. categories  
7. subcategories  
8. collections  
9. products *(includes `is_featured`, `featured_order`)*  
10. product_variants *(SKU, barcode, price, sale price, stock)*  
11. product_images  
12. product_collections  
13. attributes  
14. attribute_values  
15. variant_attributes  

## Customers & shopping
16. customers  
17. customer_addresses  
18. carts  
19. cart_items  
20. wishlists  
21. wishlist_items  

## Orders, billing & payments
22. orders  
23. order_items  
24. order_addresses  
25. payments  
26. payment_methods  
27. taxes  
28. coupons  
29. coupon_usage  
30. order_returns  
31. return_items  
32. inventory_movements  

## Dynamic website / CMS
33. site_settings  
34. menus  
35. menu_items  
36. page_sections  
37. section_items  
38. banners  
39. website_pages  
40. reviews  
41. contact_messages  
42. audit_logs  

## Storage buckets
- product-images  
- banners  
- brand-assets  

## Notes
- Order status: New → Confirmed → Packed → Shipped → Delivered  
- Stock status: In Stock / Limited / Out of Stock  
- Inventory movements track Sale / Return / Manual Adjustment / Opening Stock  
- Categories, menus, banners, homepage sections are admin-managed (dynamic)  
- `sales_channels` supports Website, POS, WhatsApp, Manual Orders  
- Not in Sprint 1 core build: Suppliers, Purchases, full GST ledger, Warehouse, Shipping API, Accounting modules  

Thanks  
