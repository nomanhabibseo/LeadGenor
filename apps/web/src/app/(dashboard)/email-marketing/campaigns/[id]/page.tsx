import { EmailCampaignWizardPage } from "@/components/email-marketing/email-campaign-wizard-page";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmailCampaignWizardPage campaignId={id} />;
}
