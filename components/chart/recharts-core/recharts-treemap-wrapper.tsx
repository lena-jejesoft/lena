"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { Treemap, ResponsiveContainer } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";
import type { TreemapDataItem, TimepointTreemapData } from "./recharts-adapter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export interface RechartsTreemapWrapperProps {
  data?: TreemapDataItem[];
  timepointData?: TimepointTreemapData[];  // 시점별 데이터 (있으면 드롭다운 표시)
  enabledSeries: Set<string>;
  themeColors?: ChartThemeColors;
  height?: number;
  allSeriesFields: string[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
}

interface CustomContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  name?: string;
  index?: number;
  colors: string[];
  allSeriesFields: string[];
  root?: { children?: { length: number } };
  size?: number;
  seriesName?: string;
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  filteredData?: TreemapDataItem[];
}

const CustomizedContent: React.FC<CustomContentProps> = (props) => {
  const {
    x = 0, y = 0, width = 0, height = 0, depth = 0,
    name, index = 0, colors, allSeriesFields,
    seriesName, onTooltipChange, filteredData
  } = props;

  // depth=1: 시리즈 노드, depth=2: 값 노드
  const actualSeriesName = depth === 1 ? name : seriesName;
  const seriesIndex = allSeriesFields.indexOf(actualSeriesName || '');
  const colorIndex = seriesIndex >= 0 ? seriesIndex : index;

  const handleMouseEnter = useCallback(() => {
    if (onTooltipChange && filteredData && name) {
      if (depth === 1) {
        // 시리즈 노드 호버: 각 시리즈의 총 합계 표시
        const allSeriesValues = filteredData.map(series => {
          const totalSize = series.children?.reduce((sum, c) => sum + (c.size || 0), 0) || 0;
          const sIndex = allSeriesFields.indexOf(series.name);
          return {
            dataKey: series.name,
            value: totalSize,
            color: colors[sIndex >= 0 ? sIndex : 0],
            payload: { name: series.name, size: totalSize, seriesName: series.name }
          };
        }).filter(item => item.value !== undefined && item.value > 0);

        onTooltipChange(allSeriesValues, name);
      } else {
        // 값 노드 호버: 동일 날짜의 모든 시리즈 값
        const allSeriesValues = filteredData.map(series => {
          const child = series.children?.find(c => c.name === name);
          const sIndex = allSeriesFields.indexOf(series.name);
          return {
            dataKey: series.name,
            value: child?.size,
            color: colors[sIndex >= 0 ? sIndex : 0],
            payload: { name, size: child?.size, seriesName: series.name }
          };
        }).filter(item => item.value !== undefined);

        onTooltipChange(allSeriesValues, name);
      }
    }
  }, [onTooltipChange, filteredData, name, depth, allSeriesFields, colors]);

  const handleMouseLeave = useCallback(() => {
    onTooltipChange?.(null, null);
  }, [onTooltipChange]);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? colors[colorIndex % colors.length] : "#ffffff00",
          stroke: "#fff",
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      {depth === 1 && width > 40 && height > 20 ? (
        <text
          x={x + 8}
          y={y + 18}
          textAnchor="start"
          fontSize={12}
          style={{ pointerEvents: "none", fontWeight: 300, fill: "#ff0000" }}
        >
          {(() => {
            // 대략적인 글자 너비 계산 (12px 폰트 기준 약 7px per 글자)
            const charWidth = 7;
            const padding = 16; // 좌우 여백
            const maxChars = Math.floor((width - padding) / charWidth);
            const displayName = name || "";
            if (displayName.length > maxChars && maxChars > 3) {
              return displayName.slice(0, maxChars - 2) + "..";
            }
            return displayName;
          })()}
        </text>
      ) : null}
    </g>
  );
};

export function RechartsTreemapWrapper({
  data,
  timepointData,
  enabledSeries,
  themeColors,
  height = 400,
  allSeriesFields,
  onTooltipChange,
}: RechartsTreemapWrapperProps) {
  const [selectedTimepoint, setSelectedTimepoint] = useState<string | null>(null);

  // 시점 선택 모드 확인
  const isTimepointMode = timepointData && timepointData.length > 0;

  // 음수가 있는 시점 목록 (TimepointTreemapData.hasNegative 사용)
  const negativeTimepoints = useMemo(() => {
    if (!isTimepointMode) return new Set<string>();
    return new Set(
      timepointData.filter(tp => tp.hasNegative).map(tp => tp.timepoint)
    );
  }, [isTimepointMode, timepointData]);

  // timepointData 변경 시 최신 시점으로 자동 설정 (음수 없는 시점 우선)
  useEffect(() => {
    if (timepointData && timepointData.length > 0) {
      // 음수 없는 시점 중 가장 최근 시점 찾기
      const validTimepoints = timepointData.filter(tp => !negativeTimepoints.has(tp.timepoint));
      if (validTimepoints.length > 0) {
        setSelectedTimepoint(validTimepoints[validTimepoints.length - 1].timepoint);
      } else {
        // 모든 시점에 음수가 있으면 마지막 시점 선택
        setSelectedTimepoint(timepointData[timepointData.length - 1].timepoint);
      }
    }
  }, [timepointData, negativeTimepoints]);

  // 시점 선택 시 레이블 업데이트 (onTooltipChange 의존성 제외 - 무한 루프 방지)
  useEffect(() => {
    if (isTimepointMode && selectedTimepoint && onTooltipChange) {
      onTooltipChange(null, selectedTimepoint);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimepointMode, selectedTimepoint]);

  // 시점 모드일 때 선택된 시점의 데이터 사용
  const activeData = useMemo(() => {
    if (isTimepointMode && selectedTimepoint) {
      const selected = timepointData.find(tp => tp.timepoint === selectedTimepoint);
      return selected?.data || [];
    }
    return data || [];
  }, [isTimepointMode, selectedTimepoint, timepointData, data]);

  const filteredData = useMemo(() => {
    return activeData.filter((item) => enabledSeries.has(item.name));
  }, [activeData, enabledSeries]);

  const colors = useMemo(() => {
    const baseColors = themeColors?.seriesColors || [];
    return expandSeriesColors(baseColors, allSeriesFields.length);
  }, [themeColors?.seriesColors, allSeriesFields.length]);

  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="text-muted-foreground text-sm">표시할 시리즈가 없습니다</span>
      </div>
    );
  }

  // 시점 선택 모드: 드롭다운 + 트리맵
  if (isTimepointMode) {
    return (
      <div className="w-full flex flex-col" style={{ height }}>
        {/* 시점 선택 드롭다운 */}
        <div className="flex items-center gap-2 mb-2 px-2">
          <span className="text-sm text-muted-foreground">시점:</span>
          <Select value={selectedTimepoint || ""} onValueChange={setSelectedTimepoint}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="시점 선택" />
            </SelectTrigger>
            <SelectContent>
              {timepointData.map(tp => {
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

        {/* 트리맵 */}
        <ResponsiveContainer width="100%" height={height - 40}>
          <Treemap
            data={filteredData}
            dataKey="size"
            stroke="#fff"
            fill="#8884d8"
            isAnimationActive={false}
            content={
              <CustomizedContent
                colors={colors}
                allSeriesFields={allSeriesFields}
                onTooltipChange={onTooltipChange}
                filteredData={filteredData}
              />
            }
          />
        </ResponsiveContainer>
      </div>
    );
  }

  // 기존 모드: 트리맵만
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Treemap
        data={filteredData}
        dataKey="size"
        stroke="#fff"
        fill="#8884d8"
        isAnimationActive={false}
        content={
          <CustomizedContent
            colors={colors}
            allSeriesFields={allSeriesFields}
            onTooltipChange={onTooltipChange}
            filteredData={filteredData}
          />
        }
      />
    </ResponsiveContainer>
  );
}
