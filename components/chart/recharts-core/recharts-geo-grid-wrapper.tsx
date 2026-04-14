"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TimepointGeoGridData } from "./recharts-adapter";

// ============================================
// 서울시 25개 구 그리드 좌표 (col, row)
// ============================================
export const SEOUL_DISTRICTS_GRID: Record<string, { col: number; row: number; nameKo: string }> = {
  "Dobong-gu":       { col: 5, row: 0, nameKo: "도봉구" },
  "Gangbuk-gu":      { col: 5, row: 1, nameKo: "강북구" },
  "Eunpyeong-gu":    { col: 3, row: 2, nameKo: "은평구" },
  "Jongno-gu":       { col: 4, row: 2, nameKo: "종로구" },
  "Seongbuk-gu":     { col: 5, row: 2, nameKo: "성북구" },
  "Nowon-gu":        { col: 6, row: 2, nameKo: "노원구" },
  "Seodaemun-gu":    { col: 3, row: 3, nameKo: "서대문구" },
  "Jung-gu":         { col: 4, row: 3, nameKo: "중구" },
  "Dongdaemun-gu":   { col: 5, row: 3, nameKo: "동대문구" },
  "Jungnang-gu":     { col: 6, row: 3, nameKo: "중랑구" },
  "Mapo-gu":         { col: 3, row: 4, nameKo: "마포구" },
  "Yongsan-gu":      { col: 4, row: 4, nameKo: "용산구" },
  "Seongdong-gu":    { col: 5, row: 4, nameKo: "성동구" },
  "Gwangjin-gu":     { col: 6, row: 4, nameKo: "광진구" },
  "Gangseo-gu":      { col: 1, row: 5, nameKo: "강서구" },
  "Gangdong-gu":     { col: 8, row: 5, nameKo: "강동구" },
  "Yangcheon-gu":    { col: 2, row: 6, nameKo: "양천구" },
  "Yeongdeungpo-gu": { col: 3, row: 6, nameKo: "영등포구" },
  "Dongjak-gu":      { col: 4, row: 6, nameKo: "동작구" },
  "Seocho-gu":       { col: 5, row: 6, nameKo: "서초구" },
  "Gangnam-gu":      { col: 6, row: 6, nameKo: "강남구" },
  "Songpa-gu":       { col: 7, row: 6, nameKo: "송파구" },
  "Guro-gu":         { col: 2, row: 7, nameKo: "구로구" },
  "Geumcheon-gu":    { col: 3, row: 7, nameKo: "금천구" },
  "Gwanak-gu":       { col: 4, row: 7, nameKo: "관악구" },
};

const SEOUL_GRID_COLS = 10;
const SEOUL_GRID_ROWS = 8;

// 한강 셀 좌표
const HAN_RIVER_CELLS = [
  // 왼쪽 끝
  { col: 0, row: 4 },
  // 기존 한강 (col +1)
  { col: 1, row: 4 },
  { col: 2, row: 4 },
  { col: 7, row: 4 },
  { col: 8, row: 4 },
  { col: 2, row: 5 },
  { col: 3, row: 5 },
  { col: 4, row: 5 },
  { col: 5, row: 5 },
  { col: 6, row: 5 },
  { col: 7, row: 5 },
  // 오른쪽 끝
  { col: 9, row: 4 },
];

// ============================================
// 전국 17개 광역시도 그리드 좌표 (멀티셀)
// ============================================
export const KOREA_REGIONS_GRID: Record<string, {
  cells: Array<{col: number; row: number}>;
  nameKo: string;
}> = {
  // 광역시/특별시 (1셀)
  "Seoul":   { cells: [{col:2, row:2}], nameKo: "서울" },
  "Incheon": { cells: [{col:1, row:2}], nameKo: "인천" },
  "Sejong":  { cells: [{col:3, row:4}], nameKo: "세종" },
  "Daejeon": { cells: [{col:3, row:5}], nameKo: "대전" },
  "Gwangju": { cells: [{col:2, row:8}], nameKo: "광주" },
  "Daegu":   { cells: [{col:5, row:7}], nameKo: "대구" },
  "Ulsan":   { cells: [{col:7, row:7}], nameKo: "울산" },
  "Busan":   { cells: [{col:7, row:8}], nameKo: "부산" },

  // 도 (멀티셀)
  "Gyeonggi": {
    cells: [{col:2,row:1},{col:3,row:1},{col:3,row:2},{col:2,row:3},{col:3,row:3}],
    nameKo: "경기"
  },
  "Gangwon": {
    cells: [{col:4,row:1},{col:5,row:1},{col:6,row:1},
            {col:4,row:2},{col:5,row:2},{col:6,row:2},
            {col:4,row:3},{col:5,row:3},{col:6,row:3},{col:7,row:3}],
    nameKo: "강원"
  },
  "Chungnam": {
    cells: [{col:1,row:4},{col:2,row:4},{col:1,row:5},{col:2,row:5}],
    nameKo: "충남"
  },
  "Chungbuk": {
    cells: [{col:4,row:4},{col:5,row:4},{col:4,row:5}],
    nameKo: "충북"
  },
  "Jeonbuk": {
    cells: [{col:2,row:6},{col:3,row:6},{col:2,row:7},{col:3,row:7}],
    nameKo: "전북"
  },
  "Jeonnam": {
    cells: [{col:1,row:8},{col:3,row:8},{col:1,row:9},{col:2,row:9},{col:3,row:9},
            {col:1,row:10},{col:2,row:10}],
    nameKo: "전남"
  },
  "Gyeongbuk": {
    cells: [{col:6,row:4},{col:7,row:4},{col:5,row:5},{col:6,row:5},{col:7,row:5},
            {col:4,row:6},{col:5,row:6},{col:6,row:6},{col:7,row:6},
            {col:4,row:7},{col:6,row:7}],
    nameKo: "경북"
  },
  "Gyeongnam": {
    cells: [{col:4,row:8},{col:5,row:8},{col:6,row:8},
            {col:4,row:9},{col:5,row:9},{col:6,row:9}],
    nameKo: "경남"
  },
  "Jeju": {
    cells: [{col:2,row:12}],
    nameKo: "제주"
  },
};

const NATIONAL_GRID_COLS = 8;
const NATIONAL_GRID_ROWS = 13;

// ============================================
// 지역명 목록 (감지 로직용)
// ============================================
export const SEOUL_DISTRICT_NAMES = Object.values(SEOUL_DISTRICTS_GRID).map(d => d.nameKo);
export const KOREA_REGION_NAMES = Object.values(KOREA_REGIONS_GRID).map(d => d.nameKo);

// ============================================
// 목업 데이터
// ============================================
export interface GeoGridDataItem {
  districtId: string;
  districtName: string;
  value: number;
}

// 서울시 목업 데이터
export const MOCK_SEOUL_DATA: GeoGridDataItem[] = [
  { districtId: "Dobong-gu", districtName: "도봉구", value: 42 },
  { districtId: "Gangbuk-gu", districtName: "강북구", value: 58 },
  { districtId: "Eunpyeong-gu", districtName: "은평구", value: 67 },
  { districtId: "Jongno-gu", districtName: "종로구", value: 35 },
  { districtId: "Seongbuk-gu", districtName: "성북구", value: 73 },
  { districtId: "Nowon-gu", districtName: "노원구", value: 88 },
  { districtId: "Seodaemun-gu", districtName: "서대문구", value: 51 },
  { districtId: "Jung-gu", districtName: "중구", value: 29 },
  { districtId: "Dongdaemun-gu", districtName: "동대문구", value: 64 },
  { districtId: "Jungnang-gu", districtName: "중랑구", value: 77 },
  { districtId: "Mapo-gu", districtName: "마포구", value: 45 },
  { districtId: "Yongsan-gu", districtName: "용산구", value: 38 },
  { districtId: "Seongdong-gu", districtName: "성동구", value: 56 },
  { districtId: "Gwangjin-gu", districtName: "광진구", value: 82 },
  { districtId: "Gangseo-gu", districtName: "강서구", value: 91 },
  { districtId: "Gangdong-gu", districtName: "강동구", value: 69 },
  { districtId: "Yangcheon-gu", districtName: "양천구", value: 54 },
  { districtId: "Yeongdeungpo-gu", districtName: "영등포구", value: 47 },
  { districtId: "Dongjak-gu", districtName: "동작구", value: 33 },
  { districtId: "Seocho-gu", districtName: "서초구", value: 62 },
  { districtId: "Gangnam-gu", districtName: "강남구", value: 95 },
  { districtId: "Songpa-gu", districtName: "송파구", value: 84 },
  { districtId: "Guro-gu", districtName: "구로구", value: 41 },
  { districtId: "Geumcheon-gu", districtName: "금천구", value: 26 },
  { districtId: "Gwanak-gu", districtName: "관악구", value: 59 },
];

// 전국 목업 데이터
export const MOCK_NATIONAL_DATA: GeoGridDataItem[] = [
  { districtId: "Seoul", districtName: "서울", value: 85 },
  { districtId: "Busan", districtName: "부산", value: 62 },
  { districtId: "Daegu", districtName: "대구", value: 48 },
  { districtId: "Incheon", districtName: "인천", value: 71 },
  { districtId: "Gwangju", districtName: "광주", value: 39 },
  { districtId: "Daejeon", districtName: "대전", value: 55 },
  { districtId: "Ulsan", districtName: "울산", value: 44 },
  { districtId: "Sejong", districtName: "세종", value: 92 },
  { districtId: "Gyeonggi", districtName: "경기", value: 78 },
  { districtId: "Gangwon", districtName: "강원", value: 33 },
  { districtId: "Chungbuk", districtName: "충북", value: 51 },
  { districtId: "Chungnam", districtName: "충남", value: 46 },
  { districtId: "Jeonbuk", districtName: "전북", value: 37 },
  { districtId: "Jeonnam", districtName: "전남", value: 29 },
  { districtId: "Gyeongbuk", districtName: "경북", value: 42 },
  { districtId: "Gyeongnam", districtName: "경남", value: 58 },
  { districtId: "Jeju", districtName: "제주", value: 67 },
];

// 기존 호환성 유지
export const MOCK_GEO_GRID_DATA = MOCK_SEOUL_DATA;

// 5개 시점 목업 데이터 생성
function generateTimepointData(baseSeoul: GeoGridDataItem[], baseNational: GeoGridDataItem[], multiplier: number): { seoulData: GeoGridDataItem[]; nationalData: GeoGridDataItem[] } {
  return {
    seoulData: baseSeoul.map(d => ({ ...d, value: Math.round(d.value * multiplier + (Math.random() - 0.5) * 20) })),
    nationalData: baseNational.map(d => ({ ...d, value: Math.round(d.value * multiplier + (Math.random() - 0.5) * 15) })),
  };
}

export const MOCK_TIMEPOINT_GEO_GRID_DATA: Array<{ timepoint: string; date: string; seoulData: GeoGridDataItem[]; nationalData: GeoGridDataItem[] }> = [
  { timepoint: "2024-Q1", date: "2024-01-01", ...generateTimepointData(MOCK_SEOUL_DATA, MOCK_NATIONAL_DATA, 0.7) },
  { timepoint: "2024-Q2", date: "2024-04-01", ...generateTimepointData(MOCK_SEOUL_DATA, MOCK_NATIONAL_DATA, 0.85) },
  { timepoint: "2024-Q3", date: "2024-07-01", ...generateTimepointData(MOCK_SEOUL_DATA, MOCK_NATIONAL_DATA, 1.0) },
  { timepoint: "2024-Q4", date: "2024-10-01", ...generateTimepointData(MOCK_SEOUL_DATA, MOCK_NATIONAL_DATA, 1.1) },
  { timepoint: "2025-Q1", date: "2025-01-01", seoulData: MOCK_SEOUL_DATA, nationalData: MOCK_NATIONAL_DATA },
];

// ============================================
// Props & 색상
// ============================================
export type MapLevel = "seoul" | "national";

export interface MetricOption {
  id: string;
  label: string;
}

// 기본 지표 목록 (placeholder)
const DEFAULT_METRICS: MetricOption[] = [
  { id: "population", label: "인구수" },
  { id: "income", label: "소득" },
  { id: "leisure", label: "여가활용 만족도" },
  { id: "cultural", label: "인구 십만명당 문화기반시설수" },
];

export interface RechartsGeoGridWrapperProps {
  data?: GeoGridDataItem[];
  nationalData?: GeoGridDataItem[];
  height?: number;
  defaultMapLevel?: MapLevel;
  onTooltipChange?: (payload: { districtName: string; value: number; color: string; totalSum: number; mapLevel: MapLevel } | null) => void;
  onMapLevelChange?: (level: MapLevel) => void;
  // 지표 선택 관련
  metrics?: MetricOption[];
  selectedMetric?: string;
  onMetricChange?: (metricId: string) => void;
  onMetricLabelChange?: (label: string) => void;
  // 시점 선택 관련
  timepointData?: TimepointGeoGridData[];
  // 현재 표시 중인 데이터 콜백 (레전드용)
  onCurrentDataChange?: (data: GeoGridDataItem[]) => void;
  // 선택된 시점 콜백 (레전드용)
  onTimepointChange?: (timepoint: string | null) => void;
}

// 전국용 그라디언트 - Anthropic 브랜드 기반 (Crail)
function getHeatmapColor(value: number, min: number, max: number): string {
  if (max === min) return "rgb(193, 95, 60)";
  const t = (value - min) / (max - min);
  // #F5E0D5 (245, 224, 213) → #C15F3C (193, 95, 60) 선형 보간 (큰 색상 차이)
  const r = Math.round(245 + (193 - 245) * t);
  const g = Math.round(224 + (95 - 224) * t);
  const b = Math.round(213 + (60 - 213) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// 서울용 카키 그라디언트 - Anthropic 브랜드 기반 (Sage 계열)
function getSeoulHeatmapColor(value: number, min: number, max: number): string {
  if (max === min) return "rgb(93, 99, 82)";
  const t = (value - min) / (max - min);
  // #E8E5DD (232, 229, 221) → #5D6352 (93, 99, 82) 선형 보간 (큰 색상 차이)
  const r = Math.round(232 + (93 - 232) * t);
  const g = Math.round(229 + (99 - 229) * t);
  const b = Math.round(221 + (82 - 221) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// ============================================
// 메인 컴포넌트
// ============================================
export function RechartsGeoGridWrapper({
  data = MOCK_SEOUL_DATA,
  nationalData = MOCK_NATIONAL_DATA,
  height = 400,
  defaultMapLevel = "national",
  onTooltipChange,
  onMapLevelChange,
  metrics = DEFAULT_METRICS,
  selectedMetric,
  onMetricChange,
  onMetricLabelChange,
  timepointData,
  onCurrentDataChange,
  onTimepointChange,
}: RechartsGeoGridWrapperProps) {
  const [mapLevel, setMapLevel] = useState<MapLevel>(defaultMapLevel);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [internalMetric, setInternalMetric] = useState(selectedMetric || metrics[0]?.id || "");
  const [selectedTimepoint, setSelectedTimepoint] = useState<string | null>(null);

  // 시점 모드 여부
  const isTimepointMode = timepointData && timepointData.length > 0;

  // timepointData 변경 시 최신 시점으로 자동 설정
  useEffect(() => {
    if (timepointData && timepointData.length > 0) {
      setSelectedTimepoint(timepointData[timepointData.length - 1].timepoint);
    }
  }, [timepointData]);

  // 시점 변경 시 콜백 호출 (레전드용)
  useEffect(() => {
    onTimepointChange?.(selectedTimepoint);
  }, [selectedTimepoint, onTimepointChange]);

  const currentMetric = selectedMetric ?? internalMetric;
  const handleMetricChange = (value: string) => {
    setInternalMetric(value);
    onMetricChange?.(value);
    const label = metrics.find(m => m.id === value)?.label || "";
    onMetricLabelChange?.(label);
  };

  // 초기 마운트시 라벨 전달
  useEffect(() => {
    const label = metrics.find(m => m.id === currentMetric)?.label || "";
    onMetricLabelChange?.(label);
  }, []);

  // 시점 모드일 때 선택된 시점의 데이터 사용
  const effectiveSeoulData = useMemo(() => {
    if (isTimepointMode && selectedTimepoint) {
      const selected = timepointData.find(tp => tp.timepoint === selectedTimepoint);
      return selected?.seoulData || data;
    }
    return data;
  }, [isTimepointMode, selectedTimepoint, timepointData, data]);

  const effectiveNationalData = useMemo(() => {
    if (isTimepointMode && selectedTimepoint) {
      const selected = timepointData.find(tp => tp.timepoint === selectedTimepoint);
      return selected?.nationalData || nationalData;
    }
    return nationalData;
  }, [isTimepointMode, selectedTimepoint, timepointData, nationalData]);

  const currentData = mapLevel === "seoul" ? effectiveSeoulData : effectiveNationalData;

  const { minValue, maxValue, dataMap, totalSum } = useMemo(() => {
    const values = currentData.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const map = new Map(currentData.map(d => [d.districtId, d]));
    return { minValue: min, maxValue: max, dataMap: map, totalSum: sum };
  }, [currentData]);

  // 현재 데이터 변경 시 콜백 호출 (레전드용)
  useEffect(() => {
    onCurrentDataChange?.(currentData);
  }, [currentData, onCurrentDataChange]);

  const handleMouseEnter = useCallback((districtId: string) => {
    setHoveredDistrict(districtId);
    const item = dataMap.get(districtId);
    if (item && onTooltipChange) {
      const color = mapLevel === "seoul"
        ? getSeoulHeatmapColor(item.value, minValue, maxValue)
        : getHeatmapColor(item.value, minValue, maxValue);
      onTooltipChange({ districtName: item.districtName, value: item.value, color, totalSum, mapLevel });
    }
  }, [dataMap, onTooltipChange, mapLevel, minValue, maxValue, totalSum]);

  const handleMouseLeave = useCallback(() => {
    setHoveredDistrict(null);
    onTooltipChange?.(null);
  }, [onTooltipChange]);

  const handleHanRiverMouseEnter = useCallback(() => {
    setHoveredDistrict("han-river");
    if (onTooltipChange) {
      onTooltipChange({
        districtName: "한강",
        value: 0,
        color: "#9DBFCE",  // Anthropic 스타일 스카이 블루
        totalSum,
        mapLevel: "seoul"
      });
    }
  }, [onTooltipChange, totalSum]);

  // 지표 선택 드롭다운 (멀티레벨트리맵 스타일)
  const MetricSelector = () => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">지표:</span>
      <Select value={currentMetric} onValueChange={handleMetricChange}>
        <SelectTrigger className="w-32 h-8 text-xs">
          <SelectValue placeholder="지표 선택" />
        </SelectTrigger>
        <SelectContent>
          {metrics.map((metric) => (
            <SelectItem
              key={metric.id}
              value={metric.id}
              className="text-xs"
            >
              {metric.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // 토글 스위치 (이중축 스타일)
  const ToggleSwitch = () => (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={mapLevel === "seoul" ? "text-muted-foreground" : "text-muted-foreground/60"}>서울</span>
      <button
        onClick={() => {
          const newLevel = mapLevel === "seoul" ? "national" : "seoul";
          setMapLevel(newLevel);
          onMapLevelChange?.(newLevel);
        }}
        className={`relative w-6 h-3.5 rounded-full transition-colors ${
          mapLevel === "national" ? "bg-muted-foreground" : "bg-muted-foreground/30"
        }`}
      >
        <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-transform ${
          mapLevel === "national" ? "translate-x-[12px]" : "translate-x-0.5"
        }`} />
      </button>
      <span className={mapLevel === "national" ? "text-muted-foreground" : "text-muted-foreground/60"}>전국</span>
    </div>
  );

  // 시점 선택 드롭다운 (멀티레벨트리맵 스타일)
  const TimepointSelector = () => {
    if (!isTimepointMode) return null;
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">시점:</span>
        <Select value={selectedTimepoint || ""} onValueChange={setSelectedTimepoint}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="시점 선택" />
          </SelectTrigger>
          <SelectContent>
            {timepointData!.map(tp => (
              <SelectItem
                key={tp.timepoint}
                value={tp.timepoint}
                className="text-xs"
              >
                {tp.timepoint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  // 상단 컨트롤 (지표 선택 + 토글 + 시점)
  const Controls = () => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-6">
        <MetricSelector />
        <div>
          <ToggleSwitch />
        </div>
      </div>
      <TimepointSelector />
    </div>
  );

  // 서울시 렌더링
  if (mapLevel === "seoul") {
    const cellSize = Math.min((height - 30) / SEOUL_GRID_ROWS, 48);
    const gap = 3;
    const svgWidth = SEOUL_GRID_COLS * (cellSize + gap);
    const svgHeight = SEOUL_GRID_ROWS * (cellSize + gap);

    return (
      <div style={{ position: 'relative', height }}>
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
          <Controls />
        </div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <svg width={svgWidth} height={svgHeight} role="img" aria-label="서울시 구별 지도 차트">
            {/* 한강 셀 렌더링 */}
            <g
              onMouseEnter={handleHanRiverMouseEnter}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: 'pointer' }}
            >
              {HAN_RIVER_CELLS.map((cell, idx) => {
                const x = cell.col * (cellSize + gap);
                const y = cell.row * (cellSize + gap);
                const isHovered = hoveredDistrict === "han-river";
                return (
                  <rect
                    key={`han-river-${idx}`}
                    x={x}
                    y={y}
                    width={cellSize}
                    height={cellSize}
                    fill="#9DBFCE"
                    stroke={isHovered ? "#444" : "transparent"}
                    strokeWidth={isHovered ? 2 : 0}
                  />
                );
              })}
            </g>
            {Object.entries(SEOUL_DISTRICTS_GRID).map(([districtId, { col, row, nameKo }]) => {
              const item = dataMap.get(districtId);
              const value = item?.value ?? 0;
              const x = col * (cellSize + gap);
              const y = row * (cellSize + gap);
              const color = getSeoulHeatmapColor(value, minValue, maxValue);
              const isHovered = hoveredDistrict === districtId;

              return (
                <g
                  key={districtId}
                  transform={`translate(${x}, ${y})`}
                  onMouseEnter={() => handleMouseEnter(districtId)}
                  onMouseLeave={handleMouseLeave}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width={cellSize}
                    height={cellSize}
                    fill={color}
                    stroke={isHovered ? "#444" : "transparent"}
                    strokeWidth={isHovered ? 2 : 0}
                  />
                  <text
                    x={cellSize / 2}
                    y={cellSize / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="hsl(var(--foreground))"
                    fontSize={cellSize > 40 ? 11 : 9}
                    fontWeight={500}
                    style={{ pointerEvents: 'none' }}
                  >
                    {nameKo}
                  </text>
                </g>
              );
            })}
            </svg>
          </div>
      </div>
    );
  }

  // 전국 렌더링 (멀티셀 병합)
  const cellSize = Math.min((height - 30) / NATIONAL_GRID_ROWS, 38);
  const gap = 0;
  const svgWidth = NATIONAL_GRID_COLS * (cellSize + gap);
  const svgHeight = NATIONAL_GRID_ROWS * (cellSize + gap);

  return (
    <div style={{ position: 'relative', height }}>
      <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
        <Controls />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <svg width={svgWidth} height={svgHeight} role="img" aria-label="전국 광역시도 지도 차트">
        {Object.entries(KOREA_REGIONS_GRID).map(([regionId, { cells, nameKo }]) => {
          const item = dataMap.get(regionId);
          const value = item?.value ?? 0;
          const color = getHeatmapColor(value, minValue, maxValue);
          const isHovered = hoveredDistrict === regionId;

          // 셀들의 bounding box 계산
          const minCol = Math.min(...cells.map(c => c.col));
          const maxCol = Math.max(...cells.map(c => c.col));
          const minRow = Math.min(...cells.map(c => c.row));
          const maxRow = Math.max(...cells.map(c => c.row));

          // 중심점 계산 (특수 케이스 처리)
          let centerX = ((minCol + maxCol + 1) / 2) * cellSize;
          let centerY = ((minRow + maxRow + 1) / 2) * cellSize;

          // 경기: 서울과 겹치므로 좌상단(row1)으로 이동
          if (regionId === "Gyeonggi") {
            centerX = (2.5) * cellSize;
            centerY = (1.5) * cellSize;
          }
          // 충북: L자 형태라 빈 공간에 중심이 있으므로 실제 셀 위치로 이동
          if (regionId === "Chungbuk") {
            centerX = (4.5) * cellSize;
            centerY = (4.5) * cellSize;
          }

          // 셀 좌표 Set 생성 (인접 체크용)
          const cellSet = new Set(cells.map(c => `${c.col},${c.row}`));

          return (
            <g
              key={regionId}
              onMouseEnter={() => handleMouseEnter(regionId)}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: 'pointer' }}
            >
              {/* 각 셀 렌더링 */}
              {cells.map((cell, idx) => {
                const x = cell.col * cellSize;
                const y = cell.row * cellSize;

                // 인접 셀 체크 (외곽선 결정용)
                const hasTop = cellSet.has(`${cell.col},${cell.row - 1}`);
                const hasBottom = cellSet.has(`${cell.col},${cell.row + 1}`);
                const hasLeft = cellSet.has(`${cell.col - 1},${cell.row}`);
                const hasRight = cellSet.has(`${cell.col + 1},${cell.row}`);

                return (
                  <g key={idx}>
                    <rect
                      x={x}
                      y={y}
                      width={cellSize}
                      height={cellSize}
                      fill={color}
                    />
                    {/* 호버 시 외곽 edge만 표시 */}
                    {isHovered && (
                      <>
                        {!hasTop && (
                          <line x1={x} y1={y} x2={x + cellSize} y2={y}
                            stroke="#444" strokeWidth={2} />
                        )}
                        {!hasBottom && (
                          <line x1={x} y1={y + cellSize} x2={x + cellSize} y2={y + cellSize}
                            stroke="#444" strokeWidth={2} />
                        )}
                        {!hasLeft && (
                          <line x1={x} y1={y} x2={x} y2={y + cellSize}
                            stroke="#444" strokeWidth={2} />
                        )}
                        {!hasRight && (
                          <line x1={x + cellSize} y1={y} x2={x + cellSize} y2={y + cellSize}
                            stroke="#444" strokeWidth={2} />
                        )}
                      </>
                    )}
                  </g>
                );
              })}
              {/* 텍스트는 중앙에 한 번만 (지역명만 표시) */}
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="hsl(var(--foreground))"
                fontSize={10}
                fontWeight={600}
                style={{ pointerEvents: 'none' }}
              >
                {nameKo}
              </text>
            </g>
          );
        })}
          </svg>
        </div>
    </div>
  );
}
