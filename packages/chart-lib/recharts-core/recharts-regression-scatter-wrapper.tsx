"use client";

import { useMemo, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Customized,
} from "recharts";
import type { ChartThemeColors } from "./recharts-wrapper";
import { getAxisLineColor } from "./recharts-wrapper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { TimepointRegressionScatterData } from "./recharts-adapter";

interface RegressionStats {
  r2: number;
  slope: number;
  intercept: number;
}

interface RechartsRegressionScatterWrapperProps {
  data: Array<Record<string, string | number | null>>;
  xField: string;
  yField: string;
  themeColors?: ChartThemeColors;
  height?: number;
  onRegressionStats?: (stats: RegressionStats | null) => void;
  onTooltipChange?: (payload: any[] | null, label: string | null) => void;
  onOutlierCount?: (count: number) => void;
  // 시점 선택 관련
  timepointData?: TimepointRegressionScatterData[];
}

function calculateLinearRegression(
  points: Array<{ x: number; y: number }>
): RegressionStats | null {
  const n = points.length;
  if (n < 2) return null;

  const sumX = points.reduce((acc, p) => acc + p.x, 0);
  const sumY = points.reduce((acc, p) => acc + p.y, 0);
  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumX2 = points.reduce((acc, p) => acc + p.x * p.x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const meanY = sumY / n;
  const ssTotal = points.reduce((acc, p) => acc + (p.y - meanY) ** 2, 0);
  const ssResidual = points.reduce(
    (acc, p) => acc + (p.y - (slope * p.x + intercept)) ** 2,
    0
  );
  const r2 = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  return { slope, intercept, r2 };
}

export function RechartsRegressionScatterWrapper({
  data,
  xField,
  yField,
  themeColors,
  height = 400,
  onRegressionStats,
  onTooltipChange,
  onOutlierCount,
  timepointData,
}: RechartsRegressionScatterWrapperProps) {
  const [selectedTimepoint, setSelectedTimepoint] = useState<string | null>(null);

  // 시점 모드 여부
  const isTimepointMode = timepointData && timepointData.length > 0;

  // timepointData 변경 시 최신 시점으로 자동 설정
  useEffect(() => {
    if (timepointData && timepointData.length > 0) {
      setSelectedTimepoint(timepointData[timepointData.length - 1].timepoint);
    }
  }, [timepointData]);

  const scatterData = useMemo(() => {
    // 시점 모드일 때는 선택된 시점의 데이터 사용
    if (isTimepointMode && selectedTimepoint) {
      const selected = timepointData.find(tp => tp.timepoint === selectedTimepoint);
      if (selected) {
        return selected.data.map(d => ({
          x: d.x,
          y: d.y,
          dateDisplay: d.label,
        }));
      }
    }

    // 기본 모드: 원래 데이터 사용
    const points: Array<{ x: number; y: number; dateDisplay: string }> = [];

    data.forEach((row) => {
      const xVal = row[xField];
      const yVal = row[yField];

      if (
        typeof xVal === "number" &&
        !isNaN(xVal) &&
        typeof yVal === "number" &&
        !isNaN(yVal)
      ) {
        points.push({ x: xVal, y: yVal, dateDisplay: String(row.date_display || "") });
      }
    });

    return points;
  }, [data, xField, yField, isTimepointMode, selectedTimepoint, timepointData]);

  const regression = useMemo(() => {
    return calculateLinearRegression(scatterData);
  }, [scatterData]);

  useEffect(() => {
    onRegressionStats?.(regression);
  }, [regression, onRegressionStats]);

  // 값을 "nice" 값으로 반올림 (0으로 끝나는 값)
  const roundToNice = (value: number, direction: 'floor' | 'ceil') => {
    const absValue = Math.abs(value);
    let step = 10;
    if (absValue >= 1000) step = 100;
    else if (absValue >= 10) step = 10;
    else step = 1;

    if (direction === 'floor') {
      return Math.floor(value / step) * step;
    }
    return Math.ceil(value / step) * step;
  };

  // 0으로 끝나는 tick 배열 생성
  const generateNiceTicks = (min: number, max: number) => {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];

    const range = max - min;
    let step = 10;
    if (range >= 500) step = 100;
    else if (range >= 100) step = 20;
    else if (range >= 50) step = 10;
    else step = 10;

    // range가 너무 크면 step을 자릿수에 맞춰 스케일 업 (tick 상한 유지)
    const MAX_TICKS = 50;
    while (range / step > MAX_TICKS) step *= 10;

    const ticks: number[] = [];
    const start = Math.ceil(min / step) * step;
    for (let v = start; v <= max; v += step) {
      ticks.push(v);
    }
    return ticks;
  };

  const { xDomain, yDomain } = useMemo(() => {
    if (scatterData.length === 0) {
      return { xDomain: [0, 100] as [number, number], yDomain: [0, 100] as [number, number] };
    }

    const xValues = scatterData.map((p) => p.x);
    const yValues = scatterData.map((p) => p.y);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xPadding = (xMax - xMin) * 0.05 || 1;
    const yPadding = (yMax - yMin) * 0.05 || 1;

    return {
      xDomain: [roundToNice(xMin - xPadding, 'floor'), roundToNice(xMax + xPadding, 'ceil')] as [number, number],
      yDomain: [roundToNice(yMin - yPadding, 'floor'), roundToNice(yMax + yPadding, 'ceil')] as [number, number],
    };
  }, [scatterData]);

  const xTicks = useMemo(() => generateNiceTicks(xDomain[0], xDomain[1]), [xDomain]);
  const yTicks = useMemo(() => generateNiceTicks(yDomain[0], yDomain[1]), [yDomain]);

  const regressionLineData = useMemo(() => {
    if (!regression) return null;

    const { slope, intercept } = regression;
    const [x1, x2] = xDomain;
    // 양쪽 Y축에서 약 0.7cm 떨어뜨리기 위해 오프셋 적용
    const xOffset = (x2 - x1) * 0.03;
    const adjustedX1 = x1 + xOffset;
    const adjustedX2 = x2 - xOffset;
    const y1 = slope * adjustedX1 + intercept;
    const y2 = slope * adjustedX2 + intercept;

    return { x1: adjustedX1, y1, x2: adjustedX2, y2 };
  }, [regression, xDomain]);

  const scatterColor = "#3172AD";  // 차분한 파란색
  const outlierColor = "#ef4444";  // 이상치 (빨간색 - 대비용)

  // 회귀 잔차 기반 이상치 범위 계산
  const residualOutlierBounds = useMemo(() => {
    if (scatterData.length < 4 || !regression) return null;

    const { slope, intercept } = regression;
    const residuals = scatterData.map(p => p.y - (slope * p.x + intercept));

    const sorted = [...residuals].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];
    const iqr = q3 - q1;

    return { lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
  }, [scatterData, regression]);

  // 이상치 수 계산 및 콜백 전달
  const outlierCount = useMemo(() => {
    if (!residualOutlierBounds || !regression) return 0;
    return scatterData.filter(p => {
      const residual = p.y - (regression.slope * p.x + regression.intercept);
      return residual < residualOutlierBounds.lower || residual > residualOutlierBounds.upper;
    }).length;
  }, [scatterData, regression, residualOutlierBounds]);

  useEffect(() => {
    onOutlierCount?.(outlierCount);
  }, [outlierCount, onOutlierCount]);

  const formatTick = (value: number) => {
    const rounded = Math.round(value);
    if (Math.abs(rounded) >= 1000000000) {
      return `${Math.round(rounded / 1000000000)}B`;
    }
    if (Math.abs(rounded) >= 1000000) {
      return `${Math.round(rounded / 1000000)}M`;
    }
    if (Math.abs(rounded) >= 1000) {
      return `${Math.round(rounded / 1000)}K`;
    }
    return rounded.toLocaleString();
  };

  // R² 라벨 위치 (우측 상단 고정)
  const r2LabelPosition = { xPercent: 0.995, yPercent: 0.82, anchor: 'end' as const };

  const dropdownHeight = isTimepointMode ? 40 : 0;
  const chartHeight = height - dropdownHeight;

  // 시점 선택 드롭다운
  const TimepointSelector = () => {
    if (!isTimepointMode) return null;
    return (
      <div className="flex items-center gap-2 mb-2 px-2">
        <span className="text-sm text-muted-foreground">시점:</span>
        <Select value={selectedTimepoint || ""} onValueChange={setSelectedTimepoint}>
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue placeholder="시점 선택" />
          </SelectTrigger>
          <SelectContent>
            {timepointData!.map(tp => (
              <SelectItem key={tp.timepoint} value={tp.timepoint} className="text-xs">
                {tp.timepoint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col" style={{ height }}>
      {/* 시점 선택 드롭다운 */}
      <TimepointSelector />
      <ResponsiveContainer width="100%" height={chartHeight}>
        <ScatterChart
          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
        >
        <CartesianGrid
          stroke="#d1d5db"
          strokeWidth={0.5}
          opacity={0.6}
        />
        <XAxis
          type="number"
          dataKey="x"
          name={xField}
          domain={xDomain}
          ticks={xTicks}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
          tickFormatter={formatTick}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yField}
          domain={yDomain}
          ticks={yTicks}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: getAxisLineColor(), strokeWidth: 1.5 }}
          tickFormatter={formatTick}
        />
        <Tooltip
          cursor={false}
          content={() => null}
        />
        <Scatter
          data={scatterData}
          fill={scatterColor}
          fillOpacity={0.85}
          stroke="#0D0D0D"
          strokeWidth={1}
          shape={(props: any) => {
            const { cx, cy, payload } = props;

            // 회귀 잔차 기반 이상치 판별
            const residual = regression ? payload.y - (regression.slope * payload.x + regression.intercept) : 0;
            const isOutlier = residualOutlierBounds &&
              (residual < residualOutlierBounds.lower || residual > residualOutlierBounds.upper);

            const pointColor = isOutlier ? outlierColor : scatterColor;

            return (
              <circle
                cx={cx}
                cy={cy}
                r={5}
                fill={pointColor}
                fillOpacity={0.85}
                stroke="#0D0D0D"
                strokeWidth={1}
                onMouseEnter={() => {
                  onTooltipChange?.(
                    [
                      { dataKey: xField, value: payload.x, color: pointColor },
                      { dataKey: yField, value: payload.y, color: pointColor, isOutlier, residual: isOutlier ? residual : null },
                    ],
                    payload.dateDisplay
                  );
                }}
                onMouseLeave={() => {
                  onTooltipChange?.(null, null);
                }}
                style={{ cursor: "pointer" }}
              />
            );
          }}
        />
        {/* 상단 테두리 */}
        <ReferenceLine
          y={yDomain[1]}
          stroke={getAxisLineColor()}
          strokeWidth={1.5}
        />
        {/* 우측 테두리 */}
        <ReferenceLine
          x={xDomain[1]}
          stroke={getAxisLineColor()}
          strokeWidth={1.5}
        />
        {regressionLineData && (
          <ReferenceLine
            segment={[
              { x: regressionLineData.x1, y: regressionLineData.y1 },
              { x: regressionLineData.x2, y: regressionLineData.y2 },
            ]}
            stroke="#374151"
            strokeDasharray="5 5"
            strokeWidth={1.5}
          />
        )}
        {/* 회귀 통계 라벨 (좌상단 또는 우상단, 박스 스타일) */}
        {regression && (
          <Customized
            component={(props: any) => {
              const { xAxisMap, yAxisMap } = props;
              const xAxis = xAxisMap?.[0];
              const yAxis = yAxisMap?.[0];
              if (!xAxis || !yAxis) return null;

              const xRange = xDomain[1] - xDomain[0];
              const yRange = yDomain[1] - yDomain[0];
              const labelX = xDomain[0] + xRange * r2LabelPosition.xPercent;
              const labelY = yDomain[0] + yRange * r2LabelPosition.yPercent;

              const pixelX = xAxis.scale(labelX);
              const pixelY = yAxis.scale(labelY);

              const labelText = `Best fit (R² = ${regression.r2.toFixed(3)}, β = ${regression.slope.toFixed(3)})`;
              const textWidth = labelText.length * 4.9;
              const dashLineWidth = 18;
              const boxPadding = { x: 4, y: 3 };
              const totalWidth = dashLineWidth + 4 + textWidth - 2;
              const boxHeight = 14 + boxPadding.y;

              // 박스 우측 끝이 pixelX에 맞춤
              const boxX = pixelX - totalWidth;

              return (
                <g>
                  {/* 테두리 박스 (배경 없음) */}
                  <rect
                    x={boxX}
                    y={pixelY - 10 - boxPadding.y}
                    width={totalWidth}
                    height={boxHeight}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth={0.5}
                    rx={2}
                    ry={2}
                  />
                  {/* 점선 마커 */}
                  <line
                    x1={boxX + boxPadding.x}
                    y1={pixelY - 4}
                    x2={boxX + boxPadding.x + dashLineWidth}
                    y2={pixelY - 4}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                  />
                  {/* 텍스트 */}
                  <text
                    x={boxX + boxPadding.x + dashLineWidth + 4}
                    y={pixelY}
                    textAnchor="start"
                    fontSize={10}
                    fill="#ffffff"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {labelText}
                  </text>
                </g>
              );
            }}
          />
        )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
