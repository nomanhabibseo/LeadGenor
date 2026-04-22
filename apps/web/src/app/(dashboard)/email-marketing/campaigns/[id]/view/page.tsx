import { EmailCampaignViewPage } from "@/components/email-marketing/email-campaign-view-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmailCampaignViewPage campaignId={id} />;
}
