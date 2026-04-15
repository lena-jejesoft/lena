"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadarChart,
  Radar,
  Tooltip,
} from "recharts";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";

const DEFAULT_RADAR_COLOR = "#C15F3C";

interface RadarDatum {
  axis: string;
  value: number;
}

export function ChartCoreRadarRenderer({
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
  const palette = style?.colorPalette ?? [];
  const radarColor = palette.length > 0 ? palette[0]! : DEFAULT_RADAR_COLOR;
  const chartHeight = height ?? 400;

  const parsed = useMemo((): { data: RadarDatum[]; maxValue: number } => {
    const base = toChartCoreTable(data);
    const enabled = s?.timepointLine?.enabled ?? {};
    const visibleFields = base.yFields.filter((field) => enabled[field] !== false);
    const latestRow = base.rows[base.rows.length - 1];

    if (!latestRow || visibleFields.length === 0) {
      return { data: [], maxValue: 0 };
    }

    const radarData = visibleFields.map((field) => {
      const rawValue = latestRow[field];
      const numericValue =
        typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : 0;
      return {
        axis: field,
        // Radar radius must stay non-negative for stable rendering.
        value: Math.max(0, numericValue),
      };
    });

    const maxValue = radarData.reduce(
      (acc, datum) => (datum.value > acc ? datum.value : acc),
      0
    );

    return { data: radarData, maxValue };
  }, [data, s?.timepointLine?.enabled]);

  if (parsed.data.length === 0) {
    return (
      <div
        className="flex-1 min-w-0 p-2 bg-transparent"
        style={{ height: chartHeight }}
      />
    );
  }

  const radiusMax = parsed.maxValue > 0 ? parsed.maxValue * 1.1 : 1;

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          data={parsed.data}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          onMouseMove={(state: any) => {
            const payload =
              Array.isArray(state?.activePayload) && state.activePayload.length > 0
                ? state.activePayload
                : null;
            const label = typeof state?.activeLabel === "string" ? state.activeLabel : null;
            onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
          }}
          onMouseLeave={() => {
            onLegendStateChange?.({ tooltipPayload: null, hoveredLabel: null });
          }}
        >
          <PolarGrid />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis axisLine={false} tick={false} domain={[0, radiusMax]} />
          <Tooltip />
          <Radar
            dataKey="value"
            stroke={radarColor}
            fill={radarColor}
            fillOpacity={0.58}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
