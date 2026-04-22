import { EmailListDetailPage } from "@/components/email-marketing/email-list-detail-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmailListDetailPage listId={id} />;
}
