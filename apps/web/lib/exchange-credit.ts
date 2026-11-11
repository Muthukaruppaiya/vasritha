import { queryOne } from "./db/pool";

/**
 * Split a bill's discount into cashier discount vs exchange credit.
 * Older exchange bills only stored the combined discount_amount — recover the
 * credit part from the exchange return notes.
 */
export async function resolveBillDiscountSplit(order: {
  order_number: string;
  discount_amount: unknown;
  cashier_discount_amount?: unknown;
  exchange_credit_amount?: unknown;
}) {
  let cashierDiscount = Number(order.cashier_discount_amount || 0);
  let exchangeCredit = Number(order.exchange_credit_amount || 0);
  const combinedDiscount = Number(order.discount_amount || 0);
  if (exchangeCredit <= 0 && cashierDiscount <= 0 && combinedDiscount > 0) {
    const exchangeNote = await queryOne<{ admin_notes: string | null }>(
      `select admin_notes
       from order_returns
       where request_type = 'exchange'
         and (
           reason ilike '%' || $1 || '%'
           or admin_notes ilike '%' || $1 || '%'
         )
       order by created_at desc
       limit 1`,
      [order.order_number]
    ).catch(() => null);
    const match = String(exchangeNote?.admin_notes || "").match(
      /Return credit\s*₹?\s*([0-9]+(?:\.[0-9]+)?)/i
    );
    if (match) {
      exchangeCredit = Math.min(combinedDiscount, Number(match[1]));
      cashierDiscount = Math.round((combinedDiscount - exchangeCredit) * 100) / 100;
    } else {
      cashierDiscount = combinedDiscount;
    }
  }
  return { cashierDiscount, exchangeCredit };
}
