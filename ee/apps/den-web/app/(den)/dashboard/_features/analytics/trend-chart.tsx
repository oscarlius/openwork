"use client";

import { useDenLocale, useDenT } from "../../../../_lib/i18n/client";
import { formatDenLocaleDate } from "../../../../_lib/i18n/den-format";
import { analyticsSurfaceClass } from "./analytics-layout";

export function formatWeekLabel(weekStart: string, locale: ReturnType<typeof useDenLocale> = "en"): string {
  const date = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return weekStart;
  return formatDenLocaleDate(locale, date, { month: "short", day: "numeric", timeZone: "UTC" });
}

export type BarSeries = {
  label: string;
  values: number[];
};

export function TrendChart({ title, subtitle, weeks, series, intervalLabel, isLoading = false }: {
  title: string;
  subtitle: string;
  weeks: { weekStart: string }[];
  series: BarSeries[];
  intervalLabel?: string;
  isLoading?: boolean;
}) {
  const t = useDenT();
  const locale = useDenLocale();
  const weekOfLabel = intervalLabel ?? t("denDashboard.chart.weekOf");
  const colorFor = (item: BarSeries) => item.label === "Failed" && item.values.some((value) => value > 0) ? "var(--ow-danger)" : "var(--dls-accent)";
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const hasData = series.some((s) => s.values.some((v) => v > 0));

  return (
    <figure className={`${analyticsSurfaceClass} p-5`} aria-label={title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-[#07192C]">{title}</h3>
          <p className="mt-0.5 text-[12px] text-[#637291]">{subtitle}</p>
        </div>
        {series.length > 1 ? (
          <div className="flex items-center gap-3">
            {series.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-[#637291]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(s) }} />
                {s.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative mt-6">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-px">
          {[0, 1, 2, 3].map((line) => <div key={line} className="border-t border-dashed border-[#edf0f5]" />)}
        </div>
        <div className="relative flex h-[168px] items-end gap-1.5" aria-hidden="true">
          {hasData ? weeks.map((week, i) => (
            <div key={week.weekStart || i} className="flex h-full flex-1 items-end justify-center gap-px">
              {series.map((s) => {
                const value = s.values[i] ?? 0;
                const height = value > 0 ? Math.max(2, (value / max) * 94) : 0;
                return (
                  <div
                    key={s.label}
                    title={t("denDashboard.chart.barTooltip", { interval: weekOfLabel, week: formatWeekLabel(week.weekStart, locale), series: s.label, value })}
                    className="w-full max-w-[24px] rounded-t-[4px] transition-[height]"
                    style={{
                      height: `${height}%`,
                      backgroundColor: value > 0 ? colorFor(s) : "var(--dls-hover)",
                    }}
                  />
                );
              })}
            </div>
          )) : null}
        </div>
        {!hasData ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span role="status" className="rounded-full bg-white/90 px-3 py-1 text-[12px] text-[#637291]">{isLoading ? t("denDashboard.chart.loading") : t("denDashboard.chart.empty")}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex justify-between text-[11px] text-[#637291]">
        <span>{weeks.length > 0 ? formatWeekLabel(weeks[0].weekStart, locale) : ""}</span>
        <span>{weeks.length > 0 ? formatWeekLabel(weeks[weeks.length - 1].weekStart, locale) : ""}</span>
      </div>
      <table className="sr-only"><caption>{title}</caption><thead><tr><th>{t("denDashboard.chart.dateColumn")}</th>{series.map((s) => <th key={s.label}>{s.label}</th>)}</tr></thead>
        <tbody>{weeks.map((week, i) => <tr key={week.weekStart}><th>{formatWeekLabel(week.weekStart, locale)}</th>{series.map((s) => <td key={s.label}>{s.values[i] ?? 0}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
}
