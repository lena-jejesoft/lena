"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "../ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronsLeft, ChevronsRight, AlertTriangle, Sun, Moon, X } from "lucide-react";
import { LegendItem } from "./legend-item";
import { ChartSettingsSidebar } from "./chart-settings-sidebar";
import { StackedGroupedSettingsSidebar } from "./stacked-grouped-settings-sidebar";
import { HierarchyGroupPanel } from "./hierarchy-group-panel";
import type { ChartType, ExtendedDataAnalysisResult, LegendValueState, YAxisPlacement, HierarchyGroup } from "../recharts-type";
import { cn } from "@/lib/utils";
import { interpolateColor } from "../recharts-ranking-bar-wrapper";
import type { TimepointTwoLevelPieData } from "../recharts-two-level-pie-wrapper";
import { TruncatedTitle } from "@/packages/chart-lib/components/truncated-title";

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

interface ChartTypeConfig {
  value: ChartType;
  label: string;
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
  chartHeight?: number;  // 차트 높이 (레전드 max-height 결정용)
  title?: string;
  description?: string;
  chartType?: ChartType;
  // 차트 컨트롤 (레전드 패널 상단)
  devMode?: boolean;
  validChartTypes?: ChartTypeConfig[];
  onChartTypeChange?: (type: ChartType) => void;
  showOutliers?: boolean;
  onShowOutliersChange?: (value: boolean) => void;
  supportsOutliers?: boolean;
  // 테마 토글
  theme?: 'light' | 'dark';
  onThemeChange?: (theme: 'light' | 'dark') => void;
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
  // Two-Level Pie 시리즈 마커 전용: series.id → 안정된 원본 색. 그룹 할당과 무관.
  seriesColorsById?: Record<string, string>;
  // Two-Level Pie 그룹 헤더 전용: groupName → 그룹 팔레트 색.
  groupHeaderColorsByName?: Record<string, string>;
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

// 레전드용 랭킹 색상 - Anthropic 브랜드 기반 (Crail)
const RANKING_LEGEND_COLOR_START = "#C15F3C";  // Crail (진한 러스트 오렌지)
const RANKING_LEGEND_COLOR_END = "#F5E0D5";    // 연한 크림 (큰 색상 차이)

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
  collapseThreshold = 6,
  chartHeight = 400,
  title,
  description,
  chartType,
  devMode,
  validChartTypes,
  onChartTypeChange,
  showOutliers,
  onShowOutliersChange,
  supportsOutliers,
  theme,
  onThemeChange,
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
  seriesColorsById,
  groupHeaderColorsByName,
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

  // 지도그리드 데이터 변경 시 페이지 초기화
  useEffect(() => {
    setGeoGridPage(0);
  }, [geoGridData]);

  // 헥스 색상을 HSL로 변환
  const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
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
  };

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
    return chartType === "column" || chartType === "stacked" || chartType === "stacked-100" || chartType === "stacked-grouped"
      ? "column"
      : "line";
  };

  const supportsSeriesTypeSettings = chartType === "line" ||
    chartType === "column" ||
    chartType === "area" ||
    chartType === "area-100" ||
    chartType === "stacked" ||
    chartType === "stacked-100" ||
    chartType === "stacked-area" ||
    chartType === "synced-area" ||
    chartType === "stacked-grouped" ||
    chartType === "dual-axis-stacked-bar" ||
    chartType === "mixed" ||
    chartType === "dual-axis";

  const fallbackYFieldTypeChange = useCallback(
    (field: string, type: "column" | "line" | "none") => {
      const shouldEnable = type !== "none";
      const currentlyEnabled = enabledSeries.has(field);
      if (shouldEnable === currentlyEnabled) return;
      onSeriesToggle(field);
    },
    [enabledSeries, onSeriesToggle]
  );

  const effectiveOnYFieldTypeChange = useMemo(() => {
    if (onYFieldTypeChange) return onYFieldTypeChange;
    if (!supportsSeriesTypeSettings) return undefined;
    return fallbackYFieldTypeChange;
  }, [onYFieldTypeChange, supportsSeriesTypeSettings, fallbackYFieldTypeChange]);

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
    if (directMatch) return { value: directMatch.value ?? null, isOutlier: false };

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

  // 100% 누적막대에서 원본값 조회
  const getOriginalValue = (seriesName: string): number | null => {
    if (!tooltipPayload || chartType !== "stacked-100") return null;

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

  // 표시할 시리즈 (전체 표시)
  const displayedSeries = seriesFields;
  const controlsEnabled = devMode ?? true;
  const hasChartTypeControl = Boolean(onChartTypeChange && validChartTypes && validChartTypes.length > 0);
  const hasOutlierControl = Boolean(onShowOutliersChange);
  const hasThemeControl = Boolean(onThemeChange);

  return (
    <div className="flex flex-nowrap flex-shrink-0">
      <div
        className="flex-shrink-0 flex flex-col border-l bg-card/50 px-4 pt-3 pb-4"
        style={{ width: '260px' }}
      >
      {/* 차트 컨트롤 (차트 유형 + 이상치 토글 + 테마 토글) */}
      {controlsEnabled && (hasChartTypeControl || hasOutlierControl || hasThemeControl) && (
        <>
          <div className="flex items-center gap-2 mb-3">
            {hasChartTypeControl && (
              <Select value={chartType} onValueChange={(value) => onChartTypeChange?.(value as ChartType)}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="차트 타입" />
                </SelectTrigger>
                <SelectContent>
                  {validChartTypes?.map(config => (
                    <SelectItem key={config.value} value={config.value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasOutlierControl && (
              <Button
                variant={showOutliers ? "default" : "outline"}
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => onShowOutliersChange?.(!showOutliers)}
                title="이상치 표시"
                disabled={!supportsOutliers}
              >
                <AlertTriangle className="h-4 w-4" />
              </Button>
            )}
            {hasThemeControl && (
              <button
                type="button"
                className="h-8 w-8 flex-shrink-0 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  console.log('[ThemeToggle] clicked, current:', theme);
                  onThemeChange?.(theme === 'dark' ? 'light' : 'dark');
                }}
                title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            )}
          </div>
          {/* 구분선 */}
          <div className="border-b mb-3" />
        </>
      )}

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

      {/* 동기화 영역 차트 시리즈 선택 */}
      {chartType === 'synced-area' && onSyncedAreaFieldChange && (
        <div className="mb-3 space-y-2">
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
                      <TruncatedTitle className="truncate" text={getSeriesLabel(field)} />
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
                      <TruncatedTitle className="truncate" text={getSeriesLabel(field)} />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 회귀 산점도 시리즈 선택 */}
      {chartType === 'regression-scatter' && onRegressionScatterFieldChange && (
        <div className="mb-3 space-y-2">
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
                      <TruncatedTitle className="truncate" text={getSeriesLabel(field)} />
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
                      <TruncatedTitle className="truncate" text={getSeriesLabel(field)} />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* X축 레이블 영역 + 설정 버튼 */}
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1 px-0 py-0 text-xs font-medium text-muted-foreground flex items-start">
          {chartType === "ranking-bar"
            ? (hoveredLabel ? "선택된 항목" : <span className="italic">차트를 가리켜보세요</span>)
            : chartType === "geo-grid"
            ? ""
            : chartType === "regression-scatter"
            ? (hoveredLabel ? "" : <span className="italic">차트를 가리켜보세요</span>)
            : (hoveredLabel || <span className="italic">차트를 가리켜보세요</span>)
          }
        </div>

        {/* 설정 버튼 - 시리즈 타입 변경 가능한 차트에서 표시 (원형 차트, 트리맵, 멀티레벨 트리맵의 시리즈 타입 제외) */}
        {((effectiveOnYFieldTypeChange && chartType !== 'multi-level-treemap') || ((chartType === 'stacked-grouped' || chartType === 'dual-axis-stacked-bar') && onGroupCountChange) || ((chartType === 'two-level-pie' || chartType === 'multi-level-treemap') && onHierarchyGroupsChange)) && seriesFields.length > 0 && chartType !== 'pie' && chartType !== 'treemap' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-auto w-auto p-0 hover:bg-transparent"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            title={
              chartType === 'two-level-pie' || chartType === 'multi-level-treemap'
                ? "계층 그룹 설정"
                : chartType === 'stacked-grouped' || chartType === 'dual-axis-stacked-bar'
                ? "시리즈/그룹 설정"
                : "시리즈 타입 설정"
            }
          >
            {isSettingsOpen ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <ChevronsLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* 레전드 리스트 (스크롤 가능 - 차트 높이에 맞춤) */}
      <div
        className="flex-1 space-y-1 overflow-y-auto"
        style={{ maxHeight: chartHeight - 60 }}
      >
        {chartType === "ranking-bar" && rankingData ? (
          // 랭킹막대 전용 레전드 - 호버된 항목만 표시
          (() => {
            const hoveredItem = rankingData.find(item => item.name === hoveredLabel);
            const hoveredIndex = rankingData.findIndex(item => item.name === hoveredLabel);

            return (
              <div className="rounded-[10px] bg-gray-100 px-3.5 py-3 min-h-[72px] flex flex-col justify-center">
                {hoveredItem && (
                  <>
                    <div className="text-sm font-semibold text-[#4b433f]">{hoveredItem.name}</div>
                    <div className="w-full h-px bg-[#d9d2cc] my-2"></div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: interpolateColor(RANKING_LEGEND_COLOR_START, RANKING_LEGEND_COLOR_END, hoveredIndex / Math.max(1, rankingData.length - 1)) }}
                      />
                      <span className="text-xs font-medium text-gray-700">{formatValue(hoveredItem.value)}</span>
                    </div>
                    <div className="text-xs text-[#8f8277] mt-1">순위: {hoveredIndex + 1}위</div>
                  </>
                )}
              </div>
            );
          })()
        ) : chartType === "geo-grid" ? (
          // 지도그리드 전용 레전드 - 호버된 지역 표시
          <div className="rounded-[10px] bg-gray-100 px-3.5 py-3 min-h-[72px] flex flex-col justify-center">
            {hoveredLabel && tooltipPayload && tooltipPayload[0] && (
              <>
                <div className="text-sm font-semibold text-gray-700">{hoveredLabel}</div>
                <div className="w-full h-px my-2 bg-gray-300"></div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tooltipPayload[0].color || "#388F76" }} />
                  {hoveredLabel === "한강" ? (
                    <span className="text-xs font-medium text-gray-700">
                      데이터는 없지만 분위기는 있습니다
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-700">
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
          // 회귀 산점도: 호버된 포인트의 X/Y 값 표시
          <div className="rounded-[10px] bg-gray-100 px-3.5 py-3 min-h-[72px] flex flex-col justify-center">
            {tooltipPayload && tooltipPayload.length >= 2 ? (
              <>
                <div className="text-sm font-semibold text-gray-700 mb-2 truncate" title={hoveredLabel || "선택된 포인트"}>
                  {hoveredLabel || "선택된 포인트"}
                </div>
                <div className="w-full h-px bg-gray-300 mb-2"></div>
                <div className="space-y-1.5">
                  {tooltipPayload.map((item, idx) => {
                    const labelText = `${getSeriesLabel(String(item.dataKey ?? ""))}(${idx === 0 ? 'X' : 'Y'}):`;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <TruncatedTitle className="text-xs text-gray-700 truncate min-w-0" text={labelText}>
                          {labelText}
                        </TruncatedTitle>
                        <span className="text-xs font-medium text-gray-700 whitespace-nowrap flex-shrink-0">
                          {formatValue(item.value)}
                        </span>
                      </div>
                    );
                  })}
                  {/* 이상치일 때만 회귀 잔차 표시 */}
                  {tooltipPayload[1]?.isOutlier && tooltipPayload[1]?.residual != null && (
                    <>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-xs text-gray-700 truncate min-w-0" title="상태:">상태:</span>
                        <span className="text-xs font-medium whitespace-nowrap flex-shrink-0">
                          <span className="text-[#ef4444]">이상치</span>
                          <span className="text-gray-700"> (회귀 잔차 {tooltipPayload[1].residual >= 0 ? '+' : ''}{formatValue(tooltipPayload[1].residual)})</span>
                        </span>
                      </div>
                      <div className="text-xs text-gray-700 pt-0.5">
                        기준: |잔차| &gt; 잔차 IQR 범위
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <span className="text-xs text-gray-500 italic">차트를 가리켜보세요</span>
            )}
          </div>
        ) : chartType === 'multi-level-treemap' && treemapStats?.seriesData ? (
          // 멀티레벨 트리맵 레전드
          (() => {
            const { seriesData, isDrilledDown, parentName, parentColor } = treemapStats;

            if (isDrilledDown && parentName) {
              // 드릴다운 상태: 부모 그룹명 + 하위 시리즈 목록
              return (
                <div className="space-y-1">
                  {/* 부모 그룹 헤더 */}
                  <div className="flex items-center gap-1.5 py-0.5 px-1">
                    <span
                      className="w-2 h-2 flex-shrink-0"
                      style={{ backgroundColor: parentColor }}
                    />
                    <span className="text-xs font-medium">{parentName}</span>
                  </div>
                  {/* 하위 시리즈 */}
                  <div className="ml-4 space-y-0.5">
                    {seriesData.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between gap-2 py-0.5 px-1"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: parentColor, opacity: 0.7 }}
                          />
                          <TruncatedTitle className="text-xs text-muted-foreground truncate" text={item.name} />
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {item.value.toLocaleString()} ({item.percentage.toFixed(1)}%)
                        </div>
                      </div>
                    ))}
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
                          className="w-2 h-2 flex-shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                        <TruncatedTitle className="text-xs font-medium truncate" text={group.name} />
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {group.value.toLocaleString()} ({group.percentage.toFixed(1)}%)
                      </div>
                    </div>
                    {/* 하위 시리즈 */}
                    {group.children && group.children.length > 0 && (
                      <div className="ml-4 space-y-0.5">
                        {group.children.map((child) => (
                          <div
                            key={child.name}
                            className={`flex items-center justify-between gap-2 py-0.5 px-1 ${!enabledSeries.has(group.name) ? 'opacity-40' : ''}`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2 h-2 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: group.color, opacity: 0.7 }}
                              />
                              <TruncatedTitle className="text-xs text-muted-foreground truncate" text={getSeriesLabel(child.name)} />
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                              {child.value.toLocaleString()} ({child.percentage.toFixed(1)}%)
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()
        ) : chartType === 'two-level-pie' && hierarchyGroups && hierarchyGroups.length > 0 ? (
          // 2단계 원형 계층 레전드
          (() => {
            // 외부 데이터에서 시리즈 값 조회 함수
            const getOuterSeriesValue = (seriesName: string): number => {
              if (!twoLevelPieOuterData) return 0;
              const item = twoLevelPieOuterData.find(d => d.name === seriesName);
              return item?.value || 0;
            };
            // 전체 합계 (비율 계산용)
            const outerTotal = twoLevelPieOuterData?.reduce((sum, d) => sum + d.value, 0) || 0;

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
                            style={{ backgroundColor: groupHeaderColorsByName?.[group.name] ?? seriesColors[groupIdx % seriesColors.length] }}
                          />
                          <TruncatedTitle className="text-sm font-medium truncate" text={group.name} />
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
                          // 시리즈 마커: id 기반 안정된 원본 색. 그룹 할당과 무관.
                          const seriesColor = seriesColorsById?.[seriesName]
                            ?? seriesColors[seriesFields.indexOf(seriesName) % seriesColors.length];

                          return (
                            <div
                              key={seriesName}
                              className={`flex items-center justify-between gap-2 py-0.5 cursor-pointer hover:bg-accent/50 rounded px-1 ${
                                !enabledSeries.has(seriesName) ? 'opacity-40' : ''
                              }`}
                              onClick={() => onSeriesToggle(seriesName)}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-2 h-2 rounded-sm flex-shrink-0"
                                  style={{ backgroundColor: seriesColor }}
                                />
                                <TruncatedTitle className="text-xs text-muted-foreground truncate" text={getSeriesLabel(seriesName)} />
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
          // 기존 레전드
          displayedSeries.map((field) => (
            <LegendItem
              key={field}
              name={field}
              displayName={getSeriesLabel(field)}
              color={seriesColors[seriesFields.indexOf(field) % seriesColors.length]}
              enabled={enabledSeries.has(field)}
              value={getSeriesValue(field)}
              originalValue={getOriginalValue(field)}
              valueState={getValueState(field)}
              onClick={() => onSeriesToggle(field)}
              chartType={chartType}
              yFieldTypes={yFieldTypes}
              yAxisPlacement={(chartType === 'dual-axis' || chartType === 'dual-axis-stacked-bar') && yAxisPlacements ? yAxisPlacements[field] : undefined}
              totalPieValue={chartType === 'treemap' ? totalTreemapValue : totalPieValue}
            />
          ))
        )}
      </div>

      {/* 시리즈 타입 설정 사이드바 - 모든 차트에서 사용 가능 (two-level-pie, multi-level-treemap 제외) */}
      {effectiveOnYFieldTypeChange && isSettingsOpen && chartType !== 'two-level-pie' && chartType !== 'multi-level-treemap' && (
        <ChartSettingsSidebar
          open={isSettingsOpen}
          seriesFields={seriesFields}
          seriesColors={seriesColors}
          seriesLabelMap={seriesLabelMap}
          getCurrentTypeForField={getCurrentTypeForField}
          onTypeChange={effectiveOnYFieldTypeChange}
          chartType={chartType}
          yAxisPlacements={yAxisPlacements}
          onAxisPlacementChange={onYAxisPlacementChange}
        />
      )}

      {/* 그룹형 누적막대 설정 사이드바 */}
      {(chartType === 'stacked-grouped' || chartType === 'dual-axis-stacked-bar') && onGroupCountChange && onSeriesGroupChange && isSettingsOpen && (
        <StackedGroupedSettingsSidebar
          open={isSettingsOpen}
          seriesFields={seriesFields}
          seriesColors={seriesColors}
          groupCount={groupCount || 2}
          seriesGroupAssignments={seriesGroupAssignments || {}}
          onGroupCountChange={onGroupCountChange}
          onSeriesGroupChange={onSeriesGroupChange}
        />
      )}

      {/* 2단계 파이 / 멀티레벨 트리맵 계층 그룹 설정 사이드바 */}
      {(chartType === 'two-level-pie' || chartType === 'multi-level-treemap') && onHierarchyGroupsChange && isSettingsOpen && (
        <HierarchyGroupPanel
          open={isSettingsOpen}
          seriesFields={allSeriesFieldsForHierarchy || seriesFields}
          seriesColors={seriesColors}
          groups={hierarchyGroups || []}
          onGroupsChange={onHierarchyGroupsChange}
        />
      )}
      </div>
    </div>
  );
}
