"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { DataChartProps, ChartStyle } from "./types";
import { getCompatibleChartTypes } from "./registry";
import { ChartToolbar } from "./ChartToolbar";

const ChartRenderer = dynamic(
  () => import("./ChartRenderer").then((mod) => mod.ChartRenderer),
  { ssr: false }
);

const ALL_CHART_TYPES = [
  "line", "area", "column", "bar", "pie", "scatter",
  "highcharts/gauge",
  "core/grid",
  "core/insider-trading",
  "chartCore/line",
  "chartCore/column",
  "chartCore/stacked",
  "chartCore/stacked-100",
  "chartCore/stacked-grouped",
  "chartCore/dual-axis",
  "chartCore/dual-axis-stacked-bar",
  "chartCore/mixed",
  "chartCore/area",
  "chartCore/area-100",
  "chartCore/stacked-area",
  "chartCore/synced-area",
  "chartCore/pie",
  "chartCore/two-level-pie",
  "chartCore/treemap",
  "chartCore/multi-level-treemap",
  "chartCore/ranking-bar",
  "chartCore/geo-grid",
  "chartCore/regression-scatter",
  "candlestick", "waterfall", "histogram",
  "lightweight/candles",
  "recharts/line",
  "recharts/column",
  "recharts/grouped-bar",
  "recharts/area",
  "recharts/area-100",
  "recharts/stacked-area",
  "recharts/ownership-stacked",
  "recharts/gauge",
  "recharts/value-conversion-bridge",
  "recharts/sankey-diagram",
  "recharts/stacked",
  "recharts/stacked-100",
  "recharts/pie",
  "recharts/two-level-pie",
  "recharts/treemap",
  "recharts/multi-level-treemap",
  "recharts/geo-grid",
  "recharts/ranking-bar",
  "recharts/dual-axis",
  "recharts/dual-axis-stacked-bar",
  "recharts/mixed",
  "recharts/synced-area",
  "recharts/regression-scatter",
  "recharts/stacked-grouped",
  "recharts/radar",
  "stacked-area", "100-stacked-area",
  "stacked-column", "100-stacked-column",
  "stacked-bar", "100-stacked-bar",
] as const;

const DEFAULT_STYLE: ChartStyle = {
  legend: { position: "none" },
  tooltip: { shared: true },
};

export function DataChart({
  data,
  chartType,
  onChartTypeChange,
  style,
  scenario,
  onStyleChange,
  onLegendStateChange,
  sidebar,
  toolbar,
  availableChartTypes,
  hideChartCoreLegendPanel,
  chartCoreLegendContainer,
  chartCoreSeriesColorOverrides,
  chartCoreGroupColorOverrides,
  onChartCoreLegendMetaChange,
  height,
  onTimeRangeChange,
  isEmpty = false,
  emptyMessage = "데이터가 없습니다",
}: DataChartProps) {
  const [internalStyle, setInternalStyle] = useState<ChartStyle>(style ?? DEFAULT_STYLE);

  const currentStyle = style ?? internalStyle;
  const handleStyleChange = onStyleChange ?? setInternalStyle;

  const chartTypes = useMemo(
    () => getCompatibleChartTypes(chartType, data.xAxisType, availableChartTypes ?? [...ALL_CHART_TYPES]),
    [chartType, data.xAxisType, availableChartTypes]
  );

  return (
    <div className="flex flex-row w-full h-full">
      {sidebar}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* <ChartToolbar
          title={currentStyle.title}
          chartType={chartType}
          onChartTypeChange={onChartTypeChange}
          availableChartTypes={chartTypes}
          style={currentStyle}
          onStyleChange={handleStyleChange}
        >
          {toolbar}
        </ChartToolbar> */}

        {isEmpty ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
            {emptyMessage}
          </div>
        ) : (
          <ChartRenderer
            data={data}
            chartType={chartType}
            style={currentStyle}
            scenario={scenario}
            height={height}
            onTimeRangeChange={onTimeRangeChange}
            onLegendStateChange={onLegendStateChange}
            hideChartCoreLegendPanel={hideChartCoreLegendPanel}
            chartCoreLegendContainer={chartCoreLegendContainer}
            chartCoreSeriesColorOverrides={chartCoreSeriesColorOverrides}
            chartCoreGroupColorOverrides={chartCoreGroupColorOverrides}
            onChartCoreLegendMetaChange={onChartCoreLegendMetaChange}
          />
        )}
      </div>
    </div>
  );
}
