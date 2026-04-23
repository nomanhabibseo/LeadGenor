import { countryFlagImageUrl } from "@/lib/flag-emoji";
import { countryShortLabel } from "@/lib/vendor-table-display";

type CountryItem = { country: { name?: string; code?: string } };

/**
 * Vendors / clients: first country only, ISO code once, circular flag (image) + label.
 */
export function CountryFlagsCell({ countries, titlePrefix = "" }: { countries: CountryItem[] | undefined; titlePrefix?: string }) {
  if (!countries?.length) {
    return <span className="text-slate-400">—</span>;
  }
  const c = countries[0]!;
  const code = (c.country.code ?? "").trim();
  const label = countryShortLabel(code || undefined);
  const flagUrl = countryFlagImageUrl(code);
  const rest = countries.length - 1;
  const t = [titlePrefix, c.country.name, code || undefined, rest > 0 ? `+${rest} more` : undefined].filter(Boolean).join(" · ");

  return (
    <div className="inline-flex max-w-full items-center justify-center gap-2" title={t || undefined}>
      {flagUrl ? (
        <span
          className="inline-flex h-5 w-5 shrink-0 overflow-hidden rounded-full border border-slate-200/90 bg-slate-100 shadow-sm ring-1 ring-slate-100/80 dark:border-slate-500/60 dark:bg-slate-700/80 dark:ring-slate-600/50"
          aria-hidden
        >
          <img src={flagUrl} alt="" className="h-full w-full object-cover" loading="lazy" width={20} height={20} />
        </span>
      ) : null}
      <span className="text-[10px] font-semibold tabular-nums text-slate-800 dark:text-slate-200">{label}</span>
    </div>
  );
}
