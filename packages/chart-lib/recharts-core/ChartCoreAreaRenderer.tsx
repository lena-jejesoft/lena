"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle, CartesianPoint } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import { getThemeColors, RechartsWrapper } from "./recharts-wrapper";

const AREA_CHART_COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

type Row = Record<string, unknown>;

function looksLikePointArray(raw: unknown[]): raw is CartesianPoint[] {
  const first = raw[0] as any;
  return Boolean(first) && typeof first === "object" && "x" in first && typeof first.y === "number";
}

function extractNumericFields(rows: Row[]): string[] {
  if (rows.length === 0) return [];
  const excluded = new Set(["date", "date_display", "x", "y"]);
  const keys = Object.keys(rows[0]).filter((k) => !excluded.has(k));
  return keys.filter((k) => rows.some((r) => typeof r[k] === "number" && !Number.isNaN(r[k] as number)));
}

function pickXKey(rows: Row[]): string {
  if (rows.some((r) => typeof r["date_display"] === "string")) return "date_display";
  if (rows.some((r) => typeof r["x"] === "string")) return "x";
  if (rows.some((r) => typeof r["date"] === "string")) return "date";
  return "x";
}

export function ChartCoreAreaRenderer({
  data,
  style,
  height,
  onLegendStateChange,
}: {
  data: ChartData;
  style?: ChartStyle;
  height?: number;
  onLegendStateChange?: (state: { tooltipPayload: any[] | null; hoveredLabel: string | null }) => void;
}) {
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [themeColors] = useState(getThemeColors());
  const s = style as CartesianStyle | undefined;
  const palette = style?.colorPalette?.length ? style.colorPalette : AREA_CHART_COLORS;

  const chartHeight = height ?? 400;

  const series0 = data.series[0];
  const raw = ((series0?.data ?? []) as unknown[]) ?? [];

  const parsed = useMemo(() => {
    // Mode 1: normal series-based points
    if (looksLikePointArray(raw)) {
      const t = toChartCoreTable(data);
      const enabled = s?.timepointLine?.enabled ?? {};
      const visibleSeries = t.series.filter((ss) => enabled[ss.id] !== false);
      return { rows: t.rows, xField: t.xField, series: visibleSeries };
    }

    // Mode 2: chartCore-style raw rows (sampleData)
    const rowsRaw = raw.filter((r): r is Row => Boolean(r) && typeof r === "object");
    const xKey = pickXKey(rowsRaw);
    const fields = extractNumericFields(rowsRaw);
    const enabled = s?.timepointLine?.enabled ?? {};
    const visibleFields = fields.filter((f) => enabled[f] !== false);

    const rows = rowsRaw.map((r, idx) => {
      const xVal = (r as any)[xKey] ?? idx;
      const out: Record<string, unknown> = {
        date: typeof (r as any).date === "string" ? String((r as any).date) : undefined,
        date_display:
          typeof (r as any).date_display === "string"
            ? String((r as any).date_display)
            : (typeof xVal === "string" ? xVal : String(xVal)),
        [xKey]: typeof xVal === "string" ? xVal : String(xVal),
      };
      for (const f of visibleFields) {
        const v = (r as any)[f];
        out[f] = typeof v === "number" && !Number.isNaN(v) ? v : null;
      }
      return out;
    });

    // Sort by date when available
    rows.sort((a: any, b: any) => {
      const da = a.date ? Date.parse(a.date) : NaN;
      const db = b.date ? Date.parse(b.date) : NaN;
      if (Number.isFinite(da) && Number.isFinite(db)) return da - db;
      return 0;
    });

    const series = visibleFields.map((f) => ({ id: f, name: f }));
    return { rows, xField: xKey, series };
  }, [data, raw, s?.timepointLine?.enabled]);

  if (!parsed.series.length) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <RechartsWrapper
        data={parsed.rows as any}
        xField={parsed.xField}
        yFields={parsed.series.map((ss) => ss.id)}
        chartType="area"
        themeColors={themeColors}
        colors={palette}
        height={chartHeight}
        showOutliers={false}
        showBrush={true}
        onTooltipChange={(payload, label) => {
          setTooltipPayload(payload);
          setHoveredLabel(label);
          onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
        }}
      />
    </div>
  );
}
