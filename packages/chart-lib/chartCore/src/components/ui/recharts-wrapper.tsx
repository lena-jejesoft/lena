"use client";

import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Scatter,
  ReferenceLine,
  Brush,
} from "recharts";
import type { ChartType, YAxisPlacement } from "@chartCore/src/types/chart-config";
import { formatDateForXAxis } from "@chartCore/src/tools/chartTool/utils/recharts-adapter";
import { axisTickFormatter } from "@/packages/chart-lib/utils/number-formatters";
import { getZeroLineStyle } from "./recharts-utils";
import { CustomYAxisLine } from "./custom-y-axis-line";
import { ChartCoreLineTooltipContent } from "./chart-core-line-tooltip-content";

/** 테마 색상 */
export interface ChartThemeColors {
  textColor: string;
  axisLineColor: string;
  gridColor: string;
  seriesColors: string[];
}

/** Dark 모드 fallback 색상 (Shadow DOM에서 사용) */
const DARK_FALLBACK_COLORS: Record<string, string> = {
  "--foreground": "hsl(0 0% 98%)",
  "--border": "hsl(0 0% 18%)",
  "--muted": "hsl(0 0% 18%)",
  "--muted-foreground": "hsl(0 0% 63.9%)",
  "--chart-1": "hsl(38 71% 75%)",
  "--chart-2": "hsl(158 26% 55%)",
  "--chart-3": "hsl(15 50% 70%)",
  "--chart-4": "hsl(177 25% 73%)",
  "--chart-5": "hsl(217 29% 68%)",
  "--chart-6": "hsl(95 36% 73%)",
  "--chart-7": "hsl(3 60% 78%)",
  "--chart-8": "hsl(38 21% 92%)",
};

/** 라인 차트 전용 색상 팔레트 (Anthropic 브랜드 스타일) */
export const LINE_CHART_COLORS: string[] = [
  "#C15F3C",   // Crail (러스트 오렌지)
  "#B1ADA1",   // Cloudy (웜 그레이)
  "#7D8471",   // Sage (세이지 그린)
  "#9B8AA6",   // Lavender (라벤더)
  "#D4A574",   // Tan (탄 베이지)
  "#6B7B8C",   // Slate (슬레이트 그레이)
  "#da7756",   // Terra Cotta (테라코타)
  "#A67B5B",   // Coffee (커피 브라운)
];

/** CSS 변수에서 색상 값 추출 */
function getCSSVariable(varName: string): string {
  if (typeof window === "undefined") return DARK_FALLBACK_COLORS[varName] || "";
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(varName).trim();
  // fallback for Shadow DOM context where CSS variables aren't accessible
  if (!value && DARK_FALLBACK_COLORS[varName]) {
    return DARK_FALLBACK_COLORS[varName];
  }
  // 이미 hsl() 형식이면 그대로 반환
  if (value.startsWith("hsl(") || value.startsWith("rgb(") || value.startsWith("#")) {
    return value;
  }
  // HSL 값만 있으면 hsl()로 감싸기 (예: "38 71% 75%")
  if (value.includes(" ") && value.includes("%")) {
    return `hsl(${value})`;
  }
  return value;
}

/**
 * 축 라인 색상 반환 (CustomYAxisLine과 동일한 스타일)
 * 라이트 모드: hsl(0 0% 44%), 다크 모드: #ffffff
 */
export function getAxisLineColor(): string {
  if (typeof window === "undefined") return "#ffffff";
  // Shadow DOM 내부에서는 document.documentElement에 dark 클래스가 없을 수 있음
  // CSS 변수로 dark 여부 확인
  const root = document.documentElement;
  const bgValue = getComputedStyle(root).getPropertyValue("--background").trim();
  // CSS 변수가 없으면 Shadow DOM 내부일 가능성 높음 → dark 모드로 처리
  if (!bgValue) return "#ffffff";
  const isDark = document.documentElement.classList.contains('dark');
  return isDark ? "#ffffff" : "hsl(0 0% 44%)";
}

/**
 * 버튼 테두리용 색상 (Y축 색상보다 한 단계 밝음)
 */
export function getButtonBorderColor(): string {
  if (typeof window === "undefined") return "hsl(0 0% 66%)";
  const isDark = document.documentElement.classList.contains('dark');
  return isDark ? "hsl(0 0% 85%)" : "hsl(0 0% 66%)";
}

/**
 * Brush 색상 반환 (라이트/다크 모드)
 */
export function getBrushColors(): { stroke: string; fill: string } {
  if (typeof window === "undefined") return { stroke: "#4B5563", fill: "rgba(255, 255, 255, 0.05)" };
  const isDark = document.documentElement.classList.contains('dark');
  return isDark
    ? { stroke: "#4B5563", fill: "rgba(255, 255, 255, 0.05)" }  // 다크 모드
    : { stroke: "#D1D5DB", fill: "rgba(0, 0, 0, 0.03)" }; // 라이트 모드 (이상치 OFF와 동일)
}

// 커스텀 Brush Traveller (핸들) - 높이 축소
export const CustomBrushTraveller = (props: any) => {
  const { x, y, width, height } = props;

  // NaN 체크 - 초기 렌더링 시 ResponsiveContainer가 아직 크기를 계산하지 못했을 때 발생
  if (isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
    return null;
  }

  const handleHeight = 20;
  const handleY = y + (height - handleHeight) / 2;

  return (
    <rect
      x={x}
      y={handleY}
      width={width}
      height={handleHeight}
      fill="#9CA3AF"
      stroke="#D1D5DB"
      strokeWidth={1}
      rx={2}
      ry={2}
      style={{ cursor: 'ew-resize' }}
    />
  );
};

/**
 * HSL 색상의 밝기를 조정하여 변형 색상 생성
 */
function adjustLightness(hslString: string, adjustment: number): string {
  if (!hslString) return "hsl(0 0% 50%)"; // fallback 색상

  const match = hslString.match(/hsl\((\d+)\s+([\d.]+)%\s+([\d.]+)%\)/);
  if (!match) return hslString;

  const h = match[1];
  const s = match[2];
  let l = parseFloat(match[3]);

  l = Math.max(20, Math.min(90, l + adjustment));

  return `hsl(${h} ${s}% ${l}%)`;
}

/**
 * 값의 크기(magnitude)에 따라 동적으로 라운딩
 * 예: -420 → -500, -42 → -50, -4200 → -5000
 * 예: 380 → 400, 38 → 40, 3800 → 4000
 */
export function roundToNice(value: number, isMax: boolean): number {
  if (value === 0) return 0;

  const absValue = Math.abs(value);
  // 10의 거듭제곱으로 크기 계산 (예: 420 → 100, 42 → 10)
  const magnitude = Math.pow(10, Math.floor(Math.log10(absValue)));

  if (isMax) {
    // 최대값: 올림
    return value >= 0
      ? Math.ceil(value / magnitude) * magnitude
      : Math.floor(value / magnitude) * magnitude;
  } else {
    // 최소값: 내림 (더 넓은 범위)
    return value >= 0
      ? Math.floor(value / magnitude) * magnitude
      : Math.floor(value / magnitude) * magnitude;
  }
}

/**
 * 깨끗한 숫자(1, 2, 5의 배수)로 Y축 틱을 생성
 * @param min 데이터 최소값
 * @param max 데이터 최대값
 * @param targetCount 목표 틱 개수 (기본 5개)
 * @returns 깨끗한 숫자로 이루어진 틱 배열
 */
export function generateNiceTicks(min: number, max: number, targetCount: number = 5): number[] {
  // 동일한 값이면 해당 값만 반환
  if (min === max) return [min];

  // 범위가 0에 매우 가까우면 기본값 반환
  const range = max - min;
  if (range < 1e-10) return [min];

  // 대략적인 간격 계산
  const roughInterval = range / (targetCount - 1);

  // 깨끗한 간격 선택 (roughInterval에 가장 가까운 것)
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughInterval)));
  const NICE_NUMBERS = [1, 2, 5, 10]; // 오름차순 정렬

  let niceInterval = magnitude; // 기본값
  let minDiff = Infinity;
  for (const nice of NICE_NUMBERS) {
    const candidate = nice * magnitude;
    const diff = Math.abs(candidate - roughInterval);
    if (diff < minDiff) {
      minDiff = diff;
      niceInterval = candidate;
    }
  }

  // 시작점/끝점 계산
  const niceMin = Math.floor(min / niceInterval) * niceInterval;
  const niceMax = Math.ceil(max / niceInterval) * niceInterval;

  // 틱 생성
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + niceInterval * 0.001; v += niceInterval) {
    // 부동소수점 오차 방지
    ticks.push(Math.round(v * 1e10) / 1e10);
  }

  return ticks;
}

/**
 * 누적막대 차트의 양수/음수 스택 합계를 계산하여 도메인 반환
 */
function calculateStackedDomain(
  data: any[],
  positiveFields: string[],
  negativeFields: string[]
): [number, number] {
  let posMax = 0;
  let negMin = 0;

  for (const row of data) {
    // 양수 스택 합계
    const posSum = positiveFields.reduce((sum, field) =>
      sum + (typeof row[field] === 'number' ? row[field] : 0), 0);
    posMax = Math.max(posMax, posSum);

    // 음수 스택 합계
    const negSum = negativeFields.reduce((sum, field) =>
      sum + (typeof row[field] === 'number' ? row[field] : 0), 0);
    negMin = Math.min(negMin, negSum);
  }

  // 모두 0인 경우 기본값
  if (posMax === 0 && negMin === 0) {
    return [-10, 10];
  }

  // 라운딩 적용
  const roundedPosMax = roundToNice(posMax, true);
  let roundedNegMin = roundToNice(negMin, false);

  // 음수 최소값에 패딩 추가 (데이터가 X축에 닿지 않도록)
  if (roundedNegMin < 0) {
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(roundedNegMin))));
    roundedNegMin = roundedNegMin - magnitude;
  }

  return [roundedNegMin, roundedPosMax];
}

/**
 * 8개 이상 시리즈를 위한 색상 확장
 */
export function expandSeriesColors(baseColors: string[], count: number): string[] {
  // baseColors가 비어있으면 fallback 색상 사용
  if (!baseColors || baseColors.length === 0) {
    const fallback = "hsl(0 0% 50%)";
    return Array(count).fill(fallback);
  }

  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  const expanded = [...baseColors];
  for (let i = baseColors.length; i < count; i++) {
    const baseIndex = i % baseColors.length;
    const cycle = Math.floor(i / baseColors.length);

    const adjustment = cycle % 2 === 0 ? 15 : -15;
    expanded.push(adjustLightness(baseColors[baseIndex], adjustment));
  }

  return expanded;
}

/** 테마에 맞는 색상 팔레트 가져오기 */
export function getThemeColors(): ChartThemeColors {
  return {
    textColor: getCSSVariable("--foreground"),
    axisLineColor: getCSSVariable("--border"),
    gridColor: getCSSVariable("--muted"),
    seriesColors: [
      getCSSVariable("--chart-1"),
      getCSSVariable("--chart-2"),
      getCSSVariable("--chart-3"),
      getCSSVariable("--chart-4"),
      getCSSVariable("--chart-5"),
      getCSSVariable("--chart-6"),
      getCSSVariable("--chart-7"),
      getCSSVariable("--chart-8"),
    ].filter(Boolean),
  };
}

export interface OutlierDataPoint {
  x: string;
  y: number;
  field: string;
}

export interface DualAxisReferenceLineStyle {
  stroke?: string;
  strokeDasharray?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface RechartsWrapperProps {
  data: Array<Record<string, string | number | [number, number] | null>>;
  xField: string;
  yFields: string[];
  allSeriesFields?: string[];
  chartType: ChartType;
  themeColors?: ChartThemeColors;
  height?: number;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  yAxisLabels?: {
    default?: string;
    left?: string;
    right?: string;
  };
  seriesLabelMap?: Record<string, string>;
  seriesGroupAssignments?: Record<string, number>;
  outlierData?: OutlierDataPoint[];
  showOutliers?: boolean;
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  datetimeUnit?: number;
  showBrush?: boolean;
  showTooltip?: boolean;
  showDualAxisReferenceLine?: boolean; // 이중축 일때 y=0선 표시 여부
  dualAxisReferenceLineStyle?: DualAxisReferenceLineStyle; // 이중축 기준선 스타일
}

export function RechartsWrapper({
  data,
  xField,
  yFields,
  allSeriesFields,
  chartType,
  themeColors,
  height = 300,
  yFieldTypes,
  yAxisPlacements,
  yAxisLabels,
  seriesLabelMap,
  seriesGroupAssignments,
  outlierData,
  showOutliers = true,
  onTooltipChange,
  datetimeUnit = 1,
  showBrush = false,
  showTooltip = true,
  showDualAxisReferenceLine = false,
  dualAxisReferenceLineStyle,
}: RechartsWrapperProps) {
  // Brush height constants (same as RechartsSplitWrapper)
  const BRUSH_HEIGHT = 40;
  const BRUSH_MARGIN_TOP = 16;
  const brushReserved = showBrush ? BRUSH_HEIGHT + BRUSH_MARGIN_TOP : 0;
  const effectiveHeight = height - brushReserved;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState<number>(0);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  // Brush 호버/드래그 상태
  const [isBrushHovered, setIsBrushHovered] = useState(false);
  const [isBrushDragging, setIsBrushDragging] = useState(false);
  const [brushStartIndex, setBrushStartIndex] = useState<number>(0);
  const [brushEndIndex, setBrushEndIndex] = useState<number>(Math.max(0, data.length - 1));

  // data 변경 시 brush 인덱스 동기화
  useEffect(() => {
    setBrushStartIndex(0);
    setBrushEndIndex(Math.max(0, data.length - 1));
  }, [data.length]);

  const isDualAxisLike = chartType === "dual-axis" || chartType === "dual-axis-stacked-bar";
  const isStackedGroupedLike = chartType === "stacked-grouped" || chartType === "dual-axis-stacked-bar";
  const defaultYAxisLabel = String(yAxisLabels?.default ?? "").trim() || undefined;
  const leftYAxisLabel = String(yAxisLabels?.left ?? "").trim() || undefined;
  const rightYAxisLabel = String(yAxisLabels?.right ?? "").trim() || undefined;
  const resolvedDualAxisReferenceLineStyle: DualAxisReferenceLineStyle = {
    stroke: "hsl(var(--muted-foreground))",
    strokeDasharray: "3 3",
    strokeWidth: 1.5,
    opacity: 0.5,
    ...dualAxisReferenceLineStyle,
  };

  const isColumnChart = chartType === 'column' || chartType === 'stacked' || chartType === 'stacked-100' || chartType === 'stacked-grouped' ||
    (chartType === 'mixed' && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column')) ||
    (isDualAxisLike && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column'));

  // Column 타입 시리즈 개수 계산 (이중축/혼합 차트에서는 Column 타입만 카운트)
  const columnFieldCount = isDualAxisLike || chartType === 'mixed'
    ? yFields.filter(f => !yFieldTypes || yFieldTypes[f] === 'column').length
    : yFields.length;

  // Column 타입 시리즈가 2개 이상일 때만 음영 사용 (분할 누적막대는 제외, 100% 누적막대와 그룹형 누적막대는 포함)
  const shouldUseShade = isColumnChart && columnFieldCount >= 2 && chartType !== 'stacked';
  const hasVisibleYAxisLabel = Boolean(
    defaultYAxisLabel || (isDualAxisLike && (leftYAxisLabel || rightYAxisLabel))
  );

  // 누적막대에서 양수/음수 혼합 시리즈를 분리하는 함수
  const transformDataForMixedSeries = useMemo(() => {
    if (chartType !== "stacked" && chartType !== "stacked-100" && !isStackedGroupedLike && chartType !== "area-100") return { data, fields: yFields, fieldStats: [], yAxisDomain: undefined, isPositiveOnly: false, isPercentage: false };

    // 100% 누적막대 또는 100% 영역 차트: 각 시점별로 퍼센트 변환
    if (chartType === "stacked-100" || chartType === "area-100") {
      const percentageData = data.map(row => {
        const newRow: any = { ...row };

        // 해당 시점의 모든 시리즈 값 합계 계산
        let total = 0;
        yFields.forEach(field => {
          const value = row[field];
          if (typeof value === "number" && !isNaN(value)) {
            total += Math.abs(value);
          }
        });

        // 각 값을 퍼센트로 변환하고 원본값 보존
        yFields.forEach(field => {
          const value = row[field];
          if (typeof value === "number" && !isNaN(value)) {
            newRow[`${field}_original`] = value;
            newRow[field] = total > 0 ? (Math.abs(value) / total) * 100 : 0;
          }
        });

        return newRow;
      });

      return {
        data: percentageData,
        fields: yFields,
        fieldStats: [],
        yAxisDomain: [0, 100] as [number, number],
        isPositiveOnly: true,
        isPercentage: true
      };
    }

    // 양수 전용 데이터 체크 (모든 필드의 모든 값이 >= 0)
    const hasAnyNegative = yFields.some(field =>
      data.some(item => {
        const value = item[field];
        return typeof value === "number" && !isNaN(value) && value < 0;
      })
    );

    // 양수 전용 데이터: 분리 로직 스킵, 원본 데이터/필드 그대로 반환
    if (!hasAnyNegative) {
      return {
        data,
        fields: yFields,
        fieldStats: [],
        yAxisDomain: undefined,
        isPositiveOnly: true,
        isPercentage: false
      };
    }

    // 각 필드의 양수/음수 여부 확인
    const fieldStats = yFields.map(field => {
      const values = data
        .map(item => item[field])
        .filter((v): v is number => typeof v === "number" && !isNaN(v));

      const hasNegative = values.some(v => v < 0);
      const hasPositive = values.some(v => v > 0);

      return {
        field,
        hasNegative,
        hasPositive,
        isMixed: hasNegative && hasPositive
      };
    });

    // 혼합 시리즈를 positive/negative로 분리
    const transformedData = data.map(row => {
      const newRow: any = { ...row };

      fieldStats.forEach(({ field, isMixed }) => {
        if (isMixed) {
          const value = row[field];
          if (typeof value === "number") {
            // 양수용 필드: 양수만 유지, 음수는 null
            newRow[`${field}_positive`] = value >= 0 ? value : null;
            // 음수용 필드: 음수만 유지, 양수는 null
            newRow[`${field}_negative`] = value < 0 ? value : null;
          }
        }
      });

      return newRow;
    });

    // 새로운 필드 목록 생성 (원래 yFields 순서 유지)
    const newFields: string[] = [];
    const positiveFields: string[] = [];
    const negativeFields: string[] = [];

    yFields.forEach(field => {
      const stat = fieldStats.find(s => s.field === field);
      if (!stat) return;

      if (stat.isMixed) {
        // 혼합 시리즈: positive와 negative를 연속으로 추가
        newFields.push(`${field}_positive`, `${field}_negative`);
        positiveFields.push(`${field}_positive`);
        negativeFields.push(`${field}_negative`);
      } else {
        // 혼합되지 않은 시리즈: 원래 필드명 사용
        newFields.push(field);
        if (stat.hasPositive && !stat.hasNegative) {
          positiveFields.push(field);
        } else {
          negativeFields.push(field);
        }
      }
    });

    // 누적막대의 도메인 계산
    const yAxisDomain = calculateStackedDomain(transformedData, positiveFields, negativeFields);

    return { data: transformedData, fields: newFields, fieldStats, yAxisDomain, isPositiveOnly: false, isPercentage: false };
  }, [data, yFields, chartType, isStackedGroupedLike]);

  // 브러시 범위에 따른 필터링된 데이터
  const filteredData = useMemo(() => {
    if (!showBrush) return transformDataForMixedSeries.data;
    return transformDataForMixedSeries.data.slice(brushStartIndex, brushEndIndex + 1);
  }, [transformDataForMixedSeries.data, brushStartIndex, brushEndIndex, showBrush]);

  // 이중축일 때 좌/우측 필드 분리
  const { leftFields, rightFields } = useMemo(() => {
    if (!isDualAxisLike || !yAxisPlacements) {
      return { leftFields: yFields, rightFields: [] };
    }

    // 렌더링에서 yAxisId 폴백 로직과 일치시킴 (설정 없으면 'left'로 폴백)
    const left = yFields.filter(f => (yAxisPlacements[f] || 'left') === 'left');
    const right = yFields.filter(f => yAxisPlacements[f] === 'right');

    return { leftFields: left, rightFields: right };
  }, [isDualAxisLike, yFields, yAxisPlacements]);

  const colors = useMemo(() => {
    const baseColors = themeColors?.seriesColors || [
      "hsl(var(--chart-1))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
      "hsl(var(--chart-6))",
      "hsl(var(--chart-7))",
      "hsl(var(--chart-8))",
    ];
    return expandSeriesColors(baseColors, yFields.length);
  }, [themeColors?.seriesColors, yFields.length]);
  const shouldRenderTooltipContent = showTooltip;

  // 누적막대 양수/음수 분할 렌더링 판단
  const shouldSplitStack = useMemo(() => {
    if (chartType !== 'stacked') return false;

    // 양수 전용 데이터는 분할 불필요
    if (transformDataForMixedSeries.isPositiveOnly) return false;

    const { fieldStats } = transformDataForMixedSeries;
    const hasPositive = fieldStats.some(s => s.hasPositive);
    const hasNegative = fieldStats.some(s => s.hasNegative);

    return hasPositive && hasNegative;
  }, [chartType, transformDataForMixedSeries]);

  // 양수/음수 데이터 준비
  const splitStackData = useMemo(() => {
    if (!shouldSplitStack) return null;

    const { data, fields, fieldStats } = transformDataForMixedSeries;

    const positiveFields = fields.filter(f => {
      const originalField = f.replace(/_positive$|_negative$/, '');
      const stat = fieldStats.find(s => s.field === originalField);
      if (f.endsWith('_positive')) return true;
      if (f.endsWith('_negative')) return false;
      return stat?.hasPositive && !stat?.hasNegative;
    });

    const negativeFields = fields.filter(f => {
      const originalField = f.replace(/_positive$|_negative$/, '');
      const stat = fieldStats.find(s => s.field === originalField);
      if (f.endsWith('_negative')) return true;
      if (f.endsWith('_positive')) return false;
      return stat?.hasNegative && !stat?.hasPositive;
    });

    return { data, positiveFields, negativeFields, fieldStats };
  }, [shouldSplitStack, transformDataForMixedSeries]);

  // 분할 누적 차트에서도 브러시 범위를 실제 렌더 데이터에 반영한다.
  const splitStackDisplayedData = useMemo(() => {
    if (!splitStackData) return [];
    if (!showBrush) return splitStackData.data;
    return splitStackData.data.slice(brushStartIndex, brushEndIndex + 1);
  }, [splitStackData, showBrush, brushStartIndex, brushEndIndex]);

  // 색상 매핑 함수
  const getColorForField = useCallback((field: string) => {
    const originalField = field.replace(/_positive$|_negative$/, '');
    const originalSeriesFields = allSeriesFields || yFields;
    const originalIndex = originalSeriesFields.indexOf(originalField);
    return originalIndex >= 0
      ? (themeColors?.seriesColors?.[originalIndex % (themeColors?.seriesColors?.length || 8)] || colors[0])
      : colors[0];
  }, [allSeriesFields, yFields, themeColors?.seriesColors, colors]);

  const createYAxisLabel = useCallback(
    (value: string | undefined, side: "left" | "right" = "left") => {
      if (!value) return undefined;
      return {
        value,
        angle: 0,
        position: side === "right" ? "insideTopRight" : "insideTopLeft",
        offset: 0,
        style: {
          textAnchor: side === "right" ? "end" : "start",
          fill: "hsl(var(--muted-foreground))",
          fontSize: 12,
        },
      } as const;
    },
    []
  );

  // Y축 도메인 계산 (분할 차트용)
  const splitDomains = useMemo(() => {
    if (!splitStackData) return null;

    const posMax = calculateStackedDomain(
      splitStackData.data,
      splitStackData.positiveFields,
      []
    )[1];

    const negMin = calculateStackedDomain(
      splitStackData.data,
      [],
      splitStackData.negativeFields
    )[0];

    return {
      positive: [0, posMax] as [number, number],
      negative: [negMin, 0] as [number, number],
    };
  }, [splitStackData]);

  // 이중축 Y축 도메인 계산
  const { leftDomain, rightDomain } = useMemo(() => {
    if (!isDualAxisLike || !yAxisPlacements) {
      return { leftDomain: undefined, rightDomain: undefined };
    }

    // 좌측 Y축 도메인 계산
    let leftMin = 0, leftMax = 0;
    if (leftFields.length > 0) {
      for (const row of data) {
        for (const field of leftFields) {
          const value = row[field];
          if (typeof value === 'number' && !isNaN(value)) {
            leftMin = Math.min(leftMin, value);
            leftMax = Math.max(leftMax, value);
          }
        }
      }
      leftMin = roundToNice(leftMin, false);
      leftMax = roundToNice(leftMax, true);
      // 음수 최소값에 패딩 추가 (데이터가 X축에 닿지 않도록)
      if (leftMin < 0) {
        const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(leftMin))));
        leftMin = leftMin - magnitude;
      }
    }

    // 우측 Y축 도메인 계산
    let rightMin = 0, rightMax = 0;
    if (rightFields.length > 0) {
      for (const row of data) {
        for (const field of rightFields) {
          const value = row[field];
          if (typeof value === 'number' && !isNaN(value)) {
            rightMin = Math.min(rightMin, value);
            rightMax = Math.max(rightMax, value);
          }
        }
      }
      rightMin = roundToNice(rightMin, false);
      rightMax = roundToNice(rightMax, true);
      // 음수 최소값에 패딩 추가 (데이터가 X축에 닿지 않도록)
      if (rightMin < 0) {
        const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(rightMin))));
        rightMin = rightMin - magnitude;
      }
    }

    return {
      leftDomain: leftFields.length > 0 ? [leftMin, leftMax] as [number, number] : undefined,
      rightDomain: rightFields.length > 0 ? [rightMin, rightMax] as [number, number] : undefined,
    };
  }, [isDualAxisLike, yAxisPlacements, data, leftFields, rightFields]);

  // 차트 높이 분배 (Y축 도메인 범위 기반)
  const chartHeights = useMemo(() => {
    if (!splitStackData || !splitDomains) {
      return { positive: effectiveHeight / 2, negative: effectiveHeight / 2 };
    }

    // Y축 도메인 범위를 사용하여 높이 비율 계산
    // 이렇게 하면 개별 막대의 시각적 높이가 절대값에 정확히 비례함
    const posRange = Math.abs(splitDomains.positive[1] - splitDomains.positive[0]);
    const negRange = Math.abs(splitDomains.negative[0] - splitDomains.negative[1]);
    const total = posRange + negRange;

    if (total === 0) {
      return { positive: effectiveHeight / 2, negative: effectiveHeight / 2 };
    }

    const positiveHeight = Math.round((posRange / total) * effectiveHeight);
    const negativeHeight = effectiveHeight - positiveHeight;

    return { positive: positiveHeight, negative: negativeHeight };
  }, [splitStackData, splitDomains, effectiveHeight]);

  // 분할 차트 tooltip 통합 핸들러
  const handleUnifiedTooltip = useCallback((label: string | null, payload: any[] | null) => {
    if (!label || !onTooltipChange || !splitStackData) {
      onTooltipChange?.(null, null);
      return;
    }

    const combinedPayload: any[] = [];
    const dataItem = splitStackDisplayedData.find(d => d[xField] === label);

    if (dataItem) {
      // 양수 필드 데이터 수집
      splitStackData.positiveFields.forEach(field => {
        const value = dataItem[field];
        if (value != null && value !== 0) {
          combinedPayload.push({ dataKey: field, value, payload: dataItem });
        }
      });

      // 음수 필드 데이터 수집
      splitStackData.negativeFields.forEach(field => {
        const value = dataItem[field];
        if (value != null && value !== 0) {
          combinedPayload.push({ dataKey: field, value, payload: dataItem });
        }
      });
    }

    onTooltipChange(combinedPayload, label);
  }, [splitStackData, splitStackDisplayedData, xField, onTooltipChange]);

  // 차트 너비 측정
  useEffect(() => {
    const updateWidth = () => {
      if (chartContainerRef.current) {
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

  // X축 레이블 필터링 로직
  const LABEL_MIN_WIDTH = 60;
  const xLabels = data.map((d) => d[xField] as string);
  const leftAxisWidth = isDualAxisLike ? 50 : 60;
  const rightAxisWidth = isDualAxisLike ? 50 : 0;
  const chartMarginRight = isDualAxisLike ? 10 : 30;

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

  // 표시할 X축 틱 계산 (첫 번째와 마지막 제외)
  const visibleTicks = useMemo(() => {
    const ticks: string[] = [];

    xLabels.forEach((label, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === xLabels.length - 1;

      // 컬럼차트: 첫/마지막 조건부 표시
      if (isColumnChart) {
        // 첫 번째는 항상 추가
        if (isFirst) {
          ticks.push(label);
          return;
        }

        // 마지막은 datetime_unit 조건 확인
        if (isLast) {
          if (!datetimeUnit || datetimeUnit === 1) {
            ticks.push(label);
          } else if (idx % datetimeUnit === 0) {
            ticks.push(label);
          }
          return;
        }
      } else {
        // 라인/영역: 첫/마지막 스킵 유지
        if (isFirst || isLast) return;
      }

      // 중간 값들: 기존 로직 그대로
      if (datetimeUnit && datetimeUnit > 1) {
        if (idx % datetimeUnit === 0) {
          ticks.push(label);
        }
        return;
      }

      // 모두 표시
      if (shouldShowAll) {
        ticks.push(label);
        return;
      }

      // 간격에 따라 표시
      const step = Math.ceil(xLabels.length / maxLabels);
      if (idx % step === 0) {
        ticks.push(label);
      }
    });

    return ticks;
  }, [xLabels, shouldShowAll, maxLabels, datetimeUnit, isColumnChart]);

  // 월 단위에서 연도가 바뀌는 레이블 감지
  const yearChangeLabels = useMemo(() => {
    const changes = new Set<string>();

    xLabels.forEach((label, idx) => {
      if (idx === 0) return; // 첫 레이블은 비교할 이전 값 없음

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

  // 카테고리 경계 계산 (막대 차트 음영용)
  const hoveredCategoryBounds = useMemo(() => {
    if (!hoveredLabel || !chartWidth || !shouldUseShade) return null;

    const idx = xLabels.findIndex(label => label === hoveredLabel);
    if (idx === -1) return null;

    // 실제 차트(플롯) 영역 너비 계산
    const plotAreaWidth = chartWidth - chartMarginRight - leftAxisWidth - rightAxisWidth;

    // brush 범위를 고려한 보이는 카테고리 수 계산
    const visibleCategoryCount = Math.max(1, brushEndIndex - brushStartIndex + 1);
    const categorySize = plotAreaWidth / visibleCategoryCount;

    // brush 시작 위치 기준으로 인덱스 조정
    const visibleIdx = idx - brushStartIndex;

    // 카테고리 시작 위치 계산
    const categoryStart = leftAxisWidth + (visibleIdx * categorySize);
    const startX = categoryStart;
    const width = categorySize;

    return { startX, width };
  }, [hoveredLabel, chartWidth, xLabels, shouldUseShade, brushStartIndex, brushEndIndex, chartMarginRight, leftAxisWidth, rightAxisWidth]);

  // 분할 누적차트 호버 보조선 X 좌표 계산
  const splitStackHoveredX = useMemo(() => {
    if (!shouldSplitStack || !hoveredLabel || !chartWidth) return null;

    const idx = xLabels.findIndex(label => label === hoveredLabel);
    if (idx === -1) return null;

    const plotAreaWidth = chartWidth - chartMarginRight - leftAxisWidth - rightAxisWidth;
    const categorySize = plotAreaWidth / xLabels.length;

    // 막대 차트는 카테고리 중앙에 위치
    const categoryCenter = (idx + 0.5) * categorySize;
    return leftAxisWidth + categoryCenter;
  }, [shouldSplitStack, hoveredLabel, chartWidth, xLabels, chartMarginRight, leftAxisWidth, rightAxisWidth]);

  const renderSeries = () => {
    const { fields: renderFields, fieldStats } = transformDataForMixedSeries;

    // Column과 Line 시리즈를 분리하여 Column이 먼저, Line이 나중에 렌더링되도록 함
    // (recharts에서 나중에 렌더링된 요소가 위에 표시됨)
    const columnSeries: React.ReactElement[] = [];
    const lineSeries: React.ReactElement[] = [];

    // 누적막대에서 마지막 Column 시리즈 인덱스 계산
    const columnFields = renderFields.filter((field) => {
      const originalField = field.replace(/_positive$|_negative$/, '');
      if (chartType === "line") return false;
      if (chartType === "mixed" || isDualAxisLike) {
        return (yFieldTypes?.[originalField] ?? "column") === "column";
      }
      return true;
    });
    const lastColumnFieldIndex = columnFields.length - 1;
    let currentColumnIndex = 0;

    // 그룹형 누적막대: 각 그룹별 마지막 시리즈 계산
    const lastFieldInGroup: Record<number, string> = {};
    if (isStackedGroupedLike && seriesGroupAssignments) {
      renderFields.forEach((field) => {
        const origField = field.replace(/_positive$|_negative$/, '');
        const groupNum = seriesGroupAssignments[origField] || 1;
        if (groupNum > 0) {
          lastFieldInGroup[groupNum] = origField;
        }
      });
    }

    renderFields.forEach((field) => {
      // 원본 필드명 추출
      const originalField = field.replace(/_positive$|_negative$/, '');
      const isPositiveSplit = field.endsWith('_positive');
      const isNegativeSplit = field.endsWith('_negative');

      // 색상 결정 (분리된 필드는 원본 필드의 색상 사용)
      const colorField = isPositiveSplit || isNegativeSplit ? originalField : field;
      // 원본 seriesFields에서 인덱스 찾기 (필터링 전 원래 위치)
      const originalSeriesFields = allSeriesFields || yFields;
      const originalIndex = originalSeriesFields.indexOf(colorField);
      const color = originalIndex >= 0
        ? (themeColors?.seriesColors?.[originalIndex % (themeColors?.seriesColors?.length || 8)] || colors[0])
        : colors[0];

      // 차트 타입별 시리즈 타입 결정
      let seriesType: "column" | "line" | "area";
      if (chartType === "line") {
        seriesType = "line";
      } else if (chartType === "area" || chartType === "area-100" || chartType === "stacked-area") {
        seriesType = "area";
      } else if (chartType === "mixed" || isDualAxisLike) {
        // 혼합 차트 or 이중축: yFieldTypes에서 지정한 타입 사용, 기본값은 "column"
        seriesType = yFieldTypes?.[originalField] ?? "column";
      } else {
        // column, stacked 등: 막대
        seriesType = "column";
      }

      // 이중축일 때 yAxisId 지정
      const yAxisId = isDualAxisLike && yAxisPlacements
        ? (yAxisPlacements[originalField] || 'left')
        : 'default';

      if (seriesType === "line") {
        lineSeries.push(
          <Line
            key={field}
            type="monotone"
            dataKey={field}
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
            yAxisId={yAxisId}
            name={seriesLabelMap?.[originalField] ?? originalField}
          />
        );
      } else if (seriesType === "area") {
        lineSeries.push(
          <Area
            key={field}
            type="monotone"
            dataKey={field}
            stroke={color}
            fill={color}
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
            activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
            yAxisId={yAxisId}
            stackId={(chartType === "area-100" || chartType === "stacked-area") ? "area-stack" : undefined}
            name={seriesLabelMap?.[originalField] ?? originalField}
          />
        );
      } else {
        // 라운딩 처리 로직
        const isLastColumn = currentColumnIndex === lastColumnFieldIndex;
        let columnRadius: number | [number, number, number, number];

        if (chartType === "stacked" || chartType === "stacked-100") {
          // 누적 막대: 마지막 시리즈만 위쪽 라운딩
          columnRadius = isLastColumn ? [2, 2, 0, 0] : 0;
        } else if (isStackedGroupedLike && seriesGroupAssignments) {
          // 그룹형 누적막대: 각 그룹별 마지막 시리즈만 라운딩
          const groupNum = seriesGroupAssignments[originalField] || 1;
          const isLastInGroup = lastFieldInGroup[groupNum] === originalField;
          columnRadius = isLastInGroup ? [2, 2, 0, 0] : 0;
        } else {
          // 일반 막대: 모든 막대 위쪽만 라운딩
          columnRadius = [2, 2, 0, 0];
        }

        // stackId 결정: 그룹형 누적막대는 그룹별로 다른 stackId 사용
        let stackId: string | undefined;
        if (isStackedGroupedLike && seriesGroupAssignments) {
          const groupNum = seriesGroupAssignments[originalField] || 1;
          stackId = `group${groupNum}`;
        } else if (chartType === "stacked" || chartType === "stacked-100") {
          stackId = "stack";
        }

        columnSeries.push(
          <Bar
            key={field}
            dataKey={field}
            fill={color}
            radius={columnRadius}
            stackId={stackId}
            yAxisId={yAxisId}
            name={seriesLabelMap?.[originalField] ?? originalField}
          />
        );
        currentColumnIndex++;
      }
    });

    // Column 먼저, Line 나중에 렌더링 (Line이 막대 위에 표시됨)
    return [...columnSeries, ...lineSeries];
  };

  // 일반 차트용 y=0 선 스타일 계산 (조건부 렌더링 밖에서 항상 호출)
  const zeroLineStyleForNormalChart = useMemo(() => {
    const style = (chartType === "stacked" || isStackedGroupedLike)
      ? getZeroLineStyle(data, yFields)
      : getZeroLineStyle(transformDataForMixedSeries.data, transformDataForMixedSeries.fields);
    return style;
  }, [data, yFields, transformDataForMixedSeries, chartType, isStackedGroupedLike]);

  // 일반 차트용 Y축 도메인 계산 (비대칭)
  const normalChartYDomain = useMemo(() => {
    // 분할 차트나 특수 차트는 제외
    if (shouldSplitStack) return undefined;
    if (chartType === "stacked" || chartType === "stacked-100" ||
      isStackedGroupedLike || chartType === "area-100" ||
      chartType === "synced-area" || isDualAxisLike) return undefined;

    // 현재 표시 데이터에서 min/max 계산 (활성화된 시리즈만 사용)
    const dataToUse = filteredData;
    const fieldsToUse = yFields;

    let min = 0, max = 0;
    for (const row of dataToUse) {
      for (const field of fieldsToUse) {
        const value = row[field];
        if (typeof value === "number" && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      }
    }

    // 모두 0이면 undefined (recharts 기본 사용)
    if (min === 0 && max === 0) return undefined;

    // roundToNice로 깔끔한 값으로 반올림
    let niceMin = min < 0 ? roundToNice(min, false) : 0;
    const niceMax = max > 0 ? roundToNice(max, true) : 0;

    // 음수 최소값에 패딩 추가 (데이터가 X축에 닿지 않도록)
    if (niceMin < 0) {
      const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(niceMin))));
      niceMin = niceMin - magnitude;
    }

    // 디버깅용 (문제 해결 후 제거)
    console.log('[DEBUG normalChartYDomain]', { yFields, min, max, niceMin, niceMax });

    return [niceMin, niceMax] as [number, number];
  }, [shouldSplitStack, chartType, filteredData, yFields, isDualAxisLike, isStackedGroupedLike]);

  // Y축 깨끗한 숫자 ticks 생성 (0 포함)
  const yAxisTicksWithZero = useMemo(() => {
    if (isDualAxisLike) return undefined;

    // 현재 도메인 확인
    const domain = (chartType === "stacked" || chartType === "stacked-100" || isStackedGroupedLike || chartType === "area-100") && transformDataForMixedSeries.yAxisDomain
      ? transformDataForMixedSeries.yAxisDomain
      : normalChartYDomain;

    if (!domain) return undefined;

    const [min, max] = domain;

    // generateNiceTicks로 깨끗한 숫자 틱 생성
    const niceTicks = generateNiceTicks(min, max, 5);

    // 0이 도메인 범위 내에 있고, niceTicks에 없으면 추가
    if (min <= 0 && max >= 0 && !niceTicks.includes(0)) {
      niceTicks.push(0);
      niceTicks.sort((a, b) => a - b);
    }

    return niceTicks;
  }, [isDualAxisLike, chartType, isStackedGroupedLike, transformDataForMixedSeries.yAxisDomain, normalChartYDomain]);

  // 이중축 좌측 Y축 깨끗한 숫자 ticks 생성
  const leftYAxisTicks = useMemo(() => {
    if (!isDualAxisLike || !leftDomain) return undefined;
    const [min, max] = leftDomain;
    const niceTicks = generateNiceTicks(min, max, 5);
    if (min <= 0 && max >= 0 && !niceTicks.includes(0)) {
      niceTicks.push(0);
      niceTicks.sort((a, b) => a - b);
    }
    return niceTicks;
  }, [isDualAxisLike, leftDomain]);

  // 이중축 우측 Y축 깨끗한 숫자 ticks 생성
  const rightYAxisTicks = useMemo(() => {
    if (!isDualAxisLike || !rightDomain) return undefined;
    const [min, max] = rightDomain;
    const niceTicks = generateNiceTicks(min, max, 5);
    if (min <= 0 && max >= 0 && !niceTicks.includes(0)) {
      niceTicks.push(0);
      niceTicks.sort((a, b) => a - b);
    }
    return niceTicks;
  }, [isDualAxisLike, rightDomain]);

  return (
    <div ref={chartContainerRef} style={{ width: '100%', height, position: 'relative' }}>
      {shouldSplitStack && splitStackData && splitDomains ? (
        <>
          {/* 누적막대 분할 차트 호버 보조선 */}
          {splitStackHoveredX !== null && (
            <svg
              style={{
                position: 'absolute',
                left: splitStackHoveredX - 0.5,
                top: 0,
                height: effectiveHeight,
                width: 1,
                pointerEvents: 'none',
                zIndex: 1,
                overflow: 'visible',
              }}
            >
              <line
                x1="0.5"
                y1="0"
                x2="0.5"
                y2={effectiveHeight - 40}
                stroke={themeColors?.textColor || "hsl(var(--foreground))"}
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeOpacity={0.15}
              />
            </svg>
          )}

          {/* 누적막대 양수/음수 분할 렌더링 */}
          <div className="flex flex-col" style={{
            gap: 0,
            height: effectiveHeight,
            overflow: 'visible',
            position: 'relative',
            zIndex: 2
          }}>
            {/* 양수 차트 (상단) */}
            {splitStackData.positiveFields.length > 0 && (
              <div style={{ height: chartHeights.positive, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={splitStackDisplayedData}
                    margin={{ top: defaultYAxisLabel ? 20 : 10, right: 30, left: 0, bottom: 0 }}
                    onMouseMove={(state: any) => {
                      if (state && state.activeLabel) {
                        setHoveredLabel(state.activeLabel);
                        handleUnifiedTooltip(state.activeLabel, state.activePayload);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredLabel(null);
                      onTooltipChange?.(null, null);
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={themeColors?.gridColor || "hsl(var(--muted))"}
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey={xField}
                      hide={true}
                    />
                    <YAxis
                      yAxisId="default"
                      domain={splitDomains.positive}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                      label={createYAxisLabel(defaultYAxisLabel)}
                      tickFormatter={(value) => typeof value === "number" ? axisTickFormatter(value) : value}
                    />
                    <Tooltip cursor={false} content={() => null} />
                    <Legend wrapperStyle={{ display: "none" }} />
                    {splitStackData.positiveFields.map((field, index) => (
                      <Bar
                        key={field}
                        dataKey={field}
                        fill={getColorForField(field)}
                        stackId="positive"
                        radius={index === splitStackData.positiveFields.length - 1 ? [2, 2, 0, 0] : 0}
                        yAxisId="default"
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 음수 차트 (하단) */}
            {splitStackData.negativeFields.length > 0 && (
              <div style={{ height: chartHeights.negative, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={splitStackDisplayedData}
                    margin={{ top: 0, right: 30, left: 0, bottom: 10 }}
                    onMouseMove={(state: any) => {
                      if (state && state.activeLabel) {
                        setHoveredLabel(state.activeLabel);
                        handleUnifiedTooltip(state.activeLabel, state.activePayload);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredLabel(null);
                      onTooltipChange?.(null, null);
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={themeColors?.gridColor || "hsl(var(--muted))"}
                      opacity={0.5}
                    />
                    <XAxis
                      dataKey={xField}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                      angle={0}
                      textAnchor="middle"
                      height={30}
                      ticks={visibleTicks}
                      tickFormatter={(value) => {
                        if (yearChangeLabels.has(value)) {
                          return value;
                        }
                        return formatDateForXAxis(value);
                      }}
                    />
                    <YAxis
                      yAxisId="default"
                      domain={splitDomains.negative}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                      tickFormatter={(value) => typeof value === "number" ? axisTickFormatter(value) : value}
                    />
                    <ReferenceLine
                      y={0}
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1}
                      opacity={0.5}
                      yAxisId="default"
                    />
                    <Tooltip cursor={false} content={() => null} />
                    <Legend wrapperStyle={{ display: "none" }} />
                    {splitStackData.negativeFields.map((field, index) => (
                      <Bar
                        key={field}
                        dataKey={field}
                        fill={getColorForField(field)}
                        stackId="negative"
                        radius={index === splitStackData.negativeFields.length - 1 ? [0, 0, 2, 2] : 0}
                        yAxisId="default"
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          {/* Brush for split stack charts */}
          {showBrush && data.length > 0 && (() => {
            const brushColors = getBrushColors();

            return (
              <div style={{ position: 'relative', height: BRUSH_HEIGHT, marginTop: BRUSH_MARGIN_TOP, marginLeft: 60, marginRight: 30 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <XAxis dataKey={xField} hide />
                    <Brush
                      dataKey={xField}
                      height={BRUSH_HEIGHT}
                      startIndex={brushStartIndex}
                      endIndex={brushEndIndex}
                      travellerWidth={4}
                      traveller={<CustomBrushTraveller />}
                      stroke={brushColors.stroke}
                      fill={brushColors.fill}
                      onChange={(range: { startIndex?: number; endIndex?: number }) => {
                        if (range.startIndex !== undefined && range.endIndex !== undefined) {
                          setBrushStartIndex(range.startIndex);
                          setBrushEndIndex(range.endIndex);
                          setIsBrushDragging(true);
                        }
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
        </>
      ) : (
        // 기존 단일 차트 렌더링
        <>
          <ResponsiveContainer width="100%" height={effectiveHeight}>
            <ComposedChart
              data={filteredData}
              margin={isDualAxisLike
                ? { top: hasVisibleYAxisLabel ? 20 : 10, right: 10, left: 0, bottom: 0 }
                : { top: defaultYAxisLabel ? 20 : 10, right: 30, left: 0, bottom: 0 }
              }
              onMouseMove={(state: any) => {
                if (state && state.activePayload && state.activePayload.length > 0) {
                  const label = state.activeLabel;
                  const payload = state.activePayload;
                  setHoveredLabel(label);
                  onTooltipChange?.(payload, label);
                }
              }}
              onMouseLeave={() => {
                setHoveredLabel(null);
                onTooltipChange?.(null, null);
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={themeColors?.gridColor || "hsl(var(--muted))"}
                opacity={0.5}
              />
              <XAxis
                dataKey={xField}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                angle={0}
                textAnchor="middle"
                height={30}
                ticks={visibleTicks}
                tickFormatter={(value) => {
                  // 월 단위에서 연도가 바뀌는 레이블은 4자리 유지
                  if (yearChangeLabels.has(value)) {
                    return value;
                  }
                  return formatDateForXAxis(value);
                }}
              />
              {/* 좌측 Y축 - 이중축일 때만 표시 */}
              <YAxis
                yAxisId="left"
                orientation="left"
                domain={leftDomain}
                ticks={leftYAxisTicks}
                width={isDualAxisLike ? 50 : 0}
                tick={isDualAxisLike ? { fill: "hsl(var(--muted-foreground))", fontSize: 12 } : false}
                tickLine={false}
                axisLine={isDualAxisLike ? { stroke: getAxisLineColor(), strokeWidth: 1.5 } : false}
                label={isDualAxisLike ? createYAxisLabel(leftYAxisLabel, "left") : undefined}
                tickFormatter={(value) => typeof value === "number" ? axisTickFormatter(value) : value}
              />

              {/* 우측 Y축 - 이중축일 때만 표시 */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={rightDomain}
                ticks={rightYAxisTicks}
                width={isDualAxisLike ? 50 : 0}
                tick={isDualAxisLike ? { fill: "hsl(var(--muted-foreground))", fontSize: 12 } : false}
                tickLine={false}
                axisLine={isDualAxisLike ? { stroke: getAxisLineColor(), strokeWidth: 1.5 } : false}
                label={isDualAxisLike ? createYAxisLabel(rightYAxisLabel, "right") : undefined}
                tickFormatter={(value) => typeof value === "number" ? axisTickFormatter(value) : value}
              />

              {/* 기본 Y축 - 이중축일 때는 숨김 */}
              <YAxis
                yAxisId="default"
                width={isDualAxisLike ? 0 : 60}
                domain={
                  (chartType === "stacked" || chartType === "stacked-100" || isStackedGroupedLike || chartType === "area-100") && transformDataForMixedSeries.yAxisDomain
                    ? transformDataForMixedSeries.yAxisDomain
                    : normalChartYDomain
                }
                ticks={yAxisTicksWithZero}
                tick={isDualAxisLike ? false : { fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickLine={false}
                axisLine={isDualAxisLike ? false : { stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                label={isDualAxisLike ? undefined : createYAxisLabel(defaultYAxisLabel)}
                tickFormatter={(value) => {
                  if (typeof value !== "number") return value;
                  if (chartType === "stacked-100" || chartType === "area-100") {
                    return `${value.toFixed(0)}%`;
                  }
                  return axisTickFormatter(value);
                }}
              />
              {(() => {
                // 이중축: 좌/우측 0 위치가 다르므로 기준선 표시 안 함
                if (isDualAxisLike) {
                  if (showDualAxisReferenceLine) {
                    return ([
                      <ReferenceLine
                        key='left'
                        y={0}
                        stroke={resolvedDualAxisReferenceLineStyle.stroke}
                        strokeDasharray={resolvedDualAxisReferenceLineStyle.strokeDasharray}
                        strokeWidth={resolvedDualAxisReferenceLineStyle.strokeWidth}
                        opacity={resolvedDualAxisReferenceLineStyle.opacity}
                        yAxisId={'left'}
                      />,
                      <ReferenceLine
                        key='right'
                        y={0}
                        stroke={resolvedDualAxisReferenceLineStyle.stroke}
                        strokeDasharray={resolvedDualAxisReferenceLineStyle.strokeDasharray}
                        strokeWidth={resolvedDualAxisReferenceLineStyle.strokeWidth}
                        opacity={resolvedDualAxisReferenceLineStyle.opacity}
                        yAxisId={'right'}
                      />
                    ])
                  } else return null
                }

                if (!zeroLineStyleForNormalChart.useSolid) {
                  // 점선
                  return (
                    <ReferenceLine
                      y={0}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                      opacity={0.5}
                      yAxisId={isDualAxisLike ? 'left' : 'default'}
                    />
                  );
                }

                if (zeroLineStyleForNormalChart.useAxisStyle) {
                  // 축선 스타일 실선
                  return (
                    <ReferenceLine
                      y={0}
                      stroke={getAxisLineColor()}
                      strokeWidth={1.5}
                      yAxisId={isDualAxisLike ? 'left' : 'default'}
                    />
                  );
                }

                // 현재 스타일 실선
                return (
                  <ReferenceLine
                    y={0}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    opacity={0.5}
                    yAxisId={isDualAxisLike ? 'left' : 'default'}
                  />
                );
              })()}
              <Tooltip
                cursor={
                  shouldUseShade ? false : {
                    stroke: themeColors?.textColor || "hsl(var(--foreground))",
                    strokeOpacity: 0.15,
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                  }
                }
                content={(props) => (
                  shouldRenderTooltipContent ? <ChartCoreLineTooltipContent {...props} seriesLabelMap={seriesLabelMap} /> : null
                )}
              />
              <Legend
                wrapperStyle={{ display: "none" }}
              />
              {renderSeries()}
              {showOutliers && outlierData && outlierData.length > 0 && (() => {
                // 현재 차트 데이터에 있는 date_display 값들만 유효
                const validDateDisplays = new Set(data.map(d => d[xField]));
                const validOutlierData = outlierData
                  .filter(o => o.x && validDateDisplays.has(o.x))
                  .map(o => ({
                    [xField]: o.x,
                    outlierValue: o.y,
                  }));

                if (validOutlierData.length === 0) return null;

                return (
                  <Scatter
                    name="이상치"
                    data={validOutlierData}
                    dataKey="outlierValue"
                    fill="#ef4444"
                    shape="circle"
                    yAxisId={isDualAxisLike ? 'right' : 'default'}
                  />
                );
              })()}
            </ComposedChart>
          </ResponsiveContainer>
          {/* Brush in separate container (like RechartsSplitWrapper) */}
          {showBrush && data.length > 0 && (() => {
            const brushColors = getBrushColors();

            return (
              <div style={{ position: 'relative', height: BRUSH_HEIGHT, marginTop: BRUSH_MARGIN_TOP, marginLeft: isDualAxisLike ? 50 : 60, marginRight: isDualAxisLike ? 60 : 30 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <XAxis dataKey={xField} hide />
                    <Brush
                      dataKey={xField}
                      height={BRUSH_HEIGHT}
                      startIndex={brushStartIndex}
                      endIndex={brushEndIndex}
                      travellerWidth={4}
                      traveller={<CustomBrushTraveller />}
                      stroke={brushColors.stroke}
                      fill={brushColors.fill}
                      onChange={(range: { startIndex?: number; endIndex?: number }) => {
                        if (range.startIndex !== undefined && range.endIndex !== undefined) {
                          setBrushStartIndex(range.startIndex);
                          setBrushEndIndex(range.endIndex);
                          setIsBrushDragging(true);
                        }
                      }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            );
          })()}
          {/* 막대 차트 호버 음영 (시리즈 2개 이상) - 차트 영역만 커버, 브러시 제외 */}
          {shouldUseShade && hoveredCategoryBounds && (() => {
            const X_AXIS_HEIGHT = 30;  // XAxis height
            const CHART_MARGIN_TOP = 10;
            // 차트 데이터 영역만 커버 (X축, 브러시 제외)
            const shadeHeight = effectiveHeight - CHART_MARGIN_TOP - X_AXIS_HEIGHT;

            return (
              <svg
                style={{
                  position: 'absolute',
                  left: hoveredCategoryBounds.startX,
                  top: CHART_MARGIN_TOP,
                  height: shadeHeight,
                  width: hoveredCategoryBounds.width,
                  pointerEvents: 'none',
                  zIndex: 100,
                }}
              >
                <rect
                  x="0"
                  y="0"
                  width={hoveredCategoryBounds.width}
                  height={shadeHeight}
                  fill={chartType === 'stacked-100' ? "rgba(255, 255, 255, 0.25)" : "rgba(128, 128, 128, 0.05)"}
                />
              </svg>
            );
          })()}
        </>
      )}
    </div>
  );
}
