"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { chartColors } from "@/lib/colors";
import {
  formatFull,
  formatPercent,
  formatPieCalloutValue,
} from "@/packages/chart-lib/utils/number-formatters";

// 2단계 원형 차트 전용 색상 팔레트 (Anthropic 브랜드 스타일)
export const TWO_LEVEL_PIE_COLORS = chartColors

// Mode 1 라벨 표시 가드: 그룹 내 최대 슬라이스 각도가 이 값 미만이면 그룹 전체 라벨 숨김.
// 같은 그룹 내에서 "일부 표시 / 일부 숨김" 불일치를 막기 위한 all-or-none 규칙.
const LABEL_MIN_ANGLE_DEGREES = 3;

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
  seriesLabelMap?: Record<string, string>;  // field(id) → 표시용 레이블 매핑 (없으면 원본 사용)
  // 시리즈 id → 안정된 원본 색 (그룹 할당과 무관). Mode 2/3 외부 슬라이스 및 Mode 2/3 inner 에서 사용.
  seriesColorsById?: Record<string, string>;
  // 그룹명 → 그룹 전용 팔레트 색. Mode 1 외부 슬라이스 및 내부 원(그룹 집계 모드)에서 사용.
  groupHeaderColorsByName?: Record<string, string>;
}

/** 표시용 레이블 해석: map이 있으면 매핑, 없으면 name 그대로 */
const resolveDisplayName = (
  name: string | undefined,
  labelMap?: Record<string, string>
): string => {
  if (!name) return "";
  return labelMap?.[name] ?? name;
};

/**
 * 색상에 alpha 적용 (hsl, hex 모두 지원).
 * Recharts가 <Cell fillOpacity>를 DOM에 반영하지 않아 fill 자체에 투명도를 섞어준다.
 */
function applyAlpha(color: string, alpha: number): string {
  if (alpha >= 1) return color;
  // hsl(h s% l%) — CSS Color Level 4 (공백 구분). 호환성 위해 legacy hsla()로 변환.
  const hslModern = color.match(/^hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)$/);
  if (hslModern) {
    return `hsla(${hslModern[1]}, ${hslModern[2]}%, ${hslModern[3]}%, ${alpha})`;
  }
  // hsl(h, s%, l%) — 레거시 (쉼표 구분)
  const hslLegacy = color.match(/^hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/);
  if (hslLegacy) {
    return `hsla(${hslLegacy[1]}, ${hslLegacy[2]}%, ${hslLegacy[3]}%, ${alpha})`;
  }
  // #RGB or #RRGGBB
  if (color.startsWith("#")) {
    const hex = color.length === 4
      ? color.slice(1).split("").map((c) => c + c).join("")
      : color.slice(1, 7);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return color;
}

/** 외부 링 라벨 연결선/텍스트 기하. 공통 렌더 유틸. */
const renderOuterLabelText = (props: any, labelText: string, startFromInner = false) => {
  const { cx, cy, midAngle, innerRadius, outerRadius } = props;
  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));
  // 리더 라인 시작점:
  //   startFromInner=true (Mode 1): 내부 원 바깥 경계(= 50% radius) 에서 시작. 선이 외부
  //     원을 관통하지만 stroke 가 중립색이라 외부 원 색과 섞이지 않고 뚜렷이 보인다.
  //     props 의 innerRadius 는 외부 원의 안쪽 경계(= 60% radius) 이므로 내부 원의
  //     바깥 경계(50%) 로 환산하기 위해 5/6 배율 적용 (layout 상 50/60 비).
  //   startFromInner=false (Mode 2/3): 외부 원 바깥 경계.
  const anchorRadius = startFromInner
    ? (innerRadius ?? 0) * (5 / 6)
    : (outerRadius ?? 0) + 2;
  const sx = (cx ?? 0) + anchorRadius * cos;
  const sy = (cy ?? 0) + anchorRadius * sin;
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 18) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 18) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 10;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke="hsl(var(--muted-foreground))"
        fill="none"
        strokeWidth={1}
      />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 4}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="central"
        style={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
      >
        {labelText}
      </text>
    </g>
  );
};

/**
 * 기본 라벨 렌더러 (연결선 포함, 호버 시 숨김).
 *
 * - `perSliceMode=true` (Mode 1): 각 외부 조각이 자기 시리즈 라벨 + 개별 비중 표시.
 *   그룹 단위 all-or-none — `shouldShowGroupLabels=true` 일 때만 그룹 전체의 모든
 *   슬라이스가 라벨을 띄우고, false 면 전부 숨김. 개별 percent 임계값은 무시.
 * - `perSliceMode=false` (Mode 2/3): 그룹(시리즈) 단위 첫 조각에만 그룹명 + 그룹 비중 표시.
 *   개별 percent 임계값 (threshold) 적용, 기존 동작 유지.
 */
const renderTwoLevelDefaultLabel = (
  props: any,
  threshold: number,
  isAnyHovered: boolean,
  totalSum: number,
  groupName?: string,
  groupSum?: number,
  labelMap?: Record<string, string>,
  perSliceMode?: boolean,
  shouldShowGroupLabels?: boolean,
) => {
  if (isAnyHovered) return null;

  const { value, payload, index } = props;

  if (perSliceMode) {
    if (!shouldShowGroupLabels) return null; // 그룹 all-or-none 가드
    const seriesId = payload?.series;
    if (!seriesId) return null;
    const percent = totalSum > 0 ? (value ?? 0) / totalSum : 0;
    // percent 임계값은 스킵 — 그룹 가드 통과 시 전부 표시.
    const text = `${resolveDisplayName(seriesId, labelMap)} (${formatPercent(percent, { decimals: 1 })})`;
    // Mode 1: 리더 시작점을 내부 원 경계(= 외부 원 innerRadius) 로.
    return renderOuterLabelText(props, text, true);
  }

  // 그룹 모드 (Mode 2/3): 첫 번째 조각에만 그룹 레이블.
  if (groupName !== undefined && groupSum !== undefined) {
    if (index !== 0) return null;
    const groupPercent = totalSum > 0 ? groupSum / totalSum : 0;
    if (groupPercent < threshold) return null;
    const text = `${resolveDisplayName(groupName, labelMap)} (${formatPercent(groupPercent, { decimals: 1 })})`;
    return renderOuterLabelText(props, text);
  }

  // 비그룹 fallback (호출 경로는 없지만 안전망).
  const percent = totalSum > 0 ? (value ?? 0) / totalSum : 0;
  if (percent < threshold) return null;
  const text = `${resolveDisplayName(payload?.name, labelMap)} (${formatPercent(percent, { decimals: 1 })})`;
  return renderOuterLabelText(props, text);
};

/**
 * 호버 시 활성 섹터 렌더러.
 *
 * 기본적으로 Recharts 가 조각 하나 단위로 호출하지만, 이 차트는 그룹 단위로 하나의
 * `<Pie>` 를 렌더하므로 (Mode 1 = 한 그룹, Mode 2/3 = 한 시리즈) activeShape 에
 * 그룹 전체의 `groupStartAngle..groupEndAngle` 을 넘기면 같은 그룹의 인접 조각들이
 * 하나의 섹터로 시각 병합된다. 내부 경계선이 사라져 그룹 단위 하이라이트가 된다.
 *
 * `groupStartAngle` / `groupEndAngle` 가 주어지지 않으면 per-slice fallback.
 */
const renderTwoLevelActiveShape = (
  props: any,
  totalSum: number,
  labelMap?: Record<string, string>,
  groupKeyField: "name" | "series" = "series",
  groupSums?: Map<string, number>,
  groupStartAngle?: number,
  groupEndAngle?: number,
) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    fill,
    payload,
    value,
  } = props;

  // 그룹 범위가 주어지면 그걸 사용, 아니면 props 의 per-slice 범위 fallback.
  const startAngle = groupStartAngle ?? props.startAngle;
  const endAngle = groupEndAngle ?? props.endAngle;
  const midAngle = (startAngle + endAngle) / 2;

  // 콜아웃 헤더: "그룹명 / 슬라이스명" — 그룹 컨텍스트 + 호버된 개별 조각의 정체.
  //   Mode 1 (groupKeyField="name"): 그룹 = payload.name, 슬라이스 = payload.series.
  //   Mode 2/3 (groupKeyField="series"): 그룹 = payload.series, 슬라이스 = payload.name.
  const groupRawKey = payload?.[groupKeyField];
  const sliceRawKey = groupKeyField === "name" ? payload?.series : payload?.name;
  const groupDisplay = resolveDisplayName(groupRawKey, labelMap);
  const sliceDisplay = resolveDisplayName(sliceRawKey, labelMap);
  const headerParts = [groupDisplay, sliceDisplay].filter(Boolean);
  const headerFull = headerParts.join(" / ");
  const headerTruncated = headerFull.length > 18 ? `${headerFull.slice(0, 18)}...` : headerFull;

  // 값/비율: 호버된 개별 슬라이스 기준 (그룹 합계 아님).
  const displayValue = value ?? 0;
  const percent = totalSum > 0 ? displayValue / totalSum : 0;
  // groupSums 는 현재 UI 에선 쓰이지 않지만 시그니처 호환을 위해 파라미터 유지 (미사용 경고 방지).
  void groupSums;

  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 4) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 4) * sin;
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 22) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 22) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 10;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      {/* 그룹 전체 섹터 — 인접 조각들의 내부 경계선을 덮어 한 덩어리로 보이게 함.
          색상 통일(Mode 1 그룹 팔레트 / Mode 2/3 시리즈 팔레트) 덕분에 fill 이 형제와
          같아 overlap 시 이음매가 안 보임. 외곽 stroke 으로 그룹 경계 강조. */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
      {/* 외부 링 강조 — 그룹 전체 범위. */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={(outerRadius ?? 0) + 4}
        outerRadius={(outerRadius ?? 0) + 10}
        fill={fill}
      />
      {/* 연결선 — 그룹 midAngle 기준. */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 8}
        y={ey}
        textAnchor={textAnchor}
        style={{ fill: "hsl(var(--foreground))", fontSize: 11 }}
      >
        <title>{`${headerFull}: ${formatFull(displayValue)}`}</title>
        {headerTruncated}: {formatPieCalloutValue(displayValue)}
      </text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 8}
        y={ey}
        dy={14}
        textAnchor={textAnchor}
        style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
      >
        {`(${formatPercent(percent ?? 0, { decimals: 1 })})`}
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
  seriesLabelMap,
  seriesColorsById,
  groupHeaderColorsByName,
}: RechartsTwoLevelPieWrapperProps) {
  const [selectedTimepointOverride, setSelectedTimepointOverride] = useState<string | null>(null);
  const timepointList = useMemo(() => timepointData ?? [], [timepointData]);
  // 외부 링 호버 인덱스 (series별로 관리)
  const [activeOuterKey, setActiveOuterKey] = useState<string | null>(null);
  const [activeOuterIndex, setActiveOuterIndex] = useState<number | undefined>(undefined);
  // 외부 링 호버 시 강조할 그룹 키 (outer.name 중복 여부로 결정되는 group key)
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);

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

  // outer.name이 중복되면 Mode 1 (사용자 그룹), 아니면 series가 그룹 역할 (Mode 2/3)
  const groupKeyField: "name" | "series" = useMemo(() => {
    const names = filteredOuterData.map((d) => d.name);
    return names.length > new Set(names).size ? "name" : "series";
  }, [filteredOuterData]);

  const getGroupKey = useCallback(
    (item: TwoLevelPieOuterDataItem): string => item[groupKeyField],
    [groupKeyField]
  );

  // inner series name → group key 매핑 (inner Cell opacity 제어용)
  const seriesToGroupKey = useMemo(() => {
    const map = new Map<string, string>();
    filteredOuterData.forEach((item) => {
      map.set(item.series, getGroupKey(item));
    });
    return map;
  }, [filteredOuterData, getGroupKey]);

  // Cell opacity 계산 (호버된 그룹만 선명, 나머지는 흐리게)
  const getOuterOpacity = useCallback(
    (entry: TwoLevelPieOuterDataItem): number => {
      if (activeGroupKey === null) return 1;
      return getGroupKey(entry) === activeGroupKey ? 1 : 0.3;
    },
    [activeGroupKey, getGroupKey]
  );

  const getInnerOpacity = useCallback(
    (entry: TwoLevelPieInnerDataItem): number => {
      if (activeGroupKey === null) return 1;
      if (isGroupInnerMode) {
        return entry.name === activeGroupKey ? 1 : 0.3;
      }
      return seriesToGroupKey.get(entry.name) === activeGroupKey ? 1 : 0.3;
    },
    [activeGroupKey, isGroupInnerMode, seriesToGroupKey]
  );

  // inner.name은 양쪽 Mode에서 그룹 키와 동일:
  //   Mode 1 (isGroupInnerMode=true, groupKeyField="name"): inner.name === outer.name
  //   Mode 2/3 (isGroupInnerMode=false, groupKeyField="series"): inner.name === outer.series
  // 따라서 그룹 식별자는 innerName 그 자체.
  const getOuterGroupNameForInner = useCallback(
    (innerName: string): string | undefined => innerName,
    []
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

  // 그룹명 → 그룹 전용 팔레트 색 해석. prop 이 없으면 fallback (기존 wrapper colors 팔레트) 에서 조회.
  const resolveGroupColor = useCallback(
    (groupName: string): string => {
      const mapped = groupHeaderColorsByName?.[groupName];
      if (mapped) return mapped;
      const groupedIndex = groupedOuterNames.indexOf(groupName);
      if (groupedIndex >= 0) return colors[groupedIndex % colors.length];
      return colors[0];
    },
    [groupHeaderColorsByName, groupedOuterNames, colors]
  );

  // 시리즈 id → 안정된 원본 색 해석. prop 이 없으면 wrapper 로컬 팔레트 fallback.
  const resolveSeriesColor = useCallback(
    (seriesId: string): string => {
      const mapped = seriesColorsById?.[seriesId];
      if (mapped) return mapped;
      return getColorForSeries(seriesId);
    },
    [seriesColorsById, getColorForSeries]
  );

  const getInnerFillColor = useCallback(
    (innerName: string): string => {
      // Mode 1 (isGroupInnerMode=true): inner 조각은 그룹 집계. 그룹 팔레트 색으로 통일.
      if (isGroupInnerMode) {
        return resolveGroupColor(innerName);
      }
      // Mode 2/3: inner.name 은 시리즈 id. 원본 시리즈 색 그대로.
      return resolveSeriesColor(innerName);
    },
    [isGroupInnerMode, resolveGroupColor, resolveSeriesColor]
  );

  const getOuterFillColor = useCallback(
    (entry: TwoLevelPieOuterDataItem): string => {
      // Mode 1 (사용자 그룹): 외부 조각은 같은 그룹명을 공유 → 그룹 팔레트 색으로 묶음 시각화.
      if (groupKeyField === "name") {
        return resolveGroupColor(entry.name);
      }
      // Mode 2/3: 외부 조각은 시리즈 단위. 원본 시리즈 색 그대로 (명도 차등 없음).
      return resolveSeriesColor(entry.series);
    },
    [groupKeyField, resolveGroupColor, resolveSeriesColor]
  );

  // 그룹 합계는 groupKeyField 기준으로 집계해야 activeShape 의 rawGroupKey 조회와 일치.
  // Mode 1: key=item.name (그룹명 중복 합산), Mode 2/3: key=item.series (시리즈별 합산).
  const groupSums = useMemo(() => {
    const sums = new Map<string, number>();
    filteredOuterData.forEach((item) => {
      const key = item[groupKeyField];
      sums.set(key, (sums.get(key) || 0) + item.value);
    });
    return sums;
  }, [filteredOuterData, groupKeyField]);

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
    setActiveGroupKey(null);
  }, [onTooltipChange]);

  // 전체 외부 데이터 합계 계산 (라벨 표시 조건용)
  const allOuterSum = useMemo(() => {
    return filteredOuterData.reduce((sum, d) => sum + d.value, 0);
  }, [filteredOuterData]);

  const renderInnerCells = useCallback(() => {
    return filteredInnerData.map((entry) => (
      <Cell
        key={`inner-${entry.name}`}
        fill={applyAlpha(getInnerFillColor(entry.name), getInnerOpacity(entry))}
      />
    ));
  }, [filteredInnerData, getInnerFillColor, getInnerOpacity]);

  const renderOuterPies = useCallback(
    (useTimepointLabel: boolean) => {
      return innerAngles.map((seriesAngle) => {
        const seriesOuterData = getOuterDataForInner(seriesAngle.name);
        if (seriesOuterData.length === 0) return null;

        const isThisSeriesActive = activeOuterKey === seriesAngle.name;
        const isAnyHovered = activeOuterIndex !== undefined;
        const groupName = getOuterGroupNameForInner(seriesAngle.name);
        const groupSum = groupName ? groupSums.get(groupName) : undefined;
        // 그룹 내 최대 슬라이스 각도(도) 계산. 하나라도 LABEL_MIN_ANGLE_DEGREES 이상이면
        // 그룹 전체 라벨 표시 (all-or-none). Mode 2/3 에서는 label 함수가 다른 분기를 타서
        // 이 값은 Mode 1 의 perSliceMode 분기에서만 의미.
        const pieTotalValue = seriesOuterData.reduce((sum, d) => sum + d.value, 0);
        const pieSpanDeg = Math.abs(seriesAngle.endAngle - seriesAngle.startAngle);
        const maxSliceAngleDeg = pieTotalValue > 0
          ? seriesOuterData.reduce(
              (maxDeg, d) => Math.max(maxDeg, (d.value / pieTotalValue) * pieSpanDeg),
              0,
            )
          : 0;
        const shouldShowGroupLabels = maxSliceAngleDeg >= LABEL_MIN_ANGLE_DEGREES;

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
            activeShape={(props) => renderTwoLevelActiveShape(
              props,
              allOuterSum,
              seriesLabelMap,
              groupKeyField,
              groupSums,
              seriesAngle.startAngle,
              seriesAngle.endAngle,
            )}
            label={(props) => renderTwoLevelDefaultLabel(
              props,
              0.01,
              isAnyHovered,
              allOuterSum,
              groupName,
              groupSum,
              seriesLabelMap,
              groupKeyField === "name", // Mode 1 → 조각별 시리즈 라벨
              shouldShowGroupLabels,
            )}
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
              if (item) setActiveGroupKey(getGroupKey(item));
            }}
            onMouseLeave={onPieLeave}
          >
            {seriesOuterData.map((entry, idx) => (
              <Cell
                key={`outer-${entry.name}-${idx}`}
                fill={applyAlpha(getOuterFillColor(entry), getOuterOpacity(entry))}
                stroke="none"
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
      groupSums,
      allOuterSum,
      onTooltipChange,
      selectedTimepoint,
      onPieLeave,
      getOuterFillColor,
      getOuterOpacity,
      getGroupKey,
      groupKeyField,
      seriesLabelMap,
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
