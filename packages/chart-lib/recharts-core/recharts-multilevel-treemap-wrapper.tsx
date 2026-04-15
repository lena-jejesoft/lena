"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Treemap, ResponsiveContainer } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";
import type { MultiLevelTreemapNode, TimepointMultiLevelTreemapData } from "./recharts-adapter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

// 멀티레벨 트리맵 전용 색상 팔레트 (Anthropic 브랜드 스타일)
export const MULTI_LEVEL_TREEMAP_COLORS = [
  "#C15F3C",   // Crail (러스트 오렌지)
  "#B1ADA1",   // Cloudy (웜 그레이)
  "#7D8471",   // Sage (세이지 그린)
  "#9B8AA6",   // Lavender (라벤더)
  "#D4A574",   // Tan (탄 베이지)
  "#6B7B8C",   // Slate (슬레이트 그레이)
];

export interface TreemapSeriesData {
  name: string;
  value: number;
  percentage: number;
  color: string;
  children?: TreemapSeriesData[];  // 하위 시리즈 데이터
}

export interface TreemapStats {
  totalSum: number;
  itemCount: number;
  isDrilledDown: boolean;
  parentName?: string;
  parentColor?: string;
  seriesData?: TreemapSeriesData[];
}

export interface RechartsMultiLevelTreemapWrapperProps {
  data?: MultiLevelTreemapNode[];
  timepointData?: TimepointMultiLevelTreemapData[];  // 시점별 데이터 (있으면 드롭다운 표시)
  enabledSeries: Set<string>;
  themeColors?: ChartThemeColors;
  height?: number;
  allSeriesFields: string[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  onDrilldownChange?: (stats: TreemapStats | null) => void;
  customColors?: string[];  // 커스텀 색상 팔레트
}

interface DrilldownState {
  level: 1 | 2 | 3;  // 드릴다운 레벨: 1=전체그룹, 2=그룹내시리즈, 3=단일시리즈
  groupNode: MultiLevelTreemapNode | null;  // 2단계 이상: 그룹 노드
  seriesNode: MultiLevelTreemapNode | null;  // 3단계: 시리즈 노드
  seriesIndexInGroup: number;  // 3단계: 2단계에서의 시리즈 인덱스 (그라데이션 색상용)
  currentData: MultiLevelTreemapNode[];
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
  size?: number;
  seriesName?: string;
  children?: MultiLevelTreemapNode[];
  onNodeClick?: (node: { name: string; children?: MultiLevelTreemapNode[]; seriesName?: string }) => void;
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  isDrilledDown?: boolean;
  totalSize?: number;
  filteredData?: Array<{ name: string; size?: number; seriesName?: string }>;
  selectedTimepoint?: string | null;  // 시점 모드에서 선택된 시점
  parentColor?: string;  // 드릴다운 상태에서 부모 색상
  level3Color?: string;  // 3단계에서 사용할 미리 계산된 색상
}

// 색상 밝기 조절 함수 (드릴다운 그라데이션용)
const adjustColorLightness = (hexColor: string, adjustment: number): string => {
  // hex to rgb
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // rgb to hsl
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
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

  // adjust lightness
  const newL = Math.max(0.2, Math.min(0.9, l + adjustment));
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(newL * 100)}%)`;
};

// 텍스트 truncate 함수 (영역 너비에 맞게 자르고 ... 추가)
const truncateText = (text: string, maxWidth: number, fontSize: number): string => {
  // 글자당 대략적인 너비 (한글은 더 넓음)
  const charWidth = fontSize * 0.6;
  const ellipsisWidth = charWidth * 1.5;
  const availableWidth = maxWidth - ellipsisWidth;

  if (!text) return '';

  let totalWidth = 0;
  let truncatedText = '';

  for (const char of text) {
    // 한글/CJK 문자는 더 넓게 계산
    const isWide = /[\u3000-\u9fff\uac00-\ud7af]/.test(char);
    const width = isWide ? fontSize * 0.9 : charWidth;

    if (totalWidth + width > availableWidth) {
      return truncatedText + '...';
    }
    totalWidth += width;
    truncatedText += char;
  }

  return text;
};

const CustomizedContent: React.FC<CustomContentProps> = (props) => {
  const {
    x = 0, y = 0, width = 0, height = 0,
    name, index = 0, colors, allSeriesFields,
    size, seriesName, children, onNodeClick, onTooltipChange, isDrilledDown, totalSize = 0, filteredData,
    selectedTimepoint, parentColor, level3Color
  } = props;

  const hasChildren = children && children.length > 0;
  const actualSeriesName = seriesName || name;
  const seriesIndex = allSeriesFields.indexOf(actualSeriesName || '');
  const colorIndex = seriesIndex >= 0 ? seriesIndex : index;

  // 드릴다운 상태에서 그라데이션 색상 계산 (index 0 = 진한 색, index 증가 = 밝은 색)
  // 드릴다운 상태에서는 parentColor 사용 (레전드와 일치하도록)
  const baseColor = isDrilledDown && parentColor
    ? parentColor
    : colors[colorIndex % colors.length];
  const itemCount = filteredData?.length || 1;
  const lightnessStep = itemCount > 1 ? 0.3 / (itemCount - 1) : 0;  // 최대 0.3 밝기 차이
  const lightnessAdjustment = isDrilledDown ? (index * lightnessStep) : 0;
  // 3단계면 미리 계산된 level3Color 사용, 그 외에는 기존 로직
  const fillColor = level3Color
    ? level3Color
    : (isDrilledDown && baseColor?.startsWith('#')
      ? adjustColorLightness(baseColor, lightnessAdjustment)
      : baseColor);

  // 비중 계산
  const percentage = totalSize > 0 ? ((size || 0) / totalSize * 100).toFixed(1) : "0.0";

  // 텍스트 영역 너비 (좌우 패딩 16px 제외)
  const textMaxWidth = width - 16;
  const displayName = truncateText(name || '', textMaxWidth, 12);

  const handleClick = useCallback(() => {
    if (onNodeClick) {
      onNodeClick({ name: name || '', children, seriesName });
    }
  }, [onNodeClick, name, children, seriesName]);

  const handleMouseEnter = useCallback(() => {
    if (onTooltipChange && filteredData && name) {
      // 모든 시리즈의 값을 표시
      const allSeriesValues = filteredData.map(item => {
        const sIndex = allSeriesFields.indexOf(item.seriesName || item.name);
        return {
          dataKey: item.name,
          value: item.size,
          color: colors[sIndex >= 0 ? sIndex : 0],
          payload: { name: item.name, size: item.size, seriesName: item.seriesName }
        };
      }).filter(item => item.value != null && item.value > 0);

      // 시점 모드에서는 레이블을 시점으로 고정
      onTooltipChange(allSeriesValues, selectedTimepoint || null);
    }
  }, [onTooltipChange, filteredData, name, allSeriesFields, colors, selectedTimepoint]);

  const handleMouseLeave = useCallback(() => {
    // 시점 모드에서는 마우스를 떼도 시점 레이블 유지
    onTooltipChange?.(null, selectedTimepoint || null);
  }, [onTooltipChange, selectedTimepoint]);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: fillColor,
          stroke: "#fff",
          strokeWidth: 2,
          cursor: hasChildren || isDrilledDown ? "pointer" : "default",
        }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      {width > 40 && height > 20 && (
        <>
          <text
            x={x + 8}
            y={y + 22}
            fill="#444444"
            fontSize={12}
            fontWeight={300}
            fontFamily="Inter, sans-serif"
            style={{ pointerEvents: "none", letterSpacing: "0.02em" }}
          >
            {displayName}
          </text>
          <text
            x={x + 8}
            y={y + 38}
            fill="#888888"
            fontSize={10}
            fontWeight={200}
            fontFamily="Inter, sans-serif"
            style={{ pointerEvents: "none", letterSpacing: "0.04em" }}
          >
            {percentage}%
          </text>
        </>
      )}
    </g>
  );
};


const UndoIcon = ({ size = 16, color = 'currentColor', strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 14L4 9L9 4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 9H14C17.3137 9 20 11.6863 20 15C20 18.3137 17.3137 21 14 21H12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface DrilldownHeaderProps {
  parentNode: MultiLevelTreemapNode;
  color: string;
  onBack: () => void;
}

const DrilldownHeader: React.FC<DrilldownHeaderProps> = ({ parentNode, color, onBack }) => {
  return (
    <div className="w-full flex justify-end px-3 py-2">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onBack();
        }}
        className="flex items-center gap-1 text-gray-600 text-sm font-normal cursor-pointer transition-opacity hover:opacity-70"
      >
        <span className="underline">상위 단계로 이동</span>
        <UndoIcon size={14} />
      </button>
    </div>
  );
};

export function RechartsMultiLevelTreemapWrapper({
  data,
  timepointData,
  enabledSeries,
  themeColors,
  height = 400,
  allSeriesFields,
  onTooltipChange,
  onDrilldownChange,
  customColors,
}: RechartsMultiLevelTreemapWrapperProps) {
  // 사용할 색상 팔레트 결정 (customColors가 있으면 사용, 없으면 기본 색상)
  const baseColors = customColors || MULTI_LEVEL_TREEMAP_COLORS;
  const [selectedTimepoint, setSelectedTimepoint] = useState<string | null>(null);

  // 시점 선택 모드 확인
  const isTimepointMode = timepointData && timepointData.length > 0;

  // 음수가 있는 시점 목록
  const negativeTimepoints = useMemo(() => {
    if (!isTimepointMode) return new Set<string>();
    return new Set(
      timepointData.filter(tp => tp.hasNegative).map(tp => tp.timepoint)
    );
  }, [isTimepointMode, timepointData]);

  // timepointData 변경 시 최신 시점으로 자동 설정 (음수 없는 시점 우선)
  useEffect(() => {
    if (timepointData && timepointData.length > 0) {
      const validTimepoints = timepointData.filter(tp => !negativeTimepoints.has(tp.timepoint));
      if (validTimepoints.length > 0) {
        setSelectedTimepoint(validTimepoints[validTimepoints.length - 1].timepoint);
      } else {
        setSelectedTimepoint(timepointData[timepointData.length - 1].timepoint);
      }
    }
  }, [timepointData, negativeTimepoints]);

  // 시점 선택 시 레이블 업데이트
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

  const [drilldownState, setDrilldownState] = useState<DrilldownState>({
    level: 1,
    groupNode: null,
    seriesNode: null,
    seriesIndexInGroup: 0,
    currentData: activeData,
  });

  useEffect(() => {
    setDrilldownState({
      level: 1,
      groupNode: null,
      seriesNode: null,
      seriesIndexInGroup: 0,
      currentData: activeData,
    });
  }, [activeData]);

  const isDrilledDown = drilldownState.level > 1;

  // 드릴다운 상태 변경 시 통계 정보 전달
  useEffect(() => {
    if (!onDrilldownChange) return;

    if (isDrilledDown && drilldownState.groupNode) {
      // 드릴다운 상태 (2단계 또는 3단계): 해당 시리즈의 children 통계
      const children = drilldownState.currentData;
      const totalSum = children.reduce((sum, item) => sum + (item.size || 0), 0);
      // 색상 계산
      const colors = expandSeriesColors(baseColors, allSeriesFields.length);
      const seriesIndex = allSeriesFields.indexOf(drilldownState.groupNode.seriesName || drilldownState.groupNode.name);
      const color = colors[seriesIndex >= 0 ? seriesIndex : 0] || colors[0];

      // 하위 시리즈 데이터 생성
      const childSeriesData: TreemapSeriesData[] = children.map(child => ({
        name: child.name,
        value: child.size || 0,
        percentage: totalSum > 0 ? ((child.size || 0) / totalSum) * 100 : 0,
        color: color,  // 부모 색상 사용
      }));

      // 3단계면 시리즈 이름, 2단계면 그룹 이름
      const parentName = drilldownState.level === 3 && drilldownState.seriesNode
        ? drilldownState.seriesNode.name
        : drilldownState.groupNode.name;

      onDrilldownChange({
        totalSum,
        itemCount: children.length,
        isDrilledDown: true,
        parentName,
        parentColor: color,
        seriesData: childSeriesData,
      });
    } else {
      // 첫 화면: 전체 시리즈 통계
      const enabledData = activeData.filter(item => enabledSeries.has(item.seriesName || item.name));
      const colors = expandSeriesColors(baseColors, allSeriesFields.length);

      // 전체 합계 먼저 계산 (비율 계산용) - enabledSeries로 children 필터링
      const totalSum = enabledData.reduce((sum, item) => {
        const value = item.children && item.children.length > 0
          ? item.children
              .filter(c => enabledSeries.has(c.name))
              .reduce((s, c) => s + (c.size || 0), 0)
          : (item.size || 0);
        return sum + value;
      }, 0);

      // 시리즈별 합계 계산 (children이 있으면 합산, 없으면 item.size 사용) - enabledSeries로 children 필터링
      const seriesData: TreemapSeriesData[] = enabledData.map(item => {
        const seriesIndex = allSeriesFields.indexOf(item.seriesName || item.name);
        const groupColor = colors[seriesIndex >= 0 ? seriesIndex : 0] || colors[0];
        const enabledChildren = item.children?.filter(c => enabledSeries.has(c.name)) || [];
        const value = enabledChildren.length > 0
          ? enabledChildren.reduce((s, c) => s + (c.size || 0), 0)
          : (item.size || 0);

        // 하위 시리즈 데이터 생성 - 모든 시리즈 포함 (레전드에서 opacity로 비활성 표시)
        const childrenData: TreemapSeriesData[] | undefined = item.children && item.children.length > 0
          ? item.children.map(child => ({
              name: child.name,
              value: child.size || 0,
              percentage: totalSum > 0 ? ((child.size || 0) / totalSum) * 100 : 0,
              color: groupColor,
            }))
          : undefined;

        return {
          name: item.name,
          value,
          percentage: totalSum > 0 ? (value / totalSum) * 100 : 0,
          color: groupColor,
          children: childrenData,
        };
      });

      onDrilldownChange({
        totalSum,
        itemCount: enabledData.length,
        isDrilledDown: false,
        seriesData,
      });
    }
  }, [isDrilledDown, drilldownState.level, drilldownState.groupNode, drilldownState.seriesNode, drilldownState.currentData, activeData, enabledSeries, onDrilldownChange, allSeriesFields, baseColors]);

  // 첫 화면용 데이터: 시리즈별 총합만 표시 (children 없이, enabledSeries 필터링 적용)
  const topLevelData = useMemo(() => {
    return activeData.map(item => {
      // children이 있으면 합산, 없으면 item.size 사용 (시점 모드)
      // enabledSeries로 필터링하여 비활성화된 시리즈는 합계에서 제외
      const totalSize = item.children && item.children.length > 0
        ? item.children
            .filter(child => enabledSeries.has(child.name))
            .reduce((sum, child) => sum + (child.size || 0), 0)
        : (item.size || 0);
      return {
        name: item.name,
        size: totalSize,
        seriesName: item.seriesName || item.name,
      };
    });
  }, [activeData, enabledSeries]);

  const filteredData = useMemo(() => {
    if (isDrilledDown) {
      // 드릴다운 상태: 해당 시리즈의 children 표시 (개별 시리즈 필터링 + size 내림차순 정렬)
      return drilldownState.currentData
        .filter((item) => enabledSeries.has(item.name))
        .sort((a, b) => (b.size || 0) - (a.size || 0));  // 큰 값이 좌측에 위치하도록
    }
    // 첫 화면: 시리즈별 총합만 표시
    return topLevelData.filter((item) =>
      enabledSeries.has(item.seriesName || item.name)
    );
  }, [topLevelData, drilldownState.currentData, enabledSeries, isDrilledDown]);

  // 비중 계산을 위한 전체 합계
  const totalSize = useMemo(() => {
    return filteredData.reduce((sum, item) => sum + (item.size || 0), 0);
  }, [filteredData]);

  const colors = useMemo(() => {
    return expandSeriesColors(baseColors, allSeriesFields.length);
  }, [baseColors, allSeriesFields.length]);

  const parentColor = useMemo(() => {
    if (drilldownState.level < 2 || !drilldownState.groupNode) return "";
    const seriesIndex = allSeriesFields.indexOf(drilldownState.groupNode.seriesName || drilldownState.groupNode.name);
    return colors[seriesIndex >= 0 ? seriesIndex : 0] || colors[0];
  }, [drilldownState.level, drilldownState.groupNode, allSeriesFields, colors]);

  // 3단계 색상 미리 계산 (2단계에서의 그라데이션 색상 유지)
  const level3Color = useMemo(() => {
    if (drilldownState.level !== 3 || !drilldownState.groupNode) return undefined;

    const groupChildren = drilldownState.groupNode.children || [];
    const enabledChildren = groupChildren.filter(c => enabledSeries.has(c.name));
    const itemCount = enabledChildren.length;
    const lightnessStep = itemCount > 1 ? 0.3 / (itemCount - 1) : 0;
    const lightnessAdjustment = drilldownState.seriesIndexInGroup * lightnessStep;

    return parentColor.startsWith('#')
      ? adjustColorLightness(parentColor, lightnessAdjustment)
      : parentColor;
  }, [drilldownState.level, drilldownState.groupNode, drilldownState.seriesIndexInGroup, parentColor, enabledSeries]);

  const handleNodeClick = useCallback((clickedNode: { name: string; children?: MultiLevelTreemapNode[]; seriesName?: string }) => {
    if (drilldownState.level === 1) {
      // 1단계 → 2단계: 그룹 클릭 시 그룹의 시리즈들 표시
      const targetNode = activeData.find((node) => node.name === clickedNode.name);
      if (targetNode?.children && targetNode.children.length > 0) {
        setDrilldownState({
          level: 2,
          groupNode: targetNode,
          seriesNode: null,
          seriesIndexInGroup: 0,
          currentData: targetNode.children,
        });
      }
    } else if (drilldownState.level === 2) {
      // 2단계 → 3단계: 시리즈 클릭 시 해당 시리즈만 표시
      // 현재 filteredData(정렬된 상태)에서 클릭한 시리즈의 인덱스 찾기
      const sortedData = drilldownState.currentData
        .filter((item) => enabledSeries.has(item.name))
        .sort((a, b) => (b.size || 0) - (a.size || 0));
      const seriesIndex = sortedData.findIndex((node) => node.name === clickedNode.name);

      const targetSeries = drilldownState.currentData.find((node) => node.name === clickedNode.name);
      if (targetSeries) {
        setDrilldownState({
          level: 3,
          groupNode: drilldownState.groupNode,
          seriesNode: targetSeries,
          seriesIndexInGroup: seriesIndex >= 0 ? seriesIndex : 0,
          currentData: [targetSeries],
        });
      }
    }
    // 3단계에서는 클릭 비활성화 (아무 동작 안 함)
  }, [drilldownState, activeData, enabledSeries]);

  const handleBack = useCallback(() => {
    if (drilldownState.level === 3) {
      // 3단계 → 2단계
      setDrilldownState({
        level: 2,
        groupNode: drilldownState.groupNode,
        seriesNode: null,
        seriesIndexInGroup: 0,
        currentData: drilldownState.groupNode?.children || [],
      });
    } else if (drilldownState.level === 2) {
      // 2단계 → 1단계
      setDrilldownState({
        level: 1,
        groupNode: null,
        seriesNode: null,
        seriesIndexInGroup: 0,
        currentData: activeData,
      });
    }
  }, [drilldownState, activeData]);

  if (filteredData.length === 0) {
    return (
      <div style={{ height }}>
        {isDrilledDown && drilldownState.groupNode && (
          <DrilldownHeader
            parentNode={drilldownState.groupNode}
            color={parentColor}
            onBack={handleBack}
          />
        )}
        <div className="flex items-center justify-center" style={{ height: isDrilledDown ? height - 36 : height }}>
          <span className="text-muted-foreground text-sm">표시할 시리즈가 없습니다</span>
        </div>
      </div>
    );
  }

  // 시점 선택 모드: 드롭다운 + 트리맵
  if (isTimepointMode) {
    const dropdownHeight = 40;
    const headerHeight = isDrilledDown ? 36 : 0;
    const chartHeight = height - dropdownHeight - headerHeight;

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
              {timepointData!.map(tp => {
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

        {/* 드릴다운 헤더 */}
        {isDrilledDown && drilldownState.groupNode && (
          <DrilldownHeader
            parentNode={drilldownState.groupNode}
            color={parentColor}
            onBack={handleBack}
          />
        )}

        {/* 트리맵 */}
        <ResponsiveContainer width="100%" height={chartHeight}>
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
                onNodeClick={handleNodeClick}
                onTooltipChange={onTooltipChange}
                isDrilledDown={isDrilledDown}
                totalSize={totalSize}
                filteredData={filteredData}
                selectedTimepoint={selectedTimepoint}
                parentColor={parentColor}
                level3Color={level3Color}
              />
            }
          />
        </ResponsiveContainer>
      </div>
    );
  }

  // 기존 모드: 드릴다운 헤더 + 트리맵
  const headerHeight = isDrilledDown ? 36 : 0;
  const chartHeight = height - headerHeight;

  return (
    <div style={{ height }}>
      {isDrilledDown && drilldownState.groupNode && (
        <DrilldownHeader
          parentNode={drilldownState.groupNode}
          color={parentColor}
          onBack={handleBack}
        />
      )}

      <ResponsiveContainer width="100%" height={chartHeight}>
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
              onNodeClick={handleNodeClick}
              onTooltipChange={onTooltipChange}
              isDrilledDown={isDrilledDown}
              totalSize={totalSize}
              filteredData={filteredData}
              selectedTimepoint={selectedTimepoint}
              parentColor={parentColor}
              level3Color={level3Color}
            />
          }
        />
      </ResponsiveContainer>
    </div>
  );
}
