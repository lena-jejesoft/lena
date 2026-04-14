"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ChartData, ChartStyle, TreemapStyle } from "../types";
import { RechartsTreemapWrapper } from "./recharts-treemap-wrapper";
import { RechartsMultiLevelTreemapWrapper, TreemapStats } from "./recharts-multilevel-treemap-wrapper";
import { getThemeColors } from "./recharts-wrapper";
import {
  calculateMultiLevelTreemapData,
  calculateMultiLevelTreemapDataByTimepoint,
  calculateTreemapData,
  calculateTreemapDataByTimepoint,
} from "./recharts-adapter";
import { toChartCoreTable } from "./toChartCoreTable";

const TREEMAP_CHART_COLORS: string[] = [
  "#C15F3C",
  "#B1ADA1",
  "#7D8471",
  "#9B8AA6",
  "#D4A574",
  "#6B7B8C",
  "#da7756",
  "#A67B5B",
];

export function ChartCoreTreemapRenderer({
  data,
  style,
  height,
  chartType = "treemap",
  onLegendStateChange,
}: {
  data: ChartData;
  style?: ChartStyle;
  height?: number;
  chartType?: string;
  onLegendStateChange?: (state: { tooltipPayload: any[] | null; hoveredLabel: string | null }) => void;
}) {
  const [themeColors] = useState(getThemeColors());
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [treemapStats, setTreemapStats] = useState<TreemapStats | null>(null);
  const legendCallbackRef = useRef(onLegendStateChange);

  const s = style as TreemapStyle | undefined;
  const cfg = s?.treemap;
  const chartHeight = height ?? 400;
  const palette = style?.colorPalette?.length ? style.colorPalette : TREEMAP_CHART_COLORS;

  const table = useMemo(() => toChartCoreTable(data), [data]);

  const seriesFields = useMemo(() => {
    return [...table.yFields].sort((a, b) => a.localeCompare(b, "ko"));
  }, [table.yFields]);

  const chartRows = useMemo(() => {
    return (table.rows as Array<Record<string, string | number | null>>).map((row, idx) => {
      const rawX = row[table.xField] ?? row.x ?? idx;
      const label = typeof rawX === "string" ? rawX : String(rawX);
      return {
        ...row,
        date: typeof row.date === "string" ? row.date : label,
        date_display: typeof row.date_display === "string" ? row.date_display : label,
      };
    });
  }, [table.rows, table.xField]);

  // Keep style-selected timepoint as latest item so wrapper defaults to it.
  const rowsForTimepoint = useMemo(() => {
    if (!cfg?.selectedKey) return chartRows;
    const idx = chartRows.findIndex((r) => String(r.date_display) === cfg.selectedKey);
    if (idx < 0) return chartRows;
    return [...chartRows.slice(0, idx), ...chartRows.slice(idx + 1), chartRows[idx]!];
  }, [chartRows, cfg?.selectedKey]);

  const hierarchyGroups = useMemo(() => {
    const groupsFromStyle = cfg?.hierarchyGroups ?? [];
    if (groupsFromStyle.length > 0) {
      return groupsFromStyle
        .map((group) => ({
          name: group.name,
          series: group.series.filter((field) => seriesFields.includes(field)),
        }))
        .filter((group) => group.series.length > 0);
    }

    const hasHierarchicalSeries = seriesFields.some((field) => field.includes("::"));
    if (!hasHierarchicalSeries) return [] as Array<{ name: string; series: string[] }>;

    const levelMap = new Map<string, string[]>();
    for (const field of seriesFields) {
      const level1 = field.split("::")[0]?.trim();
      if (!level1) continue;
      if (!levelMap.has(level1)) levelMap.set(level1, []);
      levelMap.get(level1)!.push(field);
    }

    return Array.from(levelMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ko"))
      .map(([name, series]) => ({ name, series }));
  }, [cfg?.hierarchyGroups, seriesFields]);

  const effectiveSeriesFields = useMemo(() => {
    if (chartType !== "multi-level-treemap") return seriesFields;
    if (hierarchyGroups.length > 0) return hierarchyGroups.map((group) => group.name);
    return seriesFields;
  }, [chartType, hierarchyGroups, seriesFields]);

  const enabledSeries = useMemo(() => {
    const enabled = cfg?.enabled ?? {};
    return new Set(effectiveSeriesFields.filter((field) => enabled[field] !== false));
  }, [effectiveSeriesFields, cfg?.enabled]);

  const treemapData = useMemo(() => {
    if ((chartType !== "treemap" && chartType !== "multi-level-treemap") || seriesFields.length === 0) return [];
    if (chartType === "multi-level-treemap") {
      return calculateMultiLevelTreemapData(chartRows as any[], seriesFields, hierarchyGroups.length > 0 ? hierarchyGroups : undefined);
    }
    return calculateTreemapData(chartRows as any[], seriesFields);
  }, [chartType, chartRows, seriesFields, hierarchyGroups]);

  const timepointTreemapData = useMemo(() => {
    if (chartType !== "treemap" || seriesFields.length === 0) return [];
    return calculateTreemapDataByTimepoint(rowsForTimepoint as any[], seriesFields);
  }, [chartType, rowsForTimepoint, seriesFields]);

  const timepointMultiLevelTreemapData = useMemo(() => {
    if (chartType !== "multi-level-treemap" || seriesFields.length === 0) return [];
    return calculateMultiLevelTreemapDataByTimepoint(
      rowsForTimepoint as any[],
      seriesFields,
      hierarchyGroups.length > 0 ? hierarchyGroups : undefined
    );
  }, [chartType, rowsForTimepoint, seriesFields, hierarchyGroups]);

  const appliedThemeColors = useMemo(
    () => ({
      ...themeColors,
      seriesColors: palette,
    }),
    [themeColors, palette]
  );

  useEffect(() => {
    legendCallbackRef.current = onLegendStateChange;
  }, [onLegendStateChange]);

  useEffect(() => {
    if (chartType !== "multi-level-treemap") {
      setTreemapStats(null);
    }
  }, [chartType]);

  useEffect(() => {
    legendCallbackRef.current?.({
      tooltipPayload,
      hoveredLabel,
      treemapStats: chartType === "multi-level-treemap" ? treemapStats : null,
    } as any);
  }, [tooltipPayload, hoveredLabel, treemapStats, chartType]);

  if (seriesFields.length === 0) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      {chartType === "treemap" ? (
        <RechartsTreemapWrapper
          data={treemapData as any}
          timepointData={timepointTreemapData}
          enabledSeries={enabledSeries}
          themeColors={appliedThemeColors}
          height={chartHeight}
          allSeriesFields={seriesFields}
          onTooltipChange={(payload, label) => {
            setTooltipPayload(payload);
            setHoveredLabel(label);
          }}
        />
      ) : chartType === "multi-level-treemap" ? (
        <RechartsMultiLevelTreemapWrapper
          data={treemapData as any}
          timepointData={timepointMultiLevelTreemapData}
          enabledSeries={enabledSeries}
          themeColors={appliedThemeColors}
          height={chartHeight}
          allSeriesFields={effectiveSeriesFields}
          onTooltipChange={(payload, label) => {
            setTooltipPayload(payload);
            setHoveredLabel(label);
          }}
          onDrilldownChange={setTreemapStats}
          customColors={palette}
        />
      ) : null}
    </div>
  );
}
