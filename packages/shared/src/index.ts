export type ProductStatus = "draft" | "active" | "archived";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "new"
  | "packed";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type AdminRole = "owner" | "admin" | "staff";

export type AppRole =
  | "super_admin"
  | "business_owner"
  | "manager"
  | "billing_staff"
  | "inventory_staff"
  | "packing_shipping_staff"
  | "customer_support_staff"
  | "accountant"
  | "customer";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface Subcategory extends Category {
  categoryId: string;
}

export interface Collection extends Category {}

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stockQuantity: number;
  attributes: Record<string, string>;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  subcategoryId?: string;
  collectionIds: string[];
  description: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  status: ProductStatus;
  stockQuantity: number;
  variants?: ProductVariant[];
}

export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
}

export interface AdminUser {
  userId: string;
  role: AdminRole;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantName?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  order: Order;
  issuedAt: string;
  taxAmount: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
}
