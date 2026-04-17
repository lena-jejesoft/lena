"use client";

import { ChartCoreLineRenderer } from "./ChartCoreLineRenderer";
import { ChartCoreColumnRenderer } from "./ChartCoreColumnRenderer";
import { ChartCoreAreaRenderer } from "./ChartCoreAreaRenderer";
import { ChartCoreArea100Renderer } from "./ChartCoreArea100Renderer";
import { ChartCoreStackedAreaRenderer } from "./ChartCoreStackedAreaRenderer";
import { ChartCoreStackedWrapperRenderer } from "./ChartCoreStackedWrapperRenderer";
import { ChartCoreStacked100WrapperRenderer } from "./ChartCoreStacked100WrapperRenderer";
import { ChartCorePieRenderer } from "./ChartCorePieRenderer";
import { ChartCoreTwoLevelPieRenderer } from "./ChartCoreTwoLevelPieRenderer";
import { ChartCoreTreemapRenderer } from "./ChartCoreTreemapRenderer";
import { ChartCoreGeoGridRenderer } from "./ChartCoreGeoGridRenderer";
import { ChartCoreRankingBarRenderer } from "./ChartCoreRankingBarRenderer";
import { ChartCoreDualAxisRenderer } from "./ChartCoreDualAxisRenderer";
import { ChartCoreMixedRenderer } from "./ChartCoreMixedRenderer";
import { ChartCoreSyncedAreaRenderer } from "./ChartCoreSyncedAreaRenderer";
import { ChartCoreRegressionScatterRenderer } from "./ChartCoreRegressionScatterRenderer";
import { ChartCoreStackedGroupedWrapperRenderer } from "./ChartCoreStackedGroupedWrapperRenderer";
import { ChartCoreRadarRenderer } from "./RechartsRadarRenderer";
import { RechartsSankeyRenderer } from "./RechartsSankeyRenderer";
import { RechartsRangedBarRenderer } from "./RechartsRangedBarRenderer";
import { RechartsGaugeRenderer } from "./RechartsGaugeRenderer";
import { RechartsOwnershipStackedRenderer } from "./RechartsOwnershipStackedRenderer";
import type { ChartData, ChartStyle, ChartTimeRange } from "../types";

type RechartsRendererProps = {
  data: ChartData;
  chartType: string;
  style?: ChartStyle;
  height?: number;
  onTimeRangeChange?: (range: ChartTimeRange) => void;
  onLegendStateChange?: (state: { tooltipPayload: any[] | null; hoveredLabel: string | null }) => void;
};

function toCoreChartType(chartType: string): string {
  return chartType.replace(/^recharts\//, "");
}

export function RechartsRenderer({
  data,
  chartType,
  style,
  height,
  onLegendStateChange,
}: RechartsRendererProps) {
  const coreType = toCoreChartType(chartType);

  if (coreType === "line") {
    return (
      <ChartCoreLineRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "column") {
    return (
      <ChartCoreColumnRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "area") {
    return (
      <ChartCoreAreaRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "area-100") {
    return (
      <ChartCoreArea100Renderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "stacked-area") {
    return (
      <ChartCoreStackedAreaRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "gauge") {
    return (
      <RechartsGaugeRenderer
        data={data}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "ownership-stacked") {
    return (
      <RechartsOwnershipStackedRenderer
        data={data}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "value-conversion-bridge") {
    return (
      <RechartsRangedBarRenderer
        data={data}
        style={style}
        height={height}
      />
    );
  }
  if (coreType === "sankey-diagram") {
    return (
      <RechartsSankeyRenderer
        data={data}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "stacked") {
    return (
      <ChartCoreStackedWrapperRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "stacked-100") {
    return (
      <ChartCoreStacked100WrapperRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "pie") {
    return (
      <ChartCorePieRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "two-level-pie") {
    return (
      <ChartCoreTwoLevelPieRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "treemap" || coreType === "multi-level-treemap") {
    return (
      <ChartCoreTreemapRenderer
        data={data as any}
        style={style}
        height={height}
        chartType={coreType}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "geo-grid") {
    return (
      <ChartCoreGeoGridRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "ranking-bar") {
    return (
      <ChartCoreRankingBarRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "dual-axis") {
    return (
      <ChartCoreDualAxisRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "mixed") {
    return (
      <ChartCoreMixedRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "synced-area") {
    return (
      <ChartCoreSyncedAreaRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "regression-scatter") {
    return (
      <ChartCoreRegressionScatterRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "stacked-grouped") {
    return (
      <ChartCoreStackedGroupedWrapperRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }
  if (coreType === "radar") {
    return (
      <ChartCoreRadarRenderer
        data={data as any}
        style={style}
        height={height}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }

  return null;
}
