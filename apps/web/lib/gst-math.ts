export type GstMoneySplit = {
  taxable: number;
  gst: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Split GST-inclusive amount into taxable + tax (half CGST/SGST for intra-state). */
export function splitInclusiveGst(amountInclusive: number, ratePercent: number): GstMoneySplit {
  const amount = Math.max(0, Number(amountInclusive) || 0);
  const rate = Math.max(0, Number(ratePercent) || 0);
  if (rate <= 0 || amount <= 0) {
    return { taxable: round2(amount), gst: 0, cgst: 0, sgst: 0, igst: 0 };
  }
  const taxable = round2(amount / (1 + rate / 100));
  const gst = round2(amount - taxable);
  const half = round2(gst / 2);
  return { taxable, gst, cgst: half, sgst: round2(gst - half), igst: 0 };
}
