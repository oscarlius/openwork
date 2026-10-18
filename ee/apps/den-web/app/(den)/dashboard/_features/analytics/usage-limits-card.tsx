"use client";

import type { InferenceUsageBucket } from "../../../_lib/inference-status";
import { useDenT } from "../../../../_lib/i18n/client";
import { analyticsSurfaceClass } from "./analytics-layout";

type InferenceWindowType = InferenceUsageBucket["windowType"];

const WINDOW_ORDER: InferenceWindowType[] = ["five_hour", "weekly", "monthly"];

function computeRemainingPercent(bucket: InferenceUsageBucket): number {
  if (bucket.limitAmount <= 0) return 0;
  const ratio = 1 - bucket.usedAmount / bucket.limitAmount;
  if (!Number.isFinite(ratio)) return 0;
  return Math.max(0, Math.min(100, ratio * 100));
}

export function UsageLimitsCard({ buckets }: { buckets: InferenceUsageBucket[] }) {
  const t = useDenT();
  const labelFor = (windowType: InferenceWindowType) =>
    windowType === "five_hour"
      ? t("denDashboard.usageLimits.fiveHour")
      : windowType === "weekly"
        ? t("denDashboard.usageLimits.weekly")
        : t("denDashboard.usageLimits.monthly");

  const formatResetLabel = (bucket: InferenceUsageBucket): string => {
    const reset = new Date(bucket.windowEndAt);
    if (Number.isNaN(reset.getTime())) return "—";
    if (bucket.windowType === "five_hour") {
      return t("denDashboard.usageLimits.resetsTime", {
        when: reset.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      });
    }
    return t("denDashboard.usageLimits.resetsDate", {
      when: reset.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    });
  };

  const ordered = WINDOW_ORDER
    .map((windowType) => buckets.find((bucket) => bucket.windowType === windowType))
    .filter((bucket): bucket is InferenceUsageBucket => Boolean(bucket));

  if (ordered.length === 0) return null;

  return <section aria-label={t("denDashboard.usageLimits.sectionAria")} className="grid gap-3">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-[#07192C]">{t("denDashboard.usageLimits.title")}</h2>
      <p className="text-xs text-[#637291]">{t("denDashboard.usageLimits.subtitle")}</p>
    </div>
    <div className="grid gap-3.5 sm:grid-cols-3">
      {ordered.map((bucket) => {
        const remaining = computeRemainingPercent(bucket);
        const windowLabel = labelFor(bucket.windowType);
        return <div key={bucket.windowType} className={`${analyticsSurfaceClass} p-5`}>
          <p className="text-xs font-medium text-[#637291]">{windowLabel}</p>
          <p className="mt-3 text-[26px] font-semibold tracking-tight text-[#07192C] tabular-nums">{remaining.toFixed(1)}% <span className="text-sm font-normal text-[#637291]">{t("denDashboard.usageLimits.leftSuffix")}</span></p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#edf0f5]" role="progressbar" aria-label={t("denDashboard.usageLimits.remainingAria", { window: windowLabel })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={remaining}>
            <div className={`h-full rounded-full transition-[width] ${remaining <= 10 ? "bg-[var(--ow-warning)]" : "bg-[var(--dls-accent)]"}`} style={{ width: `${remaining}%` }} />
          </div>
          <p className="mt-2.5 text-xs text-[#637291]">{formatResetLabel(bucket)}</p>
        </div>;
      })}
    </div>
  </section>;
}
