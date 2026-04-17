"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { CartesianStyle, ChartBlock, ChartStyle, Scenario } from "@/packages/chart-lib/types"
import type { ChartType as LegendPanelChartType } from "@/packages/chart-lib/recharts-core/recharts-type"
import {
  resolveCoreType,
  getSeriesControlMode,
  isLegendPanelChartType,
  getEnabledSeriesMap,
  BASE_PALETTE,
  getSeriesDisplayColors,
  getAnalysisResultForSeries,
} from "@/packages/chart-lib/utils/chart-helpers"
import { ChartLegendPanel } from "@/packages/chart-lib/recharts-core/chartTool/chart-legend-panel"

export function SeriesPanelContent({
  activeBlock,
  seriesColors,
  tooltipPayload,
  hoveredLabel,
  treemapStats,
  onBlockStyleChange,
}: {
  activeBlock: ChartBlock
  seriesColors: Record<string, string>
  tooltipPayload: any[] | null
  hoveredLabel: string | null
  treemapStats: any
  onBlockStyleChange: (blockId: string, updater: (prev: ChartStyle) => ChartStyle) => void
}) {
  const legendChartType = resolveCoreType(activeBlock.chartType)
  const seriesControlMode = getSeriesControlMode(activeBlock.chartType)
  const seriesFields = activeBlock.data.series.map((series) => series.id)
  const seriesLabelMap = Object.fromEntries(activeBlock.data.series.map((series) => [series.id, series.name]))
  const colorMap = getSeriesDisplayColors(activeBlock, seriesColors)
  const resolvedSeriesColors = seriesFields.map((field) => colorMap[field] ?? BASE_PALETTE[0])
  const enabledMap = getEnabledSeriesMap(activeBlock.style, activeBlock.chartType)
  const enabledSeries = new Set(seriesFields.filter((field) => enabledMap[field] !== false))
  const analysisResult = getAnalysisResultForSeries(activeBlock)
  const hasSeries = seriesFields.length > 0
  const canControlSeries = seriesControlMode !== "unsupported"
  const lightweightScenario = ((activeBlock.style as CartesianStyle | undefined)?.lightweightCandles?.scenario ?? "BASE") as Scenario

  const setLightweightScenario = (scenario: Scenario) => {
    onBlockStyleChange(activeBlock.id, (prev) => {
      const base = (prev as CartesianStyle) ?? {}
      return {
        ...base,
        lightweightCandles: {
          ...(base.lightweightCandles ?? {}),
          scenario,
        },
      } as ChartStyle
    })
  }

  if (activeBlock.chartType === "lightweight/candles") {
    return (
      <div className="space-y-2 rounded-md border border-border p-3">
        <h3 className="text-sm font-semibold">시나리오 밴드</h3>
        <Select
          value={lightweightScenario}
          onValueChange={(value) => setLightweightScenario(value as Scenario)}
        >
          <SelectTrigger size="sm" className="w-full h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BASE">BASE</SelectItem>
            <SelectItem value="BULL">BULL</SelectItem>
            <SelectItem value="BEAR">BEAR</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (!isLegendPanelChartType(legendChartType)) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        현재 차트 타입(`{legendChartType}`)은 패널2(시리즈) 표시를 지원하지 않습니다.
      </div>
    )
  }
  const panelChartType: LegendPanelChartType = legendChartType

  if (!hasSeries) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        시리즈 데이터가 없어 패널2를 표시할 수 없습니다.
      </div>
    )
  }

  if (!canControlSeries) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
        현재 차트 타입은 패널2에서 시리즈 제어를 지원하지 않습니다.
      </div>
    )
  }

  const toggleSeries = (field: string) => {
    const isEnabled = enabledMap[field] !== false
    const mode = getSeriesControlMode(activeBlock.chartType)

    onBlockStyleChange(activeBlock.id, (prev) => {
      if (mode === "treemap") {
        return {
          ...prev,
          treemap: {
            ...((prev as any).treemap ?? {}),
            enabled: {
              ...(((prev as any).treemap?.enabled ?? {}) as Record<string, boolean>),
              [field]: !isEnabled,
            },
          },
        } as ChartStyle
      }

      if (mode === "pie") {
        return {
          ...prev,
          timepointPie: {
            ...((prev as any).timepointPie ?? {}),
            enabled: {
              ...(((prev as any).timepointPie?.enabled ?? {}) as Record<string, boolean>),
              [field]: !isEnabled,
            },
          },
        } as ChartStyle
      }

      return {
        ...prev,
        timepointLine: {
          ...((prev as any).timepointLine ?? {}),
          enabled: {
            ...(((prev as any).timepointLine?.enabled ?? {}) as Record<string, boolean>),
            [field]: !isEnabled,
          },
        },
      } as ChartStyle
    })
  }

  const toggleAll = (enable: boolean) => {
    const mode = getSeriesControlMode(activeBlock.chartType)
    const nextMap: Record<string, boolean> = {}
    seriesFields.forEach((field) => {
      nextMap[field] = enable
    })

    onBlockStyleChange(activeBlock.id, (prev) => {
      if (mode === "treemap") {
        return {
          ...prev,
          treemap: {
            ...((prev as any).treemap ?? {}),
            enabled: nextMap,
          },
        } as ChartStyle
      }

      if (mode === "pie") {
        return {
          ...prev,
          timepointPie: {
            ...((prev as any).timepointPie ?? {}),
            enabled: nextMap,
          },
        } as ChartStyle
      }

      return {
        ...prev,
        timepointLine: {
          ...((prev as any).timepointLine ?? {}),
          enabled: nextMap,
        },
      } as ChartStyle
    })
  }

  return (
    <div className="rounded-md border border-border">
      <ChartLegendPanel
        seriesFields={seriesFields}
        seriesColors={resolvedSeriesColors}
        seriesLabelMap={seriesLabelMap}
        enabledSeries={enabledSeries}
        tooltipPayload={tooltipPayload}
        hoveredLabel={hoveredLabel}
        analysisResult={analysisResult}
        treemapStats={treemapStats}
        onSeriesToggle={toggleSeries}
        onToggleAll={toggleAll}
        chartType={panelChartType}
        chartHeight={420}
        devMode={false}
      />
    </div>
  )
}
