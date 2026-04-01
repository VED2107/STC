import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const stitchPanelClass = "stitch-panel p-6 md:p-8";
export const stitchPanelSoftClass = "stitch-panel-soft p-5 md:p-6";
export const stitchButtonClass =
  "inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 hover:brightness-105";
export const stitchSecondaryButtonClass =
  "inline-flex items-center justify-center rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition hover:-translate-y-0.5 hover:brightness-105";
export const stitchInputClass = "stitch-input w-full";

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
}

export function StitchMetricCard({ label, value, change }: MetricCardProps) {
  return (
    <div className={cn(stitchPanelSoftClass, "space-y-4")}>
      <p className="stitch-kicker">{label}</p>
      <div className="flex items-end gap-2">
        <p className="font-heading text-4xl text-primary md:text-5xl">{value}</p>
        {change ? <span className="pb-2 text-xs text-[#9db7c5]">{change}</span> : null}
      </div>
      <div className="h-px bg-linear-to-r from-primary/70 via-primary/20 to-transparent" />
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}

export function StitchEmptyState({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: EmptyStateProps) {
  return (
    <div className={cn(stitchPanelClass, "flex flex-col items-center py-16 text-center")}>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <h2 className="text-3xl text-primary">{title}</h2>
      <p className="mt-3 max-w-md text-sm leading-7 text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className={cn(stitchButtonClass, "mt-8")}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function StitchSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <p className="stitch-kicker">{eyebrow}</p>
        <h1 className="mt-3 text-5xl leading-none text-primary md:text-7xl">{title}</h1>
        {description ? (
          <p className="mt-4 max-w-2xl text-base leading-8 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-3">{action}</div> : null}
    </div>
  );
}
