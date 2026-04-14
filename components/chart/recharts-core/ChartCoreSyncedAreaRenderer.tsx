"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { formatDateForXAxis } from "./formatDateForXAxis";
import { toChartCoreTable } from "./toChartCoreTable";
import { getThemeColors } from "./recharts-wrapper";
import { RechartsSyncedArea } from "./recharts-synced-area";
import { extractSeriesFields } from "./recharts-utils";

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

function formatDateLabel(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return formatDateForXAxis(`${yyyy}-${mm}-${dd}`);
}

export function ChartCoreSyncedAreaRenderer({
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
  const table = useMemo(() => toChartCoreTable(data), [data]);
  const s = style as CartesianStyle | undefined;

  const palette = style?.colorPalette?.length ? style.colorPalette : COLORS;

  const enabled = s?.timepointLine?.enabled ?? {};
  const filtered = table.series.filter((ss) => enabled[ss.id] !== false);
  const visible = filtered.length > 0 ? filtered : table.series;

  // chartCore-src처럼 기본값: 첫 번째/두 번째 시리즈를 좌/우로 배치
  const defaultLeft = visible[0];
  const visibleIds = new Set(visible.map((v) => v.id));
  const styledLeft = s?.syncedArea?.leftField;
  const styledRight = s?.syncedArea?.rightField;

  const left = styledLeft && visibleIds.has(styledLeft)
    ? visible.find((v) => v.id === styledLeft)
    : defaultLeft;
  const fallbackRight = visible.find((v) => v.id !== left?.id) ?? left;
  const right = styledRight && visibleIds.has(styledRight)
    ? visible.find((v) => v.id === styledRight)
    : fallbackRight;

  const chartHeight = height ?? 400;

  if (!left) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  const chartData = (table.rows as Array<Record<string, string | number | null>>).map((row, idx) => {
    const rawX = row[table.xField] ?? row.x ?? idx;
    const dateDisplay =
      typeof rawX === "number" && data.xAxisType === "datetime"
        ? formatDateLabel(rawX)
        : String(rawX);
    return {
      ...row,
      date_display: dateDisplay,
    };
  });
  const syncedAreaLeftField = left.id;
  const syncedAreaRightField = right?.id ?? left.id;
  const yAxisLabel = s?.yAxes?.[0]?.title ?? "";

  const seriesColors = palette;

  // 시리즈 필드 추출 (데이터 원본 순서 유지)
  const seriesFields = useMemo(() => {
    if (!chartData) return [];
    try {
      return extractSeriesFields(chartData);
    } catch {
      return [];
    }
  }, [chartData]);

  useEffect(() => {
    onLegendStateChange?.({ tooltipPayload, hoveredLabel });
  }, [tooltipPayload, hoveredLabel, onLegendStateChange]);

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <div className="flex h-full min-w-0">
        <div className="flex-1 min-w-0 h-full">
          <RechartsSyncedArea
            chartData={chartData as Array<Record<string, any>>}
            syncedAreaLeftField={syncedAreaLeftField}
            syncedAreaRightField={syncedAreaRightField}
            seriesFields={seriesFields}
            seriesColors={seriesColors}
            yAxisLabel={yAxisLabel}
            themeColors={themeColors}
            setTooltipPayload={setTooltipPayload}
            setHoveredLabel={setHoveredLabel}
          />
        </div>
      </div>
    </div>
  );
}
