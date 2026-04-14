"use client";

import { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  customSeriesDefaultOptions,
  HistogramSeries,
  LineSeries,
  type CandlestickData,
  type CustomData,
  type CustomSeriesOptions,
  type CustomSeriesPricePlotValues,
  type CustomSeriesWhitespaceData,
  type HistogramData,
  type ICustomSeriesPaneRenderer,
  type ICustomSeriesPaneView,
  type IRange,
  type ISeriesApi,
  type LineData,
  type MouseEventParams,
  type PaneRendererCustomData,
  type PriceToCoordinateConverter,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { buildScenarioBands, genEvents, type EventItem } from "@/lib/data";
import type { CartesianStyle, ChartData, ChartTimeRange, OHLCPoint, Scenario } from "../types";
import { BandsIndicator } from "./plugins/bands-indicator";

interface LightweightCandlesRendererProps {
  data: ChartData;
  style?: CartesianStyle;
  scenario?: Scenario;
  height?: number;
  onTimeRangeChange?: (range: ChartTimeRange) => void;
}

const MIN_CHART_HEIGHT = 240;
const DEFAULT_MA_PERIOD = 5;
const DEFAULT_SCENARIO: Scenario = "BASE";
const SCENARIO_BAND_ID = "scenarioBand";
const SCENARIO_BAND_NAME = "Scenario Band";
const SCENARIO_BAND_COLOR = "rgba(99,102,241,0.55)";
const SCENARIO_BAND_FILL_COLOR = "rgba(99,102,241,0.35)";
const EVENT_MARKER_COLORS = ["#9B8AA6", "#D4A574", "#E57B53"];
const DEFAULT_CANDLE_COLORS = ["#C15F3C", "#6B7B8C", "#7D8471"];

type CandleRow = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  turnover: number | null;
};

type ScenarioBandPoint = CustomData<UTCTimestamp> & {
  low: number;
  high: number;
  mid: number;
};

type ScenarioBandSeriesApi = ISeriesApi<
  "Custom",
  Time
>;

class ScenarioBandPaneRenderer implements ICustomSeriesPaneRenderer {
  private bars: PaneRendererCustomData<UTCTimestamp, ScenarioBandPoint>["bars"] = [];
  private visibleRange: IRange<number> | null = null;
  private showBandsIndicator: boolean;

  constructor(showBandsIndicator: boolean) {
    this.showBandsIndicator = showBandsIndicator;
  }

  update(data: PaneRendererCustomData<UTCTimestamp, ScenarioBandPoint>): void {
    this.bars = data.bars;
    this.visibleRange = data.visibleRange;
  }

  draw(
    target: Parameters<ICustomSeriesPaneRenderer["draw"]>[0],
    priceToCoordinate: PriceToCoordinateConverter
  ): void {
    if (!this.visibleRange || this.bars.length < 2) return;

    const from = Math.max(Math.floor(this.visibleRange.from), 0);
    const to = Math.min(Math.ceil(this.visibleRange.to), this.bars.length - 1);
    if (to - from < 1) return;
    const isStartPointVisible = from <= 0 && to >= 0;
    const startBar = this.bars[0];
    if (!startBar) return;

    const upperPoints: Array<{ x: number; y: number }> = [];
    const lowerPoints: Array<{ x: number; y: number }> = [];
    for (let i = from; i <= to; i += 1) {
      const bar = this.bars[i];
      if (!bar) continue;
      const upperY = priceToCoordinate(bar.originalData.high);
      const lowerY = priceToCoordinate(bar.originalData.low);
      if (upperY === null || lowerY === null) continue;
      upperPoints.push({ x: bar.x, y: upperY });
      lowerPoints.push({ x: bar.x, y: lowerY });
    }

    if (upperPoints.length < 2 || lowerPoints.length < 2) return;

    target.useBitmapCoordinateSpace(({ context, mediaSize, horizontalPixelRatio, verticalPixelRatio }) => {
      context.save();
      // bitmap 좌표계에서 media 좌표(x/y)를 그대로 쓰기 위해 DPR 비율만큼 스케일을 맞춘다.
      context.scale(horizontalPixelRatio, verticalPixelRatio);

      context.strokeStyle = SCENARIO_BAND_COLOR;
      context.lineWidth = 1;
      const region = new Path2D();
      const lines = new Path2D();
      region.moveTo(upperPoints[0]!.x, upperPoints[0]!.y);
      lines.moveTo(upperPoints[0]!.x, upperPoints[0]!.y);
      for (const point of upperPoints) {
        region.lineTo(point.x, point.y);
        lines.lineTo(point.x, point.y);
      }

      const end = upperPoints.length - 1;
      region.lineTo(lowerPoints[end]!.x, lowerPoints[end]!.y);
      lines.moveTo(lowerPoints[end]!.x, lowerPoints[end]!.y);
      for (let i = end - 1; i >= 0; i -= 1) {
        region.lineTo(lowerPoints[i]!.x, lowerPoints[i]!.y);
        lines.lineTo(lowerPoints[i]!.x, lowerPoints[i]!.y);
      }
      region.lineTo(upperPoints[0]!.x, upperPoints[0]!.y);
      region.closePath();

      context.stroke(lines);
      context.fillStyle = SCENARIO_BAND_FILL_COLOR;
      context.fill(region);

      if (this.showBandsIndicator && isStartPointVisible) {
        // 시나리오 밴드가 시작되는 시점을 시각적으로 구분하기 위해 세로 점선을 그린다.
        context.save();
        context.setLineDash([4, 4]);
        context.strokeStyle = SCENARIO_BAND_COLOR;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(startBar.x, 0);
        context.lineTo(startBar.x, mediaSize.height);
        context.stroke();
        context.restore();
      }

      context.restore();
    });
  }
}

class ScenarioBandPaneView implements ICustomSeriesPaneView<UTCTimestamp, ScenarioBandPoint, CustomSeriesOptions> {
  private readonly rendererInstance: ScenarioBandPaneRenderer;

  constructor(showBandsIndicator: boolean) {
    this.rendererInstance = new ScenarioBandPaneRenderer(showBandsIndicator);
  }

  renderer(): ICustomSeriesPaneRenderer {
    return this.rendererInstance;
  }

  update(data: PaneRendererCustomData<UTCTimestamp, ScenarioBandPoint>): void {
    this.rendererInstance.update(data);
  }

  priceValueBuilder(plotRow: ScenarioBandPoint): CustomSeriesPricePlotValues {
    // 고가/저가/중앙값을 제공해 autoscale이 밴드 전체를 포괄하도록 맞춘다.
    return [plotRow.high, plotRow.low, plotRow.mid];
  }

  isWhitespace(
    item: ScenarioBandPoint | CustomSeriesWhitespaceData<UTCTimestamp>
  ): item is CustomSeriesWhitespaceData<UTCTimestamp> {
    return !("low" in item) || !("high" in item);
  }

  defaultOptions(): CustomSeriesOptions {
    return {
      ...customSeriesDefaultOptions,
      color: SCENARIO_BAND_COLOR,
    };
  }
}

function isOHLCPoint(point: unknown): point is OHLCPoint {
  if (!point || typeof point !== "object") return false;
  const candidate = point as Partial<OHLCPoint>;
  return (
    typeof candidate.x === "number" &&
    typeof candidate.open === "number" &&
    typeof candidate.high === "number" &&
    typeof candidate.low === "number" &&
    typeof candidate.close === "number"
  );
}

function toCandleRows(points: unknown[]): CandleRow[] {
  return points
    .filter(isOHLCPoint)
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((point) => ({
      time: Math.floor(point.x / 1000) as UTCTimestamp,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume:
        typeof point.volume === "number" && !Number.isNaN(point.volume)
          ? point.volume
          : null,
      turnover:
        typeof point.turnover === "number" && !Number.isNaN(point.turnover)
          ? point.turnover
          : null,
    }));
}

function toCandleSeriesRows(data: ChartData): Array<{ id: string; rows: CandleRow[] }> {
  return data.series
    .map((series) => ({
      id: series.id,
      rows: toCandleRows(series.data),
    }))
    .filter((series) => series.rows.length > 0);
}

function toCandlestickData(rows: CandleRow[]): CandlestickData<UTCTimestamp>[] {
  return rows.map((row) => ({
    time: row.time,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  }));
}

function toScenarioBandData(
  rows: CandleRow[],
  scenario: Scenario
): ScenarioBandPoint[] {
  if (rows.length === 0) return [];

  const priceData = rows.map((row) => [row.time * 1000, row.close] as [number, number]);
  const { band } = buildScenarioBands(scenario, priceData);
  return band.map(([timestamp, low, high]) => ({
    time: Math.floor(timestamp / 1000) as UTCTimestamp,
    low,
    high,
    mid: Math.round(((low + high) / 2) * 100) / 100,
    customValues: {
      id: SCENARIO_BAND_ID,
      scenario,
    },
  }));
}

function toVolumeData(rows: CandleRow[]): HistogramData<UTCTimestamp>[] {
  return rows
    .filter((row) => typeof row.volume === "number")
    .map((row) => ({
      time: row.time,
      value: row.volume as number,
    }));
}

function toMovingAverageData(
  rows: CandleRow[],
  period: number
): LineData<UTCTimestamp>[] {
  if (period <= 1) {
    return rows.map((row) => ({ time: row.time, value: row.close }));
  }

  const out: LineData<UTCTimestamp>[] = [];
  let rollingSum = 0;
  for (let i = 0; i < rows.length; i += 1) {
    rollingSum += rows[i]!.close;
    if (i >= period) {
      rollingSum -= rows[i - period]!.close;
    }
    if (i >= period - 1) {
      out.push({
        time: rows[i]!.time,
        value: Math.round((rollingSum / period) * 100) / 100,
      });
    }
  }
  return out;
}

function toEventMarkers(events: EventItem[]): {
  markers: SeriesMarker<UTCTimestamp>[];
  eventMap: Map<string, EventItem>;
} {
  // 동일 시점 이벤트가 겹치면 impact가 큰 이벤트를 우선 표시한다.
  const uniqueByTime = new Map<number, EventItem>();
  for (const event of events) {
    const key = Math.floor(event.x / 1000);
    const current = uniqueByTime.get(key);
    if (!current || event.impact > current.impact) {
      uniqueByTime.set(key, event);
    }
  }

  const selectedEvents = Array.from(uniqueByTime.values()).sort((a, b) => a.x - b.x);
  const eventMap = new Map<string, EventItem>();

  const markers = selectedEvents.map((event) => {
    eventMap.set(event.id, event);
    const color = EVENT_MARKER_COLORS[Math.max(0, Math.min(event.impact - 1, EVENT_MARKER_COLORS.length - 1))] ?? EVENT_MARKER_COLORS[0]!;
    return {
      id: event.id,
      time: Math.floor(event.x / 1000) as UTCTimestamp,
      position: "aboveBar",
      shape: "circle",
      color,
      text: event.title,
    } satisfies SeriesMarker<UTCTimestamp>;
  });

  return { markers, eventMap };
}

function toUnixMillis(time: Time): number {
  if (typeof time === "number") {
    return time * 1000;
  }
  if (typeof time === "string") {
    return new Date(time).getTime();
  }
  return Date.UTC(time.year, time.month - 1, time.day);
}

function isScenarioBandHoverData(value: unknown): value is { low: number; high: number } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<{ low: unknown; high: unknown }>;
  return typeof candidate.low === "number" && typeof candidate.high === "number";
}

function resolveHoveredObjectId(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (value && typeof value === "object" && "id" in value) {
    const candidate = (value as { id?: unknown }).id;
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate);
    }
  }
  return null;
}

export function LightweightCandlesRenderer({
  data,
  style,
  scenario,
  height,
  onTimeRangeChange,
}: LightweightCandlesRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scenarioTooltipRef = useRef<HTMLDivElement>(null);
  const scenarioTooltipUpperRef = useRef<HTMLSpanElement>(null);
  const scenarioTooltipLowerRef = useRef<HTMLSpanElement>(null);
  const eventTooltipRef = useRef<HTMLDivElement>(null);
  const eventTooltipTypeRef = useRef<HTMLSpanElement>(null);
  const eventTooltipDateRef = useRef<HTMLSpanElement>(null);
  const eventTooltipTitleRef = useRef<HTMLDivElement>(null);
  const eventTooltipSourceRef = useRef<HTMLDivElement>(null);
  const eventTooltipContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const hideScenarioTooltip = () => {
      const tooltip = scenarioTooltipRef.current;
      if (!tooltip) return;
      tooltip.style.display = "none";
    };

    const hideEventTooltip = () => {
      const tooltip = eventTooltipRef.current;
      if (!tooltip) return;
      tooltip.style.display = "none";
    };

    const hideAllTooltips = () => {
      hideScenarioTooltip();
      hideEventTooltip();
    };

    const moveTooltip = (tooltip: HTMLDivElement, point: { x: number; y: number }) => {
      const offset = 12;
      const tooltipWidth = tooltip.offsetWidth;
      const tooltipHeight = tooltip.offsetHeight;
      const maxLeft = Math.max(container.clientWidth - tooltipWidth, 0);
      const maxTop = Math.max(container.clientHeight - tooltipHeight, 0);
      const nextLeft = Math.min(Math.max(point.x + offset, 0), maxLeft);
      const nextTop = Math.min(Math.max(point.y + offset, 0), maxTop);
      tooltip.style.left = `${Math.round(nextLeft)}px`;
      tooltip.style.top = `${Math.round(nextTop)}px`;
    };

    // dependency 배열 크기를 고정하기 위해 effect 내부에서 파생 데이터를 계산한다.
    const candleSeriesRows = toCandleSeriesRows(data);
    const primaryCandleRows = candleSeriesRows[0]?.rows ?? [];
    const volumeData = toVolumeData(primaryCandleRows);
    const maPeriod = style?.lightweightCandles?.maPeriod ?? DEFAULT_MA_PERIOD;
    const ma5Data = toMovingAverageData(primaryCandleRows, maPeriod);
    const activeScenario = scenario ?? DEFAULT_SCENARIO;
    const scenarioBandData = toScenarioBandData(primaryCandleRows, activeScenario);
    const showBandsIndicator = style?.lightweightCandles?.showBandsIndicator !== false;
    const showVolume = style?.lightweightCandles?.showVolume !== false;
    const showMa5 = style?.lightweightCandles?.showMa5 !== false;
    const priceData = primaryCandleRows.map((row) => [row.time * 1000, row.close] as [number, number]);
    const events = genEvents(priceData);
    const { markers, eventMap } = toEventMarkers(events);
    const candleColors = style?.colorPalette?.length ? style.colorPalette : DEFAULT_CANDLE_COLORS;
    const candleSeriesColors = style?.lightweightCandles?.candleSeriesColors ?? {};

    const initialHeight = height ?? Math.max(container.clientHeight, MIN_CHART_HEIGHT);
    const chartOptions = {
      width: Math.max(container.clientWidth, 1),
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        attributionLogo: false,
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
      },
      grid: {
        vertLines: { color: "rgba(0, 0, 0, 0.04)" },
        horzLines: { color: "rgba(0, 0, 0, 0.04)" },
      },
    };

    const chart = createChart(container, chartOptions);
    let scenarioBandSeries: ScenarioBandSeriesApi | null = null;
    const candleSeriesList = candleSeriesRows.map((candleSeriesRow, index) => {
      const fallbackColor = candleColors[index % candleColors.length] ?? DEFAULT_CANDLE_COLORS[0];
      const seriesColorOverride = candleSeriesColors[candleSeriesRow.id];
      const upColor = seriesColorOverride?.up ?? fallbackColor;
      const downColor = seriesColorOverride?.down ?? fallbackColor;
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor,
        downColor,
        wickUpColor: upColor,
        wickDownColor: downColor,
        borderUpColor: upColor,
        borderDownColor: downColor,
      });
      candleSeries.setData(toCandlestickData(candleSeriesRow.rows));
      return candleSeries;
    });
    const primaryCandleSeries = candleSeriesList[0] ?? null;

    let bandIndicator: BandsIndicator | null = null;
    if (showBandsIndicator && primaryCandleSeries) {
      // BandsIndicator가 꺼졌을 때는 primitive를 attach하지 않아 표시를 완전히 숨긴다.
      bandIndicator = new BandsIndicator();
      primaryCandleSeries.attachPrimitive(bandIndicator);
    }

    if (showMa5 && ma5Data.length > 0) {
      const maSeries = chart.addSeries(LineSeries, {
        lineWidth: 2,
      });
      maSeries.setData(ma5Data);
    }

    if (scenarioBandData.length > 1) {
      scenarioBandSeries = chart.addCustomSeries(new ScenarioBandPaneView(showBandsIndicator), {
        title: SCENARIO_BAND_NAME,
        color: SCENARIO_BAND_COLOR,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      scenarioBandSeries.setData(scenarioBandData);
    }

    if (showVolume && volumeData.length > 0) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        priceFormat: { type: "volume" },
      });
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.74, bottom: 0 },
      });
      volumeSeries.setData(volumeData);
    }

    // 이벤트 데이터 기반 마커를 캔들 위에 올린다.
    const markersPlugin = primaryCandleSeries
      ? createSeriesMarkers(primaryCandleSeries, markers)
      : null;
    chart.timeScale().fitContent();

    const rangeHandler = (range: IRange<Time> | null) => {
      if (!range || !onTimeRangeChange) return;
      onTimeRangeChange({
        min: toUnixMillis(range.from),
        max: toUnixMillis(range.to),
      });
    };

    if (onTimeRangeChange) {
      chart.timeScale().subscribeVisibleTimeRangeChange(rangeHandler);
    }

    const crosshairHandler = (param: MouseEventParams<Time>) => {
      if (!param.point || !param.time) {
        hideAllTooltips();
        return;
      }

      const hoveredId = resolveHoveredObjectId(param.hoveredObjectId);
      if (hoveredId && eventMap.has(hoveredId)) {
        const event = eventMap.get(hoveredId)!;
        const tooltip = eventTooltipRef.current;
        const typeEl = eventTooltipTypeRef.current;
        const dateEl = eventTooltipDateRef.current;
        const titleEl = eventTooltipTitleRef.current;
        const sourceEl = eventTooltipSourceRef.current;
        const contentEl = eventTooltipContentRef.current;
        if (!tooltip || !typeEl || !dateEl || !titleEl || !sourceEl || !contentEl) return;

        typeEl.textContent = event.type;
        dateEl.textContent = event.sourceDate;
        titleEl.textContent = event.text;
        sourceEl.textContent = event.source;
        contentEl.textContent = event.content;

        tooltip.style.display = "block";
        moveTooltip(tooltip, param.point);
        hideScenarioTooltip();
        return;
      }

      hideEventTooltip();
      if (!scenarioBandSeries) {
        hideScenarioTooltip();
        return;
      }

      const hoveredData = param.seriesData.get(scenarioBandSeries);
      if (!isScenarioBandHoverData(hoveredData)) {
        hideScenarioTooltip();
        return;
      }

      const tooltip = scenarioTooltipRef.current;
      const upperEl = scenarioTooltipUpperRef.current;
      const lowerEl = scenarioTooltipLowerRef.current;
      if (!tooltip || !upperEl || !lowerEl) return;

      upperEl.textContent = hoveredData.high.toFixed(2);
      lowerEl.textContent = hoveredData.low.toFixed(2);

      tooltip.style.display = "block";
      moveTooltip(tooltip, param.point);
    };
    const hasScenarioBand = Boolean(scenarioBandSeries);
    if (hasScenarioBand) {
      chart.subscribeCrosshairMove(crosshairHandler);
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const targetEntry = entries[0];
      if (!targetEntry) return;
      const nextWidth = Math.max(Math.floor(targetEntry.contentRect.width), 1);
      const nextHeight = height ?? Math.max(Math.floor(targetEntry.contentRect.height), MIN_CHART_HEIGHT);
      chart.applyOptions({ width: nextWidth, height: nextHeight });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (onTimeRangeChange) {
        chart.timeScale().unsubscribeVisibleTimeRangeChange(rangeHandler);
      }
      if (hasScenarioBand) {
        chart.unsubscribeCrosshairMove(crosshairHandler);
      }
      if (bandIndicator && primaryCandleSeries) {
        primaryCandleSeries.detachPrimitive(bandIndicator);
      }
      hideAllTooltips();
      if (markersPlugin) {
        markersPlugin.detach();
      }
      chart.remove();
    };
  }, [data, style, scenario, height, onTimeRangeChange]);

  const containerStyle: React.CSSProperties = {
    width: "100%",
    ...(height ? { height } : { height: "100%" }),
  };

  return (
    <div className="relative flex-1 min-w-0 p-2 bg-transparent">
      <div ref={containerRef} style={containerStyle} />
      <div
        ref={scenarioTooltipRef}
        className="pointer-events-none absolute z-10 hidden rounded border border-border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
      >
        <div className="mb-0.5 font-medium">{SCENARIO_BAND_NAME}</div>
        <div>
          Upper: <span ref={scenarioTooltipUpperRef}>-</span>
        </div>
        <div>
          Lower: <span ref={scenarioTooltipLowerRef}>-</span>
        </div>
      </div>
      <div
        ref={eventTooltipRef}
        className="pointer-events-none absolute z-10 hidden max-w-[320px] rounded border border-border bg-background/95 px-2 py-1 text-[11px] shadow-sm"
      >
        <div className="mb-0.5 font-medium">
          Event <span ref={eventTooltipTypeRef} className="text-muted-foreground">-</span>
        </div>
        <div className="mb-0.5 text-muted-foreground">
          <span ref={eventTooltipDateRef}>-</span>
        </div>
        <div ref={eventTooltipTitleRef} className="mb-0.5 text-foreground">-</div>
        <div ref={eventTooltipSourceRef} className="mb-0.5 text-muted-foreground">-</div>
        <div ref={eventTooltipContentRef} className="line-clamp-4 text-muted-foreground">
          -
        </div>
      </div>
    </div>
  );
}
