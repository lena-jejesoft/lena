"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle, ChartType } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import type { OutlierInfo, RegionClassifiedData } from "./recharts-split-types";
import { RechartsWrapper, getThemeColors } from "./recharts-wrapper";
import { RechartsSplitWrapper } from "./recharts-split-wrapper";

const COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

function isBarType(t: ChartType | undefined): boolean {
  return t === "chartCore/column";
}

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

function medianAbs(values: number[]): number {
  if (values.length === 0) return NaN;
  const abs = values.map((v) => Math.abs(v)).filter((v) => Number.isFinite(v));
  if (abs.length === 0) return NaN;
  return quantile(abs, 0.5);
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

export function ChartCoreMixedRenderer({
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
  const s = style as CartesianStyle | undefined;

  const palette = style?.colorPalette?.length ? style.colorPalette : COLORS;
  const enabled = s?.timepointLine?.enabled ?? {};
  const showOutliers = s?.timepointLine?.showOutliers !== false;
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [themeColors, setThemeColors] = useState(getThemeColors());

  const parsed = useMemo(() => {
    const base = toChartCoreTable(data);
    const xKey = base.xField;
    const fullData: Array<Record<string, any>> = (base.rows as Array<Record<string, any>>).map((row) => {
      const label = String((row as any).date_display ?? row[xKey] ?? "");
      const out: Record<string, any> = {
        ...row,
        date_display: label,
      };
      return out;
    });

    // Visible fields
    const filteredFields = base.yFields.filter((f) => enabled[f] !== false);
    const yFields = filteredFields.length > 0 ? filteredFields : base.yFields;

    // Determine per-field series types for mixed rendering.
    // 1) Prefer explicit `chartType` on series (when series-based input is used)
    // 2) Fallback (row/sampleData mode): first field column, rest line
    const yFieldTypes: Record<string, "column" | "line"> = {};
    for (const ss of base.series) {
      if (!yFields.includes(ss.id)) continue;
      if (ss.chartType) {
        yFieldTypes[ss.id] = isBarType(ss.chartType) ? "column" : "line";
      }
    }
    if (Object.keys(yFieldTypes).length === 0 && yFields.length > 0) {
      // Row/sampleData mode: choose the column field with the largest typical magnitude so bars are visible.
      // (If we pick something like GDP first, bars can look "missing" due to shared scale.)
      let bestField = yFields[0]!;
      let bestScore = -Infinity;
      for (const f of yFields) {
        const vs = fullData
          .map((r) => r[f])
          .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
        const score = medianAbs(vs);
        if (Number.isFinite(score) && score > bestScore) {
          bestScore = score;
          bestField = f;
        }
      }
      yFieldTypes[bestField] = "column";
      for (const f of yFields) {
        if (f !== bestField) yFieldTypes[f] = "line";
      }
    } else {
      // Ensure all fields have a type.
      for (const f of yFields) yFieldTypes[f] = yFieldTypes[f] ?? "line";
    }

    // Apply per-field overrides from style (shared key with dual-axis style schema).
    const overrideTypes = s?.dualAxis?.yFieldTypes ?? {};
    for (const f of yFields) {
      const t = overrideTypes[f];
      if (t === "column" || t === "line") {
        yFieldTypes[f] = t;
      }
    }

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
    const baseDomain = computeDomainFromRows(fullData, yFields) ?? [0, 1];
    const normalDomain = computeDomainFromRows(normalData, yFields) ?? baseDomain;
    const upperDomain = upperHasData ? (computeDomainFromRows(upperData, yFields) ?? normalDomain) : normalDomain;
    const lowerDomain = lowerHasData ? (computeDomainFromRows(lowerData, yFields) ?? normalDomain) : normalDomain;

    const classified: RegionClassifiedData = {
      upper: { data: upperData as any, domain: upperDomain, hasData: upperHasData },
      normal: { data: normalData as any, domain: normalDomain },
      lower: { data: lowerData as any, domain: lowerDomain, hasData: lowerHasData },
    };

    return { xField: xKey, yFields, yFieldTypes, fullData, outliers, classified };
  }, [data, enabled, showOutliers, s?.dualAxis?.yFieldTypes]);

  const chartHeight = height ?? 400;

  if (parsed.yFields.length === 0) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      {showOutliers ? (
        <RechartsSplitWrapper
          xField={parsed.xField}
          yFields={parsed.yFields}
          chartType="mixed"
          yFieldTypes={parsed.yFieldTypes}
          themeColors={themeColors}
          colors={palette}
          classifiedData={parsed.classified}
          outliers={parsed.outliers}
          fullData={parsed.fullData as any}
          totalHeight={chartHeight}
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
          allSeriesFields={parsed.yFields}
          chartType="mixed"
          themeColors={themeColors}
          colors={palette}
          yFieldTypes={parsed.yFieldTypes}
          height={chartHeight}
          outlierData={[]}
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
