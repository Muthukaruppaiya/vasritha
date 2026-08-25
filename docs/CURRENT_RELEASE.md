# Vasritha — current release (what works now)

This note matches the stakeholder discussion. It lists what is **live in the current database and app**, and what is **held for a later sprint**.

Date: 25 August 2026

---

## In this release (can use now)

### Catalogue
- Unique product identity: SKU, family barcode, and unique piece barcodes (tags).
- Every product is linked to a **parent category**.
- Optional **subcategory** (child of that category).
- Extra filters: colour, description, featured flag, status.
- Admin: Categories → add children under a parent; Products → pick category then subcategory; Inventory follows the same path.

### Storefront listing rule
- Open `/sarees` (or any parent): **all products in that category**.
- If subcategories exist, chips appear (All, Silk, Cotton, …).
- Open `/sarees/silk-sarees`: **only that subcategory**.
- If a category has **no children**, the page shows **all products** under that parent (no child chips).

### Inventory
- Stock is received with **GRN (Inward stock)**.
- Adjustments and movement history exist.
- Inventory table and inward SKU lists show **category / subcategory**.

### Payments
- **Online:** UPI, card, net banking (Razorpay).
- **In-store:** cash, plus Razorpay for UPI / card / net banking.
- SMS charging is **not** enabled.

### Customers
- Name, email, and phone for online and in-store.
- Email is unique on the account.
- Admin customer list and order screens show contact details.
- Invoice history: store invoices, online invoices, customer order history.

### Brand and site
- Mocha brown header, gold offer ticker, gold VR lockup logo.
- Languages: English, Tamil, Malayalam, Kannada, Hindi, Punjabi, Gujarati.
- Predefined category names auto-translate; custom names need admin translations or a predefined pick.

### Admin operations
- Roles and permissions (admin, managers, inventory, POS, etc.).
- Reviews: customer submits → admin approves → shown on the site.
- One brand in Settings (company, logos, WhatsApp number).
- WhatsApp chat (when enabled) and email sending (when enabled).
- Coupons and gift vouchers: Admin → Gift vouchers. A voucher with **Show when website opens** appears as a popup on first visit this session. The shopper can **Use this voucher** (saved to checkout) or **Close and continue**. Discount applies at payment.

---

## Not in this release (later sprint)

Do **not** expect these yet. They were agreed as post-release or on hold.

| Topic | Why later |
| --- | --- |
| Stronger security + scalable database | Separate sprint after go-live |
| Delivery fee rules (weight / pincode / slabs) | Only a shipping amount field exists |
| Live shipment tracking (carrier AWB status) | Courier label print exists; no carrier API |
| Cash denomination till + daily cash reconcile | Cash payment exists; no note-count register |
| Strict customer merge (phone **or** email as one person) | Email unique; phone not a hard unique key |
| Customer-interest analytics / extra invoice drill-down reports | Invoice list exists; interest reports do not |
| Multiple brands in one admin | Single brand settings only |
| Loyalty points | Not built |
| Cart “add this at a reduced price” suggestions | Not built |
| SMS | On hold (cost per message) |

---

## How to use the new subcategory flow

1. Admin → **Categories** → on a parent card, **+ Add** a subcategory.
2. Admin → **Products** → set Category and Subcategory, then publish.
3. Website: parent URL shows everything; child URL shows only that child.
4. Admin → **Inventory** → filter by category and subcategory; GRN the same SKUs.

---

## Gift voucher opening notice

1. Run `npm run db:patch:gift-vouchers` once if the columns are not on `coupons` yet.
2. Admin → **Gift vouchers** → New gift voucher → set **Show when website opens** to Yes.
3. Open the storefront (not `/admin`). The notice appears until the visitor uses it or closes it for this browser tab session.
4. Only one voucher can be the opening notice at a time.

---

## Out of scope reminder

Timeline stays on the **current Postgres schema**. A later sprint will harden security and scale. Do not treat this document as a promise of loyalty, multi-brand, SMS, or live tracking.
