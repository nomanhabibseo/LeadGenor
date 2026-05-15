"use client";

import { useParams } from "next/navigation";
import { ClientForm } from "@/components/client-form";

export default function EditClientPage() {
  const { id } = useParams();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Edit client</h1>
      <div className="mt-6">
        <ClientForm clientId={id as string} />
      </div>
    </div>
  );
}
