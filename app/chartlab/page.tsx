"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChartType, ChartStyle, ChartData, CartesianPoint, CartesianStyle, OHLCPoint } from "@/packages/chart-lib/types";
import { Page, Panel } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { fetchSamsungSecuritiesOhlcv, toLightweightCandlesChartData } from "./query";
import { ChartBlockCard } from "./chart-block-card";
// ─── Types ───

interface ChartBlock {
  id: number;
  title: string;
  chartType: ChartType;
  style: ChartStyle;
  data: ChartData;
  collapsed: boolean;
}


// ─── Demo data generator ───
type SampleRow = {
  date: string;
  date_display: string;
  GDP: number;
  제조업: number;
  서비스업: number;
  암호화폐: number;
  스타트업투자: number;
};

const SAMPLE_ROW_DATA: SampleRow[] = [
  {
    "date": "2022-03-31T00:00:00+09:00",
    "date_display": "2022-Q1",
    "GDP": 0.4,
    "제조업": 4.4,
    "서비스업": 100,
    "암호화폐": 50,
    "스타트업투자": 30
  },
  {
    "date": "2022-06-30T00:00:00+09:00",
    "date_display": "2022-Q2",
    "GDP": 0.9,
    "제조업": 3.7,
    "서비스업": 120,
    "암호화폐": 45,
    "스타트업투자": 25
  },
  {
    "date": "2022-09-30T00:00:00+09:00",
    "date_display": "2022-Q3",
    "GDP": 0.5,
    "제조업": 4.2,
    "서비스업": 100,
    "암호화폐": 55,
    "스타트업투자": 35
  },
  {
    "date": "2022-12-31T00:00:00+09:00",
    "date_display": "2022-Q4",
    "GDP": -0.4,
    "제조업": -2.1,
    "서비스업": 80,
    "암호화폐": -380,
    "스타트업투자": 28
  },
  {
    "date": "2023-03-31T00:00:00+09:00",
    "date_display": "2023-Q1",
    "GDP": 0.4,
    "제조업": -3.1,
    "서비스업": 140,
    "암호화폐": 60,
    "스타트업투자": 40
  },
  {
    "date": "2023-06-30T00:00:00+09:00",
    "date_display": "2023-Q2",
    "GDP": 0.7,
    "제조업": 0.3,
    "서비스업": 100,
    "암호화폐": 48,
    "스타트업투자": -420
  },
  {
    "date": "2023-09-30T00:00:00+09:00",
    "date_display": "2023-Q3",
    "GDP": 0.8,
    "제조업": 1.4,
    "서비스업": 100,
    "암호화폐": 52,
    "스타트업투자": 32
  },
  {
    "date": "2023-12-31T00:00:00+09:00",
    "date_display": "2023-Q4",
    "GDP": 0.5,
    "제조업": 7.0,
    "서비스업": 120,
    "암호화폐": 58,
    "스타트업투자": 38
  },
  {
    "date": "2024-03-31T00:00:00+09:00",
    "date_display": "2024-Q1",
    "GDP": 1.2,
    "제조업": 6.7,
    "서비스업": 160,
    "암호화폐": 65,
    "스타트업투자": 42
  },
  {
    "date": "2024-06-30T00:00:00+09:00",
    "date_display": "2024-Q2",
    "GDP": -0.2,
    "제조업": 5.4,
    "서비스업": 120,
    "암호화폐": 47,
    "스타트업투자": 27
  },
  {
    "date": "2024-09-30T00:00:00+09:00",
    "date_display": "2024-Q3",
    "GDP": 0.1,
    "제조업": 3.5,
    "서비스업": 650,
    "암호화폐": 53,
    "스타트업투자": 33
  },
  {
    "date": "2024-12-31T00:00:00+09:00",
    "date_display": "2024-Q4",
    "GDP": 0.1,
    "제조업": 2.0,
    "서비스업": 100,
    "암호화폐": 56,
    "스타트업투자": 36
  },
  {
    "date": "2025-03-31T00:00:00+09:00",
    "date_display": "2025-Q1",
    "GDP": -0.2,
    "제조업": 0.4,
    "서비스업": 100,
    "암호화폐": 49,
    "스타트업투자": 29
  },
  {
    "date": "2025-06-30T00:00:00+09:00",
    "date_display": "2025-Q2",
    "GDP": 0.7,
    "제조업": 2.1,
    "서비스업": 100,
    "암호화폐": 54,
    "스타트업투자": 34
  },
  {
    "date": "2025-09-30T00:00:00+09:00",
    "date_display": "2025-Q3",
    "GDP": 1.2,
    "제조업": 3.3,
    "서비스업": 100,
    "암호화폐": 500,
    "스타트업투자": 40
  }
];

type ProductionCapacityRow = {
  date: string;
  date_display: string;
  dx_tv: number;
  dx_smartphone: number;
  ds_memory: number;
  sdc_panel: number;
  harman_cockpit: number;
};

const PRODUCTION_CAPACITY_ROW_DATA: ProductionCapacityRow[] = [
  {
    date: "2023-12-31T00:00:00+09:00",
    date_display: "제54기",
    dx_tv: 50000,
    dx_smartphone: 200000,
    ds_memory: 1905000000,
    sdc_panel: 2700,
    harman_cockpit: 11257,
  },
  {
    date: "2024-12-31T00:00:00+09:00",
    date_display: "제55기",
    dx_tv: 55000,
    dx_smartphone: 220000,
    ds_memory: 1926000000,
    sdc_panel: 2320,
    harman_cockpit: 10912,
  },
  {
    date: "2025-12-31T00:00:00+09:00",
    date_display: "제56기",
    dx_tv: 50000,
    dx_smartphone: 200000,
    ds_memory: 2238240000,
    sdc_panel: 2254,
    harman_cockpit: 8520,
  },
];

const PRODUCTION_CAPACITY_GROUP_ASSIGNMENTS: Record<string, number> = {
  dx_tv: 1,
  dx_smartphone: 1,
  ds_memory: 2,
  sdc_panel: 3,
  harman_cockpit: 4,
};

const PRODUCTION_CAPACITY_AXIS_PLACEMENTS: Record<string, "left" | "right"> = {
  dx_tv: "right",
  dx_smartphone: "right",
  ds_memory: "left",
  sdc_panel: "right",
  harman_cockpit: "right",
};

const PRODUCTION_CAPACITY_Y_FIELD_TYPES: Record<string, "column" | "line"> = {
  dx_tv: "column",
  dx_smartphone: "column",
  ds_memory: "column",
  sdc_panel: "column",
  harman_cockpit: "column",
};

const PRODUCTION_CAPACITY_ENABLED_FIELDS: Record<string, boolean> = {
  dx_tv: true,
  dx_smartphone: true,
  ds_memory: true,
  sdc_panel: true,
  harman_cockpit: true,
};

type CoreGridTradeRow = {
  date: string;
  action: "Buy" | "Sell";
  value: string;
  name: string;
  entity: string;
  role: string;
  shares: number;
  maxPrice: string;
};

const CORE_GRID_SAMPLE_ROWS: CoreGridTradeRow[] = [
  {
    date: "2025-12-09",
    action: "Sell",
    value: "US$25,606,501",
    name: "Kimbal Musk",
    entity: "Individual",
    role: "Director",
    shares: 56820,
    maxPrice: "US$450.66",
  },
  {
    date: "2025-09-12",
    action: "Buy",
    value: "US$999,959,042",
    name: "Elon Musk",
    entity: "Individual",
    role: "Executive",
    shares: 2568732,
    maxPrice: "US$396.36",
  },
  {
    date: "2025-09-11",
    action: "Sell",
    value: "US$7,275,100",
    name: "Xiaotong Zhu",
    entity: "Individual",
    role: "Director",
    shares: 20000,
    maxPrice: "US$363.76",
  },
  {
    date: "2025-04-24",
    action: "Buy",
    value: "US$1,025,232",
    name: "Joseph Gebbia",
    entity: "Individual",
    role: "Director",
    shares: 4000,
    maxPrice: "US$256.31",
  },
];

// geo-grid mock data (ported from chartCore-src)
type GeoGridDataItem = { districtId: string; districtName: string; value: number };
type GeoGridTimepoint = { timepoint: string; date: string; seoulData: GeoGridDataItem[]; nationalData: GeoGridDataItem[] };

const MOCK_SEOUL_DATA: GeoGridDataItem[] = [
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

const MOCK_NATIONAL_DATA: GeoGridDataItem[] = [
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

function generateGeoGridTimepointData(
  baseSeoul: GeoGridDataItem[],
  baseNational: GeoGridDataItem[],
  multiplier: number
): { seoulData: GeoGridDataItem[]; nationalData: GeoGridDataItem[] } {
  return {
    seoulData: baseSeoul.map((d) => ({ ...d, value: Math.round(d.value * multiplier + (Math.random() - 0.5) * 20) })),
    nationalData: baseNational.map((d) => ({ ...d, value: Math.round(d.value * multiplier + (Math.random() - 0.5) * 15) })),
  };
}

const GEO_GRID_TIMEPOINT_DATA: GeoGridTimepoint[] = [
  { timepoint: "2024-Q1", date: "2024-01-01", ...generateGeoGridTimepointData(MOCK_SEOUL_DATA, MOCK_NATIONAL_DATA, 0.7) },
  { timepoint: "2024-Q2", date: "2024-04-01", ...generateGeoGridTimepointData(MOCK_SEOUL_DATA, MOCK_NATIONAL_DATA, 0.85) },
  { timepoint: "2024-Q3", date: "2024-07-01", ...generateGeoGridTimepointData(MOCK_SEOUL_DATA, MOCK_NATIONAL_DATA, 1.0) },
  { timepoint: "2024-Q4", date: "2024-10-01", ...generateGeoGridTimepointData(MOCK_SEOUL_DATA, MOCK_NATIONAL_DATA, 1.1) },
  { timepoint: "2025-Q1", date: "2025-01-01", seoulData: MOCK_SEOUL_DATA, nationalData: MOCK_NATIONAL_DATA },
];

function generateDemoData(chartType: ChartType): ChartData {
  const categories = ["1월", "2월", "3월", "4월", "5월", "6월"];
  const makeSeries = (name: string, base: number, variance: number) => ({
    id: name,
    name,
    data: categories.map((cat, i) => ({
      x: cat,
      y: Math.round(base + Math.sin(i * 0.8) * variance + Math.random() * variance * 0.3),
    })) as CartesianPoint[],
  });

  const rowFields = Object.keys(SAMPLE_ROW_DATA[0] ?? {}).filter(
    (key) => key !== "date" && key !== "date_display"
  ) as Array<keyof Omit<SampleRow, "date" | "date_display">>;

  const toSeriesData = (options?: { useAbs?: boolean }) =>
    rowFields.map((field) => ({
      id: field,
      name: field,
      data: SAMPLE_ROW_DATA.map((row) => ({
        x: row.date_display,
        y: options?.useAbs ? Math.abs(row[field]) : row[field],
      })) as CartesianPoint[],
    }));

  if (chartType === "lightweight/candles") {
    const now = new Date();
    const oneYearAgo = new Date(now);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const points: OHLCPoint[] = [];
    let previousClose = 100;

    for (let date = new Date(oneYearAgo); date <= now; date.setDate(date.getDate() + 1)) {
      const day = date.getDay();
      if (day === 0 || day === 6) continue;

      const open = Math.max(1, previousClose * (1 + (Math.random() - 0.5) * 0.03));
      const close = Math.max(1, open * (1 + (Math.random() - 0.5) * 0.04));
      const high = Math.max(open, close) * (1 + Math.random() * 0.015);
      const low = Math.max(0.1, Math.min(open, close) * (1 - Math.random() * 0.015));
      const volume = Math.round(300000 + Math.random() * 1700000);
      const turnover = Math.round(close * volume);
      previousClose = close;

      points.push({
        x: date.getTime(),
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume,
        turnover,
      });
    }

    return {
      xAxisType: "datetime",
      series: [
        {
          id: "lightweight-candles",
          name: "캔들",
          data: points,
        },
      ],
    };
  }

  if (chartType === "recharts/geo-grid") {
    // geo-grid is a dedicated data shape.
    return {
      xAxisType: "category",
      series: [
        {
          id: "geo-grid",
          name: "지도 데이터",
          data: GEO_GRID_TIMEPOINT_DATA as unknown as CartesianPoint[],
        },
      ],
    };
  }

  if (chartType === "recharts/regression-scatter") {
    return {
      xAxisType: "category",
      series: toSeriesData(),
    };
  }

  if (chartType === "recharts/pie") {
    return {
      xAxisType: "category",
      series: [
        ...toSeriesData({ useAbs: true }),
      ],
    };
  }

  if (chartType === "recharts/grouped-bar") {
    return {
      xAxisType: "category",
      series: [
        {
          id: "short-term",
          name: "Short Term",
          data: [
            { x: "Assets", y: 68.64 },
            { x: "Liabilities", y: 31.71 },
          ] as CartesianPoint[],
        },
        {
          id: "long-term",
          name: "Long Term",
          data: [
            { x: "Assets", y: 69.16 },
            { x: "Liabilities", y: 23.23 },
          ] as CartesianPoint[],
        },
      ],
    };
  }

  if (chartType === "recharts/dual-axis-stacked-bar") {
    return {
      xAxisType: "category",
      series: [
        {
          id: "production-capacity",
          name: "생산능력",
          data: PRODUCTION_CAPACITY_ROW_DATA as unknown as CartesianPoint[],
        },
      ],
    };
  }

  if (chartType === "chartCore/dual-axis-stacked-bar") {
    return {
      xAxisType: "category",
      series: [
        {
          id: "chartcore-dual-axis-stacked-bar",
          name: "ChartCore/이중축 그룹형 누적 막대",
          data: PRODUCTION_CAPACITY_ROW_DATA as unknown as CartesianPoint[],
        },
      ],
    };
  }

  if (chartType === "core/grid" || chartType === "core/insider-trading") {
    // Core 표/내부자거래 차트가 동일 row-object 데이터를 공유한다.
    return {
      xAxisType: "category",
      series: [
        {
          id: "core-grid",
          name: "내부자 거래",
          data: CORE_GRID_SAMPLE_ROWS as unknown as CartesianPoint[],
        },
      ],
    };
  }

  if (
    chartType === "chartCore/line" ||
    chartType === "chartCore/column" ||
    chartType === "chartCore/stacked" ||
    chartType === "chartCore/stacked-100" ||
    chartType === "chartCore/stacked-grouped" ||
    chartType === "chartCore/dual-axis" ||
    chartType === "chartCore/mixed" ||
    chartType === "chartCore/area" ||
    chartType === "chartCore/area-100" ||
    chartType === "chartCore/stacked-area" ||
    chartType === "chartCore/synced-area" ||
    chartType === "chartCore/pie" ||
    chartType === "chartCore/two-level-pie" ||
    chartType === "chartCore/treemap" ||
    chartType === "chartCore/multi-level-treemap" ||
    chartType === "chartCore/ranking-bar" ||
    chartType === "chartCore/geo-grid" ||
    chartType === "chartCore/regression-scatter"
  ) {
    return {
      xAxisType: "category",
      series: [
        {
          id:
            chartType === "chartCore/synced-area"
              ? "chartcore-synced-area"
              : chartType === "chartCore/regression-scatter"
                ? "chartcore-regression-scatter"
                : chartType === "chartCore/geo-grid"
                  ? "chartcore-geo-grid"
                  : chartType === "chartCore/ranking-bar"
                    ? "chartcore-ranking-bar"
                    : chartType === "chartCore/multi-level-treemap"
                      ? "chartcore-multi-level-treemap"
                      : chartType === "chartCore/treemap"
                        ? "chartcore-treemap"
                        : chartType === "chartCore/two-level-pie"
                          ? "chartcore-two-level-pie"
                          : chartType === "chartCore/pie"
                            ? "chartcore-pie"
                            : chartType === "chartCore/dual-axis"
                              ? "chartcore-dual-axis"
                              : chartType === "chartCore/stacked-grouped"
                                ? "chartcore-stacked-grouped"
                                : chartType === "chartCore/stacked-100"
                                  ? "chartcore-stacked-100"
                                  : chartType === "chartCore/stacked"
                                    ? "chartcore-stacked"
                                    : chartType === "chartCore/mixed"
                                      ? "chartcore-mixed"
                                      : chartType === "chartCore/column"
                                        ? "chartcore-column"
                                        : chartType === "chartCore/stacked-area"
                                          ? "chartcore-stacked-area"
                                          : chartType === "chartCore/area-100"
                                            ? "chartcore-area-100"
                                            : chartType === "chartCore/area"
                                              ? "chartcore-area"
                                              : "chartcore-line",
          name:
            chartType === "chartCore/synced-area"
              ? "ChartCore/동기화 영역"
              : chartType === "chartCore/regression-scatter"
                ? "ChartCore/회귀 산점도"
                : chartType === "chartCore/geo-grid"
                  ? "ChartCore/지오그리드"
                  : chartType === "chartCore/ranking-bar"
                    ? "ChartCore/랭킹 막대"
                    : chartType === "chartCore/multi-level-treemap"
                      ? "ChartCore/멀티레벨 트리맵"
                      : chartType === "chartCore/treemap"
                        ? "ChartCore/트리맵"
                        : chartType === "chartCore/two-level-pie"
                          ? "ChartCore/이중 파이"
                          : chartType === "chartCore/pie"
                            ? "ChartCore/원형"
                            : chartType === "chartCore/dual-axis"
                              ? "ChartCore/이중축"
                              : chartType === "chartCore/stacked-grouped"
                                ? "ChartCore/그룹형 누적 막대"
                                : chartType === "chartCore/stacked-100"
                                  ? "ChartCore/100% 누적 막대"
                                  : chartType === "chartCore/stacked"
                                    ? "ChartCore/누적 막대"
                                    : chartType === "chartCore/mixed"
                                      ? "ChartCore/혼합"
                                      : chartType === "chartCore/column"
                                        ? "ChartCore/막대"
                                        : chartType === "chartCore/stacked-area"
                                          ? "ChartCore/누적 영역"
                                          : chartType === "chartCore/area-100"
                                            ? "ChartCore/100% 영역"
                                            : chartType === "chartCore/area"
                                              ? "ChartCore/영역"
                                              : "ChartCore/라인",
          data: SAMPLE_ROW_DATA as unknown as CartesianPoint[],
        },
      ],
    };
  }

  if (
    chartType === "highcharts/gauge" ||
    chartType === "recharts/line" ||
    chartType === "recharts/column" ||
    chartType === "recharts/area" ||
    chartType === "recharts/area-100" ||
    chartType === "recharts/stacked-area" ||
    chartType === "recharts/ownership-stacked" ||
    chartType === "recharts/gauge" ||
    chartType === "recharts/value-conversion-bridge" ||
    chartType === "recharts/sankey-diagram" ||
    chartType === "recharts/stacked" ||
    chartType === "recharts/stacked-100" ||
    chartType === "recharts/synced-area" ||
    chartType === "recharts/mixed" ||
    chartType === "recharts/two-level-pie" ||
    chartType === "recharts/treemap" ||
    chartType === "recharts/multi-level-treemap" ||
    chartType === "recharts/ranking-bar" ||
    chartType === "recharts/dual-axis" ||
    chartType === "recharts/stacked-grouped" ||
    chartType === "recharts/radar"
  ) {
    const useAbs =
      chartType === "recharts/area-100" ||
      chartType === "recharts/stacked-area" ||
      chartType === "recharts/stacked-100" ||
      chartType === "recharts/two-level-pie" ||
      chartType === "recharts/treemap" ||
      chartType === "recharts/multi-level-treemap" ||
      chartType === "recharts/stacked-grouped";

    return {
      xAxisType: "category",
      series: toSeriesData({ useAbs }),
    };
  }

  if (chartType === "pie") {
    return {
      xAxisType: "category",
      series: [{
        id: "pie-1",
        name: "비중",
        data: [
          { x: "A 항목", y: 35 },
          { x: "B 항목", y: 25 },
          { x: "C 항목", y: 20 },
          { x: "D 항목", y: 12 },
          { x: "E 항목", y: 8 },
        ] as CartesianPoint[],
      }],
    };
  }

  return {
    xAxisType: "category",
    series: [
      makeSeries("시리즈 A", 100, 30),
      makeSeries("시리즈 B", 70, 20),
    ],
  };
}

function getDefaultStyleForChartType(chartType: ChartType, previousStyle?: ChartStyle): ChartStyle | undefined {
  if (chartType !== "recharts/dual-axis-stacked-bar") return undefined;

  const base = (previousStyle as CartesianStyle | undefined) ?? {};
  return {
    ...base,
    legend: base.legend ?? { position: "bottom" },
    tooltip: base.tooltip ?? { shared: true },
    timepointLine: {
      ...(base.timepointLine ?? {}),
      showOutliers: false,
      enabled: {
        ...PRODUCTION_CAPACITY_ENABLED_FIELDS,
        ...(base.timepointLine?.enabled ?? {}),
      },
    },
    stackedGrouped: {
      ...(base.stackedGrouped ?? {}),
      groupCount: 4,
      assignments: {
        ...PRODUCTION_CAPACITY_GROUP_ASSIGNMENTS,
        ...(base.stackedGrouped?.assignments ?? {}),
      },
    },
    dualAxis: {
      ...(base.dualAxis ?? {}),
      placements: {
        ...PRODUCTION_CAPACITY_AXIS_PLACEMENTS,
        ...(base.dualAxis?.placements ?? {}),
      },
      yFieldTypes: {
        ...PRODUCTION_CAPACITY_Y_FIELD_TYPES,
        ...(base.dualAxis?.yFieldTypes ?? {}),
      },
    },
  } as ChartStyle;
}

let nextBlockId = 1;

function createChartBlock(chartType: ChartType = "line", title?: string): ChartBlock {
  const id = nextBlockId++;
  return {
    id,
    title: title || `차트 #${id}`,
    chartType,
    style: { legend: { position: "bottom" }, tooltip: { shared: true } },
    data: generateDemoData(chartType),
    collapsed: false,
  };
}

// ─── Component ───

export default function ChartLabPage() {
  const supabase = useMemo(() => createClient(), []);

  // Chart blocks (center panel editing)
  const [blocks, setBlocks] = useState<ChartBlock[]>(() => [createChartBlock("line", "샘플 차트")]);
  const [activeBlockId, setActiveBlockId] = useState<number | null>(null);

  const [samsungOhlcvData, setSamsungOhlcvData] = useState<ChartData | null>(null);
  const [samsungOhlcvLoaded, setSamsungOhlcvLoaded] = useState(false);
  const [samsungOhlcvError, setSamsungOhlcvError] = useState<string | null>(null);

  useEffect(() => {
    let isDisposed = false;

    async function loadSamsungOhlcv() {
      const { points, error } = await fetchSamsungSecuritiesOhlcv(supabase);
      if (isDisposed) return;

      setSamsungOhlcvError(error);
      if (points.length === 0) {
        setSamsungOhlcvData(null);
        setSamsungOhlcvLoaded(true);
        return;
      }

      const chartData = toLightweightCandlesChartData(points);
      setSamsungOhlcvData(chartData);
      setBlocks((prev) =>
        prev.map((block) =>
          block.chartType === "lightweight/candles"
            ? { ...block, data: chartData }
            : block
        )
      );
      setSamsungOhlcvLoaded(true);
    }

    loadSamsungOhlcv();

    return () => {
      isDisposed = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!samsungOhlcvError) return;
    console.warn(`[ChartLab] 삼성증권 OHLCV 로딩 실패: ${samsungOhlcvError}`);
  }, [samsungOhlcvError]);

  // ─── Block actions ───

  const addBlock = useCallback(() => {
    const block = createChartBlock();
    setBlocks((prev) => [...prev, block]);
    setActiveBlockId(block.id);
  }, []);

  const removeBlock = useCallback((id: number) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    setActiveBlockId((prev) => (prev === id ? null : prev));
  }, []);

  const duplicateBlock = useCallback((id: number) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      const dup = createChartBlock(src.chartType, `${src.title} (복사)`);
      dup.style = { ...src.style };
      dup.data = { ...src.data };
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((id: number) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, collapsed: !b.collapsed } : b))
    );
  }, []);

  const updateBlock = useCallback((id: number, patch: Partial<ChartBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }, []);

  const handleChartTypeChange = useCallback((id: number, type: ChartType) => {
    if (type === "lightweight/candles" && samsungOhlcvLoaded && samsungOhlcvData) {
      updateBlock(id, { chartType: type, data: samsungOhlcvData });
      return;
    }

    setBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        const defaultStyle = getDefaultStyleForChartType(type, block.style);
        return {
          ...block,
          chartType: type,
          data: generateDemoData(type),
          style: defaultStyle ?? block.style,
        };
      })
    );
  }, [updateBlock, samsungOhlcvData, samsungOhlcvLoaded]);

  return (
    <Page direction="horizontal">
      {/* ═══ Center Panel ═══ */}
      <Panel variant="flex" className="flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-medium text-foreground">차트랩</h1>
            <Button size="sm" onClick={addBlock}>
              + 새 차트 추가
            </Button>
          </div>
        </div>

        {/* Chart blocks scroll area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {blocks.map((block) => (
            <ChartBlockCard
              key={block.id}
              block={block}
              isActive={activeBlockId === block.id}
              onActivate={() => setActiveBlockId(block.id)}
              onToggleCollapse={() => toggleCollapse(block.id)}
              onDuplicate={() => duplicateBlock(block.id)}
              onDelete={() => removeBlock(block.id)}
              onTitleChange={(title) => updateBlock(block.id, { title })}
              onChartTypeChange={(type) => handleChartTypeChange(block.id, type)}
              onStyleChange={(style) => updateBlock(block.id, { style })}
            />
          ))}

          {blocks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-sm gap-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" className="text-muted-foreground/40">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              차트가 없습니다. 새 차트를 추가하세요.
            </div>
          )}
        </div>
      </Panel>
    </Page>
  );
}
