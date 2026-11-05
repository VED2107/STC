import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const stitchPanelClass = "stitch-panel p-5 md:p-6";
export const stitchPanelSoftClass = "stitch-panel-soft p-4";
const baseButton =
  "stitch-press inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-(--duration-fast)";
export const stitchButtonClass = cn(baseButton, "bg-primary text-primary-foreground hover:bg-primary/90");
export const stitchSecondaryButtonClass = cn(baseButton, "border border-input bg-card text-foreground hover:border-accent hover:bg-gold-50");
export const stitchOutlineButtonClass = stitchSecondaryButtonClass;
export const stitchAccentButtonClass = cn(baseButton, "bg-accent text-accent-foreground hover:bg-accent/85");
export const stitchInputClass = "stitch-input w-full";

/** The STC mark: an open book crossed by a nib, redrawn so it stays sharp at any size. */
export function StcMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth="3.2" strokeLinejoin="miter">
        <path d="M32 17C27 12 21 8.5 15 6v32l17 12 17-12V6c-6 2.5-12 6-17 11Z" />
        <path d="M15 13 7 16v27l25 16 25-16V16l-8-3" />
        <path d="M32 17v11M32 40v10" />
      </g>
      <path d="M50 12 12 60h6l36-44z" fill="currentColor" />
    </svg>
  );
}

export function StcWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <StcMark className={"size-8 shrink-0 text-secondary"} />
      <span className={"font-heading text-xl font-bold leading-none text-primary"}>
        STC Academy
      </span>
    </span>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  change?: string;
}

export function StitchMetricCard({ label, value, change }: MetricCardProps) {
  return (
    <div className="stitch-panel p-4 md:p-5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="tnum font-heading text-3xl font-semibold text-primary md:text-4xl">{value}</p>
        {change ? <span className="text-sm text-muted-foreground">{change}</span> : null}
      </div>
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

export function StitchEmptyState({ icon: Icon, title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <div className="stitch-panel flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-gold-100 text-primary">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="text-2xl text-primary">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className={cn(stitchButtonClass, "mt-6")}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

interface SectionHeaderProps {
  /** Accepted for existing call sites. The rail and breadcrumb already give this context. */
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function StitchSectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <h1 className="whitespace-pre-line text-3xl text-primary md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-3">{action}</div> : null}
    </div>
  );
}

/** Attendance as the register shows it: one mark per session, newest on the right. */
export function RollStrip({
  marks,
  className,
}: {
  marks: Array<{ id: string; date: string; status: string }>;
  className?: string;
}) {
  if (marks.length === 0) return null;
  const present = marks.filter((mark) => mark.status === "present").length;

  return (
    <div
      role="img"
      aria-label={`${present} present out of the last ${marks.length} recorded sessions`}
      className={cn("flex flex-wrap items-end gap-1", className)}
    >
      {[...marks].reverse().map((mark, index) => (
        <span
          key={mark.id}
          title={`${new Date(mark.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}: ${mark.status}`}
          style={{ "--i": index } as React.CSSProperties}
          className={cn("grow-y w-2 rounded-[1px]", mark.status === "present" ? "h-5 bg-success" : "h-2.5 bg-destructive")}
        />
      ))}
    </div>
  );
}

/** One panel of related numbers, instead of a row of look-alike cards. */
export function StatStrip({
  items,
  className,
}: {
  items: Array<{ label: string; value: string | number; tone?: "success" | "warning" | "destructive" }>;
  className?: string;
}) {
  const tones = { success: "text-success", warning: "text-warning", destructive: "text-destructive" };
  return (
    <dl className={cn("stitch-panel grid grid-cols-2 divide-border md:flex md:divide-x", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex-1 px-4 py-3 md:px-5">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className={cn("tnum mt-0.5 text-2xl font-bold text-primary", item.tone && tones[item.tone])}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
