"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ChartThemeColors, getAxisLineColor } from "./recharts-wrapper";

export function RechartsSyncedArea({
  chartData,
  syncedAreaLeftField,
  syncedAreaRightField,
  seriesFields,
  seriesColors,
  yAxisLabel,
  themeColors,
  setTooltipPayload,
  setHoveredLabel,
}: {
  chartData: Array<Record<string, any>>;
  syncedAreaLeftField: string;
  syncedAreaRightField: string;
  seriesFields: string[];
  seriesColors: string[];
  yAxisLabel: string;
  themeColors: ChartThemeColors;
  setTooltipPayload: (payload: any[] | null) => void;
  setHoveredLabel: (label: string | null) => void;
}) {
  return (
    // 동기화 영역 차트 (좌우 배치)
    (() => {
      // 동기화 영역 차트 호버 핸들러 (양쪽 시리즈 값 모두 표시)
      const handleSyncedAreaMouseMove = (state: any) => {
        if (state && state.activeLabel && chartData) {
          const hoveredData = chartData.find((d: any) => d.date_display === state.activeLabel);
          if (hoveredData) {
            const payload: any[] = [];
            if (syncedAreaLeftField) {
              const leftColorIdx = seriesFields.indexOf(syncedAreaLeftField);
              payload.push({
                dataKey: syncedAreaLeftField,
                value: hoveredData[syncedAreaLeftField],
                color: seriesColors[leftColorIdx % seriesColors.length],
              });
            }
            if (syncedAreaRightField) {
              const rightColorIdx = seriesFields.indexOf(syncedAreaRightField);
              payload.push({
                dataKey: syncedAreaRightField,
                value: hoveredData[syncedAreaRightField],
                color: seriesColors[rightColorIdx % seriesColors.length],
              });
            }
            setTooltipPayload(payload);
            setHoveredLabel(state.activeLabel);
          }
        }
      };
      const handleSyncedAreaMouseLeave = () => {
        setTooltipPayload(null);
        setHoveredLabel(null);
      };
      return (
        <div className="flex gap-4 h-full">
          {/* 좌측 차트 */}
          <div className="flex-1 min-w-0 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                syncId="synced-area"
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                onMouseMove={handleSyncedAreaMouseMove}
                onMouseLeave={handleSyncedAreaMouseLeave}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={themeColors?.gridColor || "hsl(var(--muted))"} opacity={0.5} />
                <XAxis
                  dataKey="date_display"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                  tickFormatter={(value) => {
                    if (typeof value === "number") {
                      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    }
                    return value;
                  }}
                  label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "hsl(var(--muted-foreground))" } } : undefined}
                />
                <Tooltip
                  cursor={{ stroke: themeColors?.textColor || "hsl(var(--foreground))", strokeOpacity: 0.15, strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={() => null}
                />
                {syncedAreaLeftField && (() => {
                  const colorIdx = seriesFields.indexOf(syncedAreaLeftField);
                  const color = seriesColors[colorIdx % seriesColors.length];
                  return (
                    <Area
                      key={syncedAreaLeftField}
                      type="monotone"
                      dataKey={syncedAreaLeftField}
                      stroke={color}
                      fill={color}
                      fillOpacity={0.3}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
                    />
                  );
                })()}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* 우측 차트 */}
          <div className="flex-1 min-w-0 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                syncId="synced-area"
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                onMouseMove={handleSyncedAreaMouseMove}
                onMouseLeave={handleSyncedAreaMouseLeave}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={themeColors?.gridColor || "hsl(var(--muted))"} opacity={0.5} />
                <XAxis
                  dataKey="date_display"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                  tickFormatter={(value) => {
                    if (typeof value === "number") {
                      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
                    }
                    return value;
                  }}
                  label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "hsl(var(--muted-foreground))" } } : undefined}
                />
                <Tooltip
                  cursor={{ stroke: themeColors?.textColor || "hsl(var(--foreground))", strokeOpacity: 0.15, strokeWidth: 1, strokeDasharray: "4 4" }}
                  content={() => null}
                />
                {syncedAreaRightField && (() => {
                  const colorIdx = seriesFields.indexOf(syncedAreaRightField);
                  const color = seriesColors[colorIdx % seriesColors.length];
                  return (
                    <Area
                      key={syncedAreaRightField}
                      type="monotone"
                      dataKey={syncedAreaRightField}
                      stroke={color}
                      fill={color}
                      fillOpacity={0.3}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
                    />
                  );
                })()}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
    })()
  );
}
