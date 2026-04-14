"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import { getThemeColors, RechartsWrapper } from "./recharts-wrapper";

const STACKED_100_CHART_COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

export function ChartCoreStacked100WrapperRenderer({
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
  const palette = style?.colorPalette?.length ? style.colorPalette : STACKED_100_CHART_COLORS;

  const base = useMemo(() => toChartCoreTable(data), [data]);
  const enabled = s?.timepointLine?.enabled ?? {};
  const yFields = useMemo(() => base.yFields.filter((f) => enabled[f] !== false), [base.yFields, enabled]);

  const chartHeight = height ?? 320;
  if (yFields.length === 0) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <RechartsWrapper
        data={base.rows as any}
        xField={base.xField}
        yFields={yFields}
        allSeriesFields={base.yFields}
        chartType={"stacked-100" as any}
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
