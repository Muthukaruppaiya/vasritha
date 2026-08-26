import { createHmac } from "crypto";

/** Test verify is allowed only for demo payments created without Razorpay keys. */
export function isTestPaymentProvider(provider: string | null | undefined) {
  return provider === "razorpay_test";
}

export function verifyRazorpayHmac(input: {
  keySecret: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
  const expected = createHmac("sha256", input.keySecret).update(payload).digest("hex");
  return expected === input.razorpaySignature;
}
