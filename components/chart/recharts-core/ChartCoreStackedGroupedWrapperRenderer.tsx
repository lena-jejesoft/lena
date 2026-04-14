"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import { getThemeColors, RechartsWrapper } from "./recharts-wrapper";

const STACKED_GROUPED_CHART_COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

function defaultGroupAssignments(fields: string[]): Record<string, number> {
  // Match the old demo behavior: split into 2 groups (front half / back half).
  const groups: Record<string, number> = {};
  if (fields.length === 0) return groups;
  const split = Math.ceil(fields.length / 2);
  fields.forEach((f, idx) => {
    groups[f] = idx < split ? 1 : 2;
  });
  return groups;
}

export function ChartCoreStackedGroupedWrapperRenderer({
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
  const palette = style?.colorPalette?.length ? style.colorPalette : STACKED_GROUPED_CHART_COLORS;

  const base = useMemo(() => toChartCoreTable(data), [data]);

  const seriesGroupAssignments = useMemo(() => {
    const fromStyle = s?.stackedGrouped?.assignments ?? {};
    if (Object.keys(fromStyle).length === 0) return defaultGroupAssignments(base.yFields);

    // Normalize: ensure all known fields have a numeric assignment (default 0 = hidden)
    const out: Record<string, number> = {};
    for (const f of base.yFields) out[f] = fromStyle[f] ?? 0;
    return out;
  }, [s?.stackedGrouped?.assignments, base.yFields]);

  const enabled = s?.timepointLine?.enabled ?? {};
  const yFields = useMemo(
    () =>
      base.yFields.filter((f) => enabled[f] !== false && (seriesGroupAssignments[f] ?? 0) > 0),
    [base.yFields, enabled, seriesGroupAssignments]
  );

  // chartCore-src stacked-grouped disallows negatives, but our sampleData contains them.
  // For stable demo rendering, use abs values.
  const rowsAbs = useMemo(() => {
    return (base.rows as any[]).map((r) => {
      const next: any = { ...r };
      for (const f of base.yFields) {
        const v = next[f];
        if (typeof v === "number" && !Number.isNaN(v)) next[f] = Math.abs(v);
      }
      return next;
    });
  }, [base.rows, base.yFields]);

  const chartHeight = height ?? 320;
  if (yFields.length === 0) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <RechartsWrapper
        data={rowsAbs}
        xField={base.xField}
        yFields={yFields}
        allSeriesFields={base.yFields}
        chartType={"stacked-grouped" as any}
        themeColors={themeColors}
        colors={palette}
        height={chartHeight}
        showOutliers={false}
        seriesGroupAssignments={seriesGroupAssignments}
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
