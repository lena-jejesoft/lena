"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
  Cell,
} from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import type { TimepointRankingBarData } from "@chartCore/src/tools/chartTool/utils/recharts-adapter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@chartCore/src/components/ui/select";

export interface RechartsRankingBarWrapperProps {
  data: Array<Record<string, string | number>>;
  xField: string;
  yField: string;
  timepointData?: TimepointRankingBarData[];
  themeColors?: ChartThemeColors;
  height?: number;
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  onRankingDataChange?: (data: Array<{ name: string; value: number }> | null) => void;
}

function getAxisLineColor(): string {
  if (typeof window === "undefined") return "#ffffff";
  // Shadow DOM 내부에서는 document.documentElement에 dark 클래스가 없음
  // CSS 변수로 dark 여부 확인
  const bgValue = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  // CSS 변수가 없거나 dark 모드면 흰색
  if (!bgValue) return "#ffffff";
  const isDark = document.documentElement.classList.contains("dark");
  return isDark ? "#ffffff" : "hsl(0 0% 44%)";
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

// Y축 레이블 truncate (최대 12자)
function truncateLabel(text: string, maxLength: number = 12): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

// 커스텀 Y축 tick 렌더러
function CustomYAxisTick(props: any) {
  const { x, y, payload } = props;
  const label = truncateLabel(String(payload.value));
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fill="hsl(var(--muted-foreground))"
      fontSize={11}
    >
      {label}
    </text>
  );
}

// 랭킹 막대 색상 (1위 → 마지막) - Anthropic 브랜드 기반
const RANKING_COLOR_START = "#C15F3C";  // Crail (진한 러스트 오렌지)
const RANKING_COLOR_END = "#F5E0D5";    // 연한 크림 (큰 색상 차이)

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
    : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function interpolateColor(color1: string, color2: string, factor: number): string {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + (c2.r - c1.r) * factor);
  const g = Math.round(c1.g + (c2.g - c1.g) * factor);
  const b = Math.round(c1.b + (c2.b - c1.b) * factor);
  return rgbToHex(r, g, b);
}

export function RechartsRankingBarWrapper({
  data,
  xField,
  yField,
  timepointData,
  themeColors,
  height = 400,
  onTooltipChange,
  onRankingDataChange,
}: RechartsRankingBarWrapperProps) {
  const timepointList = useMemo(() => timepointData ?? [], [timepointData]);
  // 시점 모드 여부 (timepointData가 있고 2개 이상일 때)
  const isTimepointMode = timepointList.length > 1;

  // 사용자가 선택한 시점은 override로만 저장하고 실제 선택 시점은 파생값으로 계산한다.
  const [selectedTimepointOverride, setSelectedTimepointOverride] = useState<string | null>(null);

  // 음수 시점 목록
  const negativeTimepoints = useMemo(() => {
    if (!isTimepointMode) return new Set<string>();
    return new Set(timepointList.filter((tp) => tp.hasNegative).map((tp) => tp.timepoint));
  }, [isTimepointMode, timepointList]);

  const selectedTimepoint = useMemo(() => {
    if (!isTimepointMode) return null;
    if (
      selectedTimepointOverride &&
      timepointList.some(
        (tp) => tp.timepoint === selectedTimepointOverride && !negativeTimepoints.has(tp.timepoint)
      )
    ) {
      return selectedTimepointOverride;
    }

    const validTimepoints = timepointList.filter((tp) => !negativeTimepoints.has(tp.timepoint));
    if (validTimepoints.length > 0) {
      return validTimepoints[validTimepoints.length - 1].timepoint;
    }
    return timepointList[timepointList.length - 1]?.timepoint ?? null;
  }, [isTimepointMode, selectedTimepointOverride, timepointList, negativeTimepoints]);

  // 시점 선택 시 레이블 업데이트
  useEffect(() => {
    if (isTimepointMode && selectedTimepoint) {
      onTooltipChange?.(null, selectedTimepoint);
    }
  }, [isTimepointMode, selectedTimepoint, onTooltipChange]);

  // 시점 선택 시 랭킹 데이터 업데이트
  useEffect(() => {
    if (isTimepointMode && selectedTimepoint && onRankingDataChange) {
      const selected = timepointList.find((tp) => tp.timepoint === selectedTimepoint);
      if (selected) {
        onRankingDataChange(selected.data);
      }
    }
  }, [isTimepointMode, selectedTimepoint, timepointList, onRankingDataChange]);

  // 활성 데이터 (시점 모드면 선택된 시점의 데이터, 아니면 원본)
  const activeData = useMemo(() => {
    if (isTimepointMode && selectedTimepoint) {
      const selected = timepointList.find((tp) => tp.timepoint === selectedTimepoint);
      if (selected) {
        return selected.data.map((item) => ({
          [xField]: item.name,
          [yField]: item.value,
        }));
      }
    }
    return data;
  }, [isTimepointMode, selectedTimepoint, timepointList, data, xField, yField]);

  const sortedData = useMemo(() => {
    return [...activeData].sort((a, b) => {
      const aValue = typeof a[yField] === "number" ? a[yField] : 0;
      const bValue = typeof b[yField] === "number" ? b[yField] : 0;
      return (bValue as number) - (aValue as number);
    });
  }, [activeData, yField]);

  // 순위별 색상 계산
  const getBarColor = (index: number): string => {
    if (sortedData.length <= 1) return RANKING_COLOR_START;
    const factor = index / (sortedData.length - 1);
    return interpolateColor(RANKING_COLOR_START, RANKING_COLOR_END, factor);
  };

  // 시점 모드: 드롭다운 + 차트
  if (isTimepointMode) {
    return (
      <div className="w-full flex flex-col" style={{ height }}>
        {/* 시점 선택 드롭다운 */}
        <div className="flex items-center gap-2 mb-2 px-2">
          <span className="text-sm text-muted-foreground">시점:</span>
          <Select value={selectedTimepoint || ""} onValueChange={setSelectedTimepointOverride}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="시점 선택" />
            </SelectTrigger>
            <SelectContent>
              {timepointList.map((tp) => {
                const isNegative = negativeTimepoints.has(tp.timepoint);
                return (
                  <SelectItem
                    key={tp.timepoint}
                    value={tp.timepoint}
                    className="text-xs"
                    disabled={isNegative}
                  >
                    {tp.timepoint}{isNegative ? " (음수)" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* 차트 */}
        <ResponsiveContainer width="100%" height={height - 40}>
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 10, right: 80, left: 10, bottom: 10 }}
            onMouseMove={(state: any) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                const label = state.activeLabel;
                const payload = state.activePayload;
                onTooltipChange?.(payload, label);
              }
            }}
            onMouseLeave={() => {
              onTooltipChange?.(null, null);
            }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={themeColors?.gridColor || "hsl(var(--muted))"}
              opacity={0.5}
              horizontal={true}
              vertical={false}
            />
            <XAxis
              type="number"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
              tickFormatter={(value) => formatValue(value)}
            />
            <Bar
              dataKey={yField}
              radius={[0, 2, 2, 0]}
            >
              {sortedData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(index)} />
              ))}
              <LabelList
                dataKey={yField}
                position="right"
                fill="hsl(var(--muted-foreground))"
                fontSize={10}
                formatter={(value: number) => formatValue(value)}
              />
            </Bar>
            <YAxis
              type="category"
              dataKey={xField}
              tick={<CustomYAxisTick />}
              tickLine={false}
              axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
              width={100}
              interval={0}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // 단일 시점 모드: 기존 차트만
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sortedData}
        layout="vertical"
        margin={{ top: 10, right: 80, left: 10, bottom: 10 }}
        onMouseMove={(state: any) => {
          if (state && state.activePayload && state.activePayload.length > 0) {
            const label = state.activeLabel;
            const payload = state.activePayload;
            onTooltipChange?.(payload, label);
          }
        }}
        onMouseLeave={() => {
          onTooltipChange?.(null, null);
        }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={themeColors?.gridColor || "hsl(var(--muted))"}
          opacity={0.5}
          horizontal={true}
          vertical={false}
        />
        <XAxis
          type="number"
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
          tickFormatter={(value) => formatValue(value)}
        />
        <Bar
          dataKey={yField}
          radius={[0, 2, 2, 0]}
        >
          {sortedData.map((_, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(index)} />
          ))}
          <LabelList
            dataKey={yField}
            position="right"
            fill="hsl(var(--muted-foreground))"
            fontSize={10}
            formatter={(value: number) => formatValue(value)}
          />
        </Bar>
        <YAxis
          type="category"
          dataKey={xField}
          tick={<CustomYAxisTick />}
          tickLine={false}
          axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
          width={100}
          interval={0}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
