"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, Sector, ResponsiveContainer } from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { expandSeriesColors } from "./recharts-wrapper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

export interface PieChartDataItem {
  name: string;
  value: number;
}

export interface TimepointPieData {
  timepoint: string;
  date: string;
  data: PieChartDataItem[];
}

export interface RechartsPieWrapperProps {
  data?: PieChartDataItem[];
  timepointData?: TimepointPieData[];  // 시점별 데이터 (있으면 small multiples)
  enabledSeries: Set<string>;
  themeColors?: ChartThemeColors;
  height?: number;
  allSeriesFields: string[];
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  onSelectedDataChange?: (data: PieChartDataItem[]) => void;  // 선택된 시점의 데이터 변경 콜백
  showDefaultLabels?: boolean;  // 디폴트 상태에서 라벨 표시 (기본 샘플용)
  labelThreshold?: number;      // 라벨 표시 최소 비율 (기본값: 0.05 = 5%)
}

/** 호버 시 강조 효과를 위한 활성 섹터 렌더러 */
const renderActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;

  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 10) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 10) * sin;
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 30) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  // 중앙 시리즈명 말줄임 (최대 10자)
  const centerName = payload?.name || "";
  const displayCenterName = centerName.length > 10 ? `${centerName.slice(0, 10)}...` : centerName;

  return (
    <g>
      {/* 중앙 시리즈명 */}
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} style={{ fontSize: 14 }}>
        {displayCenterName}
      </text>
      {/* 기본 섹터 */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      {/* 외부 링 */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={(outerRadius ?? 0) + 6}
        outerRadius={(outerRadius ?? 0) + 10}
        fill={fill}
      />
      {/* 연결선 */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      {/* 연결점 */}
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      {/* 값 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        textAnchor={textAnchor}
        className="fill-foreground"
        style={{ fontSize: 12 }}
      >
        {(value ?? 0).toLocaleString()}
      </text>
      {/* 비율 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 12}
        y={ey}
        dy={18}
        textAnchor={textAnchor}
        className="fill-muted-foreground"
        style={{ fontSize: 12 }}
      >
        {`(Rate ${((percent ?? 0) * 100).toFixed(2)}%)`}
      </text>
    </g>
  );
};

/** Small Multiples용 활성 섹터 렌더러 (기본 샘플 스타일 적용) */
const renderCompactActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const {
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
    payload,
    percent,
    value,
  } = props;

  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));

  // 연결선 시작점 (외부 링 바로 바깥)
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 4) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 4) * sin;
  // 연결선 중간점 (더 길게 - 기본 라벨과 겹치지 않도록)
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 22) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 22) * sin;
  // 연결선 끝점 (수평선)
  const ex = mx + (cos >= 0 ? 1 : -1) * 10;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  // 중앙 시리즈명 말줄임 (최대 10자)
  const centerName = payload?.name || "";
  const displayCenterName = centerName.length > 10 ? `${centerName.slice(0, 10)}...` : centerName;

  return (
    <g>
      {/* 중앙 시리즈명 */}
      <text x={cx} y={cy} dy={4} textAnchor="middle" fill={fill} style={{ fontSize: 11, fontWeight: 500 }}>
        {displayCenterName}
      </text>
      {/* 기본 섹터 */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      {/* 외부 링 */}
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={(outerRadius ?? 0) + 2}
        outerRadius={(outerRadius ?? 0) + 4}
        fill={fill}
      />
      {/* 연결선 */}
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      {/* 연결점 */}
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      {/* 값 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 4}
        y={ey}
        textAnchor={textAnchor}
        className="fill-foreground"
        style={{ fontSize: 10 }}
      >
        {(value ?? 0).toLocaleString()}
      </text>
      {/* 비율 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 4}
        y={ey}
        dy={11}
        textAnchor={textAnchor}
        className="fill-muted-foreground"
        style={{ fontSize: 9 }}
      >
        {`(${((percent ?? 0) * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

/** 기본 라벨 렌더러 (연결선 포함, 일정 비율 이상만 표시, 호버 시 숨김) */
const renderDefaultLabel = (props: any, threshold: number, isAnyHovered: boolean) => {
  const { cx, cy, midAngle, outerRadius, percent, name, fill } = props;
  // 비율 미달이거나 호버 중이면 모든 라벨 숨김
  if (percent < threshold) return null;
  if (isAnyHovered) return null;

  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));

  // 연결선 시작점 (파이 바깥)
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 2) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 2) * sin;
  // 연결선 중간점
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 18) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 18) * sin;
  // 연결선 끝점 (수평)
  const ex = mx + (cos >= 0 ? 1 : -1) * 10;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      {/* 연결선 */}
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={fill || "hsl(var(--muted-foreground))"}
        fill="none"
        strokeWidth={1}
      />
      {/* 라벨 텍스트 */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 4}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="central"
        className="fill-foreground"
        style={{ fontSize: 11 }}
      >
        {`${name} (${(percent * 100).toFixed(1)}%)`}
      </text>
    </g>
  );
};

/** Small Multiples용 컴팩트 라벨 렌더러 (연결선 포함) */
const renderCompactLabel = (props: any, threshold: number, isAnyHovered: boolean) => {
  const { cx, cy, midAngle, outerRadius, percent, name, fill } = props;
  // 비율 미달이거나 호버 중이면 모든 라벨 숨김
  if (percent < threshold) return null;
  if (isAnyHovered) return null;

  const RADIAN = Math.PI / 180;
  const sin = Math.sin(-RADIAN * (midAngle ?? 0));
  const cos = Math.cos(-RADIAN * (midAngle ?? 0));

  // 연결선 시작점 (파이 바깥)
  const sx = (cx ?? 0) + ((outerRadius ?? 0) + 2) * cos;
  const sy = (cy ?? 0) + ((outerRadius ?? 0) + 2) * sin;
  // 연결선 중간점
  const mx = (cx ?? 0) + ((outerRadius ?? 0) + 12) * cos;
  const my = (cy ?? 0) + ((outerRadius ?? 0) + 12) * sin;
  // 연결선 끝점 (수평)
  const ex = mx + (cos >= 0 ? 1 : -1) * 6;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  // 긴 라벨 말줄임 처리 (최대 6자, 비율은 호버시에만)
  const maxLength = 6;
  const displayName = name.length > maxLength ? `${name.slice(0, maxLength)}...` : name;

  return (
    <g>
      {/* 연결선 */}
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={fill || "hsl(var(--muted-foreground))"}
        fill="none"
        strokeWidth={1}
      />
      {/* 라벨 텍스트 (이름만, 비율은 호버시 표시) */}
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 4}
        y={ey}
        textAnchor={textAnchor}
        dominantBaseline="central"
        className="fill-foreground"
        style={{ fontSize: 10 }}
      >
        {displayName}
      </text>
    </g>
  );
};

export function RechartsPieWrapper({
  data,
  timepointData,
  enabledSeries,
  themeColors,
  height = 400,
  allSeriesFields,
  onTooltipChange,
  onSelectedDataChange,
  showDefaultLabels = true,
  labelThreshold = 0.01,
}: RechartsPieWrapperProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const [activeTimepoint, setActiveTimepoint] = useState<string | null>(null);
  // 사용자가 드롭다운에서 고른 시점을 override로 저장하고 실제 선택값은 파생값으로 계산한다.
  const [selectedTimepointOverride, setSelectedTimepointOverride] = useState<string | null>(null);
  const timepointList = useMemo(() => timepointData ?? [], [timepointData]);

  // 테마 색상 확장
  const colors = useMemo(() => {
    const baseColors = themeColors?.seriesColors || [];
    return expandSeriesColors(baseColors, allSeriesFields.length);
  }, [themeColors?.seriesColors, allSeriesFields.length]);

  // 시리즈별 색상 조회
  const getColorForSeries = useCallback(
    (seriesName: string) => {
      const idx = allSeriesFields.indexOf(seriesName);
      return idx >= 0 ? colors[idx % colors.length] : colors[0];
    },
    [allSeriesFields, colors]
  );

  // 단일 파이 모드용 데이터 (hooks는 항상 호출되어야 함)
  const singleData = useMemo(() => data ?? [], [data]);
  const filteredData = useMemo(() => {
    return singleData.filter((item) => enabledSeries.has(item.name));
  }, [singleData, enabledSeries]);

  // 호버 핸들러 (hooks는 항상 호출되어야 함)
  const onPieEnter = useCallback(
    (_: any, index: number) => {
      setActiveIndex(index);
      const item = filteredData[index];
      if (item && onTooltipChange) {
        onTooltipChange([{ dataKey: item.name, value: item.value, payload: item }], item.name);
      }
    },
    [filteredData, onTooltipChange]
  );

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
    onTooltipChange?.(null, null);
  }, [onTooltipChange]);

  // Small Multiples 모드 (시점별 데이터가 있을 때)
  const isSmallMultiples = timepointList.length > 0;
  const selectedTimepoint = useMemo(() => {
    if (!isSmallMultiples) return null;
    if (selectedTimepointOverride && timepointList.some((tp) => tp.timepoint === selectedTimepointOverride)) {
      return selectedTimepointOverride;
    }
    return timepointList[timepointList.length - 1]?.timepoint ?? null;
  }, [isSmallMultiples, selectedTimepointOverride, timepointList]);

  // 시점 선택 시 레전드 레이블 및 데이터 업데이트
  useEffect(() => {
    if (isSmallMultiples && selectedTimepoint) {
      if (onTooltipChange) {
        onTooltipChange(null, selectedTimepoint);
      }
      if (onSelectedDataChange) {
        const selectedData = timepointList.find((tp) => tp.timepoint === selectedTimepoint);
        if (selectedData) {
          onSelectedDataChange(selectedData.data);
        }
      }
    }
  }, [isSmallMultiples, selectedTimepoint, onTooltipChange, onSelectedDataChange, timepointList]);

  if (isSmallMultiples) {
    const count = timepointList.length;

    // 4개 이상 시점: 드롭다운 + 단일 큰 파이 (기본 샘플 스타일)
    if (count >= 4) {
      const selectedData = timepointList.find((tp) => tp.timepoint === selectedTimepoint);
      const selectedFilteredData = selectedData
        ? selectedData.data.filter((item) => enabledSeries.has(item.name))
        : [];

      return (
        <div className="w-full flex flex-col" style={{ height }}>
          {/* 시점 선택 드롭다운 */}
          <div className="flex items-center gap-2 mb-2 px-2">
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

          {/* 선택된 시점의 큰 파이 차트 (기본 샘플 스타일) */}
          {selectedFilteredData.length > 0 ? (
            <ResponsiveContainer width="100%" height={height - 60}>
              <PieChart margin={{ top: 30, right: 100, bottom: 30, left: 100 }}>
                <Pie
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  data={selectedFilteredData}
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="80%"
                  dataKey="value"
                  nameKey="name"
                  onMouseEnter={(_, index) => {
                    setActiveIndex(index);
                    const item = selectedFilteredData[index];
                    if (item && onTooltipChange) {
                      const allSeriesPayload = selectedData!.data.map(d => ({
                        dataKey: d.name,
                        value: d.value,
                        payload: { ...d, timepoint: selectedTimepoint }
                      }));
                      onTooltipChange(allSeriesPayload, selectedTimepoint);
                    }
                  }}
                  onMouseLeave={() => {
                    setActiveIndex(undefined);
                    onTooltipChange?.(null, null);
                  }}
                  label={(props) => renderDefaultLabel(props, labelThreshold, activeIndex !== undefined)}
                  labelLine={false}
                >
                  {selectedFilteredData.map((entry) => (
                    <Cell key={`cell-selected-${entry.name}`} fill={getColorForSeries(entry.name)} />
                  ))}
                </Pie>
                <Tooltip content={() => null} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center flex-1">
              <span className="text-muted-foreground text-sm">표시할 시리즈가 없습니다</span>
            </div>
          )}
        </div>
      );
    }

    // 1~3개 시점: 기존 Small Multiples
    const columns = count <= 2 ? count : 3;
    const rows = Math.ceil(count / columns);

    // 시점이 적을수록 파이 크기 증가
    const baseHeight = count <= 2 ? 380 : 340;
    const pieHeight = Math.min(baseHeight, Math.floor((height - 20) / rows));

    // 파이 반지름 및 마진 (1~3개 시점 전용)
    const innerRadius = "55%";
    const outerRadius = "72%";
    const margin = { top: 25, right: 70, bottom: 25, left: 70 };

    return (
      <div className="w-full overflow-auto" style={{ height }}>
        <div
          className="grid gap-4 p-2"
          style={{
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            minHeight: pieHeight * rows,
          }}
        >
          {timepointList.map((tp) => {
            const tpFilteredData = tp.data.filter((item) => enabledSeries.has(item.name));
            if (tpFilteredData.length === 0) return null;

            // 현재 시점의 활성 인덱스
            const currentActiveIndex = activeTimepoint === tp.timepoint ? activeIndex : undefined;

            return (
              <div key={tp.timepoint} className="flex flex-col items-center">
                <div className="text-sm font-medium text-muted-foreground mb-2">{tp.timepoint}</div>
                <ResponsiveContainer width="100%" height={pieHeight - 28}>
                  <PieChart margin={margin}>
                    <Pie
                      activeIndex={currentActiveIndex}
                      activeShape={renderCompactActiveShape}
                      data={tpFilteredData}
                      cx="50%"
                      cy="50%"
                      innerRadius={innerRadius}
                      outerRadius={outerRadius}
                      dataKey="value"
                      nameKey="name"
                      onMouseEnter={(_, index) => {
                        setActiveTimepoint(tp.timepoint);
                        setActiveIndex(index);
                        const item = tpFilteredData[index];
                        if (item && onTooltipChange) {
                          // 해당 시점의 모든 시리즈 값을 전달
                          const allSeriesPayload = tp.data.map(d => ({
                            dataKey: d.name,
                            value: d.value,
                            payload: { ...d, timepoint: tp.timepoint }
                          }));
                          onTooltipChange(allSeriesPayload, tp.timepoint);
                        }
                      }}
                      onMouseLeave={() => {
                        setActiveTimepoint(null);
                        setActiveIndex(undefined);
                        onTooltipChange?.(null, null);
                      }}
                      label={(props) => renderCompactLabel(props, labelThreshold, activeTimepoint !== null)}
                      labelLine={false}
                    >
                      {tpFilteredData.map((entry) => (
                        <Cell key={`cell-${tp.timepoint}-${entry.name}`} fill={getColorForSeries(entry.name)} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 기존 단일 파이 모드
  if (filteredData.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="text-muted-foreground text-sm">표시할 시리즈가 없습니다</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 40, right: 120, bottom: 40, left: 120 }}>
        <Pie
          activeIndex={activeIndex}
          activeShape={renderActiveShape}
          data={filteredData}
          cx="50%"
          cy="50%"
          innerRadius="50%"
          outerRadius="70%"
          dataKey="value"
          nameKey="name"
          onMouseEnter={onPieEnter}
          onMouseLeave={onPieLeave}
          label={showDefaultLabels ? (props) => renderDefaultLabel(props, labelThreshold, activeIndex !== undefined) : false}
          labelLine={false}
        >
          {filteredData.map((entry) => (
            <Cell key={`cell-${entry.name}`} fill={getColorForSeries(entry.name)} />
          ))}
        </Pie>
        <Tooltip content={() => null} />
      </PieChart>
    </ResponsiveContainer>
  );
}
