"use client";

import { useParams } from "next/navigation";
import { VendorForm } from "@/components/vendor-form";

export default function EditVendorPage() {
  const params = useParams();
  const id = params.id as string;
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Edit vendor</h1>
      <div className="mt-6">
        <VendorForm vendorId={id} />
      </div>
    </div>
  );
}
