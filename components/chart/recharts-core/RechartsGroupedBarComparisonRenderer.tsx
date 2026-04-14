"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CartesianPoint, ChartData, ChartStyle } from "../types";

type GroupedBarItem = {
  label: string;
  value: number;
  fill: string;
};

type GroupedPanel = {
  id: string;
  title: string;
  bars: GroupedBarItem[];
};

const DEFAULT_COLORS = [
  "#2f92d0",
  "#67c9be",
  "#d4a574",
  "#9b8aa6",
  "#7d8471",
  "#b1ada1",
];

function isCartesianPoint(value: unknown): value is CartesianPoint {
  return Boolean(
    value &&
      typeof value === "object" &&
      "x" in value &&
      "y" in value &&
      typeof (value as CartesianPoint).y === "number" &&
      Number.isFinite((value as CartesianPoint).y)
  );
}

function formatBillions(value: number): string {
  return `US$${value.toFixed(2)}b`;
}

function GroupedBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: GroupedBarItem }>;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div
      style={{
        background: "rgba(28, 30, 36, 0.94)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        padding: "8px 10px",
        color: "rgba(255,255,255,0.92)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>{item.label}</div>
      <div style={{ marginTop: 2, color: "rgba(255,255,255,0.75)" }}>
        {formatBillions(item.value)}
      </div>
    </div>
  );
}

export function RechartsGroupedBarComparisonRenderer({
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
  const chartHeight = height ?? 320;
  const panelChartHeight = Math.max(120, chartHeight - 86);
  const palette = style?.colorPalette?.length ? style.colorPalette : DEFAULT_COLORS;

  const panels = useMemo<GroupedPanel[]>(() => {
    const labelColorMap = new Map<string, string>();

    // 패널마다 동일 라벨은 같은 색을 유지해 비교 가독성을 높인다.
    for (const series of data.series) {
      for (const point of series.data as unknown[]) {
        if (!isCartesianPoint(point)) continue;
        const label = typeof point.x === "string" ? point.x : String(point.x);
        if (!labelColorMap.has(label)) {
          labelColorMap.set(
            label,
            point.color ??
              palette[labelColorMap.size % palette.length] ??
              DEFAULT_COLORS[labelColorMap.size % DEFAULT_COLORS.length]
          );
        }
      }
    }

    return data.series
      .map((series) => {
        const bars = (series.data as unknown[])
          .filter(isCartesianPoint)
          .map((point) => {
            const label = typeof point.x === "string" ? point.x : String(point.x);
            return {
              label,
              value: point.y,
              fill: point.color ?? labelColorMap.get(label) ?? palette[0] ?? DEFAULT_COLORS[0],
            };
          })
          .filter((item) => Number.isFinite(item.value));

        return {
          id: series.id,
          title: series.name || series.id,
          bars,
        };
      })
      .filter((panel) => panel.bars.length > 0);
  }, [data.series, palette]);

  if (panels.length === 0) {
    return (
      <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />
    );
  }

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <div
        className="grid h-full gap-3 overflow-auto"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
      >
        {panels.map((panel) => (
          <section
            key={panel.id}
            className="min-h-[220px] rounded-md border border-white/10 bg-[#1b1d22] p-2 flex flex-col"
            onMouseLeave={() => {
              onLegendStateChange?.({ tooltipPayload: null, hoveredLabel: null });
            }}
          >
            <div style={{ height: panelChartHeight }}>
              <ResponsiveContainer width="100%" height={panelChartHeight}>
                <BarChart
                  data={panel.bars}
                  margin={{ top: 30, right: 4, left: 4, bottom: 0 }}
                  barCategoryGap="18%"
                >
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.12)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: "rgba(255,255,255,0.7)" }}
                    tick={{ fill: "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: 600 }}
                  />
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.08)" }}
                    content={<GroupedBarTooltip />}
                  />
                  <Bar dataKey="value">
                    {panel.bars.map((bar, idx) => (
                      <Cell
                        key={`${panel.id}-${bar.label}-${idx}`}
                        fill={bar.fill}
                        onMouseEnter={() => {
                          onLegendStateChange?.({
                            tooltipPayload: [
                              {
                                dataKey: bar.label,
                                value: bar.value,
                                payload: bar,
                              },
                            ],
                            hoveredLabel: panel.title,
                          });
                        }}
                      />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(value: unknown) =>
                        typeof value === "number" && Number.isFinite(value)
                          ? formatBillions(value)
                          : ""
                      }
                      fill="rgba(255,255,255,0.96)"
                      fontSize={11}
                      fontWeight={700}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="px-1 pt-1 text-2xl font-semibold leading-none text-white/92">
              {panel.title}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
