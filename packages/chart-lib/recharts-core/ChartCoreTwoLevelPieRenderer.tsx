"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { ChartData, ChartStyle, PieStyle } from "../types";
import { formatDateForXAxis } from "./formatDateForXAxis";
import { RechartsTwoLevelPieWrapper } from "./recharts-two-level-pie-wrapper";
import { getThemeColors } from "./recharts-wrapper";
import {
  calculateTwoLevelPieData,
  calculateTwoLevelPieDataByTimepoint,
  TimepointTwoLevelPieData,
} from "./recharts-adapter";
import { HierarchyGroup } from "./recharts-type";
import { toChartCoreTable } from "./toChartCoreTable";

type Row = Record<string, unknown>;

function pickKey(row: Row, index: number): string {
  const v = row["date_display"] ?? row["x"] ?? row["date"] ?? index;
  return typeof v === "string" ? formatDateForXAxis(v) : String(v);
}

function extractNumericFields(rows: Row[]): string[] {
  if (rows.length === 0) return [];
  const excluded = new Set(["date", "date_display", "x", "y"]);
  const keys = Object.keys(rows[0]).filter((k) => !excluded.has(k));
  return keys.filter((k) =>
    rows.some((r) => typeof r[k] === "number" && !Number.isNaN(r[k] as number))
  );
}

type TwoLevelPieData = {
  innerData: Array<{ name: string; value: number }>;
  outerData: Array<{ name: string; value: number; series: string }>;
};

function toGroupInnerData(data: TwoLevelPieData): TwoLevelPieData {
  const groupSums = new Map<string, number>();
  const outerData = data.outerData.map((item) => {
    groupSums.set(item.name, (groupSums.get(item.name) ?? 0) + item.value);
    return {
      // wrapper alignment key (must match innerData.name)
      series: item.name,
      // outer child label
      name: item.series,
      value: item.value,
    };
  });

  const innerData = Array.from(groupSums.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => {
      const aNum = Number(a.name.replace("그룹", ""));
      const bNum = Number(b.name.replace("그룹", ""));
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
      return a.name.localeCompare(b.name, "ko");
    });

  return { innerData, outerData };
}

function toGroupInnerTimepointData(data: TimepointTwoLevelPieData[]): TimepointTwoLevelPieData[] {
  return data.map((tp) => {
    const grouped = toGroupInnerData({
      innerData: tp.innerData,
      outerData: tp.outerData,
    });
    return {
      ...tp,
      innerData: grouped.innerData,
      outerData: grouped.outerData,
    };
  });
}

export function ChartCoreTwoLevelPieRenderer({
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
  const [tooltipPayload, setTooltipPayload] = useState<any[] | null>(null);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [themeColors, setThemeColors] = useState(getThemeColors());
  // 2단계 파이 계층 그룹 상태
  const [hierarchyGroups, setHierarchyGroups] = useState<HierarchyGroup[]>([]);
  
  const s = style as PieStyle | undefined;
  const cfg = s?.twoLevelPie;
  const palette = style?.colorPalette ?? [];

  const rawRows = useMemo(() => {
    const raw = (data.series?.[0]?.data ?? []) as unknown[];
    const rowsFromRaw = raw.filter((r): r is Row => Boolean(r) && typeof r === "object");
    const row0 = rowsFromRaw[0];

    // Standard DataChart series input ({x,y} points) -> table rows.
    if (row0 && "x" in row0 && "y" in row0) {
      return toChartCoreTable(data as any).rows as Row[];
    }

    return rowsFromRaw;
  }, [data]);

  const parsed = useMemo(() => {
    const keys = rawRows.map((r, i) => pickKey(r, i));
    const selectedKey = cfg?.selectedKey && keys.includes(cfg.selectedKey) ? cfg.selectedKey : (keys[0] ?? "");
    const idx = selectedKey ? keys.indexOf(selectedKey) : 0;
    const row = rawRows[idx] ?? rawRows[0];

    const fields = extractNumericFields(rawRows);
    const assignmentsFromStyle = cfg?.assignments ?? {};
    const hasCustomAssignments = Object.keys(assignmentsFromStyle).length > 0;
    const assignments = hasCustomAssignments
      ? assignmentsFromStyle
      : (() => {
          const out: Record<string, number> = {};
          const split = Math.ceil(fields.length / 2);
          fields.forEach((field, idx) => {
            out[field] = idx < split ? 1 : 2;
          });
          return out;
        })();

    const visibleFields = fields.filter((f) => (assignments[f] ?? 0) > 0);
    if (visibleFields.length === 0) {
      return {
        keys,
        selectedKey,
        innerData: [] as Array<{ name: string; value: number }>,
        outerData: [] as Array<{ name: string; value: number; series: string }>,
        visibleFields: [] as string[],
        groupLabels: [] as string[],
      };
    }

    const outerData = visibleFields
      .map((field) => {
        const group = assignments[field] ?? 0;
        const v0 = row ? row[field] : null;
        const value = typeof v0 === "number" && !Number.isNaN(v0) ? Math.abs(v0) : 0;
        return {
          name: `그룹${group}`,
          value,
          series: field,
          group,
        };
      })
      .filter((item) => item.group > 0 && item.value > 0);

    const innerData = outerData.map((item) => ({
      name: item.series,
      value: item.value,
    }));

    const groupLabels = Array.from(
      new Set(outerData.map((item) => item.name))
    ).sort((a, b) => {
      const aNum = Number(a.replace("그룹", ""));
      const bNum = Number(b.replace("그룹", ""));
      return aNum - bNum;
    });

    return {
      keys,
      selectedKey,
      innerData,
      outerData: outerData.map(({ name, value, series }) => ({ name, value, series })),
      visibleFields,
      groupLabels,
    };
  }, [rawRows, cfg]);

  const chartHeight = height ?? 400;

  const enabledSeries = new Set<string>([...parsed.groupLabels, ...parsed.visibleFields]);
  const seriesFields = parsed.visibleFields;

  // seriesFields가 변경되면 hierarchyGroups 초기화 (샘플 변경 시)
  useEffect(() => {
    setHierarchyGroups([]);
  }, [seriesFields]);

  useEffect(() => {
    const assignments = cfg?.assignments ?? {};
    const groups = new Map<number, string[]>();

    for (const field of seriesFields) {
      const groupNo = assignments[field] ?? 0;
      if (groupNo <= 0) continue;
      if (!groups.has(groupNo)) groups.set(groupNo, []);
      groups.get(groupNo)!.push(field);
    }
    const t= Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([groupNo, fields]) => ({
        name: `그룹${groupNo}`,
        series: fields,
      }));
    setHierarchyGroups(t)
  }, [cfg?.assignments, seriesFields]);

  const chartType: string = 'recharts/two-level-pie'
  const chartData = useMemo(
    () =>
      rawRows.map((row) => {
        const dateDisplay =
          typeof row.date_display === "string"
            ? row.date_display
            : (typeof row.x === "string" ? row.x : "");
        const date =
          typeof row.date === "string"
            ? row.date
            : (dateDisplay || new Date(0).toISOString());
        return {
          ...row,
          date,
          date_display: dateDisplay,
        };
      }),
    [rawRows]
  );

  // 2단계 파이 / 멀티레벨 트리맵용 시리즈 필드 (계층 모드면 그룹명/level1만, 아니면 원본)
  const twoLevelPieSeriesFields = useMemo(() => {
    // 1. 사용자 지정 그룹이 있으면 그룹명 반환
    if (hierarchyGroups && hierarchyGroups.length > 0) {
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

  // 2단계 파이 차트 시점별 데이터 (timepoint selection용)
  const twoLevelPieTimepointData = useMemo(() => {
    const base = calculateTwoLevelPieDataByTimepoint(chartData, seriesFields, hierarchyGroups);
    return toGroupInnerTimepointData(base);
  }, [chartType, chartData, seriesFields, hierarchyGroups]);

  // 2단계 파이 차트 데이터
  const twoLevelPieData = useMemo(() => {
    const base = calculateTwoLevelPieData(chartData, seriesFields, hierarchyGroups);
    return toGroupInnerData(base);
  }, [chartType, chartData, seriesFields, hierarchyGroups]);

  return (
    <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <RechartsTwoLevelPieWrapper
        innerData={twoLevelPieData.innerData}
        outerData={twoLevelPieData.outerData}
        enabledSeries={enabledSeries}
        height={chartHeight}
        allSeriesFields={twoLevelPieSeriesFields}
        timepointData={twoLevelPieTimepointData}
        themeColors={{
          ...themeColors,
          seriesColors: palette.length > 0 ? palette : themeColors.seriesColors,
        }}
        onTooltipChange={(payload, label) => {
          setTooltipPayload(payload);
          setHoveredLabel(label);
          onLegendStateChange?.({ tooltipPayload: payload, hoveredLabel: label });
        }}
      />
    </div>
  );
}
