"use client";

import type {
  ChartType,
  ChartData,
  ChartStyle,
  ChartTimeRange,
  CartesianStyle,
  Scenario,
  ChartCoreLegendMeta,
} from "./types";
import { CHART_TYPE_REGISTRY } from "./registry";
import { RechartsRenderer } from './recharts-core/RechartsRenderer';
import { LightweightCandlesRenderer } from "./lightweight-charts/candles";
import { CoreGridRenderer } from "./core/CoreGridRenderer";
import { CoreInsiderTradingRenderer } from "./core/CoreInsiderTradingRenderer";
import { ChartCoreRenderer } from "./chartCore/ChartCoreRenderer";

interface ChartRendererProps {
  data: ChartData;
  chartType: ChartType;
  style?: ChartStyle;
  scenario?: Scenario;
  height?: number;
  onTimeRangeChange?: (range: ChartTimeRange) => void;
  onLegendStateChange?: (state: { tooltipPayload: any[] | null; hoveredLabel: string | null }) => void;
  hideChartCoreLegendPanel?: boolean;
  chartCoreLegendContainer?: HTMLElement | null;
  chartCoreSeriesColorOverrides?: Record<string, string>;
  chartCoreGroupColorOverrides?: Record<string, string>;
  onChartCoreLegendMetaChange?: (meta: ChartCoreLegendMeta | null) => void;
}

export function ChartRenderer({
  data,
  chartType,
  style,
  scenario,
  height,
  onTimeRangeChange,
  onLegendStateChange,
  hideChartCoreLegendPanel,
  chartCoreLegendContainer,
  chartCoreSeriesColorOverrides,
  chartCoreGroupColorOverrides,
  onChartCoreLegendMetaChange,
}: ChartRendererProps) {
  const chartSpec = CHART_TYPE_REGISTRY[chartType];

  if (!chartSpec) {
    return (
      <div className="flex-1 min-w-0 p-2 text-xs text-muted-foreground">
        지원하지 않는 차트 유형입니다.
      </div>
    );
  }

  if (chartSpec.renderer === "core") {
    if (chartType === "core/insider-trading") {
      return (
        <CoreInsiderTradingRenderer
          data={data}
          style={style}
          height={height}
        />
      );
    }

    if (chartType === "core/grid") {
      return (
        <CoreGridRenderer
          data={data}
          style={style}
          height={height}
        />
      );
    }

    return (
      <div className="flex-1 min-w-0 p-2 text-xs text-muted-foreground">
        지원하지 않는 Core 차트 유형입니다.
      </div>
    );
  }

  if (chartSpec.renderer === "recharts") {
    return (
      <RechartsRenderer
        data={data}
        chartType={chartType}
        style={style}
        height={height}
        onTimeRangeChange={onTimeRangeChange}
        onLegendStateChange={onLegendStateChange}
      />
    );
  }

  if (chartSpec.renderer === "lightweight") {
    return (
      <LightweightCandlesRenderer
        data={data}
        style={style as CartesianStyle | undefined}
        scenario={scenario}
        height={height}
        onTimeRangeChange={onTimeRangeChange}
      />
    );
  }

  if (chartSpec.renderer === "chartcore") {
    return (
      <ChartCoreRenderer
        data={data}
        chartType={chartType}
        style={style}
        height={height}
        hideChartCoreLegendPanel={hideChartCoreLegendPanel}
        chartCoreLegendContainer={chartCoreLegendContainer}
        chartCoreSeriesColorOverrides={chartCoreSeriesColorOverrides}
        chartCoreGroupColorOverrides={chartCoreGroupColorOverrides}
        onChartCoreLegendMetaChange={onChartCoreLegendMetaChange}
      />
    );
  }

  return (
    <div className="flex-1 min-w-0 p-2 text-xs text-muted-foreground">
      지원하지 않는 차트 유형입니다.
    </div>
  );
}
