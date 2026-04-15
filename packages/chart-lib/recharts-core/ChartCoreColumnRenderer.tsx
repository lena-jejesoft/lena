"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import { getThemeColors, RechartsWrapper } from "./recharts-wrapper";
import { RechartsSplitWrapper } from "./recharts-split-wrapper";
import type { OutlierInfo, RegionClassifiedData } from "./recharts-split-types";

const COLUMN_CHART_COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const v0 = sorted[base]!;
  const v1 = sorted[base + 1] ?? v0;
  return v0 + rest * (v1 - v0);
}

function computeIqrBounds(values: number[]): { lower: number; upper: number } | null {
  if (values.length < 4) return null;
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;
  if (!Number.isFinite(iqr) || iqr === 0) return null;
  return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

function computeDomainFromRows(rows: Array<Record<string, any>>, fields: string[]): [number, number] | undefined {
  let min = Infinity;
  let max = -Infinity;
  for (const r of rows) {
    for (const f of fields) {
      const v = r[f];
      if (typeof v === "number" && !Number.isNaN(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  if (min === max) return [min - 1, max + 1];
  return [min, max];
}

export function ChartCoreColumnRenderer({
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
  const [themeColors, setThemeColors] = useState(getThemeColors());
  
  const s = style as CartesianStyle | undefined;
  const palette = style?.colorPalette?.length ? style.colorPalette : COLUMN_CHART_COLORS;
  const enabled = s?.timepointLine?.enabled ?? {};
  const showOutliers = s?.timepointLine?.showOutliers !== false;

  const parsed = useMemo(() => {
    const base = toChartCoreTable(data);
    const yFields = base.yFields.filter((f) => enabled[f] !== false);

    const xKey = base.xField;
    const fullData: Array<Record<string, string | number | null> & { date: string; date_display: string }> = (
      base.rows as Array<Record<string, string | number | null>>
    ).map((row) => {
      const label = String((row as any).date_display ?? row[xKey] ?? "");
      return {
        ...row,
        date: typeof (row as any).date === "string" ? String((row as any).date) : label,
        date_display: label,
      };
    });

    const boundsBySeries: Record<string, { lower: number; upper: number } | null> = {};
    for (const f of yFields) {
      const vs = fullData
        .map((r) => r[f])
        .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      boundsBySeries[f] = computeIqrBounds(vs);
    }

    const outliers: OutlierInfo[] = [];
    if (showOutliers) {
      for (const row of fullData) {
        const dd = String((row as any).date_display ?? "");
        for (const f of yFields) {
          const b = boundsBySeries[f];
          const v = row[f];
          if (!b || typeof v !== "number" || Number.isNaN(v)) continue;
          if (v > b.upper) outliers.push({ bound: "upper", field: f, value: v, dateDisplay: dd });
          else if (v < b.lower) outliers.push({ bound: "lower", field: f, value: v, dateDisplay: dd });
        }
      }
    }

    const upperData = fullData.map((r) => {
      const out: any = { ...r };
      for (const f of yFields) {
        const b = boundsBySeries[f];
        const v = r[f];
        out[f] = showOutliers && b && typeof v === "number" && v > b.upper ? v : null;
      }
      return out;
    });

    const lowerData = fullData.map((r) => {
      const out: any = { ...r };
      for (const f of yFields) {
        const b = boundsBySeries[f];
        const v = r[f];
        out[f] = showOutliers && b && typeof v === "number" && v < b.lower ? v : null;
      }
      return out;
    });

    const normalData = fullData.map((r) => {
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

    const upperHasData = upperData.some((r) => yFields.some((f) => typeof r[f] === "number"));
    const lowerHasData = lowerData.some((r) => yFields.some((f) => typeof r[f] === "number"));
    const normalDomain = computeDomainFromRows(normalData, yFields) ?? [0, 1];
    const upperDomain = upperHasData
      ? (computeDomainFromRows(upperData, yFields) ?? normalDomain)
      : normalDomain;
    const lowerDomain = lowerHasData
      ? (computeDomainFromRows(lowerData, yFields) ?? normalDomain)
      : normalDomain;

    const classified: RegionClassifiedData = {
      upper: { data: upperData as any, domain: upperDomain, hasData: upperHasData },
      normal: { data: normalData as any, domain: normalDomain },
      lower: { data: lowerData as any, domain: lowerDomain, hasData: lowerHasData },
    };

    return {
      xField: xKey,
      yFields,
      fullData,
      outliers,
      classified,
    };
  }, [data, enabled, showOutliers]);

  const chartHeight = height ?? 400;

  // Use the split-wrapper rendering so outlier regions can be shown (chartCore-src style).
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
          themeColors={themeColors}
          colors={palette}
          chartType="column"
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
          chartType="column"
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
      )}
    </div>
  );
}
