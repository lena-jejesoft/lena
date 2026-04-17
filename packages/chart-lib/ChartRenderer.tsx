"use client";

import { useEffect, useRef, useCallback } from "react";
import type {
  ChartType,
  ChartData,
  ChartStyle,
  ChartTimeRange,
  CartesianPoint,
  CartesianStyle,
  PieStyle,
  WaterfallStyle,
  ChartSeries,
  PointType,
  Scenario,
  ChartCoreLegendMeta,
} from "./types";
import { CHART_TYPE_REGISTRY } from "./registry";
import type { HighchartsChartTypeSpec } from "./registry";
import { RechartsRenderer } from './recharts-core/RechartsRenderer';
import { LightweightCandlesRenderer } from "./lightweight-charts/candles";
import { CoreGridRenderer } from "./core/CoreGridRenderer";
import { CoreInsiderTradingRenderer } from "./core/CoreInsiderTradingRenderer";
import { ChartCoreRenderer } from "./chartCore/ChartCoreRenderer";

const DEFAULT_COLORS = [
  "#E57B53", "#4ECDC4", "#5B9BD5", "#D4A574",
  "#9B8AA6", "#7D8471", "#6B7B8C", "#B1ADA1",
];

const DEFAULT_YAXIS = {
  labels: { style: { color: "#888", fontSize: "10px" } },
  gridLineColor: "rgba(255,255,255,0.08)",
  title: { text: "" },
};

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
    <HighchartsRenderer
      data={data}
      chartType={chartType}
      style={style}
      height={height}
      onTimeRangeChange={onTimeRangeChange}
    />
  );
}

interface HighchartsRendererProps {
  data: ChartData;
  chartType: ChartType;
  style?: ChartStyle;
  height?: number;
  onTimeRangeChange?: (range: ChartTimeRange) => void;
}

function HighchartsRenderer({
  data,
  chartType,
  style,
  height,
  onTimeRangeChange,
}: HighchartsRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartInstanceRef = useRef<any>(null);

  const handleExtremes = useCallback(
    (e: { min: number; max: number; trigger?: string }) => {
      if (e.trigger && onTimeRangeChange) {
        onTimeRangeChange({ min: e.min, max: e.max });
      }
    },
    [onTimeRangeChange]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    async function init() {
      const spec = CHART_TYPE_REGISTRY[chartType];
      if (!spec || spec.renderer !== "highcharts") return;

      const mod = await import("highcharts/highstock");
      const Highcharts = mod.default || mod;

      // Waterfall needs the highcharts-more module.
      if (spec.highchartsType === "waterfall") {
        const moreMod = await import("highcharts/highcharts-more");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const moreInit = (moreMod as any).default || moreMod;
        if (typeof moreInit === "function") moreInit(Highcharts);
      }

      if (destroyed || !containerRef.current) return;

      const useStockChart = spec.usesStock || data.xAxisType === "datetime";
      const config = buildHighchartsConfig(data, chartType, spec, style, height, handleExtremes);

      const highchartsApi = Highcharts as {
        stockChart: (container: HTMLElement, options: unknown) => unknown;
        chart: (container: HTMLElement, options: unknown) => unknown;
      };
      if (useStockChart) {
        chartInstanceRef.current = highchartsApi.stockChart(containerRef.current, config);
      } else {
        chartInstanceRef.current = highchartsApi.chart(containerRef.current, config);
      }
    }

    init();

    return () => {
      destroyed = true;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy?.();
        chartInstanceRef.current = null;
      }
    };
  }, [data, chartType, style, height, handleExtremes]);

  const containerStyle: React.CSSProperties = {
    width: "100%",
    ...(height ? { height } : { height: "100%" }),
  };

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent">
      <div ref={containerRef} style={containerStyle} />
    </div>
  );
}

// ─── Config Builder ───

function buildHighchartsConfig(
  data: ChartData,
  chartType: ChartType,
  spec: HighchartsChartTypeSpec,
  style: ChartStyle | undefined,
  chartHeight: number | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleExtremes: (e: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const colors = style?.colorPalette ?? DEFAULT_COLORS;

  // Pie charts
  if (spec.highchartsType === "pie") {
    return buildPieConfig(data, style as PieStyle | undefined, colors, chartHeight);
  }

  // Waterfall charts
  if (spec.highchartsType === "waterfall") {
    return buildWaterfallConfig(data, style as WaterfallStyle | undefined, colors, chartHeight);
  }

  return buildCartesianConfig(
    data,
    chartType,
    spec,
    style as CartesianStyle | undefined,
    colors,
    chartHeight,
    handleExtremes
  );
}

function buildPieConfig(
  data: ChartData,
  style: PieStyle | undefined,
  colors: string[],
  chartHeight: number | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const series = data.series[0];
  const pieData = (series?.data as CartesianPoint[])?.map((p, i) => ({
    name: typeof p.x === "string" ? p.x : String(p.x),
    y: p.y,
    color: p.color ?? colors[i % colors.length],
  })) ?? [];

  return {
    chart: {
      backgroundColor: "transparent",
      style: { fontFamily: "inherit" },
      type: "pie",
      ...(chartHeight != null && { height: chartHeight }),
    },
    title: { text: style?.title ?? "", style: { color: "var(--text-secondary)", fontSize: "12px", fontWeight: "500" } },
    plotOptions: {
      series: { animation: { duration: 300 } },
      pie: {
        colors,
        innerSize: style?.innerRadius ? `${style.innerRadius}%` : "0%",
        dataLabels: {
          enabled: style?.dataLabels !== false,
          format: style?.showPercentage
            ? "{point.name}: {point.percentage:.1f}%"
            : "{point.name}: {point.y}",
          style: { color: "#aaa", fontSize: "10px", textOutline: "none" },
        },
        borderWidth: 0,
      },
    },
    legend: buildLegendConfig(style),
    series: [{ data: pieData }],
    credits: { enabled: false },
  };
}

function buildWaterfallConfig(
  data: ChartData,
  style: WaterfallStyle | undefined,
  colors: string[],
  chartHeight: number | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const series = data.series[0];
  const positiveColor = style?.positiveColor ?? "#4ECDC4";
  const negativeColor = style?.negativeColor ?? "#FF6B6B";
  const sumColor = style?.sumColor ?? colors[0];

  const waterfallData = (series?.data as CartesianPoint[])?.map((p) => ({
    name: typeof p.x === "string" ? p.x : String(p.x),
    y: p.y,
    isSum: p.isSum ?? false,
    isIntermediateSum: p.isIntermediateSum ?? false,
    color: p.color ?? (p.isSum || p.isIntermediateSum ? sumColor : p.y >= 0 ? positiveColor : negativeColor),
  })) ?? [];

  return {
    chart: {
      backgroundColor: "transparent",
      style: { fontFamily: "inherit" },
      type: "waterfall",
      ...(chartHeight != null && { height: chartHeight }),
    },
    title: { text: style?.title ?? "", style: { color: "var(--text-secondary)", fontSize: "12px", fontWeight: "500" } },
    xAxis: {
      labels: { style: { color: "#888", fontSize: "10px" } },
      gridLineColor: "rgba(255,255,255,0.05)",
      lineColor: "rgba(255,255,255,0.1)",
      tickColor: "rgba(255,255,255,0.1)",
      type: "category" as const,
    },
    yAxis: buildYAxesConfig(style?.yAxes),
    legend: { enabled: false },
    plotOptions: {
      series: { animation: { duration: 300 } },
      waterfall: {
        borderWidth: 0,
        borderRadius: 2,
        dataLabels: {
          enabled: style?.dataLabels ?? false,
          style: { color: "#aaa", fontSize: "10px", textOutline: "none" },
        },
      },
    },
    series: [{ data: waterfallData, borderWidth: 0, borderRadius: 2 }],
    credits: { enabled: false },
  };
}

function buildCartesianConfig(
  data: ChartData,
  chartType: ChartType,
  spec: HighchartsChartTypeSpec,
  style: CartesianStyle | undefined,
  colors: string[],
  chartHeight: number | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleExtremes: (e: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const stacking = getStacking(chartType, style);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hcSeries: any[] = data.series.map((s, idx) => {
    const maybeOverrideSpec = s.chartType ? CHART_TYPE_REGISTRY[s.chartType] : null;
    // Highcharts renderer must ignore any non-highcharts per-series overrides.
    const seriesSpec =
      maybeOverrideSpec && maybeOverrideSpec.renderer === "highcharts"
        ? maybeOverrideSpec
        : spec;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seriesConfig: any = {
      type: seriesSpec.highchartsType,
      name: s.name,
      data: convertSeriesData(s, data.xAxisType, seriesSpec.highchartsType),
      color: s.color ?? colors[idx % colors.length],
      visible: s.visible !== false,
      yAxis: resolveYAxisIndex(s.yAxisId, style),
    };
    // Only add optional properties when defined — Highcharts treats
    // explicit `undefined` differently from absent keys and may crash
    // (e.g. accessing `marker.symbol` on `undefined`).
    if (s.dashStyle) seriesConfig.dashStyle = s.dashStyle;
    if (s.opacity != null) seriesConfig.opacity = s.opacity;
    if (s.lineWidth != null || style?.lineWidth != null) {
      seriesConfig.lineWidth = s.lineWidth ?? style?.lineWidth;
    }
    if (s.linkedTo) seriesConfig.linkedTo = s.linkedTo;
    if (style?.markerEnabled === false) seriesConfig.marker = { enabled: false };
    if (stacking) seriesConfig.stacking = stacking;

    return seriesConfig;
  });

  const xAxisConfig = buildXAxisConfig(data, style, handleExtremes);
  const yAxisConfig = buildYAxesConfig(style?.yAxes);

  const isStock = spec.usesStock || data.xAxisType === "datetime";

  // Build config explicitly — avoid spreading a theme object at the top level
  // which can inject unexpected keys that Highcharts misinterprets.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    chart: {
      backgroundColor: "transparent",
      style: { fontFamily: "inherit" },
      spacing: [10, 10, 10, 10],
      // Only set chart.type for non-stock charts (stockChart infers from series)
      ...(!isStock && { type: spec.highchartsType }),
      ...(chartHeight != null && { height: chartHeight }),
    },
    xAxis: xAxisConfig,
    yAxis: yAxisConfig,
    tooltip: {
      backgroundColor: "rgba(30,30,30,0.95)",
      borderColor: "rgba(255,255,255,0.1)",
      style: { color: "#ccc", fontSize: "11px" },
      split: false,
      shared: style?.tooltip?.shared ?? true,
    },
    legend: buildLegendConfig(style),
    plotOptions: {
      column: { borderWidth: 0, borderRadius: 2 },
      bar: { borderWidth: 0, borderRadius: 2 },
      series: {
        animation: { duration: 500 },
        dataLabels: {
          enabled: style?.dataLabels ?? false,
          style: { color: "#aaa", fontSize: "10px", textOutline: "none" },
        },
      },
    },
    series: hcSeries,
    credits: { enabled: false },
  };

  if (isStock) {
    config.rangeSelector = {
      enabled: false,
    };
    config.navigator = {
      enabled: true,
      maskFill: "rgba(229,123,83,0.1)",
      outlineColor: "rgba(255,255,255,0.1)",
      series: { color: "#E57B53", lineWidth: 1 },
      xAxis: { labels: { style: { color: "#666", fontSize: "10px" } } },
    };
    config.scrollbar = { enabled: false };
  }

  return config;
}

// ─── Helpers ───

function convertSeriesData(
  series: ChartSeries<PointType>,
  xAxisType: string,
  hcType: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  // arearange (linked forecast range)
  if (hcType === "arearange") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return series.data.map((p: any) => [p.x, p.low, p.high]);
  }

  // Cartesian: [x, y] or { name, y }
  return (series.data as CartesianPoint[]).map((p) => {
    if (xAxisType === "category" && typeof p.x === "string") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pt: any = { name: p.x, y: p.y };
      if (p.color) pt.color = p.color;
      return pt;
    }
    const point: [number, number] = [
      typeof p.x === "number" ? p.x : new Date(p.x).getTime(),
      p.y,
    ];
    return point;
  });
}

function buildXAxisConfig(
  data: ChartData,
  style: CartesianStyle | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleExtremes: (e: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    labels: { style: { color: "#888", fontSize: "10px" } },
    gridLineColor: "rgba(255,255,255,0.05)",
    lineColor: "rgba(255,255,255,0.1)",
    tickColor: "rgba(255,255,255,0.1)",
    crosshair: { color: "rgba(255,255,255,0.1)" },
    events: { afterSetExtremes: handleExtremes },
  };

  if (data.xAxisType === "datetime") {
    config.type = "datetime";
  } else if (data.xAxisType === "category") {
    config.type = "category";
  } else {
    config.type = "linear";
  }

  if (style?.xAxis?.title) {
    config.title = { text: style.xAxis.title, style: { color: "#888" } };
  }

  if (style?.xAxis?.gridLines === false) {
    config.gridLineWidth = 0;
  }

  return config;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildYAxesConfig(yAxes?: CartesianStyle["yAxes"]): any {
  if (!yAxes || yAxes.length === 0) {
    return DEFAULT_YAXIS;
  }

  return yAxes.map((axis) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg: any = {
      labels: {
        align: axis.position === "right" ? "right" : "left",
        style: { color: "#888", fontSize: "10px" },
      },
      title: { text: axis.title ?? "" },
      gridLineColor: axis.gridLines === false ? "transparent" : "rgba(255,255,255,0.05)",
      opposite: axis.position === "right",
      visible: axis.visible !== false,
      height: "100%",
    };
    if (axis.gridLines === false) cfg.gridLineWidth = 0;
    if (axis.min != null) cfg.min = axis.min;
    if (axis.max != null) cfg.max = axis.max;
    return cfg;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLegendConfig(style?: ChartStyle): any {
  if (!style?.legend || style.legend.position === "none") {
    return { enabled: false };
  }

  const pos = style.legend.position;
  return {
    enabled: true,
    itemStyle: { color: "#aaa", fontSize: "10px" },
    itemHoverStyle: { color: "#fff" },
    layout: pos === "left" || pos === "right" ? "vertical" : "horizontal",
    align: pos === "left" ? "left" : pos === "right" ? "right" : "center",
    verticalAlign: pos === "top" ? "top" : pos === "bottom" ? "bottom" : "middle",
  };
}

function getStacking(
  chartType: ChartType,
  style?: CartesianStyle
): string | undefined {
  if (chartType.startsWith("100-stacked")) return "percent";
  if (chartType.startsWith("stacked")) return "normal";
  if (style?.stacking) return style.stacking;
  return undefined;
}

function resolveYAxisIndex(
  yAxisId: string | undefined,
  style?: CartesianStyle
): number {
  if (!yAxisId || !style?.yAxes) return 0;
  const idx = style.yAxes.findIndex((a) => a.id === yAxisId);
  return idx >= 0 ? idx : 0;
}
