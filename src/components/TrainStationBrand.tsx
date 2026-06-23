import { BRAND_NAME } from "@/lib/brand";

type Variant = "hero" | "compact" | "header";

const WORDMARK: Record<Variant, string> = {
  hero: "text-lg font-semibold tracking-[0.12em] text-white/95 sm:text-xl",
  compact: "text-base font-semibold tracking-[0.1em] text-white sm:text-lg",
  header: "text-sm font-semibold tracking-[0.08em] text-[#f2ecf9]",
};

export default function TrainStationBrand({
  variant = "hero",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  return (
    <p className={`${WORDMARK[variant]} ${className}`} aria-label={BRAND_NAME}>
      {BRAND_NAME}
    </p>
  );
}