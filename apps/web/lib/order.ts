import { CartItem, clearCart, formatPrice, getCartItems, parsePrice } from "./cart";
import { getCustomerSession } from "./customer-session";
import { products } from "./mock-data";

export type OrderLine = {
  slug: string;
  name: string;
  type: string;
  size: string;
  quantity: number;
  price: string;
  compareAtPrice?: string;
  imageSrc: string;
  lineTotal: number;
};

export type PlacedOrder = {
  id: string;
  createdAt: string;
  paymentMethod: string;
  paymentStatus: "paid";
  total: number;
  savings: number;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  items: OrderLine[];
};

const PENDING_KEY = "vasritha_pending_order";
const LAST_ORDER_KEY = "vasritha_last_order";

export type PendingOrder = {
  fromCart: boolean;
  items: Array<{ slug: string; size: string; quantity: number }>;
};

export function buildOrderLines(items: Array<{ slug: string; size: string; quantity: number }>): OrderLine[] {
  return items
    .map((item) => {
      const product = products.find((entry) => entry.slug === item.slug);
      if (!product) return null;
      return {
        slug: product.slug,
        name: product.name,
        type: product.type,
        size: item.size,
        quantity: item.quantity,
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        imageSrc: product.imageSrc,
        lineTotal: parsePrice(product.price) * item.quantity
      };
    })
    .filter(Boolean) as OrderLine[];
}

export function savePendingOrder(pending: PendingOrder) {
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function getPendingOrder(): PendingOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingOrder;
  } catch {
    return null;
  }
}

export function clearPendingOrder() {
  window.localStorage.removeItem(PENDING_KEY);
}

export function createPendingFromCheckout(params: {
  fromCart: boolean;
  productSlug?: string;
  size?: string;
}) {
  if (params.fromCart) {
    const cart = getCartItems();
    savePendingOrder({
      fromCart: true,
      items: cart.map((item: CartItem) => ({
        slug: item.slug,
        size: item.size,
        quantity: item.quantity
      }))
    });
    return;
  }

  const product = products.find((item) => item.slug === params.productSlug) ?? products[0];
  savePendingOrder({
    fromCart: false,
    items: [
      {
        slug: product.slug,
        size: params.size || product.sizes[0] || "One Size",
        quantity: 1
      }
    ]
  });
}

export function placeOrder(paymentMethod: string): PlacedOrder | null {
  const pending = getPendingOrder();
  const session = getCustomerSession();
  if (!pending?.items?.length || !session) return null;

  const items = buildOrderLines(pending.items);
  if (!items.length) return null;

  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const compareTotal = items.reduce(
    (sum, item) => sum + parsePrice(item.compareAtPrice || "0") * item.quantity,
    0
  );

  const order: PlacedOrder = {
    id: `VAS-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
    paymentMethod,
    paymentStatus: "paid",
    total,
    savings: Math.max(0, compareTotal - total),
    customer: {
      name: session.name,
      email: session.email,
      phone: session.phone
    },
    address: { ...session.address },
    items
  };

  window.localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
  clearPendingOrder();
  if (pending.fromCart) clearCart();
  return order;
}

export function getLastOrder(): PlacedOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_ORDER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlacedOrder;
  } catch {
    return null;
  }
}

export function getOrderById(orderId: string): PlacedOrder | null {
  const order = getLastOrder();
  if (!order || order.id !== orderId) return null;
  return order;
}

export { formatPrice };
