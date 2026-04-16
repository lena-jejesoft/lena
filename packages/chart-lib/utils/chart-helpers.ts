import type { ChartBlock, ChartCoreLegendMeta, ChartData, ChartStyle, ChartType, OHLCPoint } from "@/packages/chart-lib/types"
import type { ChartType as LegendPanelChartType, ExtendedDataAnalysisResult } from "@/packages/chart-lib/recharts-core/recharts-type"
import { analyzeDataQualityExtended } from "@/packages/chart-lib/recharts-core/recharts-adapter"
import { supportsOutliers } from "@/packages/chart-lib/chartCore/src/types/chart-type-config"
import { chartColors } from "@/lib/colors"

export type AnalysisRow = {
  date: string
  date_display: string
  [key: string]: string | number
}

export const LINE_LIKE_SERIES_CONTROL_TYPES = new Set([
  "line",
  "column",
  "area",
  "area-100",
  "stacked-area",
  "synced-area",
  "mixed",
  "stacked",
  "stacked-100",
  "stacked-grouped",
  "dual-axis",
  "dual-axis-stacked-bar",
  "radar",
])

export const TREEMAP_SERIES_CONTROL_TYPES = new Set([
  "treemap",
  "multi-level-treemap",
])

export const PIE_SERIES_CONTROL_TYPES = new Set([
  "pie",
])

export const LEGEND_PANEL_SUPPORTED_TYPES = new Set<LegendPanelChartType>([
  "line",
  "column",
  "area",
  "area-100",
  "stacked-area",
  "ownership-stacked",
  "synced-area",
  "mixed",
  "stacked",
  "stacked-100",
  "stacked-grouped",
  "dual-axis",
  "dual-axis-stacked-bar",
  "pie",
  "two-level-pie",
  "treemap",
  "multi-level-treemap",
  "ranking-bar",
  "geo-grid",
  "regression-scatter",
  "radar",
])

export function isOhlcPoint(point: unknown): point is OHLCPoint {
  if (!point || typeof point !== "object") return false
  const candidate = point as Partial<OHLCPoint>
  return (
    typeof candidate.x === "number" &&
    typeof candidate.open === "number" &&
    typeof candidate.high === "number" &&
    typeof candidate.low === "number" &&
    typeof candidate.close === "number"
  )
}

export function isOhlcChartData(data: ChartData): boolean {
  if (data.xAxisType !== "datetime") return false
  return data.series.some((series) => series.data.some((point) => isOhlcPoint(point)))
}

export function toSeriesRows(data: ChartData): { rows: AnalysisRow[]; fields: string[] } {
  const rowMap = new Map<string, AnalysisRow>()
  const fields = data.series.map((series) => series.id)

  for (const series of data.series) {
    for (const point of series.data) {
      if (!point || typeof point !== "object" || !("x" in point) || !("y" in point)) continue
      const key = String(point.x)
      const existing = rowMap.get(key)
      if (existing) {
        existing[series.id] = typeof point.y === "number" ? point.y : 0
        continue
      }

      rowMap.set(key, {
        date: key,
        date_display: key,
        [series.id]: typeof point.y === "number" ? point.y : 0,
      })
    }
  }

  return {
    rows: Array.from(rowMap.values()),
    fields,
  }
}

export function resolveCoreType(chartType: ChartType): string {
  const value = String(chartType)
  if (value.startsWith("chartCore/")) return value.replace("chartCore/", "")
  if (value.startsWith("recharts/")) return value.replace("recharts/", "")
  return value
}

export function getSeriesControlMode(chartType: ChartType): "line-like" | "treemap" | "pie" | "unsupported" {
  const coreType = resolveCoreType(chartType)
  if (LINE_LIKE_SERIES_CONTROL_TYPES.has(coreType)) return "line-like"
  if (TREEMAP_SERIES_CONTROL_TYPES.has(coreType)) return "treemap"
  if (PIE_SERIES_CONTROL_TYPES.has(coreType)) return "pie"
  return "unsupported"
}

export function isLegendPanelChartType(value: string): value is LegendPanelChartType {
  return LEGEND_PANEL_SUPPORTED_TYPES.has(value as LegendPanelChartType)
}

export function getEnabledSeriesMap(style: ChartStyle, chartType: ChartType): Record<string, boolean> {
  const mode = getSeriesControlMode(chartType)
  if (mode === "treemap") {
    return ((style as any).treemap?.enabled ?? {}) as Record<string, boolean>
  }
  if (mode === "pie") {
    return ((style as any).timepointPie?.enabled ?? {}) as Record<string, boolean>
  }
  if (mode === "line-like") {
    return ((style as any).timepointLine?.enabled ?? {}) as Record<string, boolean>
  }
  return {}
}

export function getChartCoreLegendMetaSignature(meta: ChartCoreLegendMeta | null | undefined): string {
  return JSON.stringify(meta ?? null)
}

export function getLegendStateSignature(state: {
  tooltipPayload: any[] | null
  hoveredLabel: string | null
  treemapStats?: any
}): string {
  return JSON.stringify({
    tooltipPayload: state.tooltipPayload ?? null,
    hoveredLabel: state.hoveredLabel ?? null,
    treemapStats: state.treemapStats ?? null,
  })
}

export const BASE_PALETTE = chartColors

export function hasRenderableSeries(block: ChartBlock): boolean {
  if (block.data.series.length === 0) return false
  return block.data.series.some((series) => series.data.length > 0)
}

export function isOutlierSupported(block: ChartBlock): boolean {
  return supportsOutliers(resolveCoreType(block.chartType))
}

export function getOutlierCount(block: ChartBlock): number {
  if (!isOutlierSupported(block)) return 0
  const { rows, fields } = toSeriesRows(block.data)
  if (rows.length === 0 || fields.length === 0) return 0
  return analyzeDataQualityExtended(rows as any, fields, fields).outliers.length
}

export function getSeriesDisplayColors(block: ChartBlock, seriesColorOverrides: Record<string, string>): Record<string, string> {
  const basePalette = block.style.colorPalette?.length ? block.style.colorPalette : BASE_PALETTE
  const colorMap: Record<string, string> = {}

  block.data.series.forEach((series, index) => {
    const fallback = series.color ?? basePalette[index % basePalette.length] ?? BASE_PALETTE[0]
    colorMap[series.id] = seriesColorOverrides[series.id] ?? fallback
  })

  return colorMap
}

export function getAnalysisResultForSeries(block: ChartBlock): ExtendedDataAnalysisResult | null {
  const { rows, fields } = toSeriesRows(block.data)
  if (rows.length === 0 || fields.length === 0) return null
  return analyzeDataQualityExtended(rows as any, fields, fields)
}

export function applyViewStateToStyle(
  block: ChartBlock,
  showOutliers: boolean,
  showTooltip: boolean,
  seriesColorOverrides: Record<string, string>
): ChartStyle {
  const colorMap = getSeriesDisplayColors(block, seriesColorOverrides)
  const palette = block.data.series
    .map((series) => colorMap[series.id])
    .filter((color): color is string => Boolean(color))

  return {
    ...block.style,
    colorPalette: palette.length > 0 ? palette : block.style.colorPalette,
    legend: { position: "none" },
    tooltip: {
      ...(block.style.tooltip ?? {}),
      shared: showTooltip,
    },
    chartCore: {
      ...(block.style.chartCore ?? {}),
      showOutliers,
    },
    timepointLine: {
      ...(block.style as any).timepointLine,
      showOutliers,
    },
  } as ChartStyle
}
