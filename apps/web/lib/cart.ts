export type CartItem = {
  slug: string;
  size: string;
  quantity: number;
};

const CART_KEY = "vasritha_cart";
export const CART_EVENT = "vasritha:cart";

function emitCartChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CART_EVENT));
}

export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.slug && item?.size && item.quantity > 0);
  } catch {
    return [];
  }
}

function saveCart(items: CartItem[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  emitCartChange();
}

export function getCartCount() {
  return getCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

export function addToCart(slug: string, size: string, quantity = 1) {
  const items = getCartItems();
  const existing = items.find((item) => item.slug === slug && item.size === size);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ slug, size, quantity });
  }
  saveCart(items);
}

export function updateCartQuantity(slug: string, size: string, quantity: number) {
  const next = getCartItems()
    .map((item) =>
      item.slug === slug && item.size === size ? { ...item, quantity } : item
    )
    .filter((item) => item.quantity > 0);
  saveCart(next);
}

export function removeFromCart(slug: string, size: string) {
  saveCart(getCartItems().filter((item) => !(item.slug === slug && item.size === size)));
}

export function clearCart() {
  saveCart([]);
}

export function parsePrice(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}
