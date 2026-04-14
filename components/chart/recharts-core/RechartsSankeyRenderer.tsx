"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  Sankey,
  Rectangle,
} from "recharts";
import type { ChartData, ChartStyle, CartesianStyle } from "../types";
import { toChartCoreTable } from "./toChartCoreTable";
import { expandSeriesColors, getThemeColors } from "./recharts-wrapper";

type SankeyNodeDatum = {
  name: string;
  color: string;
};

type SankeyLinkDatum = {
  source: number;
  target: number;
  value: number;
  field: string;
};

type SankeyData = {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
};

type SankeyNodeShapeProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  index?: number;
  payload?: SankeyNodeDatum;
};

type SankeyLinkShapeProps = {
  sourceX: number;
  sourceY: number;
  sourceControlX: number;
  targetX: number;
  targetY: number;
  targetControlX: number;
  linkWidth: number;
  payload?: {
    source: number;
    target: number;
    value: number;
  };
};

type HoverTooltipState = {
  x: number;
  y: number;
  title: string;
  value: number;
};

const NODE_SOURCE_LABEL = "총 유입";
const NODE_TARGET_LABEL = "총 유출";
const NODE_SOURCE_COLOR = "#94A3B8";
const NODE_TARGET_COLOR = "#64748B";
const FALLBACK_SERIES_COLOR = "#C15F3C";

export function RechartsSankeyRenderer({
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
  const [themeColors] = useState(getThemeColors());
  const [hoverTooltip, setHoverTooltip] = useState<HoverTooltipState | null>(null);
  const chartHeight = height ?? 420;
  const cartesianStyle = style as CartesianStyle | undefined;
  const enabledSeries = cartesianStyle?.timepointLine?.enabled ?? {};
  const palette = style?.colorPalette ?? [];

  const sankeyData = useMemo<SankeyData>(() => {
    const table = toChartCoreTable(data);
    const visibleFields = table.yFields.filter((field) => enabledSeries[field] !== false);
    const latestRow = table.rows[table.rows.length - 1];

    if (!latestRow || visibleFields.length === 0) {
      return { nodes: [], links: [] };
    }

    const fieldValues: Array<{ field: string; value: number }> = [];
    for (const field of visibleFields) {
      const raw = latestRow[field];
      if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
      const value = Math.abs(raw);
      if (value <= 0) continue;
      fieldValues.push({ field, value });
    }

    if (fieldValues.length === 0) {
      return { nodes: [], links: [] };
    }

    const baseColors =
      palette.length > 0
        ? palette
        : themeColors.seriesColors.length > 0
          ? themeColors.seriesColors
          : [FALLBACK_SERIES_COLOR];
    const expandedColors = expandSeriesColors(baseColors, fieldValues.length);

    const nodes: SankeyNodeDatum[] = [
      { name: NODE_SOURCE_LABEL, color: NODE_SOURCE_COLOR },
      ...fieldValues.map((entry, index) => ({
        name: entry.field,
        color: expandedColors[index] ?? FALLBACK_SERIES_COLOR,
      })),
      { name: NODE_TARGET_LABEL, color: NODE_TARGET_COLOR },
    ];

    const targetIndex = nodes.length - 1;
    const links: SankeyLinkDatum[] = [];
    fieldValues.forEach((entry, index) => {
      const fieldNodeIndex = index + 1;
      links.push({
        source: 0,
        target: fieldNodeIndex,
        value: entry.value,
        field: entry.field,
      });
      links.push({
        source: fieldNodeIndex,
        target: targetIndex,
        value: entry.value,
        field: entry.field,
      });
    });

    return { nodes, links };
  }, [data, enabledSeries, palette, themeColors.seriesColors]);

  if (sankeyData.links.length === 0) {
    return (
      <div className="flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }} />
    );
  }

  const renderNode = (props: SankeyNodeShapeProps) => {
    const {
      x,
      y,
      width,
      height: nodeHeight,
      index = 0,
      payload,
    } = props;
    const fillColor = payload?.color ?? FALLBACK_SERIES_COLOR;
    const nodeName = payload?.name ?? "";
    const isLastNode = index === sankeyData.nodes.length - 1;
    const labelX = isLastNode ? x - 6 : x + width + 6;
    const labelAnchor = isLastNode ? "end" : "start";

    return (
      <g>
        <Rectangle
          x={x}
          y={y}
          width={width}
          height={nodeHeight}
          fill={fillColor}
          fillOpacity={0.9}
          stroke="rgba(0, 0, 0, 0.2)"
          strokeWidth={1}
        />
        <text
          x={labelX}
          y={y + nodeHeight / 2}
          textAnchor={labelAnchor}
          dominantBaseline="middle"
          fontSize={11}
          fill={themeColors.textColor}
        >
          {nodeName}
        </text>
      </g>
    );
  };

  const renderLink = (props: SankeyLinkShapeProps) => {
    const {
      sourceX,
      sourceY,
      sourceControlX,
      targetX,
      targetY,
      targetControlX,
      linkWidth,
      payload,
    } = props;
    const sourceIndex = payload?.source ?? 0;
    const sourceNodeColor = sankeyData.nodes[sourceIndex]?.color ?? FALLBACK_SERIES_COLOR;
    const safeWidth = Math.max(1, linkWidth);
    const path = [
      `M${sourceX},${sourceY}`,
      `C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`,
    ].join(" ");

    return (
      <path
        d={path}
        stroke={sourceNodeColor}
        strokeOpacity={0.32}
        strokeWidth={safeWidth}
        fill="none"
      />
    );
  };

  return (
    <div className="relative flex-1 min-w-0 p-2 bg-transparent" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <Sankey
          data={sankeyData}
          nodePadding={22}
          nodeWidth={14}
          linkCurvature={0.55}
          margin={{ top: 20, right: 120, bottom: 20, left: 20 }}
          node={renderNode}
          link={renderLink}
          onMouseEnter={(el: any, type: string) => {
            const toFiniteNumber = (value: unknown): number | null => {
              const numeric =
                typeof value === "number" ? value : Number(value);
              return Number.isFinite(numeric) ? numeric : null;
            };

            const linkSourceName = String(el?.payload?.source?.name ?? "");
            const linkTargetName = String(el?.payload?.target?.name ?? "");
            const nodeName = String(el?.payload?.name ?? "");
            const title =
              type === "node"
                ? nodeName
                : `${linkSourceName} -> ${linkTargetName}`;
            const value =
              type === "node"
                ? toFiniteNumber(el?.payload?.value)
                : toFiniteNumber(el?.payload?.value);

            const tooltipX =
              type === "node"
                ? toFiniteNumber(el?.x) ?? 0
                : toFiniteNumber(el?.sourceX) ?? 0;
            const tooltipY =
              type === "node"
                ? toFiniteNumber(el?.y) ?? 0
                : toFiniteNumber(el?.sourceY) ?? 0;

            if (value !== null && title.length > 0) {
              setHoverTooltip({
                x: tooltipX + 20,
                y: tooltipY + 18,
                title,
                value,
              });
            } else {
              setHoverTooltip(null);
            }

            const hoveredLabel =
              type === "node"
                ? (el?.payload?.name ?? null)
                : `${el?.payload?.source?.name ?? ""} -> ${el?.payload?.target?.name ?? ""}`;
            onLegendStateChange?.({
              tooltipPayload: el ? [el] : null,
              hoveredLabel: typeof hoveredLabel === "string" ? hoveredLabel : null,
            });
          }}
          onMouseLeave={() => {
            setHoverTooltip(null);
            onLegendStateChange?.({ tooltipPayload: null, hoveredLabel: null });
          }}
        />
      </ResponsiveContainer>
      {hoverTooltip && (
        <div
          className="pointer-events-none absolute z-20 rounded border border-border bg-card px-2 py-1 text-[11px] shadow-md"
          style={{ left: hoverTooltip.x, top: hoverTooltip.y }}
        >
          <div className="text-foreground font-medium">{hoverTooltip.title}</div>
          <div className="text-muted-foreground">
            흐름: {hoverTooltip.value.toLocaleString("ko-KR")}
          </div>
        </div>
      )}
    </div>
  );
}
