"use client";

import { useParams } from "next/navigation";
import { OrderForm } from "@/components/order-form";

export default function EditOrderPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Edit order</h1>
      <div className="mt-6">
        <OrderForm orderId={id as string} />
      </div>
    </div>
  );
}
