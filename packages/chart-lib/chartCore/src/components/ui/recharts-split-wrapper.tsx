"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  Brush,
} from "recharts";
import type { ChartType, RegionClassifiedData, OutlierInfo, ChartDataItem, YAxisPlacement } from "@chartCore/src/types/chart-config";
import { type ChartThemeColors, type DualAxisReferenceLineStyle, getBrushColors, CustomBrushTraveller, roundToNice } from "./recharts-wrapper";
import { RechartsRegionChart } from "./recharts-region-chart";
import { calculateRegionHeights, formatDateForXAxis } from "@chartCore/src/tools/chartTool/utils/recharts-adapter";

export interface RechartsSplitWrapperProps {
  xField: string;
  yFields: string[];
  allSeriesFields?: string[];
  chartType: ChartType;
  themeColors?: ChartThemeColors;
  totalHeight?: number;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  yAxisLabels?: {
    default?: string;
    left?: string;
    right?: string;
  };
  seriesLabelMap?: Record<string, string>;
  classifiedData: RegionClassifiedData | null;  // 일반 차트용
  leftClassifiedData?: RegionClassifiedData;  // 추가: 이중축 좌측
  rightClassifiedData?: RegionClassifiedData;  // 추가: 이중축 우측
  outliers: OutlierInfo[];
  fullData: ChartDataItem[];  // X축 동기화용 전체 데이터
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  datetimeUnit?: number;
  showBrush?: boolean;
  showTooltip?: boolean;
  showDualAxisReferenceLine?: boolean; // 이중축 일때 y=0선 표시 여부
  dualAxisReferenceLineStyle?: DualAxisReferenceLineStyle; // 이중축 기준선 스타일
}

/**
 * 분할 차트 래퍼 컴포넌트
 * Upper/Normal/Lower 영역을 하나의 연결된 차트처럼 표시
 */
export function RechartsSplitWrapper({
  xField,
  yFields,
  allSeriesFields,
  chartType,
  themeColors,
  totalHeight = 400,
  yFieldTypes,
  yAxisPlacements,
  yAxisLabels,
  seriesLabelMap,
  classifiedData,
  leftClassifiedData,
  rightClassifiedData,
  outliers,
  fullData,
  onTooltipChange,
  datetimeUnit = 1,
  showBrush = false,
  showTooltip = true,
  showDualAxisReferenceLine = false,
  dualAxisReferenceLineStyle,
}: RechartsSplitWrapperProps) {
  // 데이터가 없는 경우 훅이 있는 내부 컴포넌트를 렌더하지 않는다.
  const isDualAxis = chartType === "dual-axis";
  const effectiveLeftData = isDualAxis && leftClassifiedData ? leftClassifiedData : classifiedData;
  const effectiveRightData = isDualAxis && rightClassifiedData ? rightClassifiedData : undefined;
  if (!effectiveLeftData) {
    return null;
  }

  return (
    <RechartsSplitWrapperContent
      xField={xField}
      yFields={yFields}
      allSeriesFields={allSeriesFields}
      chartType={chartType}
      themeColors={themeColors}
      totalHeight={totalHeight}
      yFieldTypes={yFieldTypes}
      yAxisPlacements={yAxisPlacements}
      yAxisLabels={yAxisLabels}
      seriesLabelMap={seriesLabelMap}
      outliers={outliers}
      fullData={fullData}
      onTooltipChange={onTooltipChange}
      datetimeUnit={datetimeUnit}
      showBrush={showBrush}
      showTooltip={showTooltip}
      showDualAxisReferenceLine={showDualAxisReferenceLine}
      dualAxisReferenceLineStyle={dualAxisReferenceLineStyle}
      isDualAxis={isDualAxis}
      effectiveLeftData={effectiveLeftData}
      effectiveRightData={effectiveRightData}
    />
  );
}

interface RechartsSplitWrapperContentProps {
  xField: string;
  yFields: string[];
  allSeriesFields?: string[];
  chartType: ChartType;
  themeColors?: ChartThemeColors;
  totalHeight: number;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  yAxisLabels?: {
    default?: string;
    left?: string;
    right?: string;
  };
  seriesLabelMap?: Record<string, string>;
  outliers: OutlierInfo[];
  fullData: ChartDataItem[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  datetimeUnit: number;
  showBrush: boolean;
  showTooltip: boolean;
  showDualAxisReferenceLine: boolean;
  dualAxisReferenceLineStyle?: DualAxisReferenceLineStyle;
  isDualAxis: boolean;
  effectiveLeftData: RegionClassifiedData;
  effectiveRightData?: RegionClassifiedData;
}

function RechartsSplitWrapperContent({
  xField,
  yFields,
  allSeriesFields,
  chartType,
  themeColors,
  totalHeight,
  yFieldTypes,
  yAxisPlacements,
  yAxisLabels,
  seriesLabelMap,
  outliers,
  fullData,
  onTooltipChange,
  datetimeUnit,
  showBrush,
  showTooltip,
  showDualAxisReferenceLine,
  dualAxisReferenceLineStyle,
  isDualAxis,
  effectiveLeftData,
  effectiveRightData,
}: RechartsSplitWrapperContentProps) {
  const resolvedSeriesColors = useMemo(() => (
    themeColors?.seriesColors || [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
      "hsl(var(--chart-6))",
      "hsl(var(--chart-7))",
      "hsl(var(--chart-8))",
    ]
  ), [themeColors?.seriesColors]);

  // 이중축일 때 좌/우측 필드 분리
  const { leftFields, rightFields } = useMemo(() => {
    if (!isDualAxis || !yAxisPlacements) {
      return { leftFields: yFields, rightFields: [] as string[] };
    }
    const left = yFields.filter(f => (yAxisPlacements[f] ?? 'left') === 'left');
    const right = yFields.filter(f => yAxisPlacements[f] === 'right');
    return { leftFields: left, rightFields: right };
  }, [isDualAxis, yFields, yAxisPlacements]);

  // 이중축일 때 좌/우측 데이터 병합 (날짜별로)
  // 중요: 각 측에서 분석된 필드만 사용하여 이상치 마스킹이 올바르게 적용되도록 함
  const mergeRegionData = useCallback((
    leftRegion: { data: ChartDataItem[]; domain: [number, number]; hasData?: boolean },
    rightRegion: { data: ChartDataItem[]; domain: [number, number]; hasData?: boolean } | undefined
  ): { data: ChartDataItem[]; domain: [number, number]; hasData: boolean } => {
    if (!isDualAxis || !rightRegion) {
      return {
        data: leftRegion.data,
        domain: leftRegion.domain,
        hasData: leftRegion.hasData ?? false,
      };
    }

    // 좌측과 우측 데이터 병합 (각 측에서 분석된 필드만 가져옴)
    const mergedData: ChartDataItem[] = [];

    // 좌측 데이터를 기준으로 시작
    for (const leftItem of leftRegion.data) {
      const dateDisplay = leftItem.date_display;

      // 좌측에서: date, date_display, 좌측 분석 필드만 가져옴
      const mergedItem: ChartDataItem = {
        date: leftItem.date,
        date_display: dateDisplay,
      };

      // 좌측 필드 추가 (이상치면 null로 마스킹됨)
      for (const field of leftFields) {
        mergedItem[field] = leftItem[field];
      }

      // 우측 데이터에서 같은 날짜 찾기
      const rightItem = rightRegion.data.find(d => d.date_display === dateDisplay);
      if (rightItem) {
        // 우측 필드 추가 (이상치면 null로 마스킹됨)
        for (const field of rightFields) {
          mergedItem[field] = rightItem[field];
        }
      }

      mergedData.push(mergedItem);
    }

    // 우측에만 있는 날짜 추가 (거의 없겠지만 안전을 위해)
    for (const rightItem of rightRegion.data) {
      if (!mergedData.some(d => d.date_display === rightItem.date_display)) {
        const mergedItem: ChartDataItem = {
          date: rightItem.date,
          date_display: rightItem.date_display,
        };
        for (const field of rightFields) {
          mergedItem[field] = rightItem[field];
        }
        mergedData.push(mergedItem);
      }
    }

    return {
      data: mergedData,
      domain: leftRegion.domain,
      hasData: (leftRegion.hasData ?? false) || (rightRegion.hasData ?? false),
    };
  }, [isDualAxis, leftFields, rightFields]);

  // 병합된 upper/normal/lower 데이터
  const upper = useMemo(() =>
    mergeRegionData(effectiveLeftData.upper, effectiveRightData?.upper),
    [effectiveLeftData.upper, effectiveRightData?.upper, mergeRegionData]
  );

  const normal = useMemo(() =>
    mergeRegionData(effectiveLeftData.normal, effectiveRightData?.normal),
    [effectiveLeftData.normal, effectiveRightData?.normal, mergeRegionData]
  );

  const lower = useMemo(() =>
    mergeRegionData(effectiveLeftData.lower, effectiveRightData?.lower),
    [effectiveLeftData.lower, effectiveRightData?.lower, mergeRegionData]
  );

  // Brush 범위 상태 (여기서 먼저 선언)
  const [brushRange, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);

  // Brush 범위에 따른 필터링된 영역 데이터
  const filteredUpper = useMemo(() => {
    if (!brushRange) return upper;
    const visibleLabels = new Set(fullData.slice(brushRange.startIndex, brushRange.endIndex + 1).map(d => d[xField]));
    return {
      ...upper,
      data: upper.data.filter(d => visibleLabels.has(d[xField])),
    };
  }, [upper, brushRange, fullData, xField]);

  const filteredNormal = useMemo(() => {
    if (!brushRange) return normal;
    const visibleLabels = new Set(fullData.slice(brushRange.startIndex, brushRange.endIndex + 1).map(d => d[xField]));
    return {
      ...normal,
      data: normal.data.filter(d => visibleLabels.has(d[xField])),
    };
  }, [normal, brushRange, fullData, xField]);

  const filteredLower = useMemo(() => {
    if (!brushRange) return lower;
    const visibleLabels = new Set(fullData.slice(brushRange.startIndex, brushRange.endIndex + 1).map(d => d[xField]));
    return {
      ...lower,
      data: lower.data.filter(d => visibleLabels.has(d[xField])),
    };
  }, [lower, brushRange, fullData, xField]);

  // 영역별 이상치 필터링 (활성화된 시리즈만)
  const upperOutliers = outliers.filter((o) => o.bound === "upper" && yFields.includes(o.field));
  const lowerOutliers = outliers.filter((o) => o.bound === "lower" && yFields.includes(o.field));

  // 활성화된 시리즈의 이상치가 있는 경우에만 영역 표시
  const hasUpperOutliers = upper.hasData && upper.data.length > 0 && upperOutliers.length > 0;
  const hasLowerOutliers = lower.hasData && lower.data.length > 0 && lowerOutliers.length > 0;

  // 차트 타입 감지
  const isBarChart = chartType === 'column' || chartType === 'stacked' ||
    (chartType === 'mixed' && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column')) ||
    (chartType === 'dual-axis' && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column'));

  // Column 타입 시리즈 개수 계산
  const columnFieldCount = chartType === 'dual-axis' || chartType === 'mixed'
    ? yFields.filter(f => !yFieldTypes || yFieldTypes[f] === 'column').length
    : yFields.length;

  // Column 타입 시리즈가 2개 이상일 때만 음영 사용 (누적막대는 제외)
  const shouldUseShade = isBarChart && columnFieldCount >= 2 && chartType !== 'stacked';

  // 차트 컨테이너 참조 및 너비 상태
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(0);

  // 호버 상태 추적 (통합 보조선용)
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // Brush 범위에 따른 필터링된 데이터
  const filteredFullData = useMemo(() => {
    if (!brushRange) return fullData;
    return fullData.slice(brushRange.startIndex, brushRange.endIndex + 1);
  }, [fullData, brushRange]);

  // X축 레이블 영역 높이
  const X_LABEL_HEIGHT = 30;
  const BRUSH_HEIGHT = 40;
  const BRUSH_MARGIN_TOP = 16;

  // 영역별 높이 계산 (X축 레이블 및 spacer 고려)
  const upperSpacer = hasUpperOutliers ? 10 : 0;
  const brushReserved = showBrush ? BRUSH_HEIGHT + BRUSH_MARGIN_TOP : 0;
  const totalReserved = upperSpacer + X_LABEL_HEIGHT + brushReserved;
  const effectiveTotalHeight = totalHeight - totalReserved;

  // 병합된 데이터로 heights 계산 (좌/우측 이상치 모두 고려)
  const mergedClassifiedData = useMemo(() => ({
    upper,
    normal,
    lower,
  }), [upper, normal, lower]);

  const heights = calculateRegionHeights(mergedClassifiedData, effectiveTotalHeight);

  // yFields(활성화된 시리즈) 기반으로 각 영역의 domain 재계산
  const dynamicDomains = useMemo(() => {
    const calculateDomainForRegion = (data: ChartDataItem[], fields: string[]): [number, number] | undefined => {
      if (!data || data.length === 0 || fields.length === 0) return undefined;

      let min = 0, max = 0;
      for (const row of data) {
        for (const field of fields) {
          const value = row[field];
          if (typeof value === "number" && !isNaN(value)) {
            min = Math.min(min, value);
            max = Math.max(max, value);
          }
        }
      }

      if (min === 0 && max === 0) return undefined;

      let niceMin = min < 0 ? roundToNice(min, false) : 0;
      const niceMax = max > 0 ? roundToNice(max, true) : 0;

      return [niceMin, niceMax];
    };

    // 비이중축: 기존 방식
    if (!isDualAxis) {
      return {
        upper: calculateDomainForRegion(upper.data, yFields),
        normal: calculateDomainForRegion(normal.data, yFields),
        lower: calculateDomainForRegion(lower.data, yFields),
      };
    }

    // 이중축: 좌/우측 별도 계산
    return {
      upper: calculateDomainForRegion(upper.data, yFields),
      normal: calculateDomainForRegion(normal.data, yFields),
      lower: calculateDomainForRegion(lower.data, yFields),
      // 이중축 좌/우측 별도 domain (실제 데이터 기반)
      left: {
        upper: calculateDomainForRegion(upper.data, leftFields),
        normal: calculateDomainForRegion(normal.data, leftFields),
        lower: calculateDomainForRegion(lower.data, leftFields),
      },
      right: {
        upper: calculateDomainForRegion(upper.data, rightFields),
        normal: calculateDomainForRegion(normal.data, rightFields),
        lower: calculateDomainForRegion(lower.data, rightFields),
      },
    };
  }, [upper.data, normal.data, lower.data, yFields, isDualAxis, leftFields, rightFields]);

  // Normal 영역 Y축 0 레이블 포함 커스텀 ticks 생성 (0 중복 방지)
  const normalYAxisTicksWithZero = useMemo(() => {
    if (chartType === 'dual-axis') return undefined;

    // 활성화된 시리즈 기반 동적 domain 사용
    const domain = dynamicDomains.normal;
    if (!domain) return undefined;

    const [min, max] = domain;

    // 0이 도메인 범위 내에 없으면 스킵
    if (min > 0 || max < 0) return undefined;

    // 기본 tick 개수 (약 5개)
    const tickCount = 5;
    const range = max - min;
    const step = range / (tickCount - 1);

    // 기본 ticks 생성
    const baseTicks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      baseTicks.push(min + step * i);
    }

    // 0과 겹치는 tick 제거 (범위의 5% 이내)
    const threshold = range * 0.05;
    const filteredTicks = baseTicks.filter(tick =>
      tick === 0 || Math.abs(tick) > threshold
    );

    // 0에 가까운 값을 0으로 통합하고 중복 제거
    const normalizedTicks = filteredTicks.map(tick =>
      Math.abs(tick) < 0.001 ? 0 : tick
    );

    // 0 추가 (없으면)
    if (!normalizedTicks.includes(0)) {
      normalizedTicks.push(0);
    }

    // 중복 제거 및 정렬
    const uniqueTicks = [...new Set(normalizedTicks)].sort((a, b) => a - b);

    // 부동소수점 오차 정리 (소수점 2자리로 반올림)
    const cleanedTicks = uniqueTicks.map(tick => Math.round(tick * 100) / 100);

    return cleanedTicks;
  }, [chartType, dynamicDomains.normal]);

  // 차트 너비 측정
  useEffect(() => {
    const updateWidth = () => {
      if (chartContainerRef.current) {
        // chartContainerRef는 이미 padding 안쪽 영역을 가리킴
        const chartArea = chartContainerRef.current.clientWidth;
        setChartWidth(chartArea);
      }
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    if (chartContainerRef.current) {
      observer.observe(chartContainerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // X축 레이블 데이터 추출
  const xLabels = filteredFullData.map(d => d[xField] as string);

  // 레이블당 최소 필요 너비
  const LABEL_MIN_WIDTH = 60;

  // 레이블 개수 동적 계산
  const calculateVisibleLabels = useMemo(() => {
    if (!chartWidth || chartWidth === 0) {
      return { maxLabels: 10, shouldShowAll: xLabels.length <= 10 };
    }

    const maxPossibleLabels = Math.floor(chartWidth / LABEL_MIN_WIDTH);
    const canShowAll = xLabels.length <= maxPossibleLabels;

    return {
      maxLabels: Math.max(5, maxPossibleLabels),
      shouldShowAll: canShowAll,
    };
  }, [chartWidth, xLabels.length]);

  const { maxLabels, shouldShowAll } = calculateVisibleLabels;

  // 월 단위에서 연도가 바뀌는 레이블 감지
  const yearChangeLabels = useMemo(() => {
    const changes = new Set<string>();

    xLabels.forEach((label, idx) => {
      if (idx === 0) return;

      // 월 패턴인지 확인: YYYY-MM
      if (!/^\d{4}-\d{2}$/.test(label)) return;

      const prevLabel = xLabels[idx - 1];
      const prevYear = prevLabel.substring(0, 4);
      const currYear = label.substring(0, 4);

      // 연도가 바뀌는 경우 4자리 유지
      if (prevYear !== currYear) {
        changes.add(label);
      }
    });

    return changes;
  }, [xLabels]);

  // 통합 호버 핸들러: 모든 영역의 데이터를 통합하여 전달
  const handleUnifiedTooltip = useCallback((payload: any[] | null, label: string | null) => {
    if (!label || !onTooltipChange) {
      setHoveredLabel(null);
      onTooltipChange?.(null, null);
      return;
    }

    setHoveredLabel(label);

    const combinedPayload: any[] = [];
    const fullDataItem = filteredFullData.find((d) => d[xField] === label) ?? fullData.find((d) => d[xField] === label);
    const upperOutliersForDate = upperOutliers.filter((o) => o.dateDisplay === label);
    const lowerOutliersForDate = lowerOutliers.filter((o) => o.dateDisplay === label);
    const outlierFieldSet = new Set<string>([
      ...upperOutliersForDate.map((item) => item.field),
      ...lowerOutliersForDate.map((item) => item.field),
    ]);

    if (fullDataItem) {
      yFields.forEach((field) => {
        const rawValue = fullDataItem[field];
        const seriesOrder = allSeriesFields || yFields;
        const colorIndex = seriesOrder.indexOf(field);
        combinedPayload.push({
          dataKey: field,
          name: seriesLabelMap?.[field] ?? field,
          value: typeof rawValue === "number" || typeof rawValue === "string" ? rawValue : null,
          color: resolvedSeriesColors[
            colorIndex >= 0 ? colorIndex % resolvedSeriesColors.length : 0
          ],
          isOutlier: outlierFieldSet.has(field),
          payload: {
            ...fullDataItem,
            [`${field}_field`]: field,
          },
        });
      });
    }

    onTooltipChange(combinedPayload, label);
  }, [
    filteredFullData,
    fullData,
    upperOutliers,
    lowerOutliers,
    xField,
    yFields,
    onTooltipChange,
    seriesLabelMap,
    allSeriesFields,
    resolvedSeriesColors,
  ]);

  // X 좌표 계산 (통합 보조선용)
  const hoveredX = useMemo(() => {
    if (!hoveredLabel || !chartWidth) return null;

    const idx = xLabels.indexOf(hoveredLabel);
    if (idx === -1) return null;

    // 막대 시리즈가 있는지 확인 (이중축에서 column 타입이 있으면 막대)
    const hasBarSeries = isBarChart || (chartType === 'dual-axis' && columnFieldCount > 0);

    // 막대 차트: 중앙 기준 (band scale), 라인 차트: 가장자리 기준 (point scale)
    const ratio = hasBarSeries
      ? (idx + 0.5) / xLabels.length
      : (xLabels.length > 1 ? idx / (xLabels.length - 1) : 0.5);

    // chartWidth는 이미 padding을 뺀 너비 (X축 레이블 영역과 일치)
    const paddingLeft = chartType === 'dual-axis' ? 60 : 60;
    const xPosition = paddingLeft + (chartWidth * ratio);

    return xPosition;
  }, [hoveredLabel, chartWidth, xLabels, chartType, isBarChart, columnFieldCount]);

  // 카테고리 경계 계산 (막대 차트 음영용)
  const hoveredCategoryBounds = useMemo(() => {
    if (!hoveredLabel || !chartWidth || !shouldUseShade) return null;

    const idx = xLabels.indexOf(hoveredLabel);
    if (idx === -1) return null;

    const categoryCount = xLabels.length;

    // Recharts band scale 계산
    const categorySize = chartWidth / categoryCount;
    const categoryCenter = (idx + 0.5) * categorySize;

    // Y축 여백(60px) + 카테고리 중앙에서 절반 뒤로
    const startX = 60 + categoryCenter - (categorySize / 2);
    const width = categorySize;

    return { startX, width };
  }, [hoveredLabel, chartWidth, xLabels, shouldUseShade]);

  return (
    <div style={{ position: 'relative' }}>
      {/* 호버 오버레이: 막대 차트는 음영, 라인 차트는 점선 - 브러시 영역 제외 */}
      {shouldUseShade && hoveredCategoryBounds ? (
        <svg
          style={{
            position: 'absolute',
            left: hoveredCategoryBounds.startX,
            top: 0,
            height: totalHeight - brushReserved,
            width: hoveredCategoryBounds.width,
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          <rect
            x="0"
            y="0"
            width={hoveredCategoryBounds.width}
            height={totalHeight - brushReserved}
            fill="rgba(128, 128, 128, 0.05)"
          />
        </svg>
      ) : hoveredX !== null ? (
        <svg
          style={{
            position: 'absolute',
            left: hoveredX - 0.5,
            top: 0,
            height: totalHeight - brushReserved,
            width: 1,
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          <line
            x1="0.5"
            y1="0"
            x2="0.5"
            y2={totalHeight - brushReserved}
            stroke={themeColors?.textColor || 'hsl(var(--foreground))'}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.15"
          />
        </svg>
      ) : null}

      {/* 차트 영역 */}
      <div className="flex flex-col" style={{ gap: 0, height: totalHeight, overflow: "visible" }}>
        {/* Upper 영역 (상한 이상치) */}
        {hasUpperOutliers && (
          <div style={{ zIndex: 3, overflow: "visible" }}>
            <RechartsRegionChart
              data={filteredUpper.data}
              fullData={filteredFullData}
              xField={xField}
              yFields={yFields}
              allSeriesFields={allSeriesFields}
              chartType={chartType}
              themeColors={themeColors}
              height={heights.upper}
              yFieldTypes={yFieldTypes}
              yAxisPlacements={yAxisPlacements}
              yAxisLabel={yAxisLabels?.default}
              seriesLabelMap={seriesLabelMap}
              domain={isDualAxis ? undefined : dynamicDomains.upper}
              leftDomain={isDualAxis ? (dynamicDomains as any).left?.upper : undefined}
              rightDomain={isDualAxis ? (dynamicDomains as any).right?.upper : undefined}
              regionType="upper"
              hasBreakTop={false}
              hasBreakBottom={true}
              showXAxis={false}
              outliers={upperOutliers}
              onTooltipChange={handleUnifiedTooltip}
              hoveredLabel={hoveredLabel}
              datetimeUnit={datetimeUnit}
              chartWidth={chartWidth}
              showTooltip={showTooltip}
            />
          </div>
        )}

        {/* Upper-Normal 사이 spacer */}
        {hasUpperOutliers && <div style={{ height: 10 }} />}

        {/* Normal 영역 (정상 데이터) */}
        <div style={{ zIndex: 2, overflow: "visible" }}>
          <RechartsRegionChart
            data={filteredNormal.data}
            fullData={filteredFullData}
            xField={xField}
            yFields={yFields}
            allSeriesFields={allSeriesFields}
            chartType={chartType}
            themeColors={themeColors}
            height={heights.normal}
            yFieldTypes={yFieldTypes}
            yAxisPlacements={yAxisPlacements}
            yAxisLabel={hasUpperOutliers ? undefined : yAxisLabels?.default}
            seriesLabelMap={seriesLabelMap}
            domain={isDualAxis ? undefined : dynamicDomains.normal}
            leftDomain={isDualAxis ? (dynamicDomains as any).left?.normal : undefined}
            rightDomain={isDualAxis ? (dynamicDomains as any).right?.normal : undefined}
            yAxisTicks={normalYAxisTicksWithZero}
            regionType="normal"
            hasBreakTop={hasUpperOutliers}
            hasBreakBottom={hasUpperOutliers || hasLowerOutliers}
            showXAxis={false}
            outliers={[...upperOutliers, ...lowerOutliers]}
            onTooltipChange={handleUnifiedTooltip}
            hoveredLabel={hoveredLabel}
            datetimeUnit={datetimeUnit}
            chartWidth={chartWidth}
            showTooltip={showTooltip}
            showDualAxisReferenceLine={showDualAxisReferenceLine}
            dualAxisReferenceLineStyle={dualAxisReferenceLineStyle}
          />
        </div>

        {/* X축 레이블 (Normal-Lower 사이) */}
        <div
          style={{
            height: X_LABEL_HEIGHT,
            paddingLeft: chartType === 'dual-axis' ? 60 : 60,
            paddingRight: chartType === 'dual-axis' ? 60 : 30,
          }}
        >
          <div
            ref={chartContainerRef}
            className="relative"
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            {xLabels.map((label, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === xLabels.length - 1;

              // 막대그래프: 첫/마지막 조건부 표시
              if (isBarChart) {
                // 첫 번째는 항상 렌더링 계속
                if (!isFirst && isLast) {
                  // 마지막은 조건 확인
                  if (datetimeUnit && datetimeUnit > 1) {
                    if (idx % datetimeUnit !== 0) return null;
                  }
                  // 조건 만족하면 렌더링 계속
                }
                // 중간 값들: 기존 필터링 로직
                if (!isFirst && !isLast) {
                  if (datetimeUnit && datetimeUnit > 1) {
                    if (idx % datetimeUnit !== 0) return null;
                  } else if (!shouldShowAll) {
                    const step = Math.ceil(xLabels.length / maxLabels);
                    if (idx % step !== 0) return null;
                  }
                }
              } else {
                // 라인/영역: 첫/마지막 스킵 유지
                if (isFirst || isLast) return null;

                // 중간 값 필터링
                if (datetimeUnit && datetimeUnit > 1) {
                  if (idx % datetimeUnit !== 0) return null;
                } else if (!shouldShowAll) {
                  const step = Math.ceil(xLabels.length / maxLabels);
                  if (idx % step !== 0) return null;
                }
              }

              const leftPercent = xLabels.length > 1
                ? (isBarChart
                  ? ((idx + 0.5) / xLabels.length) * 100        // 막대: 카테고리 중앙
                  : (idx / (xLabels.length - 1)) * 100)         // 라인: 점의 정확한 위치
                : 50;

              return (
                <div
                  key={idx}
                  className="text-xs absolute"
                  style={{
                    color: "hsl(var(--muted-foreground))",
                    whiteSpace: 'nowrap',
                    left: `${leftPercent}%`,
                    top: 5,
                    transform: 'translateX(-50%)',
                  }}
                >
                  {yearChangeLabels.has(label) ? label : formatDateForXAxis(label)}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lower 영역 (하한 이상치) */}
        {hasLowerOutliers && (
          <div style={{ zIndex: 1, overflow: "visible" }}>
            <RechartsRegionChart
              data={filteredLower.data}
              fullData={filteredFullData}
              xField={xField}
              yFields={yFields}
              allSeriesFields={allSeriesFields}
              chartType={chartType}
              themeColors={themeColors}
              height={heights.lower}
              yFieldTypes={yFieldTypes}
              yAxisPlacements={yAxisPlacements}
              yAxisLabel={undefined}
              seriesLabelMap={seriesLabelMap}
              domain={isDualAxis ? undefined : dynamicDomains.lower}
              leftDomain={isDualAxis ? (dynamicDomains as any).left?.lower : undefined}
              rightDomain={isDualAxis ? (dynamicDomains as any).right?.lower : undefined}
              regionType="lower"
              hasBreakTop={true}
              hasBreakBottom={false}
              showXAxis={false}
              outliers={lowerOutliers}
              onTooltipChange={handleUnifiedTooltip}
              hoveredLabel={hoveredLabel}
              datetimeUnit={datetimeUnit}
              chartWidth={chartWidth}
              showTooltip={showTooltip}
            />
          </div>
        )}

        {/* Brush 영역 */}
        {showBrush && (() => {
          const brushColors = getBrushColors();
          const startIdx = brushRange?.startIndex ?? 0;
          const endIdx = brushRange?.endIndex ?? fullData.length - 1;

          return (
            <div style={{ position: 'relative', height: BRUSH_HEIGHT, marginTop: 16, marginLeft: 60, marginRight: chartType === 'dual-axis' ? 60 : 30 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fullData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey={xField} hide />
                  <Brush
                    dataKey={xField}
                    height={BRUSH_HEIGHT}
                    startIndex={startIdx}
                    endIndex={endIdx}
                    travellerWidth={4}
                    traveller={<CustomBrushTraveller />}
                    stroke={brushColors.stroke}
                    fill={brushColors.fill}
                    onChange={(range: { startIndex?: number; endIndex?: number }) => {
                      if (range.startIndex !== undefined && range.endIndex !== undefined) {
                        setBrushRange({ startIndex: range.startIndex, endIndex: range.endIndex });
                      }
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
