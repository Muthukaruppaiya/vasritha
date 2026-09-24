"use client";

import { FinancePaymentsPanel } from "../../../../components/admin/finance-payments-panel";

export default function FinanceIncomingPage() {
  return (
    <FinancePaymentsPanel
      direction="in"
      title="Sales & receipts"
      description="E-commerce and POS payments synced from paid orders, plus manual other income. Discounts and tax stay on the original invoice."
    />
  );
}
