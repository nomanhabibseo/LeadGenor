import Image from "next/image";
import { LOGO_PATH } from "@/lib/branding";
import { cn } from "@/lib/utils";

/** Per agent.md: prominent logo in header/sidebar — use `marketing` / `sidebar` / `auth` for sizing. */
const VARIANT = {
  marketing: {
    width: 300,
    height: 78,
    className: "h-[78px] w-auto max-w-[min(92vw,340px)] min-w-[200px]",
  },
  sidebar: {
    width: 248,
    height: 64,
    className: "h-16 w-auto max-w-[260px] min-w-[180px]",
  },
  auth: {
    width: 280,
    height: 72,
    className: "h-[72px] w-auto max-w-[300px]",
  },
  compact: {
    width: 200,
    height: 52,
    className: "h-[52px] w-auto max-w-[220px]",
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
    />
  );
}
