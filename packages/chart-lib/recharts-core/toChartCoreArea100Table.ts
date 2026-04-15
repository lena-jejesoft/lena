import type { ChartData } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";

export interface ChartCoreArea100Table {
  rows: Array<Record<string, string | number | null>>;
  xField: "x";
  yFields: string[];
  series: Array<{ id: string; name: string; color?: string }>;
}

type RowObj = Record<string, unknown>;

function extractNumericFields(rows: RowObj[]): string[] {
  if (rows.length === 0) return [];
  const excluded = new Set(["date", "date_display", "x", "y"]);
  const keys = Object.keys(rows[0]).filter((k) => !excluded.has(k));
  return keys.filter((k) => rows.some((r) => typeof r[k] === "number" && !Number.isNaN(r[k] as number)));
}

function pickLabel(row: RowObj, idx: number): string {
  const v = row["date_display"] ?? row["x"] ?? row["date"] ?? idx;
  return typeof v === "string" ? v : String(v);
}

/**
 * chartCore-src의 `area-100` 변환 로직을 최소 이식:
 * - 각 x 시점에서 모든 시리즈의 절대값 합계를 100으로 보고 퍼센트로 변환
 * - 원본 값은 `${field}_original`로 보존
 */
export function toChartCoreArea100Table(data: ChartData): ChartCoreArea100Table {
  // chartCore-style raw rows mode (ex: ChartLab sampleData passed through as `series[0].data`)
  if (data.series.length === 1) {
    const raw = (data.series[0]?.data ?? []) as unknown[];
    const first = raw[0] as any;
    const looksLikeRowMode =
      Boolean(first) &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      // Not a normal point array ({x,y})
      !(("x" in first) && ("y" in first));

    if (looksLikeRowMode) {
      const rowsRaw = raw.filter((r): r is RowObj => Boolean(r) && typeof r === "object" && !Array.isArray(r));
      const yFields = extractNumericFields(rowsRaw);
      const series = yFields.map((f) => ({ id: f, name: f }));

      const rows: Array<Record<string, string | number | null>> = rowsRaw.map((r, idx) => {
        const label = pickLabel(r, idx);
        const out: Record<string, string | number | null> = {
          x: label,
          date: typeof r.date === "string" ? r.date : null,
          date_display: typeof r.date_display === "string" ? r.date_display : null,
        };
        for (const f of yFields) {
          const v = r[f];
          out[f] = typeof v === "number" && !Number.isNaN(v) ? v : null;
        }
        return out;
      });

      // Sort by ISO-ish date if present so Q1..Q4 stays in order
      rows.sort((a, b) => {
        const da = typeof a.date === "string" ? Date.parse(a.date) : NaN;
        const db = typeof b.date === "string" ? Date.parse(b.date) : NaN;
        if (Number.isFinite(da) && Number.isFinite(db)) return da - db;
        return 0;
      });

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

      return { rows: nextRows, xField: "x", yFields, series };
    }
  }

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
