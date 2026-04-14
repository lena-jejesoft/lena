"use client";

import React, { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import { getThemeColors, RechartsWrapper } from "./recharts-wrapper";
import { RechartsSplitWrapper } from "./recharts-split-wrapper";
import type { OutlierInfo, RegionClassifiedData } from "./recharts-split-types";

type DataRow = Record<string, string | number | null | undefined>;

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
      if (typeof v !== "number" || Number.isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  if (min === max) return [min - 1, max + 1];
  return [min, max];
}

function hasAnyNumeric(rows: Array<Record<string, any>>, fields: string[]): boolean {
  for (const r of rows) {
    for (const f of fields) {
      const v = r[f];
      if (typeof v === "number" && !Number.isNaN(v)) return true;
    }
  }
  return false;
}

export function ChartCoreDualAxisRenderer({
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
  
  const table = useMemo(() => toChartCoreTable(data), [data]);
  const s = style as CartesianStyle | undefined;

  const palette = style?.colorPalette?.length ? style.colorPalette : COLORS;
  const showOutliers = s?.timepointLine?.showOutliers !== false;

  // Visibility toggles: reuse timepointLine.enabled convention (true=show).
  const enabled = s?.timepointLine?.enabled;
  const visibleFields = useMemo(() => {
    if (!enabled) return table.yFields;
    const filtered = table.yFields.filter((f) => enabled[f] !== false);
    // Safety: when all fields are toggled off (or stale style map exists),
    // dual-axis should still show sampleData by default.
    return filtered.length > 0 ? filtered : table.yFields;
  }, [enabled, table.yFields]);

  // Heuristic axis split for row-shaped sampleData:
  // - Small-magnitude (%/rate-like) series -> right (lines)
  // - Large-magnitude series -> left (columns)
  const axisSplit = useMemo(() => {
    const maxAbsByField: Record<string, number> = {};
    for (const f of visibleFields) maxAbsByField[f] = 0;
    for (const r of table.rows as any[]) {
      for (const f of visibleFields) {
        const v = r?.[f];
        if (typeof v !== "number" || Number.isNaN(v)) continue;
        const abs = Math.abs(v);
        if (abs > (maxAbsByField[f] ?? 0)) maxAbsByField[f] = abs;
      }
    }
    const placements: Record<string, "left" | "right"> = {};
    const yFieldTypes: Record<string, "column" | "line"> = {};
    const stylePlacements = s?.dualAxis?.placements ?? {};
    const styleTypes = s?.dualAxis?.yFieldTypes ?? {};
    for (const f of visibleFields) {
      const maxAbs = maxAbsByField[f] ?? 0;
      // sampleData: GDP/제조업 are small, others are large.
      const inferredPlace: "left" | "right" = maxAbs >= 20 ? "left" : "right";
      const place: "left" | "right" = stylePlacements[f] ?? inferredPlace;
      placements[f] = place;
      yFieldTypes[f] = styleTypes[f] ?? (place === "left" ? "column" : "line");
    }
    return { placements, yFieldTypes };
  }, [table.rows, visibleFields, s?.dualAxis?.placements, s?.dualAxis?.yFieldTypes]);

  const normalizedRows = useMemo<DataRow[]>(() => {
    return (table.rows as DataRow[]).map((row, idx) => {
      const rawX = row[table.xField] ?? row.x ?? idx;
      const label = typeof rawX === "string" ? rawX : String(rawX);
      return {
        ...row,
        date_display: typeof row.date_display === "string" ? row.date_display : label,
      };
    });
  }, [table.rows, table.xField]);

  const xField: "date_display" = "date_display";
  const chartHeight = height ?? 400;

  const parsed = useMemo(() => {
    const rows = normalizedRows;
    const xKey = xField;

    const boundsBySeries: Record<string, { lower: number; upper: number } | null> = {};
    for (const f of visibleFields) {
      const vs = rows
        .map((r) => r[f])
        .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
      boundsBySeries[f] = computeIqrBounds(vs);
    }

    const outliers: OutlierInfo[] = [];
    if (showOutliers) {
      for (const row of rows) {
        const dd = String((row as any).date_display ?? row[xKey] ?? "");
        for (const f of visibleFields) {
          const b = boundsBySeries[f];
          const v = row[f];
          if (!b || typeof v !== "number" || Number.isNaN(v)) continue;
          if (v > b.upper) outliers.push({ bound: "upper", field: f, value: v, dateDisplay: dd });
          else if (v < b.lower) outliers.push({ bound: "lower", field: f, value: v, dateDisplay: dd });
        }
      }
    }

    const upperRows = rows.map((r) => {
      const out: Record<string, unknown> = { ...r };
      for (const f of visibleFields) {
        const b = boundsBySeries[f];
        const v = r[f];
        out[f] = showOutliers && b && typeof v === "number" && v > b.upper ? v : null;
      }
      return out;
    });

    const lowerRows = rows.map((r) => {
      const out: Record<string, unknown> = { ...r };
      for (const f of visibleFields) {
        const b = boundsBySeries[f];
        const v = r[f];
        out[f] = showOutliers && b && typeof v === "number" && v < b.lower ? v : null;
      }
      return out;
    });

    const normalRows = rows.map((r) => {
      const out: Record<string, unknown> = { ...r };
      for (const f of visibleFields) {
        const b = boundsBySeries[f];
        const v = r[f];
        const isNum = typeof v === "number" && !Number.isNaN(v);
        const isOutlier = showOutliers && b && isNum && (v < b.lower || v > b.upper);
        out[f] = isOutlier ? null : v;
      }
      return out;
    });

    const upperHasData = hasAnyNumeric(upperRows as any, visibleFields);
    const lowerHasData = hasAnyNumeric(lowerRows as any, visibleFields);
    const baseDomain = computeDomainFromRows(rows as any, visibleFields) ?? [0, 1];
    const normalDomain = computeDomainFromRows(normalRows as any, visibleFields) ?? baseDomain;
    const upperDomain = upperHasData
      ? (computeDomainFromRows(upperRows as any, visibleFields) ?? normalDomain)
      : normalDomain;
    const lowerDomain = lowerHasData
      ? (computeDomainFromRows(lowerRows as any, visibleFields) ?? normalDomain)
      : normalDomain;

    const classifiedData: RegionClassifiedData = {
      upper: {
        hasData: upperHasData,
        data: upperRows as any,
        domain: upperDomain,
      },
      normal: {
        data: normalRows as any,
        domain: normalDomain,
      },
      lower: {
        hasData: lowerHasData,
        data: lowerRows as any,
        domain: lowerDomain,
      },
    };

    const leftFields = visibleFields.filter((f) => (axisSplit.placements[f] ?? "left") === "left");
    const rightFields = visibleFields.filter((f) => (axisSplit.placements[f] ?? "left") === "right");
    const pickSide = (regionRows: Array<Record<string, any>>, fields: string[]) =>
      regionRows.map((r) => {
        const out: Record<string, unknown> = {
          x: r.x,
          date: r.date,
          date_display: r.date_display,
        };
        for (const f of fields) out[f] = r[f];
        return out;
      });

    const leftUpper = pickSide(upperRows as any, leftFields);
    const leftNormal = pickSide(normalRows as any, leftFields);
    const leftLower = pickSide(lowerRows as any, leftFields);
    const rightUpper = pickSide(upperRows as any, rightFields);
    const rightNormal = pickSide(normalRows as any, rightFields);
    const rightLower = pickSide(lowerRows as any, rightFields);
    const leftBaseDomain = computeDomainFromRows(rows as any, leftFields) ?? normalDomain;
    const leftNormalDomain = computeDomainFromRows(leftNormal as any, leftFields) ?? leftBaseDomain;
    const leftUpperHasData = hasAnyNumeric(leftUpper as any, leftFields);
    const leftLowerHasData = hasAnyNumeric(leftLower as any, leftFields);
    const leftUpperDomain = leftUpperHasData
      ? (computeDomainFromRows(leftUpper as any, leftFields) ?? leftNormalDomain)
      : leftNormalDomain;
    const leftLowerDomain = leftLowerHasData
      ? (computeDomainFromRows(leftLower as any, leftFields) ?? leftNormalDomain)
      : leftNormalDomain;

    const leftClassifiedData: RegionClassifiedData = {
      upper: {
        hasData: leftUpperHasData,
        data: leftUpper as any,
        domain: leftUpperDomain,
      },
      normal: {
        data: leftNormal as any,
        domain: leftNormalDomain,
      },
      lower: {
        hasData: leftLowerHasData,
        data: leftLower as any,
        domain: leftLowerDomain,
      },
    };

    const rightBaseDomain = computeDomainFromRows(rows as any, rightFields) ?? normalDomain;
    const rightNormalDomain = computeDomainFromRows(rightNormal as any, rightFields) ?? rightBaseDomain;
    const rightUpperHasData = hasAnyNumeric(rightUpper as any, rightFields);
    const rightLowerHasData = hasAnyNumeric(rightLower as any, rightFields);
    const rightUpperDomain = rightUpperHasData
      ? (computeDomainFromRows(rightUpper as any, rightFields) ?? rightNormalDomain)
      : rightNormalDomain;
    const rightLowerDomain = rightLowerHasData
      ? (computeDomainFromRows(rightLower as any, rightFields) ?? rightNormalDomain)
      : rightNormalDomain;

    const rightClassifiedData: RegionClassifiedData = {
      upper: {
        hasData: rightUpperHasData,
        data: rightUpper as any,
        domain: rightUpperDomain,
      },
      normal: {
        data: rightNormal as any,
        domain: rightNormalDomain,
      },
      lower: {
        hasData: rightLowerHasData,
        data: rightLower as any,
        domain: rightLowerDomain,
      },
    };

    return { classifiedData, leftClassifiedData, rightClassifiedData, outliers };
  }, [axisSplit.placements, normalizedRows, showOutliers, visibleFields, xField]);

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      {showOutliers ? (
        <RechartsSplitWrapper
          xField={xField}
          yFields={visibleFields}
          classifiedData={parsed.classifiedData}
          leftClassifiedData={parsed.leftClassifiedData}
          rightClassifiedData={parsed.rightClassifiedData}
          outliers={parsed.outliers}
          fullData={normalizedRows as any}
          totalHeight={chartHeight}
          colors={palette}
          yFieldTypes={axisSplit.yFieldTypes}
          chartType="dual-axis"
          yAxisPlacements={axisSplit.placements}
          themeColors={themeColors}
          showBrush={true}
          onTooltipChange={(payload, label) => {
            setTooltipPayload(payload);
            setHoveredLabel(label);
            onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
          }}
        />
      ) : (
        <RechartsWrapper
          data={normalizedRows as any}
          xField={xField}
          yFields={visibleFields}
          allSeriesFields={table.yFields}
          chartType="dual-axis"
          yFieldTypes={axisSplit.yFieldTypes}
          yAxisPlacements={axisSplit.placements}
          themeColors={themeColors}
          colors={palette}
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
