"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { chartColors, hexToHsl } from "@/lib/colors";

// 2단계 원형 차트 전용 색상 팔레트 (Anthropic 브랜드 스타일)
export const TWO_LEVEL_PIE_COLORS = chartColors

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

  // 시리즈명 말줄임 (최대 10자) - series가 있으면 시리즈명, 없으면 name 사용
  const displayName = payload?.series || payload?.name || "";
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
  const [selectedTimepointOverride, setSelectedTimepointOverride] = useState<string | null>(null);
  const timepointList = useMemo(() => timepointData ?? [], [timepointData]);
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
  }, [themeColors, allSeriesFields.length]);

  // 시리즈별 색상 조회
  const getColorForSeries = useCallback(
    (seriesName: string) => {
      const idx = allSeriesFields.indexOf(seriesName);
      return idx >= 0 ? colors[idx % colors.length] : colors[0];
    },
    [allSeriesFields, colors]
  );

  // 시점 선택 모드 확인
  const isTimepointMode = timepointList.length > 0;
  const selectedTimepoint = useMemo(() => {
    if (!isTimepointMode) return null;
    if (selectedTimepointOverride && timepointList.some((tp) => tp.timepoint === selectedTimepointOverride)) {
      return selectedTimepointOverride;
    }
    return timepointList[timepointList.length - 1]?.timepoint ?? null;
  }, [isTimepointMode, selectedTimepointOverride, timepointList]);

  // 시점 선택 시 레이블 업데이트
  useEffect(() => {
    if (isTimepointMode && selectedTimepoint && onTooltipChange) {
      onTooltipChange(null, selectedTimepoint);
    }
  }, [isTimepointMode, selectedTimepoint, onTooltipChange]);

  // 시점 모드일 때 선택된 시점의 데이터 사용
  const activeInnerData = useMemo(() => {
    if (isTimepointMode && selectedTimepoint) {
      const selected = timepointList.find((tp) => tp.timepoint === selectedTimepoint);
      return selected?.innerData || [];
    }
    return innerData || [];
  }, [isTimepointMode, selectedTimepoint, timepointList, innerData]);

  const activeOuterData = useMemo(() => {
    if (isTimepointMode && selectedTimepoint) {
      const selected = timepointList.find((tp) => tp.timepoint === selectedTimepoint);
      return selected?.outerData || [];
    }
    return outerData || [];
  }, [isTimepointMode, selectedTimepoint, timepointList, outerData]);

  // 내부 원 이름이 outer.name을 가리키면 그룹 기반 내부 원 모드로 판단
  const isGroupInnerMode = useMemo(() => {
    if (activeInnerData.length === 0 || activeOuterData.length === 0) return false;

    const outerNames = new Set(activeOuterData.map((item) => item.name));
    const outerSeries = new Set(activeOuterData.map((item) => item.series));
    const hasNameMatch = activeInnerData.some((item) => outerNames.has(item.name));
    const hasSeriesMatch = activeInnerData.some((item) => outerSeries.has(item.name));

    return hasNameMatch && !hasSeriesMatch;
  }, [activeInnerData, activeOuterData]);

  // enabledSeries 기반 내부 데이터 필터링
  const filteredInnerData = useMemo(() => {
    if (isGroupInnerMode) {
      return activeInnerData.filter((item) => {
        if (!enabledSeries.has(item.name)) return false;
        const groupOuterData = activeOuterData.filter((outerItem) => outerItem.name === item.name);
        if (groupOuterData.length === 0) return false;
        return groupOuterData.some((outerItem) => enabledSeries.has(outerItem.series));
      });
    }

    return activeInnerData.filter((item) => {
      if (!enabledSeries.has(item.name)) return false;
      const groupOuterData = activeOuterData.filter((outerItem) => outerItem.series === item.name);
      if (groupOuterData.length === 0) return true;
      return groupOuterData.some((outerItem) => enabledSeries.has(outerItem.name));
    });
  }, [activeInnerData, activeOuterData, enabledSeries, isGroupInnerMode]);

  // enabledSeries 기반 외부 데이터 필터링
  const filteredOuterData = useMemo(() => {
    if (isGroupInnerMode) {
      return activeOuterData.filter((item) => enabledSeries.has(item.series));
    }

    return activeOuterData.filter((item) =>
      enabledSeries.has(item.series) && enabledSeries.has(item.name)
    );
  }, [activeOuterData, enabledSeries, isGroupInnerMode]);

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

  const groupedOuterNames = useMemo(() => {
    return Array.from(new Set(filteredOuterData.map((item) => item.name)));
  }, [filteredOuterData]);

  const getOuterGroupNameForInner = useCallback(
    (innerName: string): string | undefined => {
      if (isGroupInnerMode) return innerName;
      return filteredOuterData.find((item) => item.series === innerName)?.name;
    },
    [isGroupInnerMode, filteredOuterData]
  );

  const getOuterDataForInner = useCallback(
    (innerName: string): TwoLevelPieOuterDataItem[] => {
      if (isGroupInnerMode) {
        return filteredOuterData.filter((item) => item.name === innerName);
      }
      return filteredOuterData.filter((item) => item.series === innerName);
    },
    [isGroupInnerMode, filteredOuterData]
  );

  const getGroupBaseColor = useCallback(
    (groupName: string): string => {
      const groupNumMatch = groupName.match(/^그룹(\d+)$/);
      if (groupNumMatch) {
        const groupIndex = parseInt(groupNumMatch[1], 10) - 1;
        return colors[groupIndex % colors.length];
      }

      const groupedIndex = groupedOuterNames.indexOf(groupName);
      if (groupedIndex >= 0) return colors[groupedIndex % colors.length];

      const fallbackIndex = allSeriesFields.indexOf(groupName);
      return colors[(fallbackIndex >= 0 ? fallbackIndex : 0) % colors.length];
    },
    [groupedOuterNames, colors, allSeriesFields]
  );

  const getGroupedSeriesColor = useCallback(
    (groupName: string, seriesName: string): string => {
      const baseColor = getGroupBaseColor(groupName);
      const groupSeriesData = filteredOuterData.filter((item) => item.name === groupName);
      const seriesSums = new Map<string, number>();

      groupSeriesData.forEach((item) => {
        seriesSums.set(item.series, (seriesSums.get(item.series) || 0) + item.value);
      });

      const sortedSeries = [...seriesSums.entries()].sort((a, b) => b[1] - a[1]);
      const rank = sortedSeries.findIndex(([name]) => name === seriesName);
      if (rank < 0) return adjustLightness(baseColor, -15);

      const seriesCount = sortedSeries.length;
      const lightnessStep = seriesCount > 1 ? 30 / (seriesCount - 1) : 0;
      const adjustment = -15 + rank * lightnessStep;
      return adjustLightness(baseColor, adjustment);
    },
    [getGroupBaseColor, filteredOuterData]
  );

  const getInnerFillColor = useCallback(
    (innerName: string): string => {
      if (isGroupInnerMode) {
        return adjustLightness(getGroupBaseColor(innerName), -15);
      }

      const groupName = filteredOuterData.find((item) => item.series === innerName)?.name;
      if (groupName && /^그룹\d+$/.test(groupName)) {
        return getGroupedSeriesColor(groupName, innerName);
      }
      return adjustLightness(getColorForSeries(innerName), -15);
    },
    [isGroupInnerMode, getGroupBaseColor, filteredOuterData, getGroupedSeriesColor, getColorForSeries]
  );

  const getOuterFillColor = useCallback(
    (entry: TwoLevelPieOuterDataItem): string => {
      if (isGroupInnerMode) {
        return getGroupedSeriesColor(entry.name, entry.series);
      }

      const groupName = entry.name;
      const isGroupPattern = /^그룹\d+$/.test(groupName || "");
      if (isGroupPattern) {
        return getGroupedSeriesColor(groupName, entry.series);
      }
      return adjustLightness(getColorForSeries(entry.series), -15);
    },
    [isGroupInnerMode, getGroupedSeriesColor, getColorForSeries]
  );

  const groupSums = useMemo(() => {
    const sums = new Map<string, number>();
    filteredOuterData.forEach((item) => {
      sums.set(item.name, (sums.get(item.name) || 0) + item.value);
    });
    return sums;
  }, [filteredOuterData]);

  const firstInnerPerGroup = useMemo(() => {
    const firstInnerMap = new Map<string, string>();
    innerAngles.forEach((innerAngle) => {
      const groupName = getOuterGroupNameForInner(innerAngle.name);
      if (groupName && !firstInnerMap.has(groupName)) {
        firstInnerMap.set(groupName, innerAngle.name);
      }
    });
    return firstInnerMap;
  }, [innerAngles, getOuterGroupNameForInner]);

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

  const renderInnerCells = useCallback(() => {
    return filteredInnerData.map((entry) => (
      <Cell key={`inner-${entry.name}`} fill={getInnerFillColor(entry.name)} />
    ));
  }, [filteredInnerData, getInnerFillColor]);

  const renderOuterPies = useCallback(
    (useTimepointLabel: boolean) => {
      return innerAngles.map((seriesAngle) => {
        const seriesOuterData = getOuterDataForInner(seriesAngle.name);
        if (seriesOuterData.length === 0) return null;

        const isThisSeriesActive = activeOuterKey === seriesAngle.name;
        const isAnyHovered = activeOuterIndex !== undefined;
        const groupName = getOuterGroupNameForInner(seriesAngle.name);
        const isFirstInGroup = groupName ? firstInnerPerGroup.get(groupName) === seriesAngle.name : false;
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
                  useTimepointLabel ? (selectedTimepoint || item.name) : item.name
                );
              }
              setActiveOuterKey(seriesAngle.name);
              setActiveOuterIndex(index);
            }}
            onMouseLeave={onPieLeave}
          >
            {seriesOuterData.map((entry, idx) => (
              <Cell
                key={`outer-${entry.name}-${idx}`}
                fill={getOuterFillColor(entry)}
              />
            ))}
          </Pie>
        );
      });
    },
    [
      innerAngles,
      getOuterDataForInner,
      activeOuterKey,
      activeOuterIndex,
      getOuterGroupNameForInner,
      firstInnerPerGroup,
      groupSums,
      allOuterSum,
      onTooltipChange,
      selectedTimepoint,
      onPieLeave,
      getOuterFillColor,
    ]
  );

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
          <Select value={selectedTimepoint || ""} onValueChange={setSelectedTimepointOverride}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="시점 선택" />
            </SelectTrigger>
            <SelectContent>
              {timepointList.map((tp) => (
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
              {renderInnerCells()}
            </Pie>
            {/* 외부 링 - 시리즈별 값 (내부 원 각도에 맞춰 정렬) */}
            {renderOuterPies(true)}
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
          {renderInnerCells()}
        </Pie>
        {/* 외부 링 - 시리즈별 연도별 값 (내부 원 각도에 맞춰 정렬) */}
        {renderOuterPies(false)}
      </PieChart>
    </ResponsiveContainer>
  );
}
