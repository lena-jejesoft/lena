import type { ChartData } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";

export interface ChartCoreStacked100Table {
  rows: Array<Record<string, string | number | null>>;
  xField: "x";
  yFields: string[];
  series: Array<{ id: string; name: string; color?: string }>;
}

/**
 * chartCore-src의 stacked-100(막대 100% 누적) 변환 로직을 최소 이식:
 * - 각 x 시점에서 모든 시리즈의 절대값 합계를 100으로 보고 퍼센트로 변환
 * - 원본 값은 `${field}_original`로 보존
 */
export function toChartCoreStacked100Table(data: ChartData): ChartCoreStacked100Table {
  const base = toChartCoreTable(data);
  const { rows, yFields } = base;

  const nextRows = rows.map((row) => {
    const next: Record<string, string | number | null> = { ...row };

    let total = 0;
    for (const f of yFields) {
      const v = next[f];
      if (typeof v === "number" && !Number.isNaN(v)) total += Math.abs(v);
    }

    for (const f of yFields) {
      const v = next[f];
      if (typeof v === "number" && !Number.isNaN(v)) {
        next[`${f}_original`] = v;
        next[f] = total > 0 ? (Math.abs(v) / total) * 100 : 0;
      }
    }

    return next;
  });

  return { ...base, rows: nextRows };
}

