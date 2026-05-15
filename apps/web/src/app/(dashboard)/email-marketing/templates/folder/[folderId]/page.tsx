import { EmailTemplateFolderPage } from "@/components/email-marketing/email-template-folder-page";

export default async function Page({ params }: { params: Promise<{ folderId: string }> }) {
  const { folderId } = await params;
  return <EmailTemplateFolderPage folderId={folderId} />;
}
