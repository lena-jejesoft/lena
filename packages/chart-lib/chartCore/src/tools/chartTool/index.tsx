"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@chartCore/src/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@chartCore/src/components/ui/select";
import { Label } from "@chartCore/src/components/ui/label";
import { Button } from "@chartCore/src/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Switch } from "@chartCore/src/components/ui/switch";
import { RechartsWrapper, getThemeColors, expandSeriesColors, getAxisLineColor, LINE_CHART_COLORS, type DualAxisReferenceLineStyle } from "@chartCore/src/components/ui/recharts-wrapper";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { RechartsSplitWrapper } from "@chartCore/src/components/ui/recharts-split-wrapper";
import { RechartsPieWrapper } from "@chartCore/src/components/ui/recharts-pie-wrapper";
import { RechartsTwoLevelPieWrapper, TWO_LEVEL_PIE_COLORS } from "@chartCore/src/components/ui/recharts-two-level-pie-wrapper";
import { RechartsTreemapWrapper } from "@chartCore/src/components/ui/recharts-treemap-wrapper";
import { RechartsMultiLevelTreemapWrapper, MULTI_LEVEL_TREEMAP_COLORS, type TreemapStats } from "@chartCore/src/components/ui/recharts-multilevel-treemap-wrapper";
import { RechartsRankingBarWrapper } from "@chartCore/src/components/ui/recharts-ranking-bar-wrapper";
import { RechartsGeoGridWrapper, MOCK_SEOUL_DATA, MOCK_NATIONAL_DATA, MOCK_TIMEPOINT_GEO_GRID_DATA, SEOUL_DISTRICT_NAMES, KOREA_REGION_NAMES, type MapLevel, type GeoGridDataItem } from "@chartCore/src/components/ui/recharts-geo-grid-wrapper";
import { RechartsRegressionScatterWrapper } from "@chartCore/src/components/ui/recharts-regression-scatter-wrapper";
import { cn } from "@chartCore/src/lib/utils";
import type { ChartType, YAxisPlacement, HierarchyGroup } from "@chartCore/src/types/chart-config";
import type { UnitSettings } from "@chartCore/src/types/chart-unit-settings";
import { ENABLED_CHART_TYPE_CONFIGS } from "@chartCore/src/types/chart-type-config";

// 핵심 차트 타입 (시점 개수에 따라 자동 결정)
type CoreChartType = 'pie' | 'column' | 'line';

function determineChartType(dataPointCount: number): CoreChartType {
  if (dataPointCount <= 1) return 'pie';
  if (dataPointCount <= 4) return 'column';
  return 'line';
}

// 차트 컴포넌트 Props 타입 정의
export interface ChartToolViewProps {
  inputData?: string;
  unitSettings?: UnitSettings;
  isExecuted?: boolean;
  chartType?: ChartType;
  fieldMetaById?: Record<string, { label: string; unit?: string }>;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  enabledSeriesOverride?: string[];
  showOutliers?: boolean;
  showMissingValues?: boolean;
  showTooltip?: boolean;
  onShowOutliersChange?: (value: boolean) => void;
  onShowMissingValuesChange?: (value: boolean) => void;
  hideToolbar?: boolean;  // 외부에서 사용 시 툴바 숨김
  yAxisLabel?: string;    // Y축 라벨
  devMode?: boolean;      // 개발 모드 (차트 타입 선택기 표시)
  showBrush?: boolean;    // Brush 컴포넌트 표시 여부
  skipConstraints?: boolean; // 차트 타입 제한 규칙 스킵 (기본 샘플용)
  multiLevelTreemapColors?: string[];  // 멀티레벨 트리맵 커스텀 색상
  showDualAxisReferenceLine?: boolean; // 이중축 일때 y=0선 표시 여부
  dualAxisReferenceLineStyle?: DualAxisReferenceLineStyle; // 이중축 기준선 스타일
  hideLegendPanel?: boolean; // 우측 레전드 패널 숨김 여부
  externalLegendContainer?: HTMLElement | null; // 외부 레전드 컨테이너(포털)
  seriesColorOverrides?: Record<string, string>; // 시리즈별 색상 부분 오버라이드
  groupColorOverrides?: Record<string, string>; // 그룹별 색상 부분 오버라이드
  onLegendMetaChange?: (meta: ChartCoreLegendMetaPayload | null) => void;
}

interface ChartCoreLegendSeriesPayload {
  id: string;
  label: string;
  color?: string;
}

interface ChartCoreLegendGroupPayload {
  id: string;
  label: string;
  color?: string;
  series: ChartCoreLegendSeriesPayload[];
}

interface ChartCoreLegendMetaPayload {
  chartType: "two-level-pie" | "multi-level-treemap";
  groups: ChartCoreLegendGroupPayload[];
}

import {
  parseInputDataToChartData,
  chartDataToRechartsData,
  extractSeriesFields,
  analyzeDataQualityExtended,
  outliersToScatterData,
  filterOutliersFromData,
  calculateSeriesSums,
  calculateTwoLevelPieData,
  calculateTwoLevelPieDataByTimepoint,
  calculateTreemapData,
  calculateMultiLevelTreemapData,
  calculateMultiLevelTreemapDataByTimepoint,
  calculateTreemapDataByTimepoint,
  calculateRankingBarDataByTimepoint,
  calculatePieDataByTimepoint,
  hasNegativeValues,
  getValidChartTypes,
} from "./utils/recharts-adapter";
import { DataQualityCard } from "./components/data-quality-card";
import { ChartLegendPanel } from "./components/chart-legend-panel";
import { HierarchyGroupPanel } from "./components/hierarchy-group-panel";
import { axisTickFormatter } from "@/packages/chart-lib/utils/number-formatters";
import { GROUP_HEADER_PALETTE } from "@/packages/chart-lib/utils/two-level-pie-colors";

const LEGEND_COLLAPSE_THRESHOLD = 10; // 10개 초과 시 페이지네이션 활성화

function isValidHexColor(value: string | undefined): boolean {
  if (!value) return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

export default function ChartToolView({
  inputData,
  unitSettings,
  isExecuted = true,
  chartType: propChartType,
  fieldMetaById,
  yFieldTypes,
  yAxisPlacements: propYAxisPlacements,
  enabledSeriesOverride,
  showOutliers: propShowOutliers,
  showMissingValues: propShowMissingValues,
  showTooltip = true,
  onShowOutliersChange,
  onShowMissingValuesChange,
  hideToolbar = false,
  yAxisLabel,
  devMode = false,
  showBrush = false,
  skipConstraints = false,
  multiLevelTreemapColors,
  showDualAxisReferenceLine = false,
  dualAxisReferenceLineStyle,
  hideLegendPanel = false,
  externalLegendContainer,
  seriesColorOverrides,
  groupColorOverrides,
  onLegendMetaChange,
}: ChartToolViewProps) {
  const [localChartType, setLocalChartType] = useState<ChartType>("line");
  const [themeColors, setThemeColors] = useState(getThemeColors());
  const [localShowOutliers, setLocalShowOutliers] = useState(true);
  const [localShowMissingValues, setLocalShowMissingValues] = useState(false);

  // 혼합 차트 시리즈 타입 상태
  const [localYFieldTypes, setLocalYFieldTypes] = useState<Record<string, "column" | "line">>({});

  // 이중축 시리즈 배치 상태
  const [localYAxisPlacements, setLocalYAxisPlacements] = useState<Record<string, YAxisPlacement>>({});

  // 그룹형 누적막대 상태
  const [groupCount, setGroupCount] = useState<number>(2);
  const [seriesGroupAssignments, setSeriesGroupAssignments] = useState<Record<string, number>>({});

  // 2단계 파이 계층 그룹 상태
  const [hierarchyGroups, setHierarchyGroups] = useState<HierarchyGroup[]>([]);

  // 동기화 영역 차트 상태 (각 차트에 단일 시리즈)
  const [syncedAreaLeftField, setSyncedAreaLeftField] = useState<string>("");
  const [syncedAreaRightField, setSyncedAreaRightField] = useState<string>("");

  // 레전드 관련 상태
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(new Set());
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [geoGridMetricLabel, setGeoGridMetricLabel] = useState<string>("");
  const [geoGridMapLevel, setGeoGridMapLevel] = useState<MapLevel>("national");
  const [currentGeoGridData, setCurrentGeoGridData] = useState<GeoGridDataItem[] | null>(null);
  const [currentGeoGridTimepoint, setCurrentGeoGridTimepoint] = useState<string | null>(null);
  const [treemapStats, setTreemapStats] = useState<TreemapStats | null>(null);
  const [selectedPieData, setSelectedPieData] = useState<Array<{ name: string; value: number }> | null>(null);
  const [currentRankingData, setCurrentRankingData] = useState<Array<{ name: string; value: number }> | null>(null);

  // 회귀 산점도 상태
  const [regressionScatterXField, setRegressionScatterXField] = useState<string>("");
  const [regressionScatterYField, setRegressionScatterYField] = useState<string>("");
  const [regressionStats, setRegressionStats] = useState<{ r2: number } | null>(null);
  const [regressionOutlierCount, setRegressionOutlierCount] = useState<number>(0);

  // props가 있으면 props 사용, 없으면 로컬 state 사용 (결측치 표시)
  const showMissingValues = propShowMissingValues ?? localShowMissingValues;

  const handleShowOutliersChange = (value: boolean) => {
    if (onShowOutliersChange) {
      onShowOutliersChange(value);
    } else {
      setLocalShowOutliers(value);
    }
  };

  const handleShowMissingValuesChange = (value: boolean) => {
    if (onShowMissingValuesChange) {
      onShowMissingValuesChange(value);
    } else {
      setLocalShowMissingValues(value);
    }
  };

  // props로 받은 chartType이 있으면 사용, 없으면 로컬 state 사용
  const chartType = localChartType;
  const isDualAxisLike = chartType === "dual-axis" || chartType === "dual-axis-stacked-bar";
  const isStackedGroupedLike = chartType === "stacked-grouped" || chartType === "dual-axis-stacked-bar";

  // props로 받은 chartType이 변경되면 로컬 state도 업데이트
  useEffect(() => {
    if (propChartType) {
      // 외부에서 chartType을 제어하는 경우 내부 편집 상태를 동일하게 유지한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalChartType(propChartType as ChartType);
    }
  }, [propChartType]);

  // props로 받은 yFieldTypes가 변경되면 localYFieldTypes도 업데이트
  useEffect(() => {
    if (yFieldTypes && Object.keys(yFieldTypes).length > 0) {
      // 외부 시리즈 타입 지정값을 내부 상태에 동기화해 패널 편집값과 불일치를 방지한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalYFieldTypes(yFieldTypes);
    }
  }, [yFieldTypes]);

  // props로 받은 yAxisPlacements가 변경되면 localYAxisPlacements도 업데이트
  useEffect(() => {
    if (propYAxisPlacements && Object.keys(propYAxisPlacements).length > 0) {
      // 외부 축 배치 지정값을 내부 상태에 동기화해 렌더/패널 기준을 일치시킨다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalYAxisPlacements(propYAxisPlacements);
    }
  }, [propYAxisPlacements]);

  // 테마 변경 감지
  useEffect(() => {
    const updateTheme = () => {
      setThemeColors(getThemeColors());
    };

    // MutationObserver로 dark 클래스 변경 감지
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, []);

  // 차트 데이터/오류를 파생값으로 계산해 렌더 중 setState를 피한다.
  const { chartData, error } = useMemo(() => {
    if (!inputData) {
      return {
        chartData: null,
        error: null as string | null,
      };
    }

    try {
      const parsedData = parseInputDataToChartData(inputData);
      if (!parsedData.length) {
        return {
          chartData: null,
          error: "데이터가 비어 있습니다",
        };
      }

      const nextChartData = localChartType === "ranking-bar"
        ? parsedData
        : chartDataToRechartsData(parsedData, {
          unitSettings: unitSettings,
        });

      return {
        chartData: nextChartData,
        error: null,
      };
    } catch (err) {
      return {
        chartData: null,
        error: err instanceof Error ? err.message : "데이터 파싱 오류",
      };
    }
  }, [inputData, unitSettings, localChartType]);

  // 시점 개수에 따라 차트 타입 자동 결정 (propChartType이 없을 때만)
  useEffect(() => {
    // devMode이면 자동 결정 안함 (사용자가 직접 선택)
    if (devMode) return;
    if (!propChartType && chartData && chartData.length > 0) {
      const autoChartType = determineChartType(chartData.length);
      // 입력 데이터 길이에 따른 기본 차트 타입을 자동 보정한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalChartType(autoChartType);
    }
  }, [chartData, propChartType, devMode]);

  // 시리즈 필드 추출 (가나다순 정렬)
  const seriesFields = useMemo(() => {
    if (!chartData) return [];
    try {
      const fields = extractSeriesFields(chartData);
      return fields.sort((a, b) => a.localeCompare(b, 'ko'));
    } catch {
      return [];
    }
  }, [chartData]);
  const visibleSeriesFields = useMemo(
    () => seriesFields.filter((field) => enabledSeries.has(field)),
    [seriesFields, enabledSeries]
  );
  const seriesLabelMap = useMemo(
    () => Object.fromEntries(seriesFields.map((field) => [field, fieldMetaById?.[field]?.label ?? field])),
    [fieldMetaById, seriesFields]
  );

  const getAxisUnitLabel = useCallback((fields: string[]): string | undefined => {
    if (!fieldMetaById) return undefined;

    const units: string[] = [];
    fields.forEach((field) => {
      const unit = String(fieldMetaById[field]?.unit ?? "").trim();
      if (unit && !units.includes(unit)) {
        units.push(unit);
      }
    });

    return units.length > 0 ? units.join(" / ") : undefined;
  }, [fieldMetaById]);

  const autoYAxisLabels = useMemo<{ default?: string; left?: string; right?: string }>(() => {
    if (isDualAxisLike) {
      const leftFields = visibleSeriesFields.filter(
        (field) => (localYAxisPlacements[field] ?? "left") === "left"
      );
      const rightFields = visibleSeriesFields.filter(
        (field) => (localYAxisPlacements[field] ?? "left") === "right"
      );

      return {
        left: getAxisUnitLabel(leftFields),
        right: getAxisUnitLabel(rightFields),
      };
    }

    return {
      default: getAxisUnitLabel(visibleSeriesFields),
    };
  }, [getAxisUnitLabel, isDualAxisLike, localYAxisPlacements, visibleSeriesFields]);
  const syncedAreaLeftYAxisLabel = yAxisLabel || getAxisUnitLabel(syncedAreaLeftField ? [syncedAreaLeftField] : []);
  const syncedAreaRightYAxisLabel = yAxisLabel || getAxisUnitLabel(syncedAreaRightField ? [syncedAreaRightField] : []);

  // seriesFields 변경 시 이중축 설정 리셋 (다른 데이터로 전환 시)
  useEffect(() => {
    if (!isDualAxisLike) return;
    if (Object.keys(localYAxisPlacements).length === 0) return;

    // 현재 설정된 필드와 새 seriesFields가 다르면 리셋
    const currentFields = Object.keys(localYAxisPlacements);
    const fieldsMatch = currentFields.length === seriesFields.length &&
      currentFields.every(f => seriesFields.includes(f));

    if (!fieldsMatch) {
      // 시리즈 스키마가 바뀐 경우 축 배치/타입을 초기화해 이전 데이터 설정 누수를 막는다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalYAxisPlacements({});
      setLocalYFieldTypes({});
    }
  }, [seriesFields, isDualAxisLike, localYAxisPlacements]);

  // 차트 타입 유효성 검사
  const chartTypeValidations = useMemo(() => {
    // skipConstraints가 true이면 모든 차트 타입 허용 (기본 샘플 비교용)
    if (skipConstraints) return null;
    if (!chartData || !seriesFields.length) return null;
    const dataPointCount = chartData.length;
    const seriesCount = seriesFields.length;
    const hasNegative = hasNegativeValues(chartData, seriesFields);
    // 지역 데이터 감지 (시리즈명에 지역명이 포함되어 있는지)
    const hasGeoData = seriesFields.some(field =>
      SEOUL_DISTRICT_NAMES.includes(field) || KOREA_REGION_NAMES.includes(field)
    );
    return getValidChartTypes(dataPointCount, seriesCount, hasNegative, hasGeoData);
  }, [chartData, seriesFields, skipConstraints]);

  // 2단계 파이 / 멀티레벨 트리맵용 시리즈 필드 (계층 모드면 그룹명/level1만, 아니면 원본)
  const twoLevelPieSeriesFields = useMemo(() => {
    if (chartType !== "two-level-pie" && chartType !== "multi-level-treemap") return seriesFields;

    // 1. 사용자 지정 그룹이 있고, 시리즈가 하나라도 할당되어 있으면 그룹명 반환
    const hasAssignedSeries = hierarchyGroups && hierarchyGroups.length > 0 &&
      hierarchyGroups.some(g => g.series.length > 0);
    if (hasAssignedSeries) {
      return hierarchyGroups.map(g => g.name);
    }

    // 2. "::" 구분자가 있으면 계층 모드 - level1만 추출
    const isHierarchical = seriesFields.some(f => f.includes("::"));
    if (!isHierarchical) return seriesFields;
    // level1 값만 추출하고 중복 제거
    const level1Set = new Set<string>();
    for (const field of seriesFields) {
      const level1 = field.split("::")[0];
      if (level1) level1Set.add(level1);
    }
    return Array.from(level1Set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [chartType, seriesFields, hierarchyGroups]);

  // seriesFields가 변경되면 hierarchyGroups 초기화 (샘플 변경 시)
  useEffect(() => {
    // 시리즈 집합 변경 시 계층 그룹 설정을 비워 새 스키마 기준으로 재구성한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHierarchyGroups([]);
  }, [seriesFields]);

  // seriesFields가 변경되면 groupCount가 시리즈 수를 초과하지 않도록 조정
  useEffect(() => {
    const maxAllowed = Math.min(seriesFields.length, 4);
    if (groupCount > maxAllowed && maxAllowed >= 2) {
      // 현재 시리즈 수 범위를 넘는 그룹 개수는 자동으로 상한에 맞춘다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroupCount(maxAllowed);
    }
  }, [seriesFields.length, groupCount]);

  // seriesFields가 변경되면 enabledSeries 초기화
  // two-level-pie / multi-level-treemap 계층 모드면 level1 값으로 초기화
  useEffect(() => {
    if (enabledSeriesOverride && enabledSeriesOverride.length > 0) {
      // AI가 지정한 시리즈만 활성화
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEnabledSeries(new Set(enabledSeriesOverride));
    } else if ((chartType === "two-level-pie" || chartType === "multi-level-treemap") && hierarchyGroups && hierarchyGroups.length > 0 &&
      hierarchyGroups.some(g => g.series.length > 0)) {
      // 계층 그룹 모드: 그룹명 + 개별 시리즈명 모두 포함 (시리즈가 하나라도 할당된 경우만)
      const allSeries = new Set<string>();
      hierarchyGroups.forEach(g => {
        allSeries.add(g.name);  // 그룹명
        g.series.forEach(s => allSeries.add(s));  // 개별 시리즈명
      });
      setEnabledSeries(allSeries);
    } else {
      // 기본: 모든 시리즈 활성화 (two-level-pie / multi-level-treemap이면 level1 기준)
      const targetFields = (chartType === "two-level-pie" || chartType === "multi-level-treemap") ? twoLevelPieSeriesFields : seriesFields;
      setEnabledSeries(new Set(targetFields));
    }
  }, [seriesFields, twoLevelPieSeriesFields, chartType, enabledSeriesOverride, hierarchyGroups]);

  // AI가 혼합 차트를 생성할 때 yFieldTypes 없으면 절반씩 자동 설정
  useEffect(() => {
    if (chartType === 'mixed' && seriesFields.length > 0 && (!yFieldTypes || Object.keys(yFieldTypes).length === 0) && Object.keys(localYFieldTypes).length === 0) {
      const initialTypes: Record<string, "column" | "line"> = {};
      const halfIndex = Math.ceil(seriesFields.length / 2);
      seriesFields.forEach((field, idx) => {
        initialTypes[field] = idx < halfIndex ? 'line' : 'column';
      });
      // 혼합 차트 기본 시리즈 타입을 최초 1회 자동 배치한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalYFieldTypes(initialTypes);
    }
  }, [chartType, seriesFields, yFieldTypes, localYFieldTypes]);

  // 이중축 차트인데 yAxisPlacements가 비어있으면 자동 초기화
  // 값 크기 기준 그룹핑: 큰 값 → 좌측(막대), 작은 값 → 우측(라인)
  useEffect(() => {
    if (isDualAxisLike && seriesFields.length > 0 && Object.keys(localYAxisPlacements).length === 0 && chartData) {
      const initialPlacements: Record<string, YAxisPlacement> = {};
      const initialTypes: Record<string, "column" | "line"> = {};

      // 각 시리즈의 중앙값(median) 계산 - 이상치에 강건함
      const seriesMedianValues: { field: string; median: number }[] = seriesFields.map(field => {
        const values = chartData
          .map(d => d[field])
          .filter((v): v is number => typeof v === 'number' && !isNaN(v))
          .map(v => Math.abs(v))
          .sort((a, b) => a - b);

        let median = 0;
        if (values.length > 0) {
          const mid = Math.floor(values.length / 2);
          median = values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
        }
        return { field, median };
      });

      // 중앙값 기준 내림차순 정렬
      seriesMedianValues.sort((a, b) => b.median - a.median);

      // 비율 기준 가장 큰 간격 찾기 (시리즈가 2개 이상일 때)
      let splitIndex = Math.ceil(seriesFields.length / 2); // 기본: 절반
      if (seriesMedianValues.length >= 2) {
        let maxRatioGap = 0;
        let maxGapIndex = 0;
        for (let i = 0; i < seriesMedianValues.length - 1; i++) {
          const current = seriesMedianValues[i].median;
          const next = seriesMedianValues[i + 1].median;
          // 비율 기준 간격: (현재 - 다음) / 현재
          const ratioGap = current > 0 ? (current - next) / current : 0;
          if (ratioGap > maxRatioGap) {
            maxRatioGap = ratioGap;
            maxGapIndex = i + 1;
          }
        }
        // 비율 간격이 50% 이상이면 유의미한 분리점으로 판단
        if (maxRatioGap >= 0.5 && maxGapIndex > 0) {
          splitIndex = maxGapIndex;
        }
      }

      // 그룹 분리: 큰 값(좌측/막대), 작은 값(우측/라인)
      const largeValueFields = seriesMedianValues.slice(0, splitIndex).map(s => s.field);

      seriesFields.forEach(field => {
        if (largeValueFields.includes(field)) {
          initialPlacements[field] = 'left';
          initialTypes[field] = 'column';
        } else {
          initialPlacements[field] = 'right';
          initialTypes[field] = chartType === 'dual-axis-stacked-bar' ? 'column' : 'line';
        }
      });

      // 이중축 차트 초기 진입 시 값 스케일 기준으로 축/타입을 자동 초기화한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalYAxisPlacements(initialPlacements);
      if (Object.keys(localYFieldTypes).length === 0) {
        setLocalYFieldTypes(initialTypes);
      }
    }
  }, [isDualAxisLike, chartType, seriesFields, localYAxisPlacements, localYFieldTypes, chartData]);

  // 동기화 영역 차트인데 시리즈 필드가 비어있으면 자동 초기화
  useEffect(() => {
    if (chartType === 'synced-area' && seriesFields.length > 0 && !syncedAreaLeftField && !syncedAreaRightField) {
      if (seriesFields.length >= 2) {
        // 동기화 영역 차트 초기 진입 시 좌/우 시리즈를 기본 순서로 할당한다.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSyncedAreaLeftField(seriesFields[0]);
        setSyncedAreaRightField(seriesFields[1]);
      } else if (seriesFields.length === 1) {
        setSyncedAreaLeftField(seriesFields[0]);
        setSyncedAreaRightField(seriesFields[0]);
      }
    }
  }, [chartType, seriesFields, syncedAreaLeftField, syncedAreaRightField]);

  // 좌/우측 필드 분리 (이중축 차트 전용)
  const { leftFields, rightFields } = useMemo(() => {
    if (!isDualAxisLike || !localYAxisPlacements) {
      return { leftFields: seriesFields, rightFields: [] };
    }
    // localYAxisPlacements에 없는 필드는 기본값 'left'로 처리
    const left = seriesFields.filter(f => (localYAxisPlacements[f] ?? 'left') === 'left');
    const right = seriesFields.filter(f => localYAxisPlacements[f] === 'right');
    return { leftFields: left, rightFields: right };
  }, [isDualAxisLike, seriesFields, localYAxisPlacements]);

  // 이상치/결측치 분석 (확장)
  const analysisResult = useMemo(() => {
    if (!chartData || seriesFields.length === 0) return null;

    // 이중축: 좌/우측 별도 분석
    if (isDualAxisLike && (leftFields.length > 0 || rightFields.length > 0)) {
      const leftAnalysis = leftFields.length > 0
        ? analyzeDataQualityExtended(chartData, leftFields, seriesFields)
        : null;
      const rightAnalysis = rightFields.length > 0
        ? analyzeDataQualityExtended(chartData, rightFields, seriesFields)
        : null;

      return {
        // 통합 outliers/missingValues (레전드 패널용)
        outliers: [
          ...(leftAnalysis?.outliers || []),
          ...(rightAnalysis?.outliers || [])
        ],
        missingValues: [
          ...(leftAnalysis?.missingValues || []),
          ...(rightAnalysis?.missingValues || [])
        ],
        iqrBounds: {
          ...(leftAnalysis?.iqrBounds || {}),
          ...(rightAnalysis?.iqrBounds || {})
        },
        seriesIQR: [
          ...(leftAnalysis?.seriesIQR || []),
          ...(rightAnalysis?.seriesIQR || [])
        ],
        // 좌/우측 classifiedData 별도 저장
        leftClassifiedData: leftAnalysis?.classifiedData || undefined,
        rightClassifiedData: rightAnalysis?.classifiedData || undefined,
        // 기존 필드 유지 (호환성)
        classifiedData: leftAnalysis?.classifiedData || rightAnalysis?.classifiedData || null,
        hasUpperOutliers: (leftAnalysis?.hasUpperOutliers || false) || (rightAnalysis?.hasUpperOutliers || false),
        hasLowerOutliers: (leftAnalysis?.hasLowerOutliers || false) || (rightAnalysis?.hasLowerOutliers || false),
      };
    }

    // 일반 차트: 기존 로직
    return analyzeDataQualityExtended(chartData, seriesFields);
  }, [chartData, seriesFields, isDualAxisLike, leftFields, rightFields]);

  // 선택된 시리즈에 이상치가 있는지 계산해 제어 모드 표시 판단에 사용
  const hasOutliersInEnabledSeries = useMemo(() => {
    if (!analysisResult?.outliers?.length) return false;
    return analysisResult.outliers.some((outlier) => enabledSeries.has(outlier.field));
  }, [analysisResult, enabledSeries]);

  // 제어 모드는 prop 기준, 비제어 모드는 로컬 상태 기준으로 이상치 표시 여부를 계산
  const resolvedShowOutliers = propShowOutliers === undefined
    ? localShowOutliers
    : (propShowOutliers ? hasOutliersInEnabledSeries : false);

  // 선택된 시리즈에 이상치가 있는지에 따라 자동으로 이상치 표시 토글
  useEffect(() => {
    // 제어 모드에서는 외부 prop을 상태 소스로 사용한다.
    if (propShowOutliers !== undefined) return;

    // 이상치가 허용되는 차트 타입만 적용
    const outlierAllowedCharts = ['line', 'column', 'mixed', 'dual-axis'];
    if (!outlierAllowedCharts.includes(chartType)) return;

    // 이상치가 있으면 자동 활성화, 없으면 자동 비활성화
    if (hasOutliersInEnabledSeries && !localShowOutliers) {
      // 비제어 모드에서 실제 이상치 유무에 맞춰 표시 상태를 자동 보정한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalShowOutliers(true);
    } else if (!hasOutliersInEnabledSeries && localShowOutliers) {
      setLocalShowOutliers(false);
    }
  }, [chartType, hasOutliersInEnabledSeries, localShowOutliers, propShowOutliers]);

  // 이상치 비활성화 시 사용할 정상 데이터
  const normalOnlyData = useMemo(() => {
    if (!chartData || !analysisResult) return chartData;
    return filterOutliersFromData(chartData, seriesFields, analysisResult.iqrBounds);
  }, [chartData, seriesFields, analysisResult]);

  // 이상치 Scatter 데이터
  const outlierScatterData = useMemo(() => {
    if (!analysisResult) return [];
    return outliersToScatterData(analysisResult.outliers);
  }, [analysisResult]);

  // 파이 차트 데이터 (시리즈별 합계) - 레전드용
  const pieChartData = useMemo(() => {
    if (chartType !== "pie" || !chartData || seriesFields.length === 0) return [];
    return calculateSeriesSums(chartData, seriesFields);
  }, [chartType, chartData, seriesFields]);

  // 파이 차트 시점별 데이터 (timepoint selection용)
  const pieChartTimepointData = useMemo(() => {
    if (chartType !== "pie" || !chartData || seriesFields.length === 0) return [];
    return calculatePieDataByTimepoint(chartData, seriesFields);
  }, [chartType, chartData, seriesFields]);

  // 2단계 파이 차트 데이터
  const twoLevelPieData = useMemo(() => {
    if (chartType !== "two-level-pie" || !chartData || seriesFields.length === 0)
      return { innerData: [], outerData: [] };
    return calculateTwoLevelPieData(chartData, seriesFields, hierarchyGroups);
  }, [chartType, chartData, seriesFields, hierarchyGroups]);

  // 2단계 파이 차트 시점별 데이터 (timepoint selection용)
  const twoLevelPieTimepointData = useMemo(() => {
    if (chartType !== "two-level-pie" || !chartData || seriesFields.length === 0) return [];
    return calculateTwoLevelPieDataByTimepoint(chartData, seriesFields, hierarchyGroups);
  }, [chartType, chartData, seriesFields, hierarchyGroups]);

  // 렌더링용 데이터 = 원본 그대로 (내부 원은 시리즈별 조각으로 유지).
  // 과거에는 그룹 할당 시 내부 원을 그룹 합계로 덮어씌웠으나,
  // 이는 외부·내부가 동일 구조로 보이는 문제를 야기해 제거함.
  const twoLevelPieRenderData = twoLevelPieData;
  const twoLevelPieRenderTimepointData = twoLevelPieTimepointData;

  // 트리맵 차트 데이터
  const treemapData = useMemo(() => {
    if ((chartType !== "treemap" && chartType !== "multi-level-treemap") || !chartData || seriesFields.length === 0) return [];
    // 멀티레벨 트리맵은 hierarchyGroups 적용
    if (chartType === "multi-level-treemap") {
      return calculateMultiLevelTreemapData(chartData, seriesFields, hierarchyGroups);
    }
    return calculateTreemapData(chartData, seriesFields);
  }, [chartType, chartData, seriesFields, hierarchyGroups]);

  // 시점별 트리맵 데이터 (트리맵 시점 선택용)
  const timepointTreemapData = useMemo(() => {
    if (chartType !== "treemap" || !chartData || seriesFields.length === 0) return [];
    return calculateTreemapDataByTimepoint(chartData, seriesFields);
  }, [chartType, chartData, seriesFields]);

  // 시점별 멀티레벨 트리맵 데이터 (멀티레벨 트리맵 시점 선택용)
  const timepointMultiLevelTreemapData = useMemo(() => {
    if (chartType !== "multi-level-treemap" || !chartData || seriesFields.length === 0) return [];
    return calculateMultiLevelTreemapDataByTimepoint(chartData, seriesFields, hierarchyGroups);
  }, [chartType, chartData, seriesFields, hierarchyGroups]);

  // 시점별 랭킹막대 데이터 (랭킹막대 시점 선택용)
  const timepointRankingBarData = useMemo(() => {
    if (chartType !== "ranking-bar" || !chartData || seriesFields.length === 0) return [];
    return calculateRankingBarDataByTimepoint(chartData, seriesFields);
  }, [chartType, chartData, seriesFields]);

  // 랭킹막대 차트용 레전드 데이터 (시점 모드에서는 currentRankingData 사용)
  const rankingLegendData = useMemo(() => {
    if (chartType !== "ranking-bar") return null;
    // 시점 모드에서 wrapper가 전달한 데이터 사용
    if (currentRankingData) {
      return [...currentRankingData].sort((a, b) => b.value - a.value);
    }
    // 시점 모드가 아닐 때 기본 데이터 사용
    if (!chartData || seriesFields.length === 0) return null;
    return seriesFields
      .map((field) => ({
        name: field,
        value: chartData.reduce((sum, item) => sum + ((item[field] as number) || 0), 0),
      }))
      .sort((a, b) => b.value - a.value);
  }, [chartType, chartData, seriesFields, currentRankingData]);

  // Anthropic 브랜드 색상 적용 차트 타입
  const usesBrandColors = chartType === "line" || chartType === "column" || chartType === "stacked" || chartType === "stacked-100" || chartType === "stacked-grouped" || chartType === "dual-axis-stacked-bar" || chartType === "mixed" || chartType === "dual-axis" || chartType === "area" || chartType === "area-100" || chartType === "stacked-area" || chartType === "synced-area" || chartType === "regression-scatter";
  const colorTargetFields = (chartType === "two-level-pie" || chartType === "multi-level-treemap")
    ? twoLevelPieSeriesFields
    : seriesFields;

  // 차트 타입별 기본 팔레트를 먼저 계산한 뒤, 시리즈별 오버라이드를 부분 적용한다.
  const defaultSeriesColors = useMemo(() => (
    chartType === "two-level-pie" || chartType === "pie"
      ? expandSeriesColors(TWO_LEVEL_PIE_COLORS, colorTargetFields.length)
      : chartType === "multi-level-treemap" || chartType === "treemap"
        ? expandSeriesColors(multiLevelTreemapColors || MULTI_LEVEL_TREEMAP_COLORS, colorTargetFields.length)
        : usesBrandColors
          ? expandSeriesColors(LINE_CHART_COLORS, colorTargetFields.length)
          : (themeColors.seriesColors.length > 0
            ? expandSeriesColors(themeColors.seriesColors, colorTargetFields.length)
            : expandSeriesColors(["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"], colorTargetFields.length))
  ), [
    chartType,
    colorTargetFields.length,
    multiLevelTreemapColors,
    usesBrandColors,
    themeColors.seriesColors,
  ]);

  const resolveGroupLegendColor = useCallback((groupName: string, fallbackIndex: number): string => {
    const groupOverride = groupColorOverrides?.[groupName];
    if (isValidHexColor(groupOverride)) return groupOverride!;
    const groupFieldIndex = colorTargetFields.indexOf(groupName);
    if (groupFieldIndex >= 0) {
      return defaultSeriesColors[groupFieldIndex] ?? defaultSeriesColors[0] ?? "#C15F3C";
    }
    return defaultSeriesColors[fallbackIndex] ?? defaultSeriesColors[0] ?? "#C15F3C";
  }, [groupColorOverrides, colorTargetFields, defaultSeriesColors]);

  const seriesColors = useMemo(() => (
    colorTargetFields.map((field, index) => {
      if (chartType === "two-level-pie" || chartType === "multi-level-treemap") {
        const groupOverrideColor = groupColorOverrides?.[field];
        if (isValidHexColor(groupOverrideColor)) return groupOverrideColor!;
      }
      const overrideColor = seriesColorOverrides?.[field];
      if (isValidHexColor(overrideColor)) return overrideColor!;
      return defaultSeriesColors[index] ?? defaultSeriesColors[0] ?? "#C15F3C";
    })
  ), [
    colorTargetFields,
    chartType,
    groupColorOverrides,
    seriesColorOverrides,
    defaultSeriesColors,
  ]);

  // Two-Level Pie 시리즈 마커/오버레이/차트 조각이 참조하는 안정된 per-series 색상 맵.
  // seriesFields(= 원본 시리즈 id 목록) 순서 기반으로 산출하고 seriesColorOverrides 로 오버라이드.
  // colorTargetFields(그룹명 치환) 경로와 분리해 그룹 할당과 무관하게 고정.
  const stableSeriesColorsById = useMemo(() => {
    const palette = expandSeriesColors(TWO_LEVEL_PIE_COLORS, seriesFields.length);
    const map: Record<string, string> = {};
    seriesFields.forEach((id, idx) => {
      const override = seriesColorOverrides?.[id];
      map[id] = isValidHexColor(override)
        ? override!
        : (palette[idx] ?? palette[0] ?? "#C15F3C");
    });
    return map;
  }, [seriesFields, seriesColorOverrides]);

  // Two-Level Pie 의 그룹 헤더/Mode 1 외부 원이 참조하는 그룹 전용 팔레트 맵.
  // 시리즈 팔레트와 겹치지 않는 GROUP_HEADER_PALETTE 를 그룹 순서대로 할당. groupColorOverrides 로 오버라이드.
  const groupHeaderColorsByName = useMemo(() => {
    const map: Record<string, string> = {};
    hierarchyGroups.forEach((group, idx) => {
      const override = groupColorOverrides?.[group.name];
      map[group.name] = isValidHexColor(override)
        ? override!
        : GROUP_HEADER_PALETTE[idx % GROUP_HEADER_PALETTE.length];
    });
    return map;
  }, [hierarchyGroups, groupColorOverrides]);

  const chartCoreLegendMeta = useMemo<ChartCoreLegendMetaPayload | null>(() => {
    if (chartType === "two-level-pie") {
      const outerData = twoLevelPieRenderData.outerData;
      if (!outerData.length) return null;

      // Mode 1 (사용자 그룹) 감지: outerData.name 이 중복되면 그룹핑이 있다는 뜻.
      // wrapper 의 groupKeyField 판정과 동일한 패턴.
      const names = outerData.map((item) => item.name);
      const isGroupedMode = names.length > new Set(names).size;
      if (!isGroupedMode) return null;

      const orderedGroupNames: string[] = [];
      const seenGroupNames = new Set<string>();
      for (const name of names) {
        if (!seenGroupNames.has(name)) {
          seenGroupNames.add(name);
          orderedGroupNames.push(name);
        }
      }

      const groups: ChartCoreLegendGroupPayload[] = [];
      orderedGroupNames.forEach((groupName, index) => {
        const childSeries = Array.from(
          new Set(
            outerData
              .filter((outerItem) => outerItem.name === groupName)
              .map((outerItem) => outerItem.series)
              .filter((seriesName): seriesName is string => Boolean(seriesName)),
          ),
        );
        if (!childSeries.length) return;

        const groupColor = groupHeaderColorsByName[groupName]
          ?? GROUP_HEADER_PALETTE[index % GROUP_HEADER_PALETTE.length];
        groups.push({
          id: groupName,
          label: seriesLabelMap?.[groupName] ?? groupName,
          color: groupColor,
          series: childSeries.map((seriesName) => ({
            id: seriesName,
            label: seriesLabelMap?.[seriesName] ?? seriesName,
            color: stableSeriesColorsById[seriesName],
          })),
        });
      });

      if (!groups.length) return null;
      return {
        chartType: "two-level-pie",
        groups,
      };
    }

    if (chartType === "multi-level-treemap") {
      if (!treemapStats?.seriesData || treemapStats.seriesData.length === 0) return null;

      if (treemapStats.isDrilledDown) {
        const groupLabel = treemapStats.parentName || "그룹";
        const parentColor = treemapStats.parentColor || resolveGroupLegendColor(groupLabel, 0);
        return {
          chartType: "multi-level-treemap",
          groups: [
            {
              id: groupLabel,
              label: seriesLabelMap?.[groupLabel] ?? groupLabel,
              color: isValidHexColor(groupColorOverrides?.[groupLabel]) ? groupColorOverrides![groupLabel]! : parentColor,
              series: treemapStats.seriesData.map((item) => ({
                id: item.name,
                label: seriesLabelMap?.[item.name] ?? item.name,
              })),
            },
          ],
        };
      }

      const groups = treemapStats.seriesData.map((group, index) => ({
        id: group.name,
        label: seriesLabelMap?.[group.name] ?? group.name,
        color: resolveGroupLegendColor(group.name, index),
        series: (group.children || []).map((child) => ({
          id: child.name,
          label: seriesLabelMap?.[child.name] ?? child.name,
        })),
      }));
      if (!groups.length) return null;
      return {
        chartType: "multi-level-treemap",
        groups,
      };
    }

    return null;
  }, [
    chartType,
    twoLevelPieRenderData.innerData,
    twoLevelPieRenderData.outerData,
    treemapStats,
    groupColorOverrides,
    resolveGroupLegendColor,
    seriesLabelMap,
    stableSeriesColorsById,
    groupHeaderColorsByName,
  ]);

  const legendMetaSignatureRef = useRef<string>("");
  useEffect(() => {
    if (!onLegendMetaChange) return;
    const nextSignature = JSON.stringify(chartCoreLegendMeta ?? null);
    if (legendMetaSignatureRef.current === nextSignature) return;
    legendMetaSignatureRef.current = nextSignature;
    onLegendMetaChange(chartCoreLegendMeta);
  }, [chartCoreLegendMeta, onLegendMetaChange]);

  // 차트 컴포넌트에 전달할 테마 색상 (브랜드 색상 적용 차트)
  const chartThemeColors = useMemo(() => {
    return {
      ...themeColors,
      seriesColors,
    };
  }, [themeColors, seriesColors]);

  const handleChartTypeChange = (value: string) => {
    setLocalChartType(value as ChartType);
    // 혼합 차트로 변경 시 기본값 설정 (절반은 라인, 절반은 막대)
    if (value === 'mixed') {
      const initialTypes: Record<string, "column" | "line"> = {};
      const halfIndex = Math.ceil(seriesFields.length / 2);
      seriesFields.forEach((field, idx) => {
        initialTypes[field] = idx < halfIndex ? 'line' : 'column';
      });
      setLocalYFieldTypes(initialTypes);
    }
    // 이중축 차트로 변경 시 기본값 설정
    // 값 크기 기준 그룹핑: 큰 값 → 좌측(막대), 작은 값 → 우측(라인)
    if ((value === 'dual-axis' || value === 'dual-axis-stacked-bar') && chartData) {
      const initialPlacements: Record<string, YAxisPlacement> = {};
      const initialTypes: Record<string, "column" | "line"> = {};

      // 각 시리즈의 중앙값(median) 계산 - 이상치에 강건함
      const seriesMedianValues: { field: string; median: number }[] = seriesFields.map(field => {
        const values = chartData
          .map(d => d[field])
          .filter((v): v is number => typeof v === 'number' && !isNaN(v))
          .map(v => Math.abs(v))
          .sort((a, b) => a - b);

        let median = 0;
        if (values.length > 0) {
          const mid = Math.floor(values.length / 2);
          median = values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
        }
        return { field, median };
      });

      // 중앙값 기준 내림차순 정렬
      seriesMedianValues.sort((a, b) => b.median - a.median);

      // 비율 기준 가장 큰 간격 찾기
      let splitIndex = Math.ceil(seriesFields.length / 2);
      if (seriesMedianValues.length >= 2) {
        let maxRatioGap = 0;
        let maxGapIndex = 0;
        for (let i = 0; i < seriesMedianValues.length - 1; i++) {
          const current = seriesMedianValues[i].median;
          const next = seriesMedianValues[i + 1].median;
          const ratioGap = current > 0 ? (current - next) / current : 0;
          if (ratioGap > maxRatioGap) {
            maxRatioGap = ratioGap;
            maxGapIndex = i + 1;
          }
        }
        // 비율 간격이 50% 이상이면 유의미한 분리점으로 판단
        if (maxRatioGap >= 0.5 && maxGapIndex > 0) {
          splitIndex = maxGapIndex;
        }
      }

      // 그룹 분리
      const largeValueFields = seriesMedianValues.slice(0, splitIndex).map(s => s.field);

      seriesFields.forEach(field => {
        if (largeValueFields.includes(field)) {
          initialPlacements[field] = 'left';
          initialTypes[field] = 'column';
        } else {
          initialPlacements[field] = 'right';
          initialTypes[field] = value === 'dual-axis-stacked-bar' ? 'column' : 'line';
        }
      });

      setLocalYAxisPlacements(initialPlacements);
      setLocalYFieldTypes(initialTypes);
    }
    // 동기화 영역 차트로 변경 시 기본값 설정 (첫 번째/두 번째 시리즈)
    if (value === 'synced-area') {
      if (seriesFields.length >= 2) {
        setSyncedAreaLeftField(seriesFields[0]);
        setSyncedAreaRightField(seriesFields[1]);
      } else if (seriesFields.length === 1) {
        setSyncedAreaLeftField(seriesFields[0]);
        setSyncedAreaRightField(seriesFields[0]);
      }
    }
    // 그룹형 누적막대로 변경 시 기본값 설정 (시리즈를 2그룹으로 균등 분배)
    if (value === 'stacked-grouped' || value === 'dual-axis-stacked-bar') {
      const initialAssignments: Record<string, number> = {};
      const groupSize = Math.ceil(seriesFields.length / 2);
      seriesFields.forEach((field, idx) => {
        initialAssignments[field] = Math.floor(idx / groupSize) + 1;
      });
      setSeriesGroupAssignments(initialAssignments);
      setGroupCount(2);
    }
    // 회귀 산점도로 변경 시 기본값 설정 (첫 두 시리즈)
    if (value === 'regression-scatter') {
      if (seriesFields.length >= 2) {
        setRegressionScatterXField(seriesFields[0]);
        setRegressionScatterYField(seriesFields[1]);
      } else if (seriesFields.length === 1) {
        setRegressionScatterXField(seriesFields[0]);
        setRegressionScatterYField(seriesFields[0]);
      }
    }
  };

  const legendSeriesFields = colorTargetFields;
  const hasLegendPanel = seriesFields.length > 0;
  const shouldRenderInlineLegend = hasLegendPanel && !hideLegendPanel && !externalLegendContainer;
  const shouldRenderExternalLegend = hasLegendPanel && Boolean(externalLegendContainer);
  const legendPanelNode = hasLegendPanel ? (
    <ChartLegendPanel
      seriesFields={legendSeriesFields}
      seriesColors={seriesColors}
      seriesLabelMap={seriesLabelMap}
      enabledSeries={enabledSeries}
      tooltipPayload={tooltipPayload}
      hoveredLabel={hoveredLabel}
      analysisResult={analysisResult}
      rankingData={rankingLegendData}
      pieChartData={chartType === "two-level-pie" ? twoLevelPieData.innerData : chartType === "pie" ? (selectedPieData || pieChartData) : undefined}
      geoGridData={chartType === "geo-grid" ? currentGeoGridData : undefined}
      geoGridMapLevel={chartType === "geo-grid" ? geoGridMapLevel : undefined}
      geoGridTimepoint={chartType === "geo-grid" ? currentGeoGridTimepoint : undefined}
      onSeriesToggle={(field) => {
        if (isStackedGroupedLike) {
          const isEnabled = enabledSeries.has(field);
          const nextEnabled = new Set(enabledSeries);
          const nextAssignments = { ...seriesGroupAssignments };

          if (isEnabled) {
            nextEnabled.delete(field);
            nextAssignments[field] = 0;
          } else {
            nextEnabled.add(field);
            if ((nextAssignments[field] ?? 0) <= 0) {
              nextAssignments[field] = 1;
            }
          }

          setEnabledSeries(nextEnabled);
          setSeriesGroupAssignments(nextAssignments);
          return;
        }

        const newSet = new Set(enabledSeries);
        if (newSet.has(field)) {
          newSet.delete(field);
        } else {
          newSet.add(field);
        }
        setEnabledSeries(newSet);
      }}
      onToggleAll={(enable) => {
        if (isStackedGroupedLike) {
          const nextAssignments = { ...seriesGroupAssignments };
          legendSeriesFields.forEach((field) => {
            if (enable) {
              if ((nextAssignments[field] ?? 0) <= 0) nextAssignments[field] = 1;
            } else {
              nextAssignments[field] = 0;
            }
          });
          setSeriesGroupAssignments(nextAssignments);
        }
        setEnabledSeries(enable ? new Set(legendSeriesFields) : new Set());
      }}
      collapseThreshold={LEGEND_COLLAPSE_THRESHOLD}
      title={undefined}
      description={undefined}
      chartType={chartType}
      yFieldTypes={{ ...yFieldTypes, ...localYFieldTypes }}
      yAxisPlacements={isDualAxisLike ? localYAxisPlacements : undefined}
      // 동기화 영역 차트 관련
      syncedAreaLeftField={syncedAreaLeftField}
      syncedAreaRightField={syncedAreaRightField}
      onSyncedAreaFieldChange={(position, field) => {
        if (position === 'left') {
          setSyncedAreaLeftField(field);
        } else {
          setSyncedAreaRightField(field);
        }
      }}
      onYAxisPlacementChange={(field: string, placement: YAxisPlacement) => {
        setLocalYAxisPlacements({
          ...localYAxisPlacements,
          [field]: placement
        });
      }}
      onYFieldTypeChange={(field: string, type: "column" | "line" | "none") => {
        if (type === "none") {
          // enabledSeries에서 제거
          const newSet = new Set(enabledSeries);
          newSet.delete(field);
          setEnabledSeries(newSet);

          if (chartType === "dual-axis-stacked-bar") {
            setSeriesGroupAssignments({
              ...seriesGroupAssignments,
              [field]: 0,
            });
          }

          // localYFieldTypes에서도 제거
          const newTypes = { ...localYFieldTypes };
          delete newTypes[field];
          setLocalYFieldTypes(newTypes);
        } else {
          // enabledSeries에 추가
          const newSet = new Set(enabledSeries);
          newSet.add(field);
          setEnabledSeries(newSet);

          // 타입 설정
          setLocalYFieldTypes({
            ...localYFieldTypes,
            [field]: type
          });

          if (chartType === "dual-axis-stacked-bar") {
            const currentGroup = seriesGroupAssignments[field] ?? 0;
            if (currentGroup === 0) {
              setSeriesGroupAssignments({
                ...seriesGroupAssignments,
                [field]: 1,
              });
            }
          }
        }
      }}
      // 그룹형 누적막대 관련
      groupCount={groupCount}
      seriesGroupAssignments={seriesGroupAssignments}
      onGroupCountChange={(count: number) => {
        setGroupCount(count);
        // 그룹 개수 변경 시 기존 할당이 범위를 벗어나면 조정
        const newAssignments = { ...seriesGroupAssignments };
        Object.keys(newAssignments).forEach((field) => {
          if (newAssignments[field] > count) {
            newAssignments[field] = count;
          }
        });
        setSeriesGroupAssignments(newAssignments);
      }}
      onSeriesGroupChange={(field: string, group: number) => {
        if (group === 0) {
          // 숨김: enabledSeries에서 제거
          const newSet = new Set(enabledSeries);
          newSet.delete(field);
          setEnabledSeries(newSet);
        } else {
          // 그룹 할당: enabledSeries에 추가
          const newSet = new Set(enabledSeries);
          newSet.add(field);
          setEnabledSeries(newSet);
        }
        const newAssignments = {
          ...seriesGroupAssignments,
          [field]: group
        };
        setSeriesGroupAssignments(newAssignments);
        // 실제 사용 중인 최대 그룹 번호로 groupCount 자동 조정
        const usedGroups = Object.values(newAssignments).filter(g => g > 0);
        const maxUsedGroup = usedGroups.length > 0 ? Math.max(...usedGroups) : 2;
        setGroupCount(Math.max(maxUsedGroup, 2));
      }}
      // 멀티레벨 트리맵 통계
      treemapStats={chartType === "multi-level-treemap" ? treemapStats : undefined}
      // 회귀 산점도 관련
      regressionScatterXField={regressionScatterXField}
      regressionScatterYField={regressionScatterYField}
      onRegressionScatterFieldChange={(axis, field) => {
        if (axis === 'x') {
          setRegressionScatterXField(field);
        } else {
          setRegressionScatterYField(field);
        }
      }}
      regressionStats={regressionStats}
      // 2단계 파이 계층 그룹 관련
      hierarchyGroups={hierarchyGroups}
      onHierarchyGroupsChange={setHierarchyGroups}
      allSeriesFieldsForHierarchy={seriesFields}
      twoLevelPieOuterData={chartType === "two-level-pie" ? twoLevelPieData.outerData : undefined}
      twoLevelPieTimepointData={chartType === "two-level-pie" ? twoLevelPieTimepointData : undefined}
      seriesColorsById={stableSeriesColorsById}
      groupHeaderColorsByName={groupHeaderColorsByName}
    />
  ) : null;

  return (
    <div className="w-full space-y-4">
      {/* 툴바: 차트 타입 선택 (devMode) + 이상치 토글 */}
      {!hideToolbar && devMode && (
        <div className="flex items-center gap-2">
          <Label htmlFor="chart-type" className="text-sm whitespace-nowrap">
            차트 타입
          </Label>
          <Select value={chartType} onValueChange={handleChartTypeChange}>
            <SelectTrigger id="chart-type" className="w-32">
              <SelectValue placeholder="차트 타입" />
            </SelectTrigger>
            <SelectContent>
              {ENABLED_CHART_TYPE_CONFIGS.map(config => {
                const validation = chartTypeValidations?.find(v => v.type === config.value);
                const isDisabled = validation ? !validation.valid : false;
                return (
                  <SelectItem
                    key={config.value}
                    value={config.value}
                    disabled={isDisabled}
                    title={validation?.reason}
                  >
                    {config.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {/* 이상치 토글 - line, column, mixed, dual-axis */}
          {(chartType === "line" || chartType === "column" || chartType === "mixed" || chartType === "dual-axis") && (
            <div className="flex items-center gap-2 ml-16">
              <span className="text-sm text-muted-foreground">이상치</span>
              <Switch
                checked={resolvedShowOutliers}
                onCheckedChange={handleShowOutliersChange}
                disabled={!hasOutliersInEnabledSeries}
                className="h-6 w-11 rounded-full border border-gray-300 bg-transparent data-[state=checked]:bg-transparent data-[state=checked]:border-gray-400 [&>span]:h-4 [&>span]:w-4 [&>span]:rounded-full [&>span]:bg-gray-400 [&>span]:data-[state=checked]:translate-x-5 [&>span]:data-[state=unchecked]:translate-x-1"
              />
            </div>
          )}
        </div>
      )}

      {/* 레전드 + 차트 영역 (좌측 레전드, 우측 차트) */}
      <Card className="w-full">
        <CardContent className="w-full pt-6">
          {!isExecuted ? (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
              실행 버튼을 눌러 차트를 생성하세요
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-[400px] text-destructive text-sm">
              {error}
            </div>
          ) : chartData ? (
            <div className={cn("flex w-full", shouldRenderInlineLegend ? "gap-4" : "gap-0")}>
              {/* 좌측 차트 (넓게) */}
              <div className="flex-1 min-w-0">
                {chartType === "two-level-pie" ? (
                  // 2단계 원형 차트
                  <RechartsTwoLevelPieWrapper
                    innerData={twoLevelPieRenderData.innerData}
                    outerData={twoLevelPieRenderData.outerData}
                    timepointData={twoLevelPieRenderTimepointData}
                    enabledSeries={enabledSeries}
                    themeColors={chartThemeColors}
                    height={400}
                    allSeriesFields={twoLevelPieSeriesFields}
                    seriesLabelMap={seriesLabelMap}
                    seriesColorsById={stableSeriesColorsById}
                    groupHeaderColorsByName={groupHeaderColorsByName}
                    onTooltipChange={(payload, label) => {
                      setTooltipPayload(payload);
                      setHoveredLabel(label);
                    }}
                  />
                ) : chartType === "pie" ? (
                  // 원형 차트 (시점별 Small Multiples)
                  <RechartsPieWrapper
                    data={pieChartData}
                    timepointData={pieChartTimepointData}
                    enabledSeries={enabledSeries}
                    themeColors={chartThemeColors}
                    height={400}
                    allSeriesFields={seriesFields}
                    seriesLabelMap={seriesLabelMap}
                    onTooltipChange={(payload, label) => {
                      setTooltipPayload(payload);
                      setHoveredLabel(label);
                    }}
                    onSelectedDataChange={setSelectedPieData}
                    showDefaultLabels={skipConstraints}
                  />
                ) : chartType === "treemap" ? (
                  // 트리맵 차트
                  <RechartsTreemapWrapper
                    timepointData={timepointTreemapData}
                    enabledSeries={enabledSeries}
                    themeColors={chartThemeColors}
                    height={400}
                    allSeriesFields={seriesFields}
                    onTooltipChange={(payload, label) => {
                      setTooltipPayload(payload);
                      setHoveredLabel(label);
                    }}
                    seriesLabelMap={seriesLabelMap}
                  />
                ) : chartType === "multi-level-treemap" ? (
                  // 멀티레벨 트리맵 차트
                  <RechartsMultiLevelTreemapWrapper
                    data={treemapData}
                    timepointData={timepointMultiLevelTreemapData}
                    enabledSeries={enabledSeries}
                    themeColors={chartThemeColors}
                    height={400}
                    allSeriesFields={twoLevelPieSeriesFields}
                    onTooltipChange={(payload, label) => {
                      setTooltipPayload(payload);
                      setHoveredLabel(label);
                    }}
                    onDrilldownChange={setTreemapStats}
                    customColors={multiLevelTreemapColors}
                    seriesLabelMap={seriesLabelMap}
                  />
                ) : chartType === "ranking-bar" ? (
                  // 랭킹막대 차트
                  <RechartsRankingBarWrapper
                    data={chartData}
                    xField="name"
                    yField={seriesFields[0] || ""}
                    timepointData={timepointRankingBarData}
                    themeColors={chartThemeColors}
                    height={400}
                    onTooltipChange={(payload, label) => {
                      setTooltipPayload(payload);
                      setHoveredLabel(label);
                    }}
                    onRankingDataChange={setCurrentRankingData}
                    seriesLabelMap={seriesLabelMap}
                  />
                ) : chartType === "geo-grid" ? (
                  // 지도그리드 차트
                  <RechartsGeoGridWrapper
                    height={400}
                    timepointData={MOCK_TIMEPOINT_GEO_GRID_DATA}
                    onTooltipChange={(payload) => {
                      if (payload) {
                        setTooltipPayload([{ dataKey: payload.districtName, value: payload.value, color: payload.color, totalSum: payload.totalSum, mapLevel: payload.mapLevel }]);
                        setHoveredLabel(payload.districtName);
                      } else {
                        setTooltipPayload(null);
                        setHoveredLabel(null);
                      }
                    }}
                    onMapLevelChange={setGeoGridMapLevel}
                    onMetricLabelChange={setGeoGridMetricLabel}
                    onCurrentDataChange={setCurrentGeoGridData}
                    onTimepointChange={setCurrentGeoGridTimepoint}
                  />
                ) : chartType === "regression-scatter" ? (
                  // 회귀 산점도
                  <RechartsRegressionScatterWrapper
                    data={chartData}
                    xField={regressionScatterXField}
                    yField={regressionScatterYField}
                    themeColors={chartThemeColors}
                    height={400}
                    onRegressionStats={setRegressionStats}
                    onTooltipChange={(payload, label) => {
                      setTooltipPayload(payload);
                      setHoveredLabel(label);
                    }}
                    onOutlierCount={setRegressionOutlierCount}
                  />
                ) : chartType === "synced-area" ? (
                  // 동기화 영역 차트 (좌우 배치)
                  (() => {
                    // 동기화 영역 차트 호버 핸들러 (양쪽 시리즈 값 모두 표시)
                    const handleSyncedAreaMouseMove = (state: any) => {
                      if (state && state.activeLabel && chartData) {
                        const hoveredData = chartData.find((d: any) => d.date_display === state.activeLabel);
                        if (hoveredData) {
                          const payload: any[] = [];
                          if (syncedAreaLeftField) {
                            const leftColorIdx = seriesFields.indexOf(syncedAreaLeftField);
                            payload.push({
                              dataKey: syncedAreaLeftField,
                              value: hoveredData[syncedAreaLeftField],
                              color: seriesColors[leftColorIdx % seriesColors.length],
                            });
                          }
                          if (syncedAreaRightField) {
                            const rightColorIdx = seriesFields.indexOf(syncedAreaRightField);
                            payload.push({
                              dataKey: syncedAreaRightField,
                              value: hoveredData[syncedAreaRightField],
                              color: seriesColors[rightColorIdx % seriesColors.length],
                            });
                          }
                          setTooltipPayload(payload);
                          setHoveredLabel(state.activeLabel);
                        }
                      }
                    };
                    const handleSyncedAreaMouseLeave = () => {
                      setTooltipPayload(null);
                      setHoveredLabel(null);
                    };
                    return (
                      <div className="flex gap-4 h-[400px]">
                        {/* 좌측 차트 */}
                        <div className="flex-1 min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={chartData}
                              syncId="synced-area"
                              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                              onMouseMove={handleSyncedAreaMouseMove}
                              onMouseLeave={handleSyncedAreaMouseLeave}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={chartThemeColors?.gridColor || "hsl(var(--muted))"} opacity={0.5} />
                              <XAxis
                                dataKey="date_display"
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                              />
                              <YAxis
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                                tickFormatter={(value) => typeof value === "number" ? axisTickFormatter(value) : value}
                                label={syncedAreaLeftYAxisLabel
                                  ? {
                                    value: syncedAreaLeftYAxisLabel,
                                    angle: 0,
                                    position: "insideTopLeft",
                                    offset: 0,
                                    style: {
                                      textAnchor: "start",
                                      fill: "hsl(var(--muted-foreground))",
                                      fontSize: 12,
                                    },
                                  }
                                  : undefined}
                              />
                              <Tooltip
                                cursor={{ stroke: chartThemeColors?.textColor || "hsl(var(--foreground))", strokeOpacity: 0.15, strokeWidth: 1, strokeDasharray: "4 4" }}
                                content={() => null}
                              />
                              {syncedAreaLeftField && (() => {
                                const colorIdx = seriesFields.indexOf(syncedAreaLeftField);
                                const color = seriesColors[colorIdx % seriesColors.length];
                                return (
                                  <Area
                                    key={syncedAreaLeftField}
                                    type="monotone"
                                    dataKey={syncedAreaLeftField}
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={0.3}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
                                  />
                                );
                              })()}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        {/* 우측 차트 */}
                        <div className="flex-1 min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                              data={chartData}
                              syncId="synced-area"
                              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                              onMouseMove={handleSyncedAreaMouseMove}
                              onMouseLeave={handleSyncedAreaMouseLeave}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke={chartThemeColors?.gridColor || "hsl(var(--muted))"} opacity={0.5} />
                              <XAxis
                                dataKey="date_display"
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                              />
                              <YAxis
                                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                                tickLine={false}
                                axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
                                tickFormatter={(value) => typeof value === "number" ? axisTickFormatter(value) : value}
                                label={syncedAreaRightYAxisLabel
                                  ? {
                                    value: syncedAreaRightYAxisLabel,
                                    angle: 0,
                                    position: "insideTopLeft",
                                    offset: 0,
                                    style: {
                                      textAnchor: "start",
                                      fill: "hsl(var(--muted-foreground))",
                                      fontSize: 12,
                                    },
                                  }
                                  : undefined}
                              />
                              <Tooltip
                                cursor={{ stroke: chartThemeColors?.textColor || "hsl(var(--foreground))", strokeOpacity: 0.15, strokeWidth: 1, strokeDasharray: "4 4" }}
                                content={() => null}
                              />
                              {syncedAreaRightField && (() => {
                                const colorIdx = seriesFields.indexOf(syncedAreaRightField);
                                const color = seriesColors[colorIdx % seriesColors.length];
                                return (
                                  <Area
                                    key={syncedAreaRightField}
                                    type="monotone"
                                    dataKey={syncedAreaRightField}
                                    stroke={color}
                                    fill={color}
                                    fillOpacity={0.3}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ fill: color, stroke: color, strokeWidth: 0, r: 5 }}
                                  />
                                );
                              })()}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })()
                ) : resolvedShowOutliers && analysisResult && (analysisResult.hasUpperOutliers || analysisResult.hasLowerOutliers) && chartType !== 'stacked' && chartType !== 'stacked-100' && chartType !== 'stacked-grouped' && chartType !== 'dual-axis-stacked-bar' && chartType !== 'area' && chartType !== 'area-100' && chartType !== 'stacked-area' ? (
                  // 이상치 활성화 + 이상치 존재 시: 분할 차트 (누적막대 제외)
                  <RechartsSplitWrapper
                    xField="date_display"
                    yFields={visibleSeriesFields}
                    allSeriesFields={seriesFields}
                    chartType={chartType}
                    yFieldTypes={{ ...yFieldTypes, ...localYFieldTypes }}
                    yAxisPlacements={isDualAxisLike ? localYAxisPlacements : undefined}
                    yAxisLabels={autoYAxisLabels}
                    seriesLabelMap={seriesLabelMap}
                    themeColors={chartThemeColors}
                    totalHeight={showBrush ? 480 : 400}
                    showBrush={showBrush}
                    classifiedData={analysisResult.classifiedData}
                    leftClassifiedData={isDualAxisLike ? (analysisResult.leftClassifiedData || undefined) : undefined}
                    rightClassifiedData={isDualAxisLike ? (analysisResult.rightClassifiedData || undefined) : undefined}
                    outliers={analysisResult.outliers}
                    fullData={chartData}
                    datetimeUnit={unitSettings?.datetime_unit}
                    showTooltip={showTooltip}
                    onTooltipChange={(payload, label) => {
                      setTooltipPayload(payload);
                      setHoveredLabel(label);
                    }}
                    showDualAxisReferenceLine={showDualAxisReferenceLine}
                    dualAxisReferenceLineStyle={dualAxisReferenceLineStyle}
                  />
                ) : (
                  // 이상치 비활성화 또는 이상치 없음 또는 누적막대: 단일 차트
                  <RechartsWrapper
                    data={chartData}
                    xField="date_display"
                    yFields={visibleSeriesFields}
                    allSeriesFields={seriesFields}
                    chartType={chartType}
                    yFieldTypes={{ ...yFieldTypes, ...localYFieldTypes }}
                    yAxisPlacements={isDualAxisLike ? localYAxisPlacements : undefined}
                    yAxisLabels={autoYAxisLabels}
                    seriesLabelMap={seriesLabelMap}
                    seriesGroupAssignments={isStackedGroupedLike ? seriesGroupAssignments : undefined}
                    themeColors={chartThemeColors}
                    height={showBrush ? 480 : 400}
                    showBrush={showBrush}
                    outlierData={resolvedShowOutliers && chartType !== 'stacked' && chartType !== 'stacked-100' && chartType !== 'stacked-grouped' && chartType !== 'dual-axis-stacked-bar' && chartType !== 'area' && chartType !== 'area-100' && chartType !== 'stacked-area' ? outlierScatterData : []}
                    showOutliers={resolvedShowOutliers && chartType !== 'stacked' && chartType !== 'stacked-100' && chartType !== 'stacked-grouped' && chartType !== 'dual-axis-stacked-bar' && chartType !== 'area' && chartType !== 'area-100' && chartType !== 'stacked-area'}
                    datetimeUnit={unitSettings?.datetime_unit}
                    showTooltip={showTooltip}
                    onTooltipChange={(payload, label) => {
                      setTooltipPayload(payload);
                      setHoveredLabel(label);
                    }}
                    showDualAxisReferenceLine={showDualAxisReferenceLine}
                    dualAxisReferenceLineStyle={dualAxisReferenceLineStyle}
                  />
                )}
              </div>
              {/* 우측 레전드 */}
              {shouldRenderInlineLegend && legendPanelNode}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground text-sm">
              인풋 데이터를 입력해주세요
            </div>
          )}
        </CardContent>
      </Card>
      {shouldRenderExternalLegend && externalLegendContainer
        ? createPortal(legendPanelNode, externalLegendContainer)
        : null}

      {/* 주석 카드 (이상치/결측치 정보) */}
      {isExecuted && analysisResult && (
        <DataQualityCard
          analysisResult={analysisResult}
          showOutliers={resolvedShowOutliers}
          showMissingValues={showMissingValues}
          regressionOutlierCount={chartType === 'regression-scatter' ? regressionOutlierCount : undefined}
          chartType={chartType}
          enabledSeries={enabledSeries}
        />
      )}

      {/* 단위설정 정보 표시 */}
      {unitSettings && (
        <div className="text-xs text-muted-foreground">
          <span>기간: {unitSettings.datetime_range.datetime_start || "-"}</span>
          <span className="mx-2">~</span>
          <span>{unitSettings.datetime_range.datetime_end || "-"}</span>
          <span className="ml-4">단위: {unitSettings.datetime_unit} {unitSettings.datetime_type}</span>
        </div>
      )}
    </div>
  );
}
