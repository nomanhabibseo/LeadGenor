import { EmailTemplateEditorPage } from "@/components/email-marketing/email-template-editor-page";

export default async function Page({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  return <EmailTemplateEditorPage templateId={templateId} />;
}
