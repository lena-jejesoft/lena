"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ChartData, ChartStyle, CartesianPoint } from "../types";

type GaugeNeedle = {
  id: string;
  name: string;
  value: number;
  color?: string;
};

type GaugeScale = {
  min: number;
  max: number;
  tickInterval: number;
};

const FALLBACK_COLORS = [
  "#4ECDC4",
  "#5B9BD5",
  "#E57B53",
  "#9B8AA6",
  "#D4A574",
  "#7D8471",
];

const ARC_COLORS = [
  "#9F2936",
  "#C74442",
  "#DF7C27",
  "#E0BA2F",
  "#87C74A",
  "#2F9E7D",
];

function extractNeedles(data: ChartData): GaugeNeedle[] {
  return data.series.flatMap((series) => {
    for (let i = series.data.length - 1; i >= 0; i -= 1) {
      const point = series.data[i] as CartesianPoint | undefined;
      if (!point || typeof point.y !== "number" || !Number.isFinite(point.y)) continue;
      return [{
        id: series.id,
        name: series.name,
        value: point.y,
        color: series.color,
      }];
    }
    return [];
  });
}

function resolveStep(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(step)));
  const normalized = step / magnitude;
  if (normalized <= 1) return 1 * magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function buildScale(values: number[]): GaugeScale {
  if (values.length === 0) {
    return { min: 0, max: 100, tickInterval: 20 };
  }
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) {
    // 단일 값이어도 게이지 바늘이 보이도록 범위를 만든다.
    const pad = Math.max(1, Math.abs(min) * 0.3);
    min -= pad;
    max += pad;
  }
  const tickInterval = resolveStep((max - min) / 4);
  const niceMin = Math.floor(min / tickInterval) * tickInterval;
  const niceMax = Math.ceil(max / tickInterval) * tickInterval;
  return {
    min: niceMin,
    max: niceMax,
    tickInterval,
  };
}

function buildLegendConfig(style?: ChartStyle) {
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

export function HighchartsGaugeRenderer({
  data,
  style,
  height,
}: {
  data: ChartData;
  style?: ChartStyle;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  const needles = useMemo(() => extractNeedles(data), [data]);
  const palette = style?.colorPalette ?? FALLBACK_COLORS;
  const scale = useMemo(() => buildScale(needles.map((needle) => needle.value)), [needles]);

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    async function init() {
      const mod = await import("highcharts/highstock");
      const Highcharts = mod.default || mod;
      const moreMod = await import("highcharts/highcharts-more");
      const moreInit = (moreMod as any).default || moreMod;
      if (typeof moreInit === "function") moreInit(Highcharts);
      if (destroyed || !containerRef.current) return;

      const range = scale.max - scale.min || 1;
      const segmentSize = range / ARC_COLORS.length;
      const plotBands = ARC_COLORS.map((color, idx) => ({
        from: scale.min + segmentSize * idx,
        to: scale.min + segmentSize * (idx + 1),
        color,
        thickness: 14,
        borderWidth: 0,
      }));

      const series = needles.map((needle, idx) => {
        const color = needle.color ?? palette[idx % palette.length] ?? FALLBACK_COLORS[idx % FALLBACK_COLORS.length]!;
        return {
          type: "gauge",
          name: needle.name,
          data: [needle.value],
          color,
          dial: {
            backgroundColor: color,
            radius: `${Math.max(58, 86 - idx * 8)}%`,
            baseWidth: 7,
            topWidth: 1,
            rearLength: "0%",
          },
          pivot: {
            radius: 5,
            backgroundColor: "#cbd5e1",
          },
          dataLabels: {
            enabled: false,
          },
        };
      });

      chartRef.current = (Highcharts as { chart: Function }).chart(containerRef.current, {
        chart: {
          type: "gauge",
          backgroundColor: "transparent",
          style: { fontFamily: "inherit" },
          spacing: [10, 10, 10, 10],
          ...(height != null && { height }),
        },
        title: {
          text: style?.title ?? "",
          style: { color: "var(--text-secondary)", fontSize: "12px", fontWeight: "500" },
        },
        pane: {
          startAngle: -120,
          endAngle: 120,
          background: [
            {
              outerRadius: "100%",
              innerRadius: "70%",
              borderWidth: 0,
              backgroundColor: "rgba(148,163,184,0.16)",
              shape: "arc",
            },
          ],
        },
        yAxis: {
          min: scale.min,
          max: scale.max,
          tickInterval: scale.tickInterval,
          tickLength: 8,
          tickWidth: 1,
          tickColor: "rgba(255,255,255,0.35)",
          tickPosition: "inside",
          lineWidth: 0,
          minorTickLength: 0,
          minorTickInterval: null,
          labels: {
            distance: 18,
            style: { color: "#cbd5e1", fontSize: "10px" },
            formatter: function formatter(this: { value: number }) {
              const v = Number(this.value);
              if (!Number.isFinite(v)) return "";
              if (Math.abs(v) < 1e-6) return "0%";
              return `${v.toFixed(1)}%`;
            },
          },
          plotBands,
        },
        legend: buildLegendConfig(style),
        tooltip: {
          shared: false,
          pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>{point.y:.1f}%</b><br/>',
          backgroundColor: "rgba(30,30,30,0.95)",
          borderColor: "rgba(255,255,255,0.1)",
          style: { color: "#ccc", fontSize: "11px" },
        },
        plotOptions: {
          series: {
            animation: { duration: 300 },
          },
        },
        series: series as any,
        credits: { enabled: false },
      });
    }

    init();

    return () => {
      destroyed = true;
      if (chartRef.current) {
        chartRef.current.destroy?.();
        chartRef.current = null;
      }
    };
  }, [needles, scale.min, scale.max, scale.tickInterval, palette, style, height]);

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
