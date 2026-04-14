"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Scatter,
  ReferenceLine,
  LabelList,
} from "recharts";
import type { ChartType, ChartDataItem, OutlierInfo, YAxisPlacement } from "@chartCore/src/types/chart-config";
import type { ChartThemeColors } from "./recharts-wrapper";
import { generateNiceTicks, type DualAxisReferenceLineStyle } from "./recharts-wrapper";
import { CustomYAxisLine } from "./custom-y-axis-line";
import { ChartCoreLineTooltipContent } from "./chart-core-line-tooltip-content";
import { formatDateForXAxis } from "@chartCore/src/tools/chartTool/utils/recharts-adapter";
import { getZeroLineStyle } from "./recharts-utils";

export type RegionType = "upper" | "normal" | "lower";

/**
 * 값의 크기(magnitude)에 따라 동적으로 라운딩
 */
function roundToNice(value: number, isMax: boolean): number {
  if (value === 0) return 0;

  const absValue = Math.abs(value);
  const magnitude = Math.pow(10, Math.floor(Math.log10(absValue)));

  if (isMax) {
    return value >= 0
      ? Math.ceil(value / magnitude) * magnitude
      : Math.floor(value / magnitude) * magnitude;
  } else {
    return value >= 0
      ? Math.floor(value / magnitude) * magnitude
      : Math.floor(value / magnitude) * magnitude;
  }
}

export interface RechartsRegionChartProps {
  data: ChartDataItem[];
  fullData?: ChartDataItem[];  // X축 동기화용 전체 데이터
  xField: string;
  yFields: string[];
  allSeriesFields?: string[];
  chartType: ChartType;
  themeColors?: ChartThemeColors;
  height: number;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  yAxisLabel?: string;
  seriesLabelMap?: Record<string, string>;
  domain?: [number, number];  // 일반 차트용
  leftDomain?: [number, number];  // 추가: 이중축 좌측
  rightDomain?: [number, number];  // 추가: 이중축 우측
  yAxisTicks?: number[];  // 커스텀 Y축 ticks (0 레이블 포함용)
  regionType: RegionType;
  hasBreakTop: boolean;
  hasBreakBottom: boolean;
  showXAxis: boolean;
  outliers?: OutlierInfo[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  hoveredLabel?: string | null;  // Wrapper에서 전달받는 통합 호버 상태
  datetimeUnit?: number;
  chartWidth?: number;
  showTooltip?: boolean;
  showDualAxisReferenceLine?: boolean; // 이중축 일때 y=0선 표시 여부
  dualAxisReferenceLineStyle?: DualAxisReferenceLineStyle; // 이중축 기준선 스타일
}

export function RechartsRegionChart({
  data,
  fullData,
  xField,
  yFields,
  allSeriesFields,
  chartType,
  themeColors,
  height,
  yFieldTypes,
  yAxisPlacements,
  yAxisLabel,
  seriesLabelMap,
  domain,
  leftDomain: leftDomainProp,
  rightDomain: rightDomainProp,
  yAxisTicks,
  regionType,
  hasBreakTop,
  hasBreakBottom,
  showXAxis,
  outliers = [],
  onTooltipChange,
  hoveredLabel,
  datetimeUnit = 1,
  chartWidth = 0,
  showTooltip = true,
  showDualAxisReferenceLine = false,
  dualAxisReferenceLineStyle,
}: RechartsRegionChartProps) {
  // 로컬 호버 상태 추적
  const [localHoveredLabel, setLocalHoveredLabel] = useState<string | null>(null);
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

  // Wrapper 상태와 병합 (Wrapper 우선)
  const effectiveHoveredLabel = hoveredLabel ?? localHoveredLabel;
  const resolvedYAxisLabel = String(yAxisLabel ?? "").trim() || undefined;

  // X축 동기화: fullData가 있으면 전체 데이터 사용
  const baseData = fullData || data;

  // 차트 타입 감지
  const isBarChart = chartType === 'column' || chartType === 'stacked' ||
    (chartType === 'mixed' && yFields.some(f => !yFieldTypes || yFieldTypes[f] === 'column'));

  // 이중축일 때 좌/우측 필드 분리
  const { leftFields, rightFields } = useMemo(() => {
    if (chartType !== 'dual-axis' || !yAxisPlacements) {
      return { leftFields: yFields, rightFields: [] };
    }

    // yAxisPlacements에 없는 필드는 기본값 'left'로 처리
    const left = yFields.filter(f => (yAxisPlacements[f] ?? 'left') === 'left');
    const right = yFields.filter(f => yAxisPlacements[f] === 'right');

    return { leftFields: left, rightFields: right };
  }, [chartType, yFields, yAxisPlacements]);
  const createYAxisLabel = useCallback((value: string | undefined) => {
    if (!value || chartType === "dual-axis") return undefined;
    return {
      value,
      angle: 0,
      position: "insideTopLeft",
      offset: 0,
      style: {
        textAnchor: "start",
        fill: "hsl(var(--muted-foreground))",
        fontSize: 12,
      },
    } as const;
  }, [chartType]);

  // 이중축에서 실제 데이터가 배치된 축만 시각 요소를 노출한다.
  const showLeftAxisVisuals = chartType === 'dual-axis' && leftFields.length > 0;
  const showRightAxisVisuals = chartType === 'dual-axis' && rightFields.length > 0;
  const resolvedDualAxisReferenceLineStyle: DualAxisReferenceLineStyle = {
    stroke: "hsl(var(--muted-foreground))",
    strokeDasharray: "3 3",
    strokeWidth: 1.5,
    opacity: 0.5,
    ...dualAxisReferenceLineStyle,
  };
  const shouldRenderTooltipContent = showTooltip;

  // 이중축일 때 좌측 Y축 domain 계산 (현재 영역의 data 기준)
  const leftDomain = useMemo(() => {
    if (chartType !== 'dual-axis') {
      return undefined;
    }

    // 분할 차트(regionType 존재)에서는 전달받은 leftDomainProp 우선 사용
    if (regionType && leftDomainProp && Array.isArray(leftDomainProp) && leftDomainProp.length === 2) {
      const [min, max] = leftDomainProp;
      if (typeof min === 'number' && typeof max === 'number' && !isNaN(min) && !isNaN(max)) {
        return leftDomainProp;
      }
    }

    // leftFields가 비어있어도 기본 domain 제공 (YAxis가 항상 존재하므로)
    if (leftFields.length === 0) {
      return [0, 1] as [number, number];
    }

    // 일반 이중축 차트: 기존 로직 유지 (data 기반 계산)
    if (data.length === 0) return undefined;

    let min = Infinity, max = -Infinity;
    let hasValue = false;

    for (const row of data) {
      for (const field of leftFields) {
        const value = row[field];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
          hasValue = true;
        }
      }
    }

    if (!hasValue) return undefined;

    // 0을 포함하도록 조정
    min = Math.min(0, min);
    max = Math.max(0, max);

    min = roundToNice(min, false);
    max = roundToNice(max, true);

    return [min, max] as [number, number];
  }, [chartType, leftFields, data, regionType, leftDomainProp]);

  // 이중축일 때 우측 Y축 domain 계산 (현재 영역의 data 기준)
  const rightDomain = useMemo(() => {
    if (chartType !== 'dual-axis') {
      return undefined;
    }

    // rightFields가 비어있어도 기본 domain 제공 (YAxis가 항상 존재하므로)
    if (rightFields.length === 0) {
      return [0, 1] as [number, number];
    }

    // 분할 차트(regionType 존재)에서는 전달받은 rightDomainProp 우선 사용
    if (regionType && rightDomainProp && Array.isArray(rightDomainProp) && rightDomainProp.length === 2) {
      const [min, max] = rightDomainProp;
      if (typeof min === 'number' && typeof max === 'number' && !isNaN(min) && !isNaN(max)) {
        return rightDomainProp;
      }
    }

    // 일반 이중축 차트: 기존 로직 유지 (data 기반 계산)
    if (data.length === 0) return undefined;

    let min = Infinity, max = -Infinity;
    let hasValue = false;

    for (const row of data) {
      for (const field of rightFields) {
        const value = row[field];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
          hasValue = true;
        }
      }
    }

    if (!hasValue) return undefined;

    // 0을 포함하도록 조정
    min = Math.min(0, min);
    max = Math.max(0, max);

    min = roundToNice(min, false);
    max = roundToNice(max, true);

    return [min, max] as [number, number];
  }, [chartType, rightFields, data, regionType, rightDomainProp]);

  // 누적막대에서 양수/음수 혼합 시리즈를 분리하는 함수 (baseData 기반)
  const getMixedSeriesStats = useMemo(() => {
    if (chartType !== "stacked") return { fields: yFields, fieldStats: [] };

    // 각 필드의 양수/음수 여부 확인
    const fieldStats = yFields.map(field => {
      const values = baseData
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

    // 혼합 시리즈가 없으면 원본 필드 반환
    if (!fieldStats.some(s => s.isMixed)) {
      return { fields: yFields, fieldStats };
    }

    // 새로운 필드 목록 생성
    const newFields: string[] = [];
    fieldStats.forEach(({ field, isMixed }) => {
      if (isMixed) {
        newFields.push(`${field}_positive`, `${field}_negative`);
      } else {
        newFields.push(field);
      }
    });

    return { fields: newFields, fieldStats };
  }, [baseData, yFields, chartType]);

  // X축 레이블 필터링 로직
  const LABEL_MIN_WIDTH = 60;
  const xLabels = baseData.map((d) => d[xField] as string);

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

  const visibleTicks = useMemo(() => {
    const ticks: string[] = [];

    xLabels.forEach((label, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === xLabels.length - 1;

      // 막대그래프: 첫/마지막 조건부 표시
      if (isBarChart) {
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
      // datetime_unit 우선 적용
      if (datetimeUnit && datetimeUnit > 1) {
        if (idx % datetimeUnit === 0) {
          ticks.push(label);
        }
        return;
      }

      if (shouldShowAll) {
        ticks.push(label);
        return;
      }

      const step = Math.ceil(xLabels.length / maxLabels);
      if (idx % step === 0) {
        ticks.push(label);
      }
    });

    return ticks;
  }, [xLabels, shouldShowAll, maxLabels, datetimeUnit, isBarChart]);

  // 이상치를 날짜별로 그룹화 (활성화된 시리즈만)
  const outliersByDate = new Map<string, OutlierInfo[]>();
  outliers
    .filter((o) => o.bound === (regionType === 'upper' ? 'upper' : 'lower'))
    .filter((o) => yFields.includes(o.field))
    .forEach((o) => {
      if (!outliersByDate.has(o.dateDisplay)) {
        outliersByDate.set(o.dateDisplay, []);
      }
      // 중복 체크: 같은 날짜, 같은 필드의 이상치가 이미 있으면 추가하지 않음
      const existing = outliersByDate.get(o.dateDisplay)!;
      if (!existing.some(e => e.field === o.field)) {
        existing.push(o);
      }
    });

  // chartData 생성: 영역별로 다른 로직 적용
  const chartData = baseData.map((item) => {
    // 실제 데이터에서 해당 날짜의 값 찾기 (이상치가 null로 마스킹됨)
    const actualDataItem = data.find((d) => d.date_display === item.date_display);

    // 해당 날짜의 이상치들 가져오기
    const dateOutliers = outliersByDate.get(item.date_display) || [];

    let row: any;

    if (regionType === 'upper' || regionType === 'lower') {
      // Upper/Lower 영역: Band scale 동기화를 위해 yFields에 더미값(0) 설정
      // 이렇게 해야 노말 영역의 Bar와 동일한 스케일이 적용됨
      const dummyYFields = yFields.reduce((acc, field) => {
        acc[field] = 0;  // 더미값 (Bar는 투명하게 처리됨)
        return acc;
      }, {} as Record<string, number>);

      // 이상치 데이터
      const outlierFields = dateOutliers.reduce((acc, outlier, idx) => {
        acc[`outlier_${idx}`] = outlier.value;
        acc[`outlier_${idx}_field`] = outlier.field;
        return acc;
      }, {} as Record<string, number | string>);

      row = {
        date: item.date,
        date_display: item.date_display,
        ...dummyYFields,
        ...outlierFields,
      };
    } else {
      // Normal 영역: 실제 data의 값 사용 (이상치가 null로 마스킹됨)
      row = {
        date: item.date,
        date_display: item.date_display,
        ...(actualDataItem || {}),
      };
    }

    // 누적막대에서 혼합 시리즈 분리
    if (chartType === "stacked") {
      getMixedSeriesStats.fieldStats.forEach(({ field, isMixed }) => {
        if (isMixed) {
          const value = row[field];
          if (typeof value === "number") {
            row[`${field}_positive`] = value >= 0 ? value : null;
            row[`${field}_negative`] = value < 0 ? value : null;
          }
        }
      });
    }

    return row;
  });

  const colors = themeColors?.seriesColors || [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
    "hsl(var(--chart-7))",
    "hsl(var(--chart-8))",
  ];
  const buildTooltipPayloadForLabel = useCallback((targetLabel: string | number | undefined) => {
    if (targetLabel == null) return [];
    const normalizedLabel = String(targetLabel);

    const matchedItem = baseData.find((item) => String(item[xField]) === normalizedLabel);
    if (!matchedItem) return [];

    const targetOutlierFields = new Set(
      outliers
        .filter((item) => item.dateDisplay === normalizedLabel)
        .map((item) => item.field)
    );
    const seriesOrder = allSeriesFields || yFields;

    return yFields.map((field) => {
      const rawValue = matchedItem[field];
      const colorIndex = seriesOrder.indexOf(field);
      return {
        dataKey: field,
        name: seriesLabelMap?.[field] ?? field,
        value: typeof rawValue === "number" || typeof rawValue === "string" ? rawValue : null,
        color: resolvedSeriesColors[
          colorIndex >= 0 ? colorIndex % resolvedSeriesColors.length : 0
        ],
        isOutlier: targetOutlierFields.has(field),
        payload: {
          ...matchedItem,
          [`${field}_field`]: field,
        },
      };
    });
  }, [allSeriesFields, baseData, outliers, resolvedSeriesColors, seriesLabelMap, xField, yFields]);

  const renderSeries = (fieldsToRender?: string[]) => {
    // 파라미터로 받은 필드가 있으면 그것을 사용, 아니면 getMixedSeriesStats 사용
    const { fields: renderFields, fieldStats } = fieldsToRender
      ? { fields: fieldsToRender, fieldStats: [] as any[] }
      : getMixedSeriesStats;

    // Bar와 Line 시리즈를 분리하여 Bar가 먼저, Line이 나중에 렌더링되도록 함
    // (recharts에서 나중에 렌더링된 요소가 위에 표시됨)
    const barSeries: React.ReactElement[] = [];
    const lineSeries: React.ReactElement[] = [];

    // 누적막대에서 마지막 Bar 시리즈 인덱스 계산
    const barFields = renderFields.filter((field) => {
      const originalField = field.replace(/_positive$|_negative$/, '');
      if (chartType === "line") return false;
      if (chartType === "mixed" || chartType === "dual-axis") {
        return (yFieldTypes?.[originalField] ?? "column") === "column";
      }
      return true;
    });
    const lastBarFieldIndex = barFields.length - 1;
    let currentBarIndex = 0;

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
      let seriesType: "column" | "line";
      if (chartType === "line") {
        seriesType = "line";
      } else if (chartType === "mixed" || chartType === "dual-axis") {
        // 혼합 차트 or 이중축: yFieldTypes에서 지정한 타입 사용, 기본값은 "column"
        seriesType = yFieldTypes?.[originalField] ?? "column";
      } else {
        // column, stacked 등: 막대
        seriesType = "column";
      }

      // 이중축일 때 yAxisId 지정 (recharts-wrapper 패턴)
      const yAxisId = chartType === 'dual-axis' && yAxisPlacements
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
            dot={(props: any) => {
              const currentValue = props.payload?.[field];
              // 현재 값이 null이면 dot 표시 안 함
              if (currentValue == null) return <g key={`empty-${props.index}`} />;

              const idx = props.index;
              const prevValue = idx > 0 ? chartData[idx - 1]?.[field] : null;
              const nextValue = idx < chartData.length - 1 ? chartData[idx + 1]?.[field] : null;

              // 고립된 값: 전후가 모두 null (라인이 끊긴 곳의 단독 점)
              const isIsolated = prevValue == null && nextValue == null;
              // 첫 번째 값이고 다음이 null인 경우
              const isStartIsolated = idx === 0 && nextValue == null;
              // 마지막 값이고 이전이 null인 경우
              const isEndIsolated = idx === chartData.length - 1 && prevValue == null;

              if (isIsolated || isStartIsolated || isEndIsolated) {
                return (
                  <circle
                    key={props.index}
                    cx={props.cx}
                    cy={props.cy}
                    r={3}
                    fill={color}
                    stroke={color}
                    strokeWidth={0}
                  />
                );
              }

              return <g key={`empty-${props.index}`} />;
            }}
            activeDot={(props: any) => {
              // 값이 null/undefined면 마커를 렌더링하지 않음 (이상치로 마스킹된 경우)
              if (props.payload?.[field] == null) {
                return <></>;
              }

              const isHovered = effectiveHoveredLabel === props.payload?.[xField];
              if (!isHovered) return <></>;

              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={5}
                  fill={color}
                  stroke={color}
                  strokeWidth={0}
                />
              );
            }}
            connectNulls={false}
            name={seriesLabelMap?.[originalField] ?? originalField}
            {...(yAxisId && { yAxisId })}
          />
        );
      } else {
        // 라운딩 처리 로직
        const isLastBar = currentBarIndex === lastBarFieldIndex;
        let barRadius: number | [number, number, number, number];

        if (chartType === "stacked") {
          // 누적 막대: 마지막 시리즈만 위쪽 라운딩
          barRadius = isLastBar ? [2, 2, 0, 0] : 0;
        } else {
          // 일반 막대: 모든 막대 위쪽만 라운딩
          barRadius = [2, 2, 0, 0];
        }

        // 이상치 영역에서는 Bar를 투명하게 (band scale 동기화용)
        const isOutlierRegion = regionType === 'upper' || regionType === 'lower';

        barSeries.push(
          <Bar
            key={field}
            dataKey={field}
            fill={isOutlierRegion ? "transparent" : color}
            radius={barRadius}
            stackId={chartType === "stacked" ? "stack" : undefined}
            name={seriesLabelMap?.[originalField] ?? originalField}
            {...(yAxisId && { yAxisId })}
          />
        );
        currentBarIndex++;
      }
    });

    // Bar 먼저, Line 나중에 렌더링 (Line이 막대 위에 표시됨)
    return [...barSeries, ...lineSeries];
  };

  return (
    <div className="relative" style={{ height, overflow: "visible" }}>
      {/* 커스텀 Y축 선 (zigzag 포함) */}
      {chartType === 'dual-axis' && (regionType !== 'normal' || hasBreakTop || hasBreakBottom) ? (
        <>
          {/* 이중축: 좌측 Y축 물결선 */}
          {showLeftAxisVisuals && (
            <div className="absolute" style={{ left: 56, top: 0, height: height, zIndex: 5, pointerEvents: 'none' }}>
              <CustomYAxisLine
                height={height}
                hasBreakTop={hasBreakTop}
                hasBreakBottom={hasBreakBottom}
              />
            </div>
          )}
          {/* 이중축: 우측 Y축 물결선 */}
          {showRightAxisVisuals && (
            <div className="absolute" style={{ right: 64, top: 0, height: height, zIndex: 5, pointerEvents: 'none' }}>
              <CustomYAxisLine
                height={height}
                hasBreakTop={hasBreakTop}
                hasBreakBottom={hasBreakBottom}
              />
            </div>
          )}
        </>
      ) : chartType !== 'dual-axis' && (hasBreakTop || hasBreakBottom) ? (
        // 기존 물결선 (좌측)
        <div className="absolute" style={{ left: 56, top: 0, height: height }}>
          <CustomYAxisLine
            height={height}
            hasBreakTop={hasBreakTop}
            hasBreakBottom={hasBreakBottom}
          />
        </div>
      ) : null}

      {/* Y축 레이블 (수동) - fullData 기반 전체 범위 사용 */}
      {showLeftAxisVisuals && leftDomain && (
        <svg style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 60,
          height: height,
          pointerEvents: 'none',
          zIndex: 10
        }}>
          {(regionType === 'upper'
            ? [{ value: leftDomain[1], yPos: 15 }]  // Upper: 최대값만 (상단 1개)
            : regionType === 'lower'
              ? [{ value: leftDomain[0], yPos: height - 15 }]  // Lower: 최소값만 (하단 1개)
              : (() => {
                // Normal: generateNiceTicks로 깨끗한 숫자 생성
                const niceTicks = generateNiceTicks(leftDomain[0], leftDomain[1], 5);
                const tickMin = niceTicks[0];
                const tickMax = niceTicks[niceTicks.length - 1];
                const tickRange = tickMax - tickMin;
                return niceTicks.map(value => ({
                  value,
                  yPos: tickRange > 0
                    ? height - 15 - ((value - tickMin) / tickRange) * (height - 30)
                    : height / 2
                }));
              })()
          ).map((item, idx) => {
            let display = String(Math.round(item.value));
            if (Math.abs(item.value) >= 1000000000) {
              const v = item.value / 1000000000;
              const rounded = Math.round(v);
              display = Math.abs(v - rounded) < 0.001 ? `${rounded}B` : `${v.toFixed(1)}B`;
            } else if (Math.abs(item.value) >= 1000000) {
              const v = item.value / 1000000;
              const rounded = Math.round(v);
              display = Math.abs(v - rounded) < 0.001 ? `${rounded}M` : `${v.toFixed(1)}M`;
            } else if (Math.abs(item.value) >= 1000) {
              const v = item.value / 1000;
              const rounded = Math.round(v);
              display = Math.abs(v - rounded) < 0.001 ? `${rounded}K` : `${v.toFixed(1)}K`;
            }

            return (
              <text
                key={idx}
                x={55}
                y={item.yPos}
                dy={4}
                textAnchor="end"
                fill="hsl(var(--muted-foreground))"
                fontSize={11}
              >
                {display}
              </text>
            );
          })}
        </svg>
      )}

      {showRightAxisVisuals && rightDomain && (
        <svg style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 60,
          height: height,
          pointerEvents: 'none',
          zIndex: 10
        }}>
          {(regionType === 'upper'
            ? [{ value: rightDomain[1], yPos: 15 }]  // Upper: 최대값만 (상단 1개)
            : regionType === 'lower'
              ? [{ value: rightDomain[0], yPos: height - 15 }]  // Lower: 최소값만 (하단 1개)
              : (() => {
                // Normal: generateNiceTicks로 깨끗한 숫자 생성
                const niceTicks = generateNiceTicks(rightDomain[0], rightDomain[1], 5);
                const tickMin = niceTicks[0];
                const tickMax = niceTicks[niceTicks.length - 1];
                const tickRange = tickMax - tickMin;
                return niceTicks.map(value => ({
                  value,
                  yPos: tickRange > 0
                    ? height - 15 - ((value - tickMin) / tickRange) * (height - 30)
                    : height / 2
                }));
              })()
          ).map((item, idx) => {
            let display = String(Math.round(item.value));
            if (Math.abs(item.value) >= 1000000000) {
              const v = item.value / 1000000000;
              const rounded = Math.round(v);
              display = Math.abs(v - rounded) < 0.001 ? `${rounded}B` : `${v.toFixed(1)}B`;
            } else if (Math.abs(item.value) >= 1000000) {
              const v = item.value / 1000000;
              const rounded = Math.round(v);
              display = Math.abs(v - rounded) < 0.001 ? `${rounded}M` : `${v.toFixed(1)}M`;
            } else if (Math.abs(item.value) >= 1000) {
              const v = item.value / 1000;
              const rounded = Math.round(v);
              display = Math.abs(v - rounded) < 0.001 ? `${rounded}K` : `${v.toFixed(1)}K`;
            }

            return (
              <text
                key={idx}
                x={5}
                y={item.yPos}
                dy={4}
                textAnchor="start"
                fill="hsl(var(--muted-foreground))"
                fontSize={11}
              >
                {display}
              </text>
            );
          })}
        </svg>
      )}

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{
            top: (hasBreakTop ? 5 : 10) + (resolvedYAxisLabel ? 10 : 0),
            right: chartType === 'dual-axis' ? 60 : 30,
            left: chartType === 'dual-axis' ? 60 : 0,
            bottom: showXAxis ? (chartData.length > 10 ? 100 : 50) : 5,
          }}
          onMouseMove={(state: any) => {
            if (state && state.activePayload && state.activePayload.length > 0) {
              const label = state.activeLabel;
              const payload = state.activePayload;
              setLocalHoveredLabel(label);
              onTooltipChange?.(payload, label);
            }
          }}
          onMouseLeave={() => {
            setLocalHoveredLabel(null);
            onTooltipChange?.(null, null);
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={themeColors?.gridColor || "hsl(var(--muted))"}
            opacity={0.5}
            vertical={false}
          />

          {showXAxis && (
            <XAxis
              dataKey={xField}
              type="category"
              padding={{ left: 0, right: 0 }}
              ticks={visibleTicks}
              minTickGap={5}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "hsl(var(--muted-foreground))" }}
              angle={chartData.length > 10 ? -45 : 0}
              textAnchor={chartData.length > 10 ? "end" : "middle"}
              height={chartData.length > 10 ? 80 : 40}
              tickFormatter={(value) => formatDateForXAxis(value)}
            />
          )}

          {!showXAxis && (
            <XAxis
              dataKey={xField}
              type="category"
              padding={{ left: 0, right: 0 }}
              tick={false}
              axisLine={false}
              tickLine={false}
              height={0}
            />
          )}

          {/* 좌측 Y축 - 항상 렌더링 (recharts-wrapper 패턴) */}
          <YAxis
            yAxisId="left"
            orientation="left"
            width={0}
            domain={chartType === 'dual-axis' ? leftDomain : undefined}
            tick={false}
            tickLine={false}
            axisLine={false}
          />

          {/* 우측 Y축 - 항상 렌더링 (recharts-wrapper 패턴) */}
          <YAxis
            yAxisId="right"
            orientation="right"
            width={0}
            domain={chartType === 'dual-axis' ? rightDomain : undefined}
            tick={false}
            tickLine={false}
            axisLine={false}
          />

          {/* 기본 Y축 - 항상 렌더링 */}
          <YAxis
            yAxisId="default"
            domain={chartType === 'dual-axis' ? undefined : domain}
            ticks={
              chartType !== 'dual-axis' && (regionType === 'upper' || regionType === 'lower') && domain
                ? (regionType === 'upper'
                  ? [domain[1]]             // Upper: 최대값만 (상단 1개)
                  : [domain[0]])            // Lower: 최소값만 (하단 1개)
                : (regionType === 'normal' && domain
                  ? (() => {
                    // Normal 영역: generateNiceTicks로 깨끗한 숫자 틱 생성
                    const niceTicks = generateNiceTicks(domain[0], domain[1], 5);
                    // 0이 도메인 범위 내에 있고, niceTicks에 없으면 추가
                    if (domain[0] <= 0 && domain[1] >= 0 && !niceTicks.includes(0)) {
                      niceTicks.push(0);
                      niceTicks.sort((a, b) => a - b);
                    }
                    return niceTicks;
                  })()
                  : undefined)
            }
            interval={
              chartType !== 'dual-axis' && (regionType === 'upper' || regionType === 'lower')
                ? 0
                : undefined
            }
            allowDataOverflow={false}
            tick={chartType === 'dual-axis' ? false : { fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={createYAxisLabel(resolvedYAxisLabel)}
            tickFormatter={(value) => {
              if (typeof value === "number") {
                if (Math.abs(value) >= 1000000000) {
                  const v = value / 1000000000;
                  const rounded = Math.round(v);
                  return Math.abs(v - rounded) < 0.001 ? `${rounded}B` : `${v.toFixed(1)}B`;
                }
                if (Math.abs(value) >= 1000000) {
                  const v = value / 1000000;
                  const rounded = Math.round(v);
                  return Math.abs(v - rounded) < 0.001 ? `${rounded}M` : `${v.toFixed(1)}M`;
                }
                if (Math.abs(value) >= 1000) {
                  const v = value / 1000;
                  const rounded = Math.round(v);
                  return Math.abs(v - rounded) < 0.001 ? `${rounded}K` : `${v.toFixed(1)}K`;
                }
                // 1000 미만: 정수면 정수로, 소수면 소수점 2자리까지
                if (!Number.isInteger(value)) {
                  return parseFloat(value.toFixed(2)).toString();
                }
                return String(value);
              }
              return value;
            }}
            width={chartType === 'dual-axis' ? 0 : 60}
          />

          {regionType === 'normal' && (() => {
            // 이중축: 좌/우측 0 위치가 다르므로 기준선 표시 안 함
            if (chartType === 'dual-axis') {
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

            // Y축 도메인에 0이 포함되면 Y=0 보조선 표시
            const shouldShowZeroLine = domain && domain[0] <= 0 && domain[1] >= 0;

            if (!shouldShowZeroLine) {
              return null;
            }

            // 보조선 스타일로 표시
            return (
              <ReferenceLine
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                opacity={0.5}
                yAxisId="default"
              />
            );
          })()}

          <Tooltip
            cursor={false}
            content={(props) => (
              shouldRenderTooltipContent ? (
                <ChartCoreLineTooltipContent
                  active={props.active}
                  label={props.label}
                  payload={buildTooltipPayloadForLabel(props.label)}
                  seriesLabelMap={seriesLabelMap}
                />
              ) : null
            )}
          />

          {/* Normal 영역: 모든 시리즈 표시 */}
          {regionType === "normal" && renderSeries()}

          {/* Upper/Lower 영역: band scale 동기화용 투명 Bar 렌더링 (막대 차트일 때만) */}
          {(regionType === "upper" || regionType === "lower") && isBarChart && yFields.length > 0 && (
            <Bar
              dataKey={yFields[0]}
              fill="transparent"
              yAxisId="default"
            />
          )}

          {/* Upper/Lower 영역에서는 빨간 이상치 점 표시 */}
          {(regionType === "upper" || regionType === "lower") && (() => {
            // 최대 이상치 개수 찾기
            const maxOutliers = Math.max(
              0,
              ...chartData.map((d: any) => {
                const outlierKeys = Object.keys(d).filter(k => k.startsWith('outlier_') && !k.endsWith('_field'));
                return outlierKeys.length;
              })
            );

            if (maxOutliers === 0) return null;

            // 이중축일 때 Line 컴포넌트로 이상치 표시 (Scatter 대신 Line 사용하여 X 좌표 정렬)
            if (chartType === 'dual-axis') {
              return Array.from({ length: maxOutliers }, (_, idx) => {
                // 이상치의 필드에 따라 적절한 Y축 사용
                const outlierField = chartData.find((d: any) => d[`outlier_${idx}`] !== undefined)?.[`outlier_${idx}_field`];
                // 모든 시리즈가 우측 축에 있을 때는 이상치 fallback도 우측으로 맞춘다.
                const defaultPlacement = leftFields.length === 0 && rightFields.length > 0 ? 'right' : 'left';
                const fieldPlacement = outlierField
                  ? (yAxisPlacements?.[outlierField] ?? defaultPlacement)
                  : defaultPlacement;
                const yAxisId = fieldPlacement === 'right' ? 'right' : 'left';

                return (
                  <Line
                    key={`outlier-${idx}`}
                    type="monotone"
                    dataKey={`outlier_${idx}`}
                    stroke="transparent"
                    strokeWidth={0}
                    dot={(props: any) => {
                      if (props.payload?.[`outlier_${idx}`] === undefined) return <g key={`empty-${props.index}`} />;
                      const isHovered = effectiveHoveredLabel === props.payload?.[xField];
                      const radius = isHovered ? 4 : 3;

                      // 이중축+막대: cx를 band scale 중앙으로 조정
                      let adjustedCx = props.cx;
                      const xLabelsCount = chartData.length;
                      const dataIndex = props.index;

                      // 유효성 검사: 필수 값이 없으면 원래 cx 사용
                      if (chartWidth > 0 && xLabelsCount > 0 && typeof dataIndex === 'number') {
                        const columnFieldCount = yFieldTypes
                          ? Object.values(yFieldTypes).filter(t => t === 'column').length
                          : 0;
                        const hasBarSeries = columnFieldCount > 0;

                        if (hasBarSeries) {
                          const paddingLeft = 60;  // 이중축 마진
                          // band scale 중앙 위치 계산
                          const ratio = (dataIndex + 0.5) / xLabelsCount;
                          adjustedCx = paddingLeft + (chartWidth * ratio);
                        }
                      }

                      return (
                        <circle
                          key={props.index}
                          cx={adjustedCx}
                          cy={props.cy}
                          r={radius}
                          fill="#ef4444"
                          style={{ cursor: "pointer" }}
                        />
                      );
                    }}
                    activeDot={false}
                    yAxisId={yAxisId}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                );
              });
            }

            // 일반 차트: Line 컴포넌트로 이상치 표시 (band scale 자동 동기화)
            return Array.from({ length: maxOutliers }, (_, idx) => (
              <Line
                key={`outlier-${idx}`}
                type="monotone"
                dataKey={`outlier_${idx}`}
                stroke="transparent"
                strokeWidth={0}
                dot={(props: any) => {
                  if (props.payload?.[`outlier_${idx}`] === undefined) return <g key={`empty-${props.index}`} />;
                  const isHovered = effectiveHoveredLabel === props.payload?.[xField];
                  const radius = isHovered ? 4 : 3;
                  return (
                    <circle
                      key={props.index}
                      cx={props.cx}
                      cy={props.cy}
                      r={radius}
                      fill="#ef4444"
                      style={{ cursor: "pointer" }}
                    />
                  );
                }}
                activeDot={false}
                yAxisId="default"
                isAnimationActive={false}
                connectNulls={false}
              />
            ));
          })()}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
