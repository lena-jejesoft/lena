"use client";

import { useState, useMemo, useEffect } from "react";
import { Switch } from "@chartCore/src/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@chartCore/src/components/ui/select";
import { X } from "lucide-react";
import { LegendItem } from "./legend-item";
import type { ChartType, ExtendedDataAnalysisResult, LegendValueState, YAxisPlacement, HierarchyGroup } from "@chartCore/src/types/chart-config";
import { cn } from "@chartCore/src/lib/utils";
import { interpolateColor } from "@chartCore/src/components/ui/recharts-ranking-bar-wrapper";
import type { TimepointTwoLevelPieData } from "@chartCore/src/components/ui/recharts-two-level-pie-wrapper";
import { hexToHsl } from "@/lib/colors";

// 레전드용 랭킹 색상 - Anthropic 브랜드 기반 (Crail)
const RANKING_LEGEND_COLOR_START = "#C15F3C";  // Crail (진한 러스트 오렌지)
const RANKING_LEGEND_COLOR_END = "#F5E0D5";    // 연한 크림 (큰 색상 차이)

// 색상 밝기 조절 함수 (그라데이션용)
const adjustColorLightness = (hexColor: string, adjustment: number): string => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

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

  const newL = Math.max(0.2, Math.min(0.9, l + adjustment));
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(newL * 100)}%)`
}

interface TreemapSeriesData {
  name: string;
  value: number;
  percentage: number;
  color: string;
  children?: TreemapSeriesData[];  // 하위 시리즈 데이터
}

interface TreemapStats {
  totalSum: number;
  itemCount: number;
  isDrilledDown: boolean;
  parentName?: string;
  parentColor?: string;
  seriesData?: TreemapSeriesData[];
}

// 지도그리드 데이터 아이템 타입
interface GeoGridDataItem {
  districtId: string;
  districtName: string;
  value: number;
}

interface ChartLegendPanelProps {
  seriesFields: string[];
  seriesColors: string[];
  seriesLabelMap?: Record<string, string>;
  enabledSeries: Set<string>;
  tooltipPayload: any[] | null;
  hoveredLabel: string | null;
  analysisResult: ExtendedDataAnalysisResult | null;
  rankingData?: Array<{ name: string; value: number }> | null;
  pieChartData?: Array<{ name: string; value: number }> | null;  // 파이 차트용 기본 값
  geoGridData?: GeoGridDataItem[] | null;  // 지도그리드 레전드용 데이터
  geoGridMapLevel?: "seoul" | "national";  // 지도그리드 맵 레벨
  geoGridTimepoint?: string | null;  // 지도그리드 선택된 시점
  onSeriesToggle: (field: string) => void;
  onToggleAll: (enable: boolean) => void;
  collapseThreshold?: number;
  title?: string;
  description?: string;
  chartType?: ChartType;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  onYFieldTypeChange?: (field: string, type: "column" | "line" | "none") => void;
  onYAxisPlacementChange?: (field: string, placement: YAxisPlacement) => void;
  // 그룹형 누적막대 관련
  groupCount?: number;
  seriesGroupAssignments?: Record<string, number>;
  onGroupCountChange?: (count: number) => void;
  onSeriesGroupChange?: (field: string, group: number) => void;
  // 동기화 영역 차트 관련
  syncedAreaLeftField?: string;
  syncedAreaRightField?: string;
  onSyncedAreaFieldChange?: (position: 'left' | 'right', field: string) => void;
  // 멀티레벨 트리맵 통계
  treemapStats?: TreemapStats | null;
  // 회귀 산점도 관련
  regressionScatterXField?: string;
  regressionScatterYField?: string;
  onRegressionScatterFieldChange?: (axis: 'x' | 'y', field: string) => void;
  regressionStats?: { r2: number } | null;
  // 2단계 파이 계층 그룹 관련
  hierarchyGroups?: HierarchyGroup[];
  onHierarchyGroupsChange?: (groups: HierarchyGroup[]) => void;
  allSeriesFieldsForHierarchy?: string[];  // 계층 그룹 설정용 원본 시리즈
  twoLevelPieOuterData?: Array<{ name: string; value: number; series: string }>;  // 외부 링 데이터
  twoLevelPieTimepointData?: TimepointTwoLevelPieData[];  // 시점별 2단계 파이 데이터
}

// 값 포맷 함수
function formatValue(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function ChartLegendPanel({
  seriesFields,
  seriesColors,
  seriesLabelMap,
  enabledSeries,
  tooltipPayload,
  hoveredLabel,
  analysisResult,
  rankingData,
  pieChartData,
  geoGridData,
  geoGridMapLevel,
  geoGridTimepoint,
  onSeriesToggle,
  onToggleAll,
  collapseThreshold = 10,
  title,
  description,
  chartType,
  yFieldTypes,
  yAxisPlacements,
  onYFieldTypeChange,
  onYAxisPlacementChange,
  groupCount,
  seriesGroupAssignments,
  onGroupCountChange,
  onSeriesGroupChange,
  syncedAreaLeftField,
  syncedAreaRightField,
  onSyncedAreaFieldChange,
  treemapStats,
  regressionScatterXField,
  regressionScatterYField,
  onRegressionScatterFieldChange,
  regressionStats,
  hierarchyGroups,
  onHierarchyGroupsChange,
  allSeriesFieldsForHierarchy,
  twoLevelPieOuterData,
  twoLevelPieTimepointData,
}: ChartLegendPanelProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);  // 이중축 편집 모드
  const [rankingPage, setRankingPage] = useState(0);
  const [geoGridPage, setGeoGridPage] = useState(0);
  const [legendPage, setLegendPage] = useState(0);
  const getSeriesLabel = (field: string) => seriesLabelMap?.[field] ?? field;

  // 차트 타입 변경 시 사이드바 닫기, 편집 모드 해제, 페이지 초기화
  useEffect(() => {
    setIsSettingsOpen(false);
    setIsEditMode(false);
    setRankingPage(0);
    setGeoGridPage(0);
    setLegendPage(0);
  }, [chartType]);

  // 밝기 조정 (헥스 또는 HSL 지원)
  const adjustColorLightness = (color: string, adjustment: number): string => {
    if (color.startsWith('#')) {
      const { h, s, l } = hexToHsl(color);
      const newL = Math.max(20, Math.min(90, l + adjustment));
      return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(newL)}%)`;
    }
    // HSL 형식인 경우
    const match = color.match(/hsl\((\d+)\s+([\d.]+)%\s+([\d.]+)%\)/);
    if (match) {
      const newL = Math.max(20, Math.min(90, parseFloat(match[3]) + adjustment));
      return `hsl(${match[1]} ${match[2]}% ${newL}%)`;
    }
    return color;
  };

  // 2단계 원형 / 멀티레벨 트리맵 편집 모드에서 그룹 기반 색상 결정
  const getColorForTwoLevelPieEdit = (field: string): string => {
    if ((chartType === 'two-level-pie' || chartType === 'multi-level-treemap') && isEditMode && hierarchyGroups) {
      const groupIdx = hierarchyGroups.findIndex(g => g.series.includes(field));
      if (groupIdx >= 0) {
        return seriesColors[groupIdx % seriesColors.length];
      }
      return "hsl(0 0% 60%)"; // 미할당
    }
    const effectiveFields = allSeriesFieldsForHierarchy || seriesFields;
    return seriesColors[effectiveFields.indexOf(field) % seriesColors.length];
  };

  // 지도그리드 데이터 변경 시 페이지 초기화
  useEffect(() => {
    setGeoGridPage(0);
  }, [geoGridData]);

  // 파이 차트 전체 합계 (활성화된 시리즈만 - 비율 계산용)
  const totalPieValue = useMemo(() => {
    if ((chartType !== "pie" && chartType !== "two-level-pie") || !pieChartData) return 0;
    return pieChartData
      .filter(item => enabledSeries.has(item.name))
      .reduce((sum, item) => sum + item.value, 0);
  }, [chartType, pieChartData, enabledSeries]);

  // 트리맵 전체 합계 (호버 시 비율 계산용)
  const totalTreemapValue = useMemo(() => {
    if (chartType !== "treemap" || !tooltipPayload) return 0;
    return tooltipPayload
      .filter(item => enabledSeries.has(item.dataKey))
      .reduce((sum, item) => sum + (item.value || 0), 0);
  }, [chartType, tooltipPayload, enabledSeries]);

  // 특정 시리즈의 현재 타입 결정
  const getCurrentTypeForField = (field: string): "line" | "column" | "none" => {
    if (!enabledSeries.has(field)) return "none";
    if ((chartType === "mixed" || chartType === "dual-axis" || chartType === "dual-axis-stacked-bar") && yFieldTypes?.[field]) {
      return yFieldTypes[field];
    }
    return chartType === "column" || chartType === "stacked" || chartType === "stacked-100" || chartType === "stacked-grouped" || chartType === "dual-axis-stacked-bar"
      ? "column"
      : "line";
  };

  // 값 조회 (이상치 여부 포함)
  const getSeriesValueWithState = (seriesName: string): { value: number | null; isOutlier: boolean } => {
    if (!tooltipPayload) return { value: null, isOutlier: false };

    // 1. 이상치 키 매칭 먼저 시도 (우선순위)
    const outlierMatch = tooltipPayload.find((p: any) => {
      if (typeof p.dataKey === 'string' && p.dataKey.startsWith('outlier_')) {
        const payload = p.payload;
        const fieldKey = `${p.dataKey}_field`;
        return payload && payload[fieldKey] === seriesName;
      }
      return false;
    });

    if (outlierMatch) return { value: outlierMatch.value ?? null, isOutlier: true };

    // 2. 직접 매칭 시도 (정상 데이터)
    const directMatch = tooltipPayload.find((p: any) => p.dataKey === seriesName);
    if (directMatch) return { value: directMatch.value ?? null, isOutlier: directMatch.isOutlier === true };

    // 3. 분리된 필드 매칭 시도 (_positive, _negative)
    const positiveMatch = tooltipPayload.find((p: any) => p.dataKey === `${seriesName}_positive`);
    const negativeMatch = tooltipPayload.find((p: any) => p.dataKey === `${seriesName}_negative`);

    // 분리된 필드가 있으면 둘 중 null이 아닌 값 반환
    if (positiveMatch && positiveMatch.value != null) {
      return { value: positiveMatch.value, isOutlier: false };
    }
    if (negativeMatch && negativeMatch.value != null) {
      return { value: negativeMatch.value, isOutlier: false };
    }

    return { value: null, isOutlier: false };
  };

  // 값만 조회 (호환성 유지)
  const getSeriesValue = (seriesName: string): number | null => {
    // tooltipPayload가 있으면 먼저 사용 (호버 시점의 값)
    const tooltipValue = getSeriesValueWithState(seriesName).value;
    if (tooltipValue !== null) return tooltipValue;

    // 파이 차트: tooltipPayload에 없으면 pieChartData에서 기본값 사용
    if ((chartType === "pie" || chartType === "two-level-pie") && pieChartData) {
      const pieItem = pieChartData.find(item => item.name === seriesName);
      if (pieItem) return pieItem.value;
    }
    return null;
  };

  // 100% 누적막대/영역에서 원본값 조회
  const getOriginalValue = (seriesName: string): number | null => {
    if (!tooltipPayload || (chartType !== "stacked-100" && chartType !== "area-100")) return null;

    const originalMatch = tooltipPayload.find((p: any) => {
      if (p.payload && typeof p.payload[`${seriesName}_original`] === "number") {
        return true;
      }
      return false;
    });

    if (originalMatch) {
      return originalMatch.payload[`${seriesName}_original`] ?? null;
    }
    return null;
  };

  // 값 상태 결정
  const getValueState = (seriesName: string): LegendValueState => {
    // tooltipPayload가 있으면 먼저 확인
    const { value, isOutlier } = getSeriesValueWithState(seriesName);
    if (value !== null) {
      if (isOutlier) return 'outlier';
      return 'normal';
    }

    // 파이 차트: tooltipPayload에 없으면 pieChartData에서 확인
    if ((chartType === "pie" || chartType === "two-level-pie") && pieChartData) {
      const pieItem = pieChartData.find(item => item.name === seriesName);
      if (pieItem) return 'normal';
    }
    return 'missing';
  };

  // 전체 선택 여부
  const allEnabled = enabledSeries.size === seriesFields.length;

  return (
    <div className="flex">
      <div
        className="flex-shrink-0 flex flex-col border-l bg-card/50 px-4 pt-[22px] pb-4"
        style={{ width: '260px' }}
      >
        {/* 기존 title, description */}
        {title && (
          <h3 className="text-sm font-semibold text-muted-foreground mb-1 mt-2">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        )}

        {/* 동기화 영역 차트: 시점 헤더 + 시리즈 선택 */}
        {chartType === 'synced-area' && onSyncedAreaFieldChange && (
          <div className="mb-3 space-y-3">
            {/* 시점 헤더 */}
            <div className="text-sm font-medium text-muted-foreground pb-2 border-b border-border">
              {hoveredLabel || <span className="text-muted-foreground italic font-normal text-xs">데이터 포인트 선택</span>}
            </div>
            {/* 좌/우 차트 선택 */}
            <div className="space-y-2 pt-1">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">좌측 차트</label>
                <Select value={syncedAreaLeftField || ""} onValueChange={(value) => onSyncedAreaFieldChange('left', value)}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="시리즈 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {seriesFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                          />
                          <span className="truncate">{getSeriesLabel(field)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">우측 차트</label>
                <Select value={syncedAreaRightField || ""} onValueChange={(value) => onSyncedAreaFieldChange('right', value)}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="시리즈 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {seriesFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                          />
                          <span className="truncate">{getSeriesLabel(field)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* 회귀 산점도: 시점 헤더 + 시리즈 선택 */}
        {chartType === 'regression-scatter' && onRegressionScatterFieldChange && (
          <div className="mb-3 space-y-3">
            {/* 시점 헤더 */}
            <div className="text-sm font-medium text-muted-foreground pb-2 border-b border-border">
              {hoveredLabel || <span className="text-muted-foreground italic font-normal text-xs">데이터 포인트 선택</span>}
            </div>
            {/* X/Y 축 선택 */}
            <div className="space-y-2 pt-1">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">X축</label>
                <Select value={regressionScatterXField || ""} onValueChange={(value) => onRegressionScatterFieldChange('x', value)}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="시리즈 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {seriesFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                          />
                          <span className="truncate">{getSeriesLabel(field)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Y축</label>
                <Select value={regressionScatterYField || ""} onValueChange={(value) => onRegressionScatterFieldChange('y', value)}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="시리즈 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {seriesFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: seriesColors[seriesFields.indexOf(field) % seriesColors.length] }}
                          />
                          <span className="truncate">{getSeriesLabel(field)}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* X축 레이블 영역 + 설정 버튼 */}
        <div className={cn(
          "mb-3 flex items-center gap-2",
          (chartType !== "ranking-bar" && chartType !== "geo-grid" && chartType !== "regression-scatter" && chartType !== "synced-area")
            ? "pb-2 border-b border-border"
            : ""
        )}>
          <div className={cn(
            "flex-1 px-0 py-0 flex items-center justify-between",
            (chartType !== "ranking-bar" && chartType !== "geo-grid" && chartType !== "regression-scatter" && chartType !== "synced-area")
              ? "text-sm font-medium text-muted-foreground"
              : "text-xs font-medium text-muted-foreground"
          )}>
            <span>
              {chartType === "ranking-bar"
                ? ""
                : chartType === "geo-grid"
                  ? ""
                  : chartType === "regression-scatter"
                    ? ""
                    : chartType === "synced-area"
                      ? ""
                      : (hoveredLabel || <span className="italic text-muted-foreground font-normal text-xs">데이터 포인트 선택</span>)
              }
            </span>
          </div>

          {/* 이중축/혼합/그룹형누적막대/2단계원형/멀티레벨트리맵 편집 모드 토글 */}
          {((chartType === 'dual-axis' || chartType === 'dual-axis-stacked-bar' || chartType === 'mixed') && onYFieldTypeChange || ((chartType === 'stacked-grouped' || chartType === 'dual-axis-stacked-bar') && onGroupCountChange) || ((chartType === 'two-level-pie' || chartType === 'multi-level-treemap') && onHierarchyGroupsChange)) && seriesFields.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                편집
              </span>
              <Switch
                checked={isEditMode}
                onCheckedChange={setIsEditMode}
                className="h-3.5 w-6 border border-white/25 data-[state=checked]:bg-[#8f8f8f] data-[state=unchecked]:bg-[#8f8f8f66] [&>span]:h-2.5 [&>span]:w-2.5 [&>span]:bg-white [&>span]:data-[state=checked]:translate-x-2.5"
              />
            </div>
          )}

        </div>

        {/* 2단계 원형 / 멀티레벨 트리맵 그룹 관리 영역 (편집 모드일 때만) */}
        {(chartType === 'two-level-pie' || chartType === 'multi-level-treemap') && isEditMode && onHierarchyGroupsChange && (
          <div className="flex items-center gap-1.5 pb-2 mb-2">
            <span className="text-xs text-muted-foreground">그룹:</span>
            <button
              onClick={() => {
                const newGroup = { name: `그룹${(hierarchyGroups || []).length + 1}`, series: [] };
                onHierarchyGroupsChange([...(hierarchyGroups || []), newGroup]);
              }}
              className="text-xs text-muted-foreground hover:text-foreground w-6 h-6 rounded bg-muted/40 hover:bg-muted/60 transition-colors flex items-center justify-center"
              title="그룹 추가"
            >
              +
            </button>
            <div className="flex-1" />
            {(hierarchyGroups || []).map((group, idx) => (
              <div key={idx} className="flex items-center gap-0.5 bg-muted/40 rounded px-1.5 py-0.5 group">
                <input
                  type="text"
                  value={group.name}
                  onChange={(e) => {
                    const newGroups = [...(hierarchyGroups || [])];
                    newGroups[idx] = { ...newGroups[idx], name: e.target.value };
                    onHierarchyGroupsChange(newGroups);
                  }}
                  onFocus={(e) => e.target.select()}
                  className="text-xs bg-transparent border-none outline-none w-12 text-foreground cursor-text focus:ring-1 focus:ring-primary/50 rounded px-0.5"
                  placeholder="그룹명"
                />
                <button
                  onClick={() => {
                    const filtered = (hierarchyGroups || []).filter((_, i) => i !== idx);
                    // 그룹 번호 재정렬 (그룹N 형식인 경우만)
                    let groupNum = 1;
                    const newGroups = filtered.map(g => {
                      if (/^그룹\d+$/.test(g.name)) {
                        return { ...g, name: `그룹${groupNum++}` };
                      }
                      return g;
                    });
                    onHierarchyGroupsChange(newGroups);
                  }}
                  className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  title="그룹 삭제"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 레전드 리스트 */}
        <div className="flex-1 space-y-1">
          {chartType === "ranking-bar" && rankingData ? (
            // 랭킹막대 전용 레전드 - 순위 나열 방식 + 페이지네이션
            (() => {
              const RANKING_PAGE_SIZE = 10;
              const totalPages = Math.ceil(rankingData.length / RANKING_PAGE_SIZE);
              const startIdx = rankingPage * RANKING_PAGE_SIZE;
              const displayedRankingData = rankingData.slice(startIdx, startIdx + RANKING_PAGE_SIZE);

              return (
                <div className="space-y-1">
                  {/* 시점 레이블 */}
                  {hoveredLabel && (
                    <div className="text-sm font-medium text-muted-foreground px-2 pb-2 border-b border-border mb-2">
                      {hoveredLabel}
                    </div>
                  )}
                  {/* 순위 목록 - 고정 높이 */}
                  <div className="min-h-[240px]">
                    {displayedRankingData.map((item, index) => {
                      const actualRank = startIdx + index + 1;
                      const colorFactor = actualRank / Math.max(1, rankingData.length);
                      const markerColor = interpolateColor(RANKING_LEGEND_COLOR_START, RANKING_LEGEND_COLOR_END, colorFactor);
                      return (
                        <div
                          key={item.name}
                          className="flex items-center justify-between gap-2 py-1.5 px-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: markerColor }}
                            />
                            <span className="text-xs text-muted-foreground flex-shrink-0">{actualRank}위</span>
                            <span className="text-xs text-foreground truncate">{item.name}</span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                            {formatValue(item.value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2 border-t border-border mt-2">
                      <button
                        onClick={() => setRankingPage(p => Math.max(0, p - 1))}
                        disabled={rankingPage === 0}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
                      >
                        ←
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {rankingPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setRankingPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={rankingPage === totalPages - 1}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          ) : chartType === "geo-grid" && geoGridData ? (
            // 지도그리드 전용 레전드 - 순위 나열 방식 + 페이지네이션
            (() => {
              const GEO_GRID_PAGE_SIZE = 10;
              // 값 기준 내림차순 정렬
              const sortedData = [...geoGridData].sort((a, b) => b.value - a.value);
              const totalSum = sortedData.reduce((sum, item) => sum + item.value, 0);
              const totalPages = Math.ceil(sortedData.length / GEO_GRID_PAGE_SIZE);
              const startIdx = geoGridPage * GEO_GRID_PAGE_SIZE;
              const displayedData = sortedData.slice(startIdx, startIdx + GEO_GRID_PAGE_SIZE);

              // 지도그리드 색상 함수 (서울: 녹색, 전국: 주황색)
              const minValue = Math.min(...sortedData.map(d => d.value));
              const maxValue = Math.max(...sortedData.map(d => d.value));
              const isSeoul = geoGridMapLevel === "seoul";

              const getColor = (value: number) => {
                if (maxValue === minValue) return isSeoul ? "rgb(93, 99, 82)" : "rgb(193, 95, 60)";
                const t = (value - minValue) / (maxValue - minValue);
                if (isSeoul) {
                  // 카키 그라디언트 (Sage 계열): #E8E5DD → #5D6352
                  const r = Math.round(232 + (93 - 232) * t);
                  const g = Math.round(229 + (99 - 229) * t);
                  const b = Math.round(221 + (82 - 221) * t);
                  return `rgb(${r}, ${g}, ${b})`;
                } else {
                  // Crail 그라디언트: #F5E0D5 → #C15F3C
                  const r = Math.round(245 + (193 - 245) * t);
                  const g = Math.round(224 + (95 - 224) * t);
                  const b = Math.round(213 + (60 - 213) * t);
                  return `rgb(${r}, ${g}, ${b})`;
                }
              };

              return (
                <div className="space-y-1">
                  {/* 시점 레이블 */}
                  {geoGridTimepoint && (
                    <div className="text-sm font-medium text-muted-foreground px-2 pb-2 border-b border-border mb-2">
                      {geoGridTimepoint}
                    </div>
                  )}
                  {/* 순위 목록 - 고정 높이 */}
                  <div className="min-h-[240px]">
                    {displayedData.map((item, index) => {
                      const actualRank = startIdx + index + 1;
                      const markerColor = getColor(item.value);
                      const isHovered = hoveredLabel === item.districtName;
                      const percentage = totalSum > 0 ? (item.value / totalSum) * 100 : 0;
                      return (
                        <div
                          key={item.districtId}
                          className={cn(
                            "flex items-center justify-between gap-2 py-1.5 px-2 rounded",
                            isHovered && "bg-accent"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: markerColor }}
                            />
                            <span className="text-xs text-muted-foreground flex-shrink-0">{actualRank}위</span>
                            <span className="text-xs text-foreground truncate">{item.districtName}</span>
                          </div>
                          <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                            {formatValue(item.value)} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2 border-t border-border mt-2">
                      <button
                        onClick={() => setGeoGridPage(p => Math.max(0, p - 1))}
                        disabled={geoGridPage === 0}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
                      >
                        ←
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {geoGridPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setGeoGridPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={geoGridPage === totalPages - 1}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
                      >
                        →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
          ) : chartType === "geo-grid" ? (
            // 지도그리드 레전드 - 데이터 없을 때 (호버 기반 폴백)
            <div className="rounded-[10px] bg-muted px-3.5 py-3 min-h-[72px] flex flex-col justify-center">
              {hoveredLabel && tooltipPayload && tooltipPayload[0] && (
                <>
                  <div className="text-sm font-semibold text-foreground">{hoveredLabel}</div>
                  <div className="w-full h-px my-2 bg-border"></div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tooltipPayload[0].color || "#388F76" }} />
                    {hoveredLabel === "한강" ? (
                      <span className="text-xs font-medium text-muted-foreground">
                        데이터는 없지만 분위기는 있습니다
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        {formatValue(tooltipPayload[0].value)}
                        {tooltipPayload[0].totalSum && (
                          <span className="ml-1">
                            (전체 합계의 {((tooltipPayload[0].value / tooltipPayload[0].totalSum) * 100).toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : chartType === "regression-scatter" ? (
            // 회귀 산점도: 호버된 포인트의 X/Y 좌표값 표시 (시점은 상단에 표시)
            <div className="space-y-2">
              {tooltipPayload && tooltipPayload.length >= 2 ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{getSeriesLabel(regressionScatterXField || 'X')}:</span>
                    <span className="font-medium text-foreground">{formatValue(tooltipPayload[0].value)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{getSeriesLabel(regressionScatterYField || 'Y')}:</span>
                    <span className="font-medium text-foreground">{formatValue(tooltipPayload[1].value)}</span>
                  </div>
                  {/* 이상치일 때 표시 */}
                  {tooltipPayload[1]?.isOutlier && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
                      <span className="text-[#ef4444] font-medium">이상치</span>
                      <span className="text-muted-foreground">
                        잔차 {tooltipPayload[1].residual >= 0 ? '+' : ''}{formatValue(tooltipPayload[1].residual)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{getSeriesLabel(regressionScatterXField || 'X')}:</span>
                    <span className="text-muted-foreground">-</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{getSeriesLabel(regressionScatterYField || 'Y')}:</span>
                    <span className="text-muted-foreground">-</span>
                  </div>
                </div>
              )}
              {/* R² 값 표시 */}
              {regressionStats && (
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-border">
                  <span className="text-muted-foreground">R² (결정계수):</span>
                  <span className="font-medium text-foreground">{regressionStats.r2.toFixed(3)}</span>
                </div>
              )}
            </div>
          ) : chartType === 'multi-level-treemap' && treemapStats?.seriesData && !isEditMode ? (
            // 멀티레벨 트리맵 레전드 (편집 모드가 아닐 때만)
            (() => {
              const { seriesData, isDrilledDown, parentName, parentColor } = treemapStats;

              if (isDrilledDown && parentName) {
                // 드릴다운 상태: 부모 그룹명 + 하위 시리즈 목록
                return (
                  <div className="space-y-1">
                    {/* 부모 그룹 헤더 */}
                    <div className="flex items-center gap-1.5 py-0.5 px-1">
                      <span
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: parentColor }}
                      />
                      <span className="text-xs font-medium">{parentName}</span>
                    </div>
                    {/* 하위 시리즈 */}
                    <div className="ml-4 space-y-0.5">
                      {[...seriesData]
                        .sort((a, b) => b.value - a.value)  // 값 기준 내림차순 정렬 (큰 값 = 진한 색)
                        .map((item, idx) => {
                          // 그라데이션 색상 계산 (index 0 = 진한 색, index 증가 = 밝은 색)
                          const itemCount = seriesData.length;
                          const lightnessStep = itemCount > 1 ? 30 / (itemCount - 1) : 0;  // 최대 30 밝기 차이 (l은 0~100 범위)
                          const lightnessAdjustment = idx * lightnessStep;
                          const baseColor = parentColor || '#C15F3C';  // 기본 색상 폴백
                          const gradientColor = baseColor.startsWith('#')
                            ? adjustColorLightness(baseColor, lightnessAdjustment)
                            : baseColor;

                          return (
                            <div
                              key={item.name}
                              className="flex items-center justify-between gap-2 py-0.5 px-1"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2 h-2 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: gradientColor }}
                                />
                                <span className="text-xs text-muted-foreground truncate">{item.name}</span>
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                {item.value.toLocaleString()} ({item.percentage.toFixed(1)}%)
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                );
              }

              // 그룹 레벨: 그룹별 + 하위 시리즈 계층 구조 표시
              return (
                <div className="space-y-1">
                  {seriesData.map((group) => (
                    <div key={group.name}>
                      {/* 그룹 헤더 */}
                      <div
                        className={`flex items-center justify-between gap-1.5 py-0.5 cursor-pointer hover:bg-accent/50 rounded px-1 ${!enabledSeries.has(group.name) ? 'opacity-40' : ''}`}
                        onClick={() => onSeriesToggle(group.name)}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: group.color }}
                          />
                          <span className="text-xs font-medium truncate">{group.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {group.value.toLocaleString()} ({group.percentage.toFixed(1)}%)
                        </div>
                      </div>
                      {/* 하위 시리즈 */}
                      {group.children && group.children.length > 0 && (
                        <div className="ml-4 space-y-0.5">
                          {[...group.children]
                            .sort((a, b) => b.value - a.value)  // 값 기준 내림차순 정렬 (큰 값 = 진한 색)
                            .map((child, childIdx) => {
                              // 그라데이션 색상 계산 (index 0 = 진한 색, index 증가 = 밝은 색)
                              const childCount = group.children!.length;
                              const lightnessStep = childCount > 1 ? 0.3 / (childCount - 1) : 0;  // 최대 0.3 밝기 차이
                              const lightnessAdjustment = childIdx * lightnessStep;
                              const baseColor = group.color || '#C15F3C';  // 기본 색상 폴백
                              const gradientColor = baseColor.startsWith('#')
                                ? adjustColorLightness(baseColor, lightnessAdjustment)
                                : baseColor;

                              return (
                                <div
                                  key={child.name}
                                  className={`flex items-center justify-between gap-2 py-0.5 px-1 cursor-pointer hover:bg-accent/50 rounded ${!enabledSeries.has(group.name) || !enabledSeries.has(child.name) ? 'opacity-40' : ''}`}
                                  onClick={() => onSeriesToggle(child.name)}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className="w-2 h-2 rounded-sm flex-shrink-0"
                                      style={{ backgroundColor: gradientColor }}
                                    />
                                    <span className="text-xs text-muted-foreground truncate">{getSeriesLabel(child.name)}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                    {child.value.toLocaleString()} ({child.percentage.toFixed(1)}%)
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()
          ) : chartType === 'two-level-pie' && hierarchyGroups && hierarchyGroups.length > 0 && !isEditMode ? (
            // 2단계 원형 계층 레전드 (편집 모드가 아닐 때만)
            (() => {
              // 시점이 선택되었으면 해당 시점의 데이터 사용, 아니면 전체 합계 사용
              const selectedTimepointData = hoveredLabel && twoLevelPieTimepointData
                ? twoLevelPieTimepointData.find(tp => tp.timepoint === hoveredLabel)
                : null;
              const activeOuterData = selectedTimepointData?.outerData || twoLevelPieOuterData;

              // 외부 데이터에서 시리즈 값 조회 함수 (비활성 시리즈는 0)
              const getOuterSeriesValue = (seriesName: string): number => {
                if (!activeOuterData) return 0;
                if (!enabledSeries.has(seriesName)) return 0;
                const item = activeOuterData.find(d => d.series === seriesName);
                return item?.value || 0;
              };
              // 활성 시리즈만의 합계 (비율 계산용)
              const outerTotal = activeOuterData?.reduce((sum, d) => {
                if (!enabledSeries.has(d.series)) return sum;
                return sum + d.value;
              }, 0) || 0;

              return (
                <div className="space-y-2">
                  {hierarchyGroups.map((group, groupIdx) => {
                    // 그룹 합계 계산
                    const groupTotal = group.series.reduce((sum, s) => sum + getOuterSeriesValue(s), 0);
                    const groupPercentage = outerTotal > 0 ? (groupTotal / outerTotal) * 100 : 0;

                    return (
                      <div key={group.name}>
                        {/* 그룹 헤더 */}
                        <div
                          className="flex items-center justify-between gap-2 py-1 cursor-pointer hover:bg-accent/50 rounded px-1"
                          onClick={() => {
                            // 그룹 전체 토글
                            const allEnabled = group.series.every(s => enabledSeries.has(s));
                            group.series.forEach(s => {
                              if (allEnabled) {
                                onSeriesToggle(s);
                              } else if (!enabledSeries.has(s)) {
                                onSeriesToggle(s);
                              }
                            });
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-sm flex-shrink-0"
                              style={{ backgroundColor: seriesColors[groupIdx % seriesColors.length] }}
                            />
                            <span className="text-sm font-medium truncate">{group.name}</span>
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                            {groupTotal.toLocaleString()} ({groupPercentage.toFixed(1)}%)
                          </div>
                        </div>
                        {/* 하위 시리즈 */}
                        <div className="ml-4 space-y-0.5">
                          {group.series.map((seriesName) => {
                            const seriesValue = getOuterSeriesValue(seriesName);
                            const seriesPercentage = outerTotal > 0 ? (seriesValue / outerTotal) * 100 : 0;
                            // 값 기준 순위 계산 (차트와 동일한 방식)
                            const groupSeriesValues = group.series.map(s => ({
                              name: s,
                              value: getOuterSeriesValue(s)
                            }));
                            const sortedByValue = [...groupSeriesValues].sort((a, b) => b.value - a.value);
                            const rank = sortedByValue.findIndex(d => d.name === seriesName);
                            const baseColor = seriesColors[groupIdx % seriesColors.length];
                            const lightnessStep = group.series.length > 1
                              ? 30 / (group.series.length - 1)
                              : 0;
                            // rank 0은 -15 (내부 원과 동일), rank 증가할수록 밝게
                            const adjustment = -15 + rank * lightnessStep;
                            const seriesColor = adjustColorLightness(baseColor, adjustment);

                            return (
                              <div
                                key={seriesName}
                                className={`flex items-center justify-between gap-2 py-0.5 cursor-pointer hover:bg-accent/50 rounded px-1 ${!enabledSeries.has(seriesName) ? 'opacity-40' : ''
                                  }`}
                                onClick={() => onSeriesToggle(seriesName)}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2 h-2 rounded-sm flex-shrink-0"
                                    style={{ backgroundColor: seriesColor }}
                                  />
                                  <span className="text-xs text-muted-foreground truncate">{getSeriesLabel(seriesName)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                                  {seriesValue.toLocaleString()} ({seriesPercentage.toFixed(1)}%)
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            // 기존 레전드 + 페이지네이션
            (() => {
              // two-level-pie / multi-level-treemap 편집 모드일 때는 원본 시리즈 사용
              const effectiveSeriesFields = ((chartType === 'two-level-pie' || chartType === 'multi-level-treemap') && isEditMode && allSeriesFieldsForHierarchy)
                ? allSeriesFieldsForHierarchy
                : seriesFields;
              const LEGEND_PAGE_SIZE = collapseThreshold;
              const totalPages = Math.ceil(effectiveSeriesFields.length / LEGEND_PAGE_SIZE);
              const startIdx = legendPage * LEGEND_PAGE_SIZE;
              const paginatedSeries = effectiveSeriesFields.slice(startIdx, startIdx + LEGEND_PAGE_SIZE);

              return (
                <>
                  {/* stacked-grouped 편집 모드일 때 컬럼 헤드 */}
                  {(chartType === 'stacked-grouped' || chartType === 'dual-axis-stacked-bar') && isEditMode && (
                    <div className="flex items-center gap-2 pb-1">
                      {/* 마커 + 시리즈명 영역 (빈 공간) */}
                      <div style={{ width: '12px' }} />
                      <div className="flex-1 min-w-0" />
                      {/* 그룹 번호 헤더 */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {[1, 2, 3, 4].map((group) => {
                          // 실제로 해당 그룹에 시리즈가 할당되어 있는지 확인
                          const usedGroups = seriesGroupAssignments ? new Set(Object.values(seriesGroupAssignments).filter(g => g > 0)) : new Set();
                          const isActive = usedGroups.has(group);
                          return (
                            <div
                              key={group}
                              className="w-4 h-4 flex items-center justify-center"
                              style={{ opacity: isActive ? 1 : 0.4 }}
                            >
                              <span className="text-[10px] text-muted-foreground">{group}</span>
                            </div>
                          );
                        })}
                        {/* 숨김 버튼 영역 (빈 공간) */}
                        <div className="w-4 h-4" />
                      </div>
                    </div>
                  )}
                  {paginatedSeries.map((field) => (
                    <LegendItem
                      key={field}
                      name={field}
                      displayName={getSeriesLabel(field)}
                      color={(chartType === 'two-level-pie' || chartType === 'multi-level-treemap') ? getColorForTwoLevelPieEdit(field) : seriesColors[effectiveSeriesFields.indexOf(field) % seriesColors.length]}
                      enabled={enabledSeries.has(field)}
                      value={getSeriesValue(field)}
                      originalValue={getOriginalValue(field)}
                      valueState={getValueState(field)}
                      onClick={() => onSeriesToggle(field)}
                      chartType={chartType}
                      yFieldTypes={yFieldTypes}
                      yAxisPlacement={(chartType === 'dual-axis' || chartType === 'dual-axis-stacked-bar') && yAxisPlacements ? yAxisPlacements[field] : undefined}
                      totalPieValue={chartType === 'treemap' ? totalTreemapValue : totalPieValue}
                      isEditMode={(chartType === 'dual-axis' || chartType === 'dual-axis-stacked-bar' || chartType === 'mixed' || chartType === 'stacked-grouped' || chartType === 'two-level-pie' || chartType === 'multi-level-treemap') ? isEditMode : undefined}
                      onTypeChange={(chartType === 'dual-axis' || chartType === 'dual-axis-stacked-bar' || chartType === 'mixed') ? onYFieldTypeChange : undefined}
                      onAxisPlacementChange={(chartType === 'dual-axis' || chartType === 'dual-axis-stacked-bar') ? onYAxisPlacementChange : undefined}
                      groupCount={(chartType === 'stacked-grouped' || chartType === 'dual-axis-stacked-bar') ? groupCount : undefined}
                      seriesGroupAssignment={(chartType === 'stacked-grouped' || chartType === 'dual-axis-stacked-bar') && seriesGroupAssignments ? seriesGroupAssignments[field] : undefined}
                      onSeriesGroupChange={(chartType === 'stacked-grouped' || chartType === 'dual-axis-stacked-bar') ? onSeriesGroupChange : undefined}
                      usedGroups={(chartType === 'stacked-grouped' || chartType === 'dual-axis-stacked-bar') && seriesGroupAssignments ? new Set(Object.values(seriesGroupAssignments).filter(g => g > 0)) : undefined}
                      hierarchyGroups={(chartType === 'two-level-pie' || chartType === 'multi-level-treemap') ? hierarchyGroups : undefined}
                      onHierarchySeriesChange={(chartType === 'two-level-pie' || chartType === 'multi-level-treemap') && onHierarchyGroupsChange ? (seriesName: string, groupName: string | null) => {
                        const newGroups = (hierarchyGroups || []).map(g => ({
                          ...g,
                          series: g.series.filter(s => s !== seriesName)
                        }));
                        if (groupName) {
                          const targetGroup = newGroups.find(g => g.name === groupName);
                          if (targetGroup) {
                            targetGroup.series.push(seriesName);
                          }
                        }
                        onHierarchyGroupsChange(newGroups);
                      } : undefined}
                    />
                  ))}
                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2 border-t border-border mt-2">
                      <button
                        onClick={() => setLegendPage(p => Math.max(0, p - 1))}
                        disabled={legendPage === 0}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
                      >
                        ←
                      </button>
                      <span className="text-xs text-muted-foreground">
                        {legendPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setLegendPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={legendPage === totalPages - 1}
                        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1"
                      >
                        →
                      </button>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>

      </div>
    </div>
  );
}
