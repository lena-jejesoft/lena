import type { ChartData, CartesianPoint, ChartSeries, PointType, XAxisType, ChartType } from "../types";

export interface ChartCoreTable {
  rows: Array<Record<string, string | number | null>>;
  xField: "x";
  yFields: string[];
  series: Array<{ id: string; name: string; color?: string; yAxisId?: string; chartType?: ChartType }>;
}

type RowObj = Record<string, unknown>;

function isCartesianPoint(p: PointType): p is CartesianPoint {
  return typeof (p as CartesianPoint).y === "number" && "x" in (p as CartesianPoint);
}

function looksLikeRowMode(series: ChartSeries<PointType>[]): boolean {
  if (series.length !== 1) return false;
  const raw = (series[0]?.data ?? []) as unknown[];
  const first = raw[0] as any;
  if (!first || typeof first !== "object" || Array.isArray(first)) return false;
  // Row mode is an object with multiple numeric columns; point mode is {x,y}.
  if ("x" in first && "y" in first) return false;
  return true;
}

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

function xKey(x: string | number): string {
  return typeof x === "number" ? `n:${x}` : `s:${x}`;
}

function sortRowsByX(rows: Array<Record<string, string | number | null>>, xAxisType: XAxisType) {
  if (xAxisType === "category") return rows;

  // datetime/numeric should sort by numeric X when possible.
  return [...rows].sort((a, b) => {
    const ax = a.x;
    const bx = b.x;
    const an = typeof ax === "number" ? ax : Number(ax);
    const bn = typeof bx === "number" ? bx : Number(bx);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return String(ax).localeCompare(String(bx));
  });
}

export function toChartCoreTable(data: ChartData): ChartCoreTable {
  // chartCore-style raw rows (ex: ChartLab sampleData passed through as `series[0].data`)
  if (looksLikeRowMode(data.series as ChartSeries<PointType>[])) {
    const raw = (data.series[0]?.data ?? []) as unknown[];
    const rowsRaw = raw.filter((r): r is RowObj => Boolean(r) && typeof r === "object" && !Array.isArray(r));
    const yFields = extractNumericFields(rowsRaw);

    const rows: Array<Record<string, string | number | null>> = rowsRaw.map((r, idx) => {
      const label = pickLabel(r, idx);
      const out: Record<string, string | number | null> = {
        x: label,
      };
      for (const f of yFields) {
        const v = r[f];
        out[f] = typeof v === "number" && !Number.isNaN(v) ? v : null;
      }
      return out;
    });

    // Sort by parsed `date` if present to keep chronological order.
    rows.sort((a, b) => {
      const ra = rowsRaw.find((rr, i) => pickLabel(rr, i) === a.x);
      const rb = rowsRaw.find((rr, i) => pickLabel(rr, i) === b.x);
      const da = ra && typeof (ra as any).date === "string" ? Date.parse(String((ra as any).date)) : NaN;
      const db = rb && typeof (rb as any).date === "string" ? Date.parse(String((rb as any).date)) : NaN;
      if (Number.isFinite(da) && Number.isFinite(db)) return da - db;
      return 0;
    });

    return {
      rows,
      xField: "x",
      yFields,
      series: yFields.map((f) => ({ id: f, name: f })),
    };
  }

  const yFields = data.series.map((s) => s.id);
  const series = data.series.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    yAxisId: s.yAxisId,
    chartType: s.chartType,
  }));

  const rowMap = new Map<string, Record<string, string | number | null>>();

  const upsertRow = (x: string | number) => {
    const k = xKey(x);
    let row = rowMap.get(k);
    if (!row) {
      row = { x };
      rowMap.set(k, row);
    }
    return row;
  };

  for (const s of data.series as ChartSeries<PointType>[]) {
    for (const p of s.data) {
      if (!isCartesianPoint(p)) continue;
      const row = upsertRow(p.x);
      row[s.id] = p.y;
    }
  }

  const rows = Array.from(rowMap.values()).map((row) => {
    // Ensure missing fields are explicitly `null` (recharts treats null as "missing").
    for (const f of yFields) {
      if (!(f in row)) row[f] = null;
    }
    return row;
  });

  return {
    rows: sortRowsByX(rows, data.xAxisType),
    xField: "x",
    yFields,
    series,
  };
}
