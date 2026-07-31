"use client";

import { useRouter } from "next/navigation";
import { resolveBuyPath } from "../lib/customer-session";

export function BuyButton({
  productSlug,
  size,
  className,
  children = "Buy now"
}: {
  productSlug: string;
  size?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        router.push(resolveBuyPath(productSlug, size));
      }}
    >
      {children}
    </button>
  );
}
