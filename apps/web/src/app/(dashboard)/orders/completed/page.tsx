"use client";

import { OrderTable } from "@/components/order-table";

export default function CompletedOrdersPage() {
  return <OrderTable scope="completed" title="Completed orders" />;
}
