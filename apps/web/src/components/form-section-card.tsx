export function FormSectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-section-card">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <span className="h-4 w-1 shrink-0 rounded-full bg-brand-600" aria-hidden />
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
