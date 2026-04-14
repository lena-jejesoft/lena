"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import { getThemeColors, RechartsWrapper } from "./recharts-wrapper";
import { RechartsSplitWrapper } from "./recharts-split-wrapper";
import type { OutlierInfo, RegionClassifiedData } from "./recharts-split-types";

const LINE_CHART_COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function computeIqrBounds(values: number[]): { lower: number; upper: number } | null {
  const xs = values
    .filter((v) => typeof v === "number" && !Number.isNaN(v))
    .slice()
    .sort((a, b) => a - b);
  if (xs.length < 4) return null;
  const q1 = quantile(xs, 0.25);
  const q3 = quantile(xs, 0.75);
  const iqr = q3 - q1;
  if (!Number.isFinite(iqr) || iqr === 0) return null;
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

function computeDomainFromRows(
  rows: Array<Record<string, unknown>>,
  fields: string[]
): [number, number] | undefined {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    for (const f of fields) {
      const v = (r as any)[f];
      if (typeof v === "number" && !Number.isNaN(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

export function ChartCoreLineRenderer({
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
  const palette = style?.colorPalette?.length ? style.colorPalette : LINE_CHART_COLORS;
  const enabled = s?.timepointLine?.enabled ?? {};
  const showOutliers = s?.timepointLine?.showOutliers !== false;

  const base = useMemo(() => toChartCoreTable(data), [data]);

  const parsed = useMemo(() => {
    const fullData = (base.rows as Array<Record<string, unknown>>).map((row, idx) => {
      const rawX = row[base.xField] ?? row.x ?? idx;
      const label = typeof rawX === "string" ? rawX : String(rawX);
      return {
        ...row,
        date: typeof row.date === "string" ? row.date : label,
        date_display: typeof row.date_display === "string" ? row.date_display : label,
      };
    });

    const yFields = base.yFields.filter((f) => enabled[f] !== false);

    const boundsBySeries: Record<string, { lower: number; upper: number } | null> = {};
    for (const f of yFields) {
      const vs = fullData
        .map((r: any) => r[f])
        .filter((v: any): v is number => typeof v === "number" && !Number.isNaN(v));
      boundsBySeries[f] = computeIqrBounds(vs);
    }

    const outliers: OutlierInfo[] = [];
    if (showOutliers) {
      for (const row of fullData as any[]) {
        const dd = String(row.date_display ?? "");
        for (const f of yFields) {
          const b = boundsBySeries[f];
          const v = row[f];
          if (!b || typeof v !== "number" || Number.isNaN(v)) continue;
          if (v > b.upper) outliers.push({ bound: "upper", field: f, value: v, dateDisplay: dd });
          else if (v < b.lower) outliers.push({ bound: "lower", field: f, value: v, dateDisplay: dd });
        }
      }
    }

    const upperData = fullData.map((r: any) => {
      const out: any = { ...r };
      for (const f of yFields) {
        const b = boundsBySeries[f];
        const v = r[f];
        out[f] = showOutliers && b && typeof v === "number" && v > b.upper ? v : null;
      }
      return out;
    });

    const lowerData = fullData.map((r: any) => {
      const out: any = { ...r };
      for (const f of yFields) {
        const b = boundsBySeries[f];
        const v = r[f];
        out[f] = showOutliers && b && typeof v === "number" && v < b.lower ? v : null;
      }
      return out;
    });

    const normalData = fullData.map((r: any) => {
      const out: any = { ...r };
      for (const f of yFields) {
        const b = boundsBySeries[f];
        const v = r[f];
        const isNum = typeof v === "number" && !Number.isNaN(v);
        const isOutlier = showOutliers && b && isNum && (v < b.lower || v > b.upper);
        out[f] = isOutlier ? null : v;
      }
      return out;
    });

    const upperHasData = upperData.some((r: any) => yFields.some((f) => typeof r[f] === "number"));
    const lowerHasData = lowerData.some((r: any) => yFields.some((f) => typeof r[f] === "number"));
    const normalDomain = computeDomainFromRows(normalData as any, yFields) ?? [0, 1];
    const upperDomain = upperHasData
      ? (computeDomainFromRows(upperData as any, yFields) ?? normalDomain)
      : normalDomain;
    const lowerDomain = lowerHasData
      ? (computeDomainFromRows(lowerData as any, yFields) ?? normalDomain)
      : normalDomain;

    const classified: RegionClassifiedData = {
      upper: {
        data: upperData as any,
        domain: upperDomain,
        hasData: upperHasData,
      },
      normal: {
        data: normalData as any,
        domain: normalDomain,
      },
      lower: {
        data: lowerData as any,
        domain: lowerDomain,
        hasData: lowerHasData,
      },
    };

    return { xField: "date_display" as const, yFields, fullData, outliers, classified };
  }, [base.rows, base.xField, base.yFields, enabled, showOutliers]);

  const chartHeight = height ?? 400;
  const outlierScatterData = parsed.outliers.map((o) => ({
    x: o.dateDisplay,
    y: o.value,
    field: o.field,
  }));

  if (parsed.yFields.length === 0) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      {showOutliers ? (
        <RechartsSplitWrapper
          xField={parsed.xField}
          yFields={parsed.yFields}
          classifiedData={parsed.classified}
          outliers={parsed.outliers}
          fullData={parsed.fullData}
          totalHeight={chartHeight}
          chartType="line"
          themeColors={themeColors}
          colors={palette}
          showBrush={true}
          onTooltipChange={(payload, label) => {
            setTooltipPayload(payload);
            setHoveredLabel(label);
            onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
          }}
        />
      ) : (
        <RechartsWrapper
          data={parsed.fullData as any}
          xField={parsed.xField}
          yFields={parsed.yFields}
          chartType="line"
          themeColors={themeColors}
          colors={palette}
          height={chartHeight}
          outlierData={outlierScatterData}
          showOutliers={false}
          showBrush={true}
          onTooltipChange={(payload, label) => {
            setTooltipPayload(payload);
            setHoveredLabel(label);
            onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
          }}
        />
      )}
    </div>
  );
}
