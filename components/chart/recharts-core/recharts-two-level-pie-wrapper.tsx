"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

// 2단계 원형 차트 전용 색상 팔레트 (Anthropic 브랜드 스타일)
export const TWO_LEVEL_PIE_COLORS = [
  "#C15F3C",   // Crail (러스트 오렌지)
  "#B1ADA1",   // Cloudy (웜 그레이)
  "#7D8471",   // Sage (세이지 그린)
  "#9B8AA6",   // Lavender (라벤더)
  "#D4A574",   // Tan (탄 베이지)
  "#6B7B8C",   // Slate (슬레이트 그레이)
];

export interface TwoLevelPieInnerDataItem {
  name: string;
  value: number;
}

export interface TwoLevelPieOuterDataItem {
  name: string;
  value: number;
  series: string;
}

export interface TimepointTwoLevelPieData {
  timepoint: string;
  date: string;
  innerData: TwoLevelPieInnerDataItem[];
  outerData: TwoLevelPieOuterDataItem[];
}

export interface RechartsTwoLevelPieWrapperProps {
  innerData?: TwoLevelPieInnerDataItem[];
  outerData?: TwoLevelPieOuterDataItem[];
  timepointData?: TimepointTwoLevelPieData[];  // 시점별 데이터 (있으면 timepoint selection)
  enabledSeries: Set<string>;
  themeColors?: ChartThemeColors;
  height?: number;
  allSeriesFields: string[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
}

/**
 * 헥스 색상을 HSL로 변환
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 50 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * 색상의 밝기를 조정하여 변형 색상 생성 (헥스, HSL 모두 지원)
 */
function adjustLightness(color: string, adjustment: number): string {
  if (!color) return "hsl(0 0% 50%)"; // fallback 색상

  // 헥스 색상 처리
  if (color.startsWith('#')) {
    const { h, s, l } = hexToHsl(color);
    const newL = Math.max(20, Math.min(90, l + adjustment));
    return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(newL)}%)`;
  }

  // HSL 색상 처리
  const match = color.match(/hsl\((\d+)\s+([\d.]+)%\s+([\d.]+)%\)/);
  if (!match) return color;

  const h = match[1];
  const s = match[2];
  let l = parseFloat(match[3]);

  l = Math.max(20, Math.min(90, l + adjustment));

  return `hsl(${h} ${s}% ${l}%)`;
}

/** 기본 라벨 렌더러 (연결선 포함, 호버 시 숨김) */
const renderTwoLevelDefaultLabel = (
  props: any,
  threshold: number,
  isAnyHovered: boolean,
  totalSum: number,
  groupName?: string,
  groupSum?: number
) => {
  const { cx, cy, midAngle, outerRadius, value, name, fill, index } = props;

  // 그룹 모드: 첫 번째 항목에만 그룹 레이블 표시
  if (groupName !== undefined && groupSum !== undefined) {
    if (index !== 0) return null;
    const groupPercent = totalSum > 0 ? groupSum / totalSum : 0;
    if (groupPercent < threshold) return null;
    if (isAnyHovered) return null;

    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * (midAngle ?? 0));
    const cos = Math.cos(-RADIAN * (midAngle ?? 0));
    const sx = (cx ?? 0) + ((outerRadius ?? 0) + 2) * cos;
    const sy = (cy ?? 0) + ((outerRadius ?? 0) + 2) * sin;
    const mx = (cx ?? 0) + ((outerRadius ?? 0) + 18) * cos;
    const my = (cy ?? 0) + ((outerRadius ?? 0) + 18) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 10;
    const ey = my;
    const textAnchor = cos >= 0 ? "start" : "end";

    return (
      <g>
        <path
          d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
          stroke={fill || "hsl(var(--muted-foreground))"}
          fill="none"
          strokeWidth={1}
        />
        <text
          x={ex + (cos >= 0 ? 1 : -1) * 4}
          y={ey}
          textAnchor={textAnchor}
          dominantBaseline="central"
          className="fill-foreground"
          style={{ fontSize: 11 }}
        >
          {`${groupName} (${(groupPercent * 100).toFixed(1)}%)`}
        </text>
      </g>
    );
  }

  // 기존 모드 (그룹 없음)
  const percent = totalSum > 0 ? value / totalSum : 0;

  // 비율 미달이거나 호버 중이면 라벨 숨김
  if (percent < threshold) return null;
  if (isAnyHovered) return null;

  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));

  // 연결선 시작점 (파이 바깥)
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 2) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 2) * sin;
  // 연결선 중간점
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 18) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 18) * sin;
  // 연결선 끝점 (수평)
  const ex = mx + (cos >= 0 ? 1 : -1) * 10;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      {/* 연결선 */}
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={fill || "hsl(var(--muted-foreground))"}
        fill="none"
        strokeWidth={1}
      />
      {/* 라벨 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 4}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="central"
        className="fill-foreground"
        style={{ fontSize: 11 }}
      >
        {`${name} (${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

/** 호버 시 활성 섹터 렌더러 */
const renderTwoLevelActiveShape = (props: any, totalSum: number) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    value,
  } = props;

  // 전체 합계 기준으로 비율 계산
  const percent = totalSum > 0 ? (value ?? 0) / totalSum : 0;

  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 4) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 4) * sin;
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 22) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 22) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 10;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  // 외부 링은 `name`이 시리즈명, `series`가 그룹 키로 사용된다.
  const displayName = payload?.name || payload?.series || "";
  const truncatedName = displayName.length > 10 ? `${displayName.slice(0, 10)}...` : displayName;

  return (
    <g>
      {/* 기본 섹터 */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      {/* 외부 링 강조 */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={(outerRadius ?? 0) + 6}
        outerRadius={(outerRadius ?? 0) + 10}
        fill={fill}
      />
      {/* 연결선 */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      {/* 연결점 */}
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      {/* 값 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 8}
        y={ey}
        textAnchor={textAnchor}
        className="fill-foreground"
        style={{ fontSize: 11 }}
      >
        {truncatedName}: {(value ?? 0).toLocaleString()}
      </text>
      {/* 비율 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 8}
        y={ey}
        dy={14}
        textAnchor={textAnchor}
        className="fill-muted-foreground"
        style={{ fontSize: 10 }}
      >
        {`(${((percent ?? 0) * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

export function RechartsTwoLevelPieWrapper({
  innerData,
  outerData,
  timepointData,
  enabledSeries,
  themeColors,
  height = 400,
  allSeriesFields,
  onTooltipChange,
}: RechartsTwoLevelPieWrapperProps) {
  const [selectedTimepoint, setSelectedTimepoint] = useState<string | null>(null);
  // 외부 링 호버 인덱스 (series별로 관리)
  const [activeOuterKey, setActiveOuterKey] = useState<string | null>(null);
  const [activeOuterIndex, setActiveOuterIndex] = useState<number | undefined>(undefined);

  // 2단계 원형 차트 전용 색상 사용
  const colors = useMemo(() => {
    const baseColors =
      themeColors?.seriesColors && themeColors.seriesColors.length > 0
        ? themeColors.seriesColors
        : TWO_LEVEL_PIE_COLORS;
    return expandSeriesColors(baseColors, allSeriesFields.length);
  }, [themeColors?.seriesColors, allSeriesFields.length]);

  // 시리즈별 색상 조회
  const getColorForSeries = useCallback(
    (seriesName: string) => {
      const idx = allSeriesFields.indexOf(seriesName);
      return idx >= 0 ? colors[idx % colors.length] : colors[0];
    },
    [allSeriesFields, colors]
  );

  // 시점 선택 모드 확인
  const isTimepointMode = timepointData && timepointData.length > 0;

  // timepointData 변경 시 최신 시점으로 자동 설정
  useEffect(() => {
    if (timepointData && timepointData.length > 0) {
      const lastTimepoint = timepointData[timepointData.length - 1];
      setSelectedTimepoint(lastTimepoint.timepoint);
    }
  }, [timepointData]);

  // 시점 선택 시 레이블 업데이트
  useEffect(() => {
    if (isTimepointMode && selectedTimepoint && onTooltipChange) {
      onTooltipChange(null, selectedTimepoint);
    }
  }, [isTimepointMode, selectedTimepoint, onTooltipChange]);

  // 시점 모드일 때 선택된 시점의 데이터 사용
  const activeInnerData = useMemo(() => {
    if (isTimepointMode && selectedTimepoint) {
      const selected = timepointData.find(tp => tp.timepoint === selectedTimepoint);
      return selected?.innerData || [];
    }
    return innerData || [];
  }, [isTimepointMode, selectedTimepoint, timepointData, innerData]);

  const activeOuterData = useMemo(() => {
    if (isTimepointMode && selectedTimepoint) {
      const selected = timepointData.find(tp => tp.timepoint === selectedTimepoint);
      return selected?.outerData || [];
    }
    return outerData || [];
  }, [isTimepointMode, selectedTimepoint, timepointData, outerData]);

  // enabledSeries 기반 내부 데이터 필터링
  // 그룹명이 enabledSeries에 있고, 해당 그룹의 시리즈 중 활성화된 것이 있어야 표시
  const filteredInnerData = useMemo(() => {
    return activeInnerData.filter((item) => {
      // 기본: enabledSeries에 그룹명 있는지 확인
      if (!enabledSeries.has(item.name)) return false;

      // 계층 모드: 외부 데이터에서 해당 그룹의 시리즈 중 활성화된 것이 있는지 확인
      const groupOuterData = activeOuterData.filter(o => o.series === item.name);
      // 그룹에 속한 시리즈가 없으면 그룹명만으로 판단 (비계층 모드)
      if (groupOuterData.length === 0) return true;
      // 그룹에 속한 시리즈 중 하나라도 활성화되어 있으면 표시
      return groupOuterData.some(o => enabledSeries.has(o.name));
    });
  }, [activeInnerData, activeOuterData, enabledSeries]);

  // enabledSeries 기반 외부 데이터 필터링
  // 그룹명(item.series)과 개별 시리즈명(item.name) 둘 다 확인
  const filteredOuterData = useMemo(() => {
    return activeOuterData.filter((item) =>
      enabledSeries.has(item.series) && enabledSeries.has(item.name)
    );
  }, [activeOuterData, enabledSeries]);

  // 내부 원의 각 시리즈별 시작/끝 각도 계산
  const innerAngles = useMemo(() => {
    const total = filteredInnerData.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return [];

    let currentAngle = 90; // Recharts 기본 시작 각도

    return filteredInnerData.map((item) => {
      const angle = (item.value / total) * 360;
      const result = {
        name: item.name,
        startAngle: currentAngle,
        endAngle: currentAngle - angle,
      };
      currentAngle -= angle;
      return result;
    });
  }, [filteredInnerData]);

  // 내부 원 호버 핸들러
  const onInnerPieEnter = useCallback(
    (_: any, index: number) => {
      const item = filteredInnerData[index];
      if (item && onTooltipChange) {
        // 시점 모드면 selectedTimepoint를 label로 전달
        const label = isTimepointMode && selectedTimepoint ? selectedTimepoint : item.name;
        onTooltipChange([{ dataKey: item.name, value: item.value, payload: item }], label);
      }
    },
    [filteredInnerData, onTooltipChange, isTimepointMode, selectedTimepoint]
  );

  const onPieLeave = useCallback(() => {
    onTooltipChange?.(null, null);
    setActiveOuterKey(null);
    setActiveOuterIndex(undefined);
  }, [onTooltipChange]);

  // 전체 외부 데이터 합계 계산 (라벨 표시 조건용)
  const allOuterSum = useMemo(() => {
    return filteredOuterData.reduce((sum, d) => sum + d.value, 0);
  }, [filteredOuterData]);

  if (filteredInnerData.length === 0 && filteredOuterData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="text-muted-foreground text-sm">표시할 시리즈가 없습니다</span>
      </div>
    );
  }

  // 시점 선택 모드: 드롭다운 + 차트
  if (isTimepointMode) {
    return (
      <div className="w-full flex flex-col" style={{ height }}>
        {/* 시점 선택 드롭다운 */}
        <div className="flex items-center gap-1 mb-1 px-2">
          <span className="text-sm text-muted-foreground">시점:</span>
          <Select value={selectedTimepoint || ""} onValueChange={setSelectedTimepoint}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="시점 선택" />
            </SelectTrigger>
            <SelectContent>
              {timepointData.map(tp => (
                <SelectItem key={tp.timepoint} value={tp.timepoint} className="text-xs">
                  {tp.timepoint}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 2단계 파이 차트 */}
        <ResponsiveContainer width="100%" height={height - 32}>
          <PieChart margin={{ top: 40, right: 80, bottom: 40, left: 80 }}>
            {/* 내부 원 - 그룹별 합계 */}
            <Pie
              data={filteredInnerData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius="50%"
              startAngle={90}
              endAngle={-270}
              onMouseEnter={onInnerPieEnter}
              onMouseLeave={onPieLeave}
            >
              {filteredInnerData.map((entry) => {
                // 시리즈가 속한 그룹명 찾기
                const groupName = activeOuterData.find(d => d.series === entry.name)?.name;
                // 그룹명이 "그룹N" 패턴인지 확인
                const isGroupPattern = /^그룹\d+$/.test(groupName || '');
                let fillColor: string;
                if (isGroupPattern) {
                  // 그룹 모드: 그룹 번호로 기본 색상 결정
                  const groupNumMatch = groupName?.match(/\d+/);
                  const groupIndex = groupNumMatch ? parseInt(groupNumMatch[0], 10) - 1 : 0;
                  const baseColor = colors[groupIndex % colors.length];

                  // 그룹 내 시리즈별 값 기준 순위 계산 (외부 링/레전드와 동일)
                  const groupSeriesData = filteredOuterData.filter(d => d.name === groupName);
                  const seriesSums = new Map<string, number>();
                  groupSeriesData.forEach(d => {
                    seriesSums.set(d.series, (seriesSums.get(d.series) || 0) + d.value);
                  });
                  const sortedSeries = [...seriesSums.entries()].sort((a, b) => b[1] - a[1]);
                  const rank = sortedSeries.findIndex(([s]) => s === entry.name);
                  const seriesCount = sortedSeries.length;
                  const lightnessStep = seriesCount > 1 ? 30 / (seriesCount - 1) : 0;
                  const adjustment = -15 + rank * lightnessStep;
                  fillColor = adjustLightness(baseColor, adjustment);
                } else {
                  // 디폴트 모드: 시리즈별 색상 사용
                  fillColor = adjustLightness(getColorForSeries(entry.name), -15);
                }
                return <Cell key={`inner-${entry.name}`} fill={fillColor} />;
              })}
            </Pie>
            {/* 외부 링 - 시리즈별 값 (내부 원 각도에 맞춰 정렬) */}
            {(() => {
              // 그룹별 합계 계산
              const groupSums = new Map<string, number>();
              filteredOuterData.forEach(d => {
                groupSums.set(d.name, (groupSums.get(d.name) || 0) + d.value);
              });

              // innerAngles 순서에 따라 그룹별 첫 번째 시리즈 결정
              const firstSeriesPerGroup = new Map<string, string>();
              innerAngles.forEach(seriesAngle => {
                const groupName = filteredOuterData.find(d => d.series === seriesAngle.name)?.name;
                if (groupName && !firstSeriesPerGroup.has(groupName)) {
                  firstSeriesPerGroup.set(groupName, seriesAngle.name);
                }
              });

              return innerAngles.map((seriesAngle) => {
                const seriesOuterData = filteredOuterData.filter(
                  (d) => d.series === seriesAngle.name
                );

                if (seriesOuterData.length === 0) return null;

                // 현재 시리즈가 호버 중인지 확인
                const isThisSeriesActive = activeOuterKey === seriesAngle.name;
                const isAnyHovered = activeOuterIndex !== undefined;

                // 이 시리즈가 속한 그룹의 첫 번째 시리즈인지 확인
                const groupName = seriesOuterData[0]?.name;
                const isFirstInGroup = groupName && firstSeriesPerGroup.get(groupName) === seriesAngle.name;
                const groupSum = groupName ? groupSums.get(groupName) : undefined;

                return (
                  <Pie
                    key={`outer-${seriesAngle.name}`}
                    data={seriesOuterData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    startAngle={seriesAngle.startAngle}
                    endAngle={seriesAngle.endAngle}
                    innerRadius="60%"
                    outerRadius="80%"
                    activeIndex={isThisSeriesActive ? activeOuterIndex : undefined}
                    activeShape={(props) => renderTwoLevelActiveShape(props, allOuterSum)}
                    label={isFirstInGroup
                      ? (props) => renderTwoLevelDefaultLabel(props, 0.01, isAnyHovered, allOuterSum, groupName, groupSum)
                      : false
                    }
                    labelLine={false}
                    onMouseEnter={(_: any, index: number) => {
                      const item = seriesOuterData[index];
                      if (item && onTooltipChange) {
                        onTooltipChange(
                          [{ dataKey: item.series, value: item.value, payload: item, name: item.name }],
                          selectedTimepoint || item.name
                        );
                      }
                      setActiveOuterKey(seriesAngle.name);
                      setActiveOuterIndex(index);
                    }}
                    onMouseLeave={onPieLeave}
                  >
                    {seriesOuterData.map((entry, idx) => {
                      const groupName = entry.name;
                      // 그룹명이 "그룹N" 패턴인지 확인
                      const isGroupPattern = /^그룹\d+$/.test(groupName || '');
                      let fillColor: string;
                      if (isGroupPattern) {
                        // 그룹 모드: 그룹 번호로 기본 색상 결정
                        const groupNumMatch = groupName?.match(/\d+/);
                        const groupIndex = groupNumMatch ? parseInt(groupNumMatch[0], 10) - 1 : 0;
                        const baseColor = colors[groupIndex % colors.length];

                        // 그룹 내 시리즈별 값 기준 순위 계산 (레전드와 동일)
                        const groupSeriesData = filteredOuterData.filter(d => d.name === groupName);
                        const seriesSums = new Map<string, number>();
                        groupSeriesData.forEach(d => {
                          seriesSums.set(d.series, (seriesSums.get(d.series) || 0) + d.value);
                        });
                        const sortedSeries = [...seriesSums.entries()].sort((a, b) => b[1] - a[1]);
                        const rank = sortedSeries.findIndex(([s]) => s === entry.series);
                        const seriesCount = sortedSeries.length;
                        const lightnessStep = seriesCount > 1 ? 30 / (seriesCount - 1) : 0;
                        const adjustment = -15 + rank * lightnessStep;
                        fillColor = adjustLightness(baseColor, adjustment);
                      } else {
                        // 디폴트 모드: 시리즈별 색상 사용
                        fillColor = adjustLightness(getColorForSeries(entry.series), -15);
                      }

                      return (
                        <Cell
                          key={`outer-${entry.name}-${idx}`}
                          fill={fillColor}
                        />
                      );
                    })}
                  </Pie>
                );
              });
            })()}
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
        <PieChart margin={{ top: 40, right: 80, bottom: 40, left: 80 }}>
          {/* 내부 원 - 시리즈별 합계 */}
          <Pie
            data={filteredInnerData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
          outerRadius="50%"
          startAngle={90}
          endAngle={-270}
          onMouseEnter={onInnerPieEnter}
          onMouseLeave={onPieLeave}
        >
          {filteredInnerData.map((entry) => {
            // 시리즈가 속한 그룹명 찾기
            const groupName = activeOuterData.find(d => d.series === entry.name)?.name;
            // 그룹명이 "그룹N" 패턴인지 확인
            const isGroupPattern = /^그룹\d+$/.test(groupName || '');
            let fillColor: string;
            if (isGroupPattern) {
              // 그룹 모드: 그룹 번호로 기본 색상 결정
              const groupNumMatch = groupName?.match(/\d+/);
              const groupIndex = groupNumMatch ? parseInt(groupNumMatch[0], 10) - 1 : 0;
              const baseColor = colors[groupIndex % colors.length];

              // 그룹 내 시리즈별 값 기준 순위 계산 (외부 링/레전드와 동일)
              const groupSeriesData = filteredOuterData.filter(d => d.name === groupName);
              const seriesSums = new Map<string, number>();
              groupSeriesData.forEach(d => {
                seriesSums.set(d.series, (seriesSums.get(d.series) || 0) + d.value);
              });
              const sortedSeries = [...seriesSums.entries()].sort((a, b) => b[1] - a[1]);
              const rank = sortedSeries.findIndex(([s]) => s === entry.name);
              const seriesCount = sortedSeries.length;
              const lightnessStep = seriesCount > 1 ? 30 / (seriesCount - 1) : 0;
              const adjustment = -15 + rank * lightnessStep;
              fillColor = adjustLightness(baseColor, adjustment);
            } else {
              // 디폴트 모드: 시리즈별 색상 사용
              fillColor = adjustLightness(getColorForSeries(entry.name), -15);
            }
            return <Cell key={`inner-${entry.name}`} fill={fillColor} />;
          })}
        </Pie>
        {/* 외부 링 - 시리즈별 연도별 값 (내부 원 각도에 맞춰 정렬) */}
        {(() => {
          // 그룹별 합계 계산
          const groupSums = new Map<string, number>();
          filteredOuterData.forEach(d => {
            groupSums.set(d.name, (groupSums.get(d.name) || 0) + d.value);
          });

          // innerAngles 순서에 따라 그룹별 첫 번째 시리즈 결정
          const firstSeriesPerGroup = new Map<string, string>();
          innerAngles.forEach(seriesAngle => {
            const groupName = filteredOuterData.find(d => d.series === seriesAngle.name)?.name;
            if (groupName && !firstSeriesPerGroup.has(groupName)) {
              firstSeriesPerGroup.set(groupName, seriesAngle.name);
            }
          });

          return innerAngles.map((seriesAngle) => {
            const seriesOuterData = filteredOuterData.filter(
              (d) => d.series === seriesAngle.name
            );

            if (seriesOuterData.length === 0) return null;

            // 현재 시리즈가 호버 중인지 확인
            const isThisSeriesActive = activeOuterKey === seriesAngle.name;
            const isAnyHovered = activeOuterIndex !== undefined;

            // 이 시리즈가 속한 그룹의 첫 번째 시리즈인지 확인
            const groupName = seriesOuterData[0]?.name;
            const isFirstInGroup = groupName && firstSeriesPerGroup.get(groupName) === seriesAngle.name;
            const groupSum = groupName ? groupSums.get(groupName) : undefined;

            return (
              <Pie
                key={`outer-${seriesAngle.name}`}
                data={seriesOuterData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                startAngle={seriesAngle.startAngle}
                endAngle={seriesAngle.endAngle}
                innerRadius="60%"
                outerRadius="80%"
                activeIndex={isThisSeriesActive ? activeOuterIndex : undefined}
                activeShape={(props) => renderTwoLevelActiveShape(props, allOuterSum)}
                label={isFirstInGroup
                  ? (props) => renderTwoLevelDefaultLabel(props, 0.01, isAnyHovered, allOuterSum, groupName, groupSum)
                  : false
                }
                labelLine={false}
              onMouseEnter={(_: any, index: number) => {
                const item = seriesOuterData[index];
                if (item && onTooltipChange) {
                  onTooltipChange(
                    [{ dataKey: item.series, value: item.value, payload: item, name: item.name }],
                    item.name
                  );
                }
                setActiveOuterKey(seriesAngle.name);
                setActiveOuterIndex(index);
              }}
              onMouseLeave={onPieLeave}
            >
              {seriesOuterData.map((entry, idx) => {
                const groupName = entry.name;
                // 그룹명이 "그룹N" 패턴인지 확인
                const isGroupPattern = /^그룹\d+$/.test(groupName || '');
                let fillColor: string;
                if (isGroupPattern) {
                  // 그룹 모드: 그룹 번호로 기본 색상 결정
                  const groupNumMatch = groupName?.match(/\d+/);
                  const groupIndex = groupNumMatch ? parseInt(groupNumMatch[0], 10) - 1 : 0;
                  const baseColor = colors[groupIndex % colors.length];

                  // 그룹 내 시리즈별 값 기준 순위 계산 (레전드와 동일)
                  const groupSeriesData = filteredOuterData.filter(d => d.name === groupName);
                  const seriesSums = new Map<string, number>();
                  groupSeriesData.forEach(d => {
                    seriesSums.set(d.series, (seriesSums.get(d.series) || 0) + d.value);
                  });
                  const sortedSeries = [...seriesSums.entries()].sort((a, b) => b[1] - a[1]);
                  const rank = sortedSeries.findIndex(([s]) => s === entry.series);
                  const seriesCount = sortedSeries.length;
                  const lightnessStep = seriesCount > 1 ? 30 / (seriesCount - 1) : 0;
                  const adjustment = -15 + rank * lightnessStep;
                  fillColor = adjustLightness(baseColor, adjustment);
                } else {
                  // 디폴트 모드: 시리즈별 색상 사용
                  fillColor = adjustLightness(getColorForSeries(entry.series), -15);
                }

                return (
                  <Cell
                    key={`outer-${entry.name}-${idx}`}
                    fill={fillColor}
                  />
                );
              })}
            </Pie>
            );
          });
        })()}
      </PieChart>
    </ResponsiveContainer>
  );
}
