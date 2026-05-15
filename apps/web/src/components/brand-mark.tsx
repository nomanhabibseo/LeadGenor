import Image from "next/image";
import { LOGO_PATH } from "@/lib/branding";
import { cn } from "@/lib/utils";

/** Per agent.md: prominent logo in header/sidebar — use `marketing` / `sidebar` / `auth` for sizing. */
const VARIANT = {
  marketing: {
    width: 800,
    height: 250,
    className:
      "h-[78px] w-auto max-h-[78px] max-w-[min(92vw,340px)] shrink-0 object-contain object-left [min-width:unset]",
  },
  sidebar: {
    width: 800,
    height: 250,
    className:
      "h-16 w-auto max-w-[260px] shrink-0 object-contain object-left [min-width:unset] md:max-w-[232px]",
  },
  auth: {
    width: 800,
    height: 250,
    className: "h-[72px] w-auto max-w-[300px] shrink-0 object-contain object-left [min-width:unset]",
  },
  compact: {
    width: 800,
    height: 250,
    className: "h-[52px] w-auto max-w-[220px] shrink-0 object-contain object-left [min-width:unset]",
  },
} as const;

export type BrandMarkVariant = keyof typeof VARIANT;

type Props = {
  variant?: BrandMarkVariant;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
};

export function BrandMark({ variant = "marketing", width, height, className, priority }: Props) {
  const v = VARIANT[variant];
  const w = width ?? v.width;
  const h = height ?? v.height;
  return (
    <Image
      src={LOGO_PATH}
      alt="LeadGenor"
      width={w}
      height={h}
      className={cn(v.className, className)}
      priority={priority}
      sizes="(max-width: 768px) 90vw, 340px"
      unoptimized
    />
  );
}
