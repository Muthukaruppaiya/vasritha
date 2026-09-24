export const REPORT_CATALOG = [
  {
    type: "sales",
    label: "Sales report",
    description: "Invoice-level sales with tax, discount, payments and status.",
    group: "Sales"
  },
  {
    type: "orders",
    label: "Order report",
    description: "Order register with payment and fulfilment status.",
    group: "Sales"
  },
  {
    type: "product_sales",
    label: "Product sales",
    description: "Quantity sold, discounts, returns and net sales by product.",
    group: "Sales"
  },
  {
    type: "category_sales",
    label: "Category sales",
    description: "Sales performance rolled up by product category.",
    group: "Sales"
  },
  {
    type: "payments",
    label: "Payment report",
    description: "Collections by cash / UPI / card / online with refunds.",
    group: "Sales"
  },
  {
    type: "customers",
    label: "Customer report",
    description: "Orders, purchase value, paid, outstanding and refunds per customer.",
    group: "People"
  },
  {
    type: "customer_outstanding",
    label: "Customer outstanding",
    description: "Open invoices with due / overdue ageing (Finance AR).",
    group: "People",
    reuseHref: "/admin/finance/receivables"
  },
  {
    type: "purchases",
    label: "Purchase report",
    description: "GRN purchases with supplier, products, paid and outstanding.",
    group: "Purchases"
  },
  {
    type: "suppliers",
    label: "Supplier report",
    description: "Purchase value, paid and outstanding by supplier.",
    group: "Purchases"
  },
  {
    type: "supplier_outstanding",
    label: "Supplier outstanding",
    description: "Open supplier bills (Finance AP).",
    group: "Purchases",
    reuseHref: "/admin/finance/payables"
  },
  {
    type: "expenses",
    label: "Expense report",
    description: "Shop expenses with category-wise totals.",
    group: "Finance"
  },
  {
    type: "profit",
    label: "Profit report",
    description: "Sales, discounts, returns, purchases, expenses and net profit.",
    group: "Finance",
    reuseHref: "/admin/finance/pnl"
  },
  {
    type: "inventory",
    label: "Inventory report",
    description: "Current stock, value at selling price, low / out of stock.",
    group: "Catalogue"
  },
  {
    type: "returns",
    label: "Returns / refunds",
    description: "Return lines with quantity, amounts, reason and status.",
    group: "Sales"
  }
] as const;

export type ReportType = (typeof REPORT_CATALOG)[number]["type"];

export function getReportMeta(type: string) {
  return REPORT_CATALOG.find((r) => r.type === type) || null;
}
