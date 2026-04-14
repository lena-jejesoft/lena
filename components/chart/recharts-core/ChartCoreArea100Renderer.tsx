"use client";

import { useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreArea100Table } from "./toChartCoreArea100Table";
import { getThemeColors, RechartsWrapper } from "./recharts-wrapper";

const AREA_100_CHART_COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

export function ChartCoreArea100Renderer({
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
  const palette = style?.colorPalette?.length ? style.colorPalette : AREA_100_CHART_COLORS;
  const { rows, xField, yFields, allYFields } = useMemo(() => {
    const base = toChartCoreArea100Table(data);
    const enabled = s?.timepointLine?.enabled ?? {};
    return {
      ...base,
      allYFields: base.yFields,
      yFields: base.yFields.filter((field) => enabled[field] !== false),
    };
  }, [data, s?.timepointLine?.enabled]);

  const chartHeight = height ?? 400;

  if (yFields.length === 0) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <RechartsWrapper
        data={rows as any}
        xField={xField}
        yFields={yFields}
        allSeriesFields={allYFields}
        chartType={"area-100" as any}
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
