"use client";

import { OrderTable } from "@/components/order-table";

export default function PendingOrdersPage() {
  return <OrderTable scope="pending" title="Pending orders" />;
}
