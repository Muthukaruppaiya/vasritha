"use client";

import { FinancePaymentsPanel } from "../../../../components/admin/finance-payments-panel";

export default function FinanceOutgoingPage() {
  return (
    <FinancePaymentsPanel
      direction="out"
      title="Outgoing payments"
      description="Purchases, expenses, salary, rent, logistics, tax remittance and refunds. Update status as payments clear."
    />
  );
}
