# Inventory, inward stock & store POS — user guide

> **Word document:** [`INVENTORY_AND_POS_GUIDE.docx`](./INVENTORY_AND_POS_GUIDE.docx) — regenerate with `python scripts/generate-inventory-pos-guide-docx.py`

Simple step-by-step instructions for shop staff and managers using the **Sukadhaa / Vasritha admin** (operations panel).

**Sign in:** open your admin URL (e.g. `/admin/login`) and use your staff email and password.

---

## Before you start

Complete these once (or when adding a new product):

| Step | Where | What to do |
| --- | --- | --- |
| 1 | **Catalogue → Categories** | Create the category (and subcategory if needed), e.g. Sarees → Cotton sarees |
| 2 | **Catalogue → Product Master** | Create the product: name, price, category, status **Active** |
| 3 | **System → Shops** | Ensure at least one shop is **active** (required for store billing) |

**Remember:** Product details are edited in **Product Master**. Stock quantities are changed only in **Inventory** (receive, adjust) or when a sale happens in **POS / online**.

---

## End-to-end flow (quick view)

```
Categories  →  Product Master  →  Inventory (receive stock)  →  Print barcodes  →  Store POS (bill)
```

1. **Create** the product in Product Master.  
2. **Receive** stock when goods arrive (GRN / inward).  
3. **Print** barcode stickers for each unique piece (from Product Master).  
4. **Bill** the customer in Store POS (scan barcode or search by name/SKU).

---

## 1. Inventory flow (view & check stock)

**Menu:** **Catalogue → Inventory** (`/admin/inventory`)

Use this page to see how much stock you have and what moved recently.

### What you see

- **Summary cards** — total SKUs, total pieces on hand, in stock / low / out of stock  
- **Current stock table** — each product variant with **On hand** count and level badge  
- **Stock ledger** — recent movements (inward, sale, adjustment, etc.)

### Stock level badges

| Badge | Meaning |
| --- | --- |
| **In stock** | Enough quantity available |
| **Low stock** | On hand is **10 or less** (system default) |
| **Out of stock** | Zero pieces available |

### Filters

- **Search** — product name, SKU, HSN, category  
- **Stock level** — All / In stock / Low stock / Out of stock  
- **Category / Subcategory** — narrow the list  

### Row actions

| Button | Use when |
| --- | --- |
| **Receive** | New stock arrived — opens the inward (GRN) form for that variant |
| **Adjust** | Correction only (count mistake, damage, return to shelf) — not for new purchases |
| **Edit** | Opens **Product Master** to change product details (not quantity) |

### From Product Master

On a product row, click **Stock** — you are taken to Inventory filtered for that product.

---

## 2. Inward flow (receive stock / GRN)

**When to use:** Goods arrive from a supplier, warehouse, or production. This **adds** stock and creates **unique barcode tags** for each piece.

**Where:** **Catalogue → Inventory** → **Receive stock** (top button) or **Receive** on a row.

### Step-by-step

1. Open **Receive stock (GRN)**.  
2. *(Optional)* Fill **Supplier**, **Bill / invoice no.**, and **Note**.  
3. Under **Lines**:  
   - Choose **SKU / variant** (product must already exist in Product Master).  
   - Enter **Quantity** (number of unique pieces received).  
   - Use **+ Add line** if one GRN covers multiple SKUs.  
4. Click **Post inward**.  
5. Wait for success — the stock table and ledger update with **Inward / purchase**.

### After inward

1. Go to **Product Master** → open the product → use **Barcode / print** actions to print stickers for the new pieces.  
2. Stick labels on each physical item before putting them on the floor or shelf.  
3. Confirm **On hand** on Inventory matches what you received.

### Opening stock (new product only)

When **creating** a product in Product Master, you may set **Opening stock (unique pieces)** once for the first batch.  
After the product is saved, **do not** change quantity on the product form — use **Inventory → Receive stock** for all future inward.

### Adjust stock (not inward)

Use **Adjust stock** only for corrections:

| Type | Use for |
| --- | --- |
| **Opening stock (+)** | Rare one-time correction |
| **Customer / supplier return (+)** | Item came back to sellable stock |
| **Manual correction (+/−)** | Stock count, damage write-off, etc. |

Always add a **Note / reason** (required for audits).  
**Prefer Receive (GRN)** for all normal purchases from suppliers.

---

## 3. Store POS billing flow

**Menu:** **Sales → Store POS** (`/admin/billing`)

Use this to bill walk-in customers at the shop counter.

### Before billing

- Shop selected in the **Shop** dropdown (top of page).  
- Products are **Active** and have **stock > 0**.  
- Barcode stickers are printed and on the items (recommended).

### Step-by-step sale

#### A. Add items to cart

1. Click in **Scan barcode or search name / SKU**.  
2. **Scan** a piece barcode **or** type product name / family SKU and press **Enter** or **Add**.  
3. If several products match, pick the correct one from the list.  
4. Repeat for each item.  
   - Scanning a **unique piece barcode** adds exactly **one** piece (quantity cannot go above 1 for that tag).  
   - Searching by **family SKU** may allow quantity **+ / −** up to available stock.

#### B. Customer details (required)

| Field | Required? |
| --- | --- |
| **Name** | Yes |
| **Mobile** | Yes (10-digit Indian mobile) |
| **Email** | No |

#### C. Discount (optional)

- Choose **% Off** or **₹ Off**, then enter the discount amount.  
- Check **Payable** total before payment.

#### D. Payment

| Method | Action |
| --- | --- |
| **Cash** | Click **Collect ₹…** — bill is paid immediately |
| **Razorpay** | Click **Pay ₹… with Razorpay** — customer completes UPI/card on the Razorpay screen |

On success, a **bill preview** opens.

#### E. Print & finish

1. Click **Print bill** (5″ thermal-style shop bill).  
2. Click **Close** to start the next sale, or **New sale** in the header to clear the cart.

Stock is reduced automatically when payment is **paid**. Each sold unique piece is marked so it cannot be sold again.

### Reprint a past bill

**Menu:** **Invoice → Store Invoice** (`/admin/invoices/store`)

- Search by invoice number, customer name, phone, or email.  
- Open a **paid** POS bill and print again.

### If Razorpay is cancelled

The order stays **pending**. You can retry Razorpay or switch to **Cash** for the same cart (follow on-screen message).

---

## Who can do what (summary)

| Task | Typical roles |
| --- | --- |
| View inventory | Inventory staff, manager, owner |
| Receive stock (GRN) | Inventory staff, manager, owner |
| Adjust stock (manual) | Manager, owner (needs approval permission) |
| Store POS billing | Billing staff, manager, owner |
| Manage products | Manager, owner |

If a menu or button is missing, ask your admin to check **System → Users** and role permissions.

---

## Common issues

| Problem | What to check |
| --- | --- |
| Product not found in POS | Product status **Active**? Stock **> 0**? Inward posted? |
| Barcode scan not working | Scan the **piece tag** (e.g. `VAS-…-0001`), not only the family code |
| “No active shop” | **System → Shops** — add or activate a shop |
| Stock wrong after sale | Check **Inventory → Stock ledger** for **Sale out** lines |
| Need more stock | **Inventory → Receive stock**, not Product Master edit |

---

## Daily checklist (shop floor)

- [ ] Receive inward (GRN) when new cartons arrive  
- [ ] Print and attach barcodes before display  
- [ ] Bill in **Store POS** with customer name + mobile  
- [ ] Glance at **Low stock** filter on Inventory before closing  

---

*Last updated for the current Vasritha release. For technical setup (database, Vercel), see `docs/CURRENT_RELEASE.md` and `docs/LOCAL_POSTGRES.md`.*
