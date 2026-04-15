"use client";

import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import type { ChartData, ChartStyle, GeoGridStyle, CartesianStyle } from "../types";

// Ported (minimal) from chartCore-src's recharts-geo-grid-wrapper.tsx.

type GeoGridDataItem = {
  districtId: string;
  districtName: string;
  value: number;
};

type GeoGridTimepoint = {
  timepoint: string;
  date?: string;
  seoulData: GeoGridDataItem[];
  nationalData: GeoGridDataItem[];
};

const DEFAULT_METRICS: Array<{ id: string; label: string }> = [
  { id: "population", label: "인구수" },
  { id: "income", label: "소득" },
  { id: "leisure", label: "여가활용 만족도" },
  { id: "cultural", label: "인구 십만명당 문화기반시설수" },
];

const SEOUL_DISTRICTS_GRID: Record<string, { col: number; row: number; nameKo: string }> = {
  "Dobong-gu": { col: 5, row: 0, nameKo: "도봉구" },
  "Gangbuk-gu": { col: 5, row: 1, nameKo: "강북구" },
  "Eunpyeong-gu": { col: 3, row: 2, nameKo: "은평구" },
  "Jongno-gu": { col: 4, row: 2, nameKo: "종로구" },
  "Seongbuk-gu": { col: 5, row: 2, nameKo: "성북구" },
  "Nowon-gu": { col: 6, row: 2, nameKo: "노원구" },
  "Seodaemun-gu": { col: 3, row: 3, nameKo: "서대문구" },
  "Jung-gu": { col: 4, row: 3, nameKo: "중구" },
  "Dongdaemun-gu": { col: 5, row: 3, nameKo: "동대문구" },
  "Jungnang-gu": { col: 6, row: 3, nameKo: "중랑구" },
  "Mapo-gu": { col: 3, row: 4, nameKo: "마포구" },
  "Yongsan-gu": { col: 4, row: 4, nameKo: "용산구" },
  "Seongdong-gu": { col: 5, row: 4, nameKo: "성동구" },
  "Gwangjin-gu": { col: 6, row: 4, nameKo: "광진구" },
  "Gangseo-gu": { col: 1, row: 5, nameKo: "강서구" },
  "Gangdong-gu": { col: 8, row: 5, nameKo: "강동구" },
  "Yangcheon-gu": { col: 2, row: 6, nameKo: "양천구" },
  "Yeongdeungpo-gu": { col: 3, row: 6, nameKo: "영등포구" },
  "Dongjak-gu": { col: 4, row: 6, nameKo: "동작구" },
  "Seocho-gu": { col: 5, row: 6, nameKo: "서초구" },
  "Gangnam-gu": { col: 6, row: 6, nameKo: "강남구" },
  "Songpa-gu": { col: 7, row: 6, nameKo: "송파구" },
  "Guro-gu": { col: 2, row: 7, nameKo: "구로구" },
  "Geumcheon-gu": { col: 3, row: 7, nameKo: "금천구" },
  "Gwanak-gu": { col: 4, row: 7, nameKo: "관악구" },
};

const SEOUL_GRID_COLS = 10;
const SEOUL_GRID_ROWS = 8;

const HAN_RIVER_CELLS = [
  { col: 0, row: 4 },
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
  { col: 9, row: 4 },
];

const KOREA_REGIONS_GRID: Record<
  string,
  { cells: Array<{ col: number; row: number }>; nameKo: string }
> = {
  Seoul: { cells: [{ col: 2, row: 2 }], nameKo: "서울" },
  Incheon: { cells: [{ col: 1, row: 2 }], nameKo: "인천" },
  Sejong: { cells: [{ col: 3, row: 4 }], nameKo: "세종" },
  Daejeon: { cells: [{ col: 3, row: 5 }], nameKo: "대전" },
  Gwangju: { cells: [{ col: 2, row: 8 }], nameKo: "광주" },
  Daegu: { cells: [{ col: 5, row: 7 }], nameKo: "대구" },
  Ulsan: { cells: [{ col: 7, row: 7 }], nameKo: "울산" },
  Busan: { cells: [{ col: 7, row: 8 }], nameKo: "부산" },

  Gyeonggi: {
    cells: [
      { col: 2, row: 1 },
      { col: 3, row: 1 },
      { col: 3, row: 2 },
      { col: 2, row: 3 },
      { col: 3, row: 3 },
    ],
    nameKo: "경기",
  },
  Gangwon: {
    cells: [
      { col: 4, row: 1 },
      { col: 5, row: 1 },
      { col: 6, row: 1 },
      { col: 4, row: 2 },
      { col: 5, row: 2 },
      { col: 6, row: 2 },
      { col: 4, row: 3 },
      { col: 5, row: 3 },
      { col: 6, row: 3 },
      { col: 7, row: 3 },
    ],
    nameKo: "강원",
  },
  Chungnam: {
    cells: [
      { col: 1, row: 4 },
      { col: 2, row: 4 },
      { col: 1, row: 5 },
      { col: 2, row: 5 },
    ],
    nameKo: "충남",
  },
  Chungbuk: {
    cells: [
      { col: 4, row: 4 },
      { col: 5, row: 4 },
      { col: 4, row: 5 },
    ],
    nameKo: "충북",
  },
  Jeonbuk: {
    cells: [
      { col: 2, row: 6 },
      { col: 3, row: 6 },
      { col: 2, row: 7 },
      { col: 3, row: 7 },
    ],
    nameKo: "전북",
  },
  Jeonnam: {
    cells: [
      { col: 1, row: 8 },
      { col: 3, row: 8 },
      { col: 1, row: 9 },
      { col: 2, row: 9 },
      { col: 3, row: 9 },
      { col: 1, row: 10 },
      { col: 2, row: 10 },
    ],
    nameKo: "전남",
  },
  Gyeongbuk: {
    cells: [
      { col: 6, row: 4 },
      { col: 7, row: 4 },
      { col: 5, row: 5 },
      { col: 6, row: 5 },
      { col: 7, row: 5 },
      { col: 4, row: 6 },
      { col: 5, row: 6 },
      { col: 6, row: 6 },
      { col: 7, row: 6 },
      { col: 4, row: 7 },
      { col: 6, row: 7 },
    ],
    nameKo: "경북",
  },
  Gyeongnam: {
    cells: [
      { col: 4, row: 8 },
      { col: 5, row: 8 },
      { col: 6, row: 8 },
      { col: 4, row: 9 },
      { col: 5, row: 9 },
      { col: 6, row: 9 },
    ],
    nameKo: "경남",
  },
  Jeju: { cells: [{ col: 2, row: 12 }], nameKo: "제주" },
};

const NATIONAL_GRID_COLS = 8;
const NATIONAL_GRID_ROWS = 13;

function getHeatmapColor(value: number, min: number, max: number): string {
  if (max === min) return "rgb(193, 95, 60)";
  const t = (value - min) / (max - min);
  const r = Math.round(245 + (193 - 245) * t);
  const g = Math.round(224 + (95 - 224) * t);
  const b = Math.round(213 + (60 - 213) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function getSeoulHeatmapColor(value: number, min: number, max: number): string {
  if (max === min) return "rgb(93, 99, 82)";
  const t = (value - min) / (max - min);
  const r = Math.round(232 + (93 - 232) * t);
  const g = Math.round(229 + (99 - 229) * t);
  const b = Math.round(221 + (82 - 221) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export function ChartCoreGeoGridRenderer({
  data,
  style,
  height,
  onLegendStateChange,
}: {
  data: ChartData;
  style?: ChartStyle;
  height?: number;
  onLegendStateChange?: (state: { tooltipPayload: any[] | null; hoveredLabel: string | null }) => void;
}) {
  const s = style as GeoGridStyle | undefined;
  const lineStyle = style as CartesianStyle | undefined;
  const cfg = s?.geoGrid;
  const series0 = data.series?.[0];
  const enabled = lineStyle?.timepointLine?.enabled ?? {};
  const isVisible = series0 ? enabled[series0.id] !== false : true;

  const chartHeight = height ?? 420;
  const mapLevel = cfg?.mapLevel ?? "national";
  const metricId = cfg?.metricId ?? DEFAULT_METRICS[0]?.id ?? "metric";
  const metricLabel = DEFAULT_METRICS.find((m) => m.id === metricId)?.label ?? metricId;

  const timepointData = useMemo(() => {
    const raw = (data.series?.[0]?.data ?? []) as unknown[];
    return raw.filter((r): r is GeoGridTimepoint => Boolean(r) && typeof r === "object" && "timepoint" in (r as any));
  }, [data.series]);

  const active = useMemo(() => {
    const keys = timepointData.map((tp) => tp.timepoint);
    const selected =
      cfg?.selectedTimepoint && keys.includes(cfg.selectedTimepoint)
        ? cfg.selectedTimepoint
        : (keys[keys.length - 1] ?? null);
    const tp = selected ? timepointData.find((x) => x.timepoint === selected) : undefined;
    return { selectedTimepoint: selected, tp };
  }, [timepointData, cfg?.selectedTimepoint]);

  const currentData = useMemo(() => {
    const tp = active.tp;
    if (!tp) return [] as GeoGridDataItem[];
    return mapLevel === "seoul" ? tp.seoulData : tp.nationalData;
  }, [active.tp, mapLevel]);

  const stats = useMemo(() => {
    const values = currentData.map((d) => d.value);
    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 0;
    const totalSum = values.reduce((acc, v) => acc + v, 0);
    const dataMap = new Map(currentData.map((d) => [d.districtId, d]));
    return { minValue, maxValue, totalSum, dataMap };
  }, [currentData]);

  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    name: string;
    value: number;
    color: string;
  } | null>(null);
  const legendCallbackRef = useRef(onLegendStateChange);

  useEffect(() => {
    legendCallbackRef.current = onLegendStateChange;
  }, [onLegendStateChange]);

  useEffect(() => {
    const payload = tooltip
      ? [
          {
            dataKey: metricId,
            value: tooltip.value,
            color: tooltip.color,
            totalSum: stats.totalSum,
            mapLevel,
            timepoint: active.selectedTimepoint,
            metricLabel,
          },
        ]
      : null;

    legendCallbackRef.current?.({
      tooltipPayload: payload,
      hoveredLabel: tooltip?.name ?? null,
    });
  }, [tooltip, metricId, metricLabel, mapLevel, active.selectedTimepoint, stats.totalSum]);

  const handleLeave = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const handleEnter = useCallback(
    (id: string, fallbackNameKo?: string) => {
      setHovered(id);
      const item = stats.dataMap.get(id);
      const value = item?.value ?? 0;
      const name = item?.districtName ?? fallbackNameKo ?? id;
      const color =
        mapLevel === "seoul"
          ? getSeoulHeatmapColor(value, stats.minValue, stats.maxValue)
          : getHeatmapColor(value, stats.minValue, stats.maxValue);
      setTooltip({ name, value, color });
    },
    [stats.dataMap, stats.minValue, stats.maxValue, mapLevel]
  );

  if (!isVisible || !active.tp) {
    return <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />;
  }

  if (mapLevel === "seoul") {
    const cellSize = Math.min((chartHeight - 30) / SEOUL_GRID_ROWS, 48);
    const gap = 3;
    const svgWidth = SEOUL_GRID_COLS * (cellSize + gap);
    const svgHeight = SEOUL_GRID_ROWS * (cellSize + gap);

    return (
      <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight, position: "relative" }}>
        {tooltip ? (
          <div
            className="pointer-events-none"
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              background: "rgba(30,30,30,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 11,
              color: "#ddd",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {tooltip.name} <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>({active.selectedTimepoint ?? ""})</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: tooltip.color, display: "inline-block" }} />
              <span>
                {tooltip.value.toLocaleString()}
                <span style={{ color: "rgba(255,255,255,0.6)" }}> · {metricLabel}</span>
              </span>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <svg width={svgWidth} height={svgHeight} role="img" aria-label="서울시 구별 지도 그리드">
            <g
              onMouseEnter={() => {
                setHovered("han-river");
                setTooltip({ name: "한강", value: 0, color: "#9DBFCE" });
              }}
              onMouseLeave={handleLeave}
              style={{ cursor: "pointer" }}
            >
              {HAN_RIVER_CELLS.map((cell, idx) => {
                const x = cell.col * (cellSize + gap);
                const y = cell.row * (cellSize + gap);
                const isHovered = hovered === "han-river";
                return (
                  <rect
                    key={`han-${idx}`}
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

            {Object.entries(SEOUL_DISTRICTS_GRID).map(([districtId, meta]) => {
              const item = stats.dataMap.get(districtId);
              const value = item?.value ?? 0;
              const x = meta.col * (cellSize + gap);
              const y = meta.row * (cellSize + gap);
              const color = getSeoulHeatmapColor(value, stats.minValue, stats.maxValue);
              const isHovered = hovered === districtId;
              return (
                <g
                  key={districtId}
                  transform={`translate(${x}, ${y})`}
                  onMouseEnter={() => handleEnter(districtId, meta.nameKo)}
                  onMouseLeave={handleLeave}
                  style={{ cursor: "pointer" }}
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
                    style={{ pointerEvents: "none" }}
                  >
                    {meta.nameKo}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  }

  const cellSize = Math.min((chartHeight - 30) / NATIONAL_GRID_ROWS, 38);
  const svgWidth = NATIONAL_GRID_COLS * cellSize;
  const svgHeight = NATIONAL_GRID_ROWS * cellSize;

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight, position: "relative" }}>
      {tooltip ? (
        <div
          className="pointer-events-none"
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(30,30,30,0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 11,
            color: "#ddd",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {tooltip.name} <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: 400 }}>({active.selectedTimepoint ?? ""})</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: tooltip.color, display: "inline-block" }} />
            <span>
              {tooltip.value.toLocaleString()}
              <span style={{ color: "rgba(255,255,255,0.6)" }}> · {metricLabel}</span>
            </span>
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <svg width={svgWidth} height={svgHeight} role="img" aria-label="전국 광역시도 지도 그리드">
          {Object.entries(KOREA_REGIONS_GRID).map(([regionId, meta]) => {
            const item = stats.dataMap.get(regionId);
            const value = item?.value ?? 0;
            const color = getHeatmapColor(value, stats.minValue, stats.maxValue);
            const isHovered = hovered === regionId;

            const cellSet = new Set(meta.cells.map((c) => `${c.col},${c.row}`));

            // Bounding box center for label; keep chartCore's special cases.
            const minCol = Math.min(...meta.cells.map((c) => c.col));
            const maxCol = Math.max(...meta.cells.map((c) => c.col));
            const minRow = Math.min(...meta.cells.map((c) => c.row));
            const maxRow = Math.max(...meta.cells.map((c) => c.row));
            let centerX = ((minCol + maxCol + 1) / 2) * cellSize;
            let centerY = ((minRow + maxRow + 1) / 2) * cellSize;
            if (regionId === "Gyeonggi") {
              centerX = 2.5 * cellSize;
              centerY = 1.5 * cellSize;
            }
            if (regionId === "Chungbuk") {
              centerX = 4.5 * cellSize;
              centerY = 4.5 * cellSize;
            }

            return (
              <g
                key={regionId}
                onMouseEnter={() => handleEnter(regionId, meta.nameKo)}
                onMouseLeave={handleLeave}
                style={{ cursor: "pointer" }}
              >
                {meta.cells.map((cell, idx) => {
                  const x = cell.col * cellSize;
                  const y = cell.row * cellSize;
                  const hasTop = cellSet.has(`${cell.col},${cell.row - 1}`);
                  const hasBottom = cellSet.has(`${cell.col},${cell.row + 1}`);
                  const hasLeft = cellSet.has(`${cell.col - 1},${cell.row}`);
                  const hasRight = cellSet.has(`${cell.col + 1},${cell.row}`);
                  return (
                    <g key={idx}>
                      <rect x={x} y={y} width={cellSize} height={cellSize} fill={color} />
                      {isHovered ? (
                        <>
                          {!hasTop ? <line x1={x} y1={y} x2={x + cellSize} y2={y} stroke="#444" strokeWidth={2} /> : null}
                          {!hasBottom ? (
                            <line x1={x} y1={y + cellSize} x2={x + cellSize} y2={y + cellSize} stroke="#444" strokeWidth={2} />
                          ) : null}
                          {!hasLeft ? <line x1={x} y1={y} x2={x} y2={y + cellSize} stroke="#444" strokeWidth={2} /> : null}
                          {!hasRight ? (
                            <line x1={x + cellSize} y1={y} x2={x + cellSize} y2={y + cellSize} stroke="#444" strokeWidth={2} />
                          ) : null}
                        </>
                      ) : null}
                    </g>
                  );
                })}
                <text
                  x={centerX}
                  y={centerY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="hsl(var(--foreground))"
                  fontSize={10}
                  fontWeight={600}
                  style={{ pointerEvents: "none" }}
                >
                  {meta.nameKo}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
