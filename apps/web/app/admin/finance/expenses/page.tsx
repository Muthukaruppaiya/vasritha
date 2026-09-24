"use client";

import { FinancePaymentsPanel } from "../../../../components/admin/finance-payments-panel";

export default function FinanceExpensesPage() {
  return (
    <FinancePaymentsPanel
      direction="out"
      title="Shop expenses"
      description="Boutique operating costs: rent, salary, electricity, internet, transport, packaging, marketing, maintenance and other."
      categoryFilter={[
        "expense",
        "salary",
        "rent",
        "utilities",
        "logistics",
        "packaging",
        "marketing",
        "maintenance",
        "tax",
        "other"
      ]}
    />
  );
}
