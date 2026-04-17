"use client"

import type { ChartBlock, ChartCoreLegendMeta, ChartStyle } from "@/packages/chart-lib/types"
import {
  resolveCoreType,
  hasRenderableSeries,
  isOutlierSupported,
  getSeriesDisplayColors,
  BASE_PALETTE,
} from "@/packages/chart-lib/utils/chart-helpers"
import { ToggleSwitch, ToggleRow } from "@/packages/chart-lib/panels/ToggleRow"
import { SeriesColorRow, SeriesColorPopover } from "@/packages/chart-lib/panels/SeriesColorRow"
import { CandleTrendColorRow } from "@/packages/chart-lib/panels/CandleTrendColorRow"
import { GroupColorRow } from "@/packages/chart-lib/panels/GroupColorRow"

export function StylePanelContent({
  activeBlock,
  outlierCount,
  chartCoreLegendMeta,
  onBlockStyleChange,
  showOutliers,
  showTooltip,
  showLegend,
  seriesColors,
  groupColors,
  onShowOutliersChange,
  onShowTooltipChange,
  onShowLegendChange,
  onSetSeriesColor,
  onRemoveSeriesColor,
  onSetGroupColor,
  onRemoveGroupColor,
  compact = false,
}: {
  activeBlock: ChartBlock
  outlierCount: number
  chartCoreLegendMeta?: ChartCoreLegendMeta | null
  onBlockStyleChange: (blockId: string, updater: (prev: ChartStyle) => ChartStyle) => void
  showOutliers: boolean
  showTooltip: boolean
  showLegend: boolean
  seriesColors: Record<string, string>
  groupColors: Record<string, string>
  onShowOutliersChange: (blockId: string, next: boolean) => void
  onShowTooltipChange: (blockId: string, next: boolean) => void
  onShowLegendChange: (blockId: string, next: boolean) => void
  onSetSeriesColor: (blockId: string, seriesId: string, color: string) => void
  onRemoveSeriesColor: (blockId: string, seriesId: string) => void
  onSetGroupColor?: (blockId: string, groupId: string, color: string) => void
  onRemoveGroupColor?: (blockId: string, groupId: string) => void
  compact?: boolean
}) {
  const hasSeries = activeBlock.data.series.length > 0
  const hasData = hasRenderableSeries(activeBlock)
  const outlierDisabled = !hasData || !isOutlierSupported(activeBlock) || outlierCount === 0
  const tooltipDisabled = !hasData
  const legendDisabled = !hasSeries
  const coreType = resolveCoreType(activeBlock.chartType)
  const canConfigureGroupColors = coreType === "two-level-pie" || coreType === "multi-level-treemap"
  const groupedLegendEntries = canConfigureGroupColors ? (chartCoreLegendMeta?.groups ?? []) : []
  const isLightweightCandles = activeBlock.chartType === "lightweight/candles"
  const chartStateColorMap = getSeriesDisplayColors(activeBlock, seriesColors)

  if (compact) {
    return (
      <div className="space-y-3">
        {/* 색상 */}
        <section className="space-y-2">
          <p className="text-xs font-medium">색상</p>
          {hasSeries ? (
            <div className="space-y-2">
              {activeBlock.data.series.map((series) => (
                <SeriesColorPopover
                  key={`${activeBlock.id}-color-${series.id}`}
                  block={activeBlock}
                  seriesId={series.id}
                  seriesColors={seriesColors}
                  onSetColor={onSetSeriesColor}
                  onRemoveColor={onRemoveSeriesColor}
                />
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">시리즈가 없습니다.</p>
          )}
        </section>

        {/* 범례 */}
        <section>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">범례</p>
            <ToggleSwitch
              checked={showLegend}
              disabled={legendDisabled}
              onChange={(next) => onShowLegendChange(activeBlock.id, next)}
              size="sm"
            />
          </div>
        </section>

        {/* 툴팁 */}
        <section>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">툴팁</p>
            <ToggleSwitch
              checked={showTooltip}
              disabled={tooltipDisabled}
              onChange={(next) => onShowTooltipChange(activeBlock.id, next)}
              size="sm"
            />
          </div>
        </section>

        {/* 이상치 */}
        <section>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">이상치</p>
            <ToggleSwitch
              checked={showOutliers}
              disabled={outlierDisabled}
              onChange={(next) => onShowOutliersChange(activeBlock.id, next)}
              size="sm"
            />
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">토글</h3>
        <ToggleRow
          title="이상치 토글"
          description={
            !hasData
              ? "데이터가 없어 이상치 토글을 사용할 수 없습니다."
              : outlierDisabled
                ? "이상치가 없거나 현재 차트가 미지원입니다."
                : `현재 이상치 ${outlierCount}건`
          }
          checked={showOutliers}
          disabled={outlierDisabled}
          onChange={(next) => onShowOutliersChange(activeBlock.id, next)}
        />
        <ToggleRow
          title="호버시 데이터 툴팁"
          description={tooltipDisabled ? "데이터가 없어 툴팁 제어를 사용할 수 없습니다." : "현재 차트 영역 전역 툴팁 표시를 제어합니다."}
          checked={showTooltip}
          disabled={tooltipDisabled}
          onChange={(next) => onShowTooltipChange(activeBlock.id, next)}
        />
        <ToggleRow
          title="레전드 토글"
          description={legendDisabled ? "시리즈가 없어 레전드 제어를 사용할 수 없습니다." : "차트 우상단 시리즈 레전드 표시/숨김을 제어합니다."}
          checked={showLegend}
          disabled={legendDisabled}
          onChange={(next) => onShowLegendChange(activeBlock.id, next)}
        />
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">시리즈 색상 선택</h3>
        <p className="text-xs text-muted-foreground">기존 팔레트 + HEX 입력 + 컬러피커</p>
        {hasSeries ? (
          <div className="space-y-2">
            {activeBlock.data.series.map((series) => (
              <SeriesColorRow
                key={`${activeBlock.id}-${series.id}`}
                block={activeBlock}
                seriesId={series.id}
                seriesColors={seriesColors}
                onSetColor={onSetSeriesColor}
                onRemoveColor={onRemoveSeriesColor}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            시리즈가 없어 색상 설정을 표시할 수 없습니다.
          </div>
        )}
      </section>

      {isLightweightCandles && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">캔들 상승/하락 색상</h3>
          <p className="text-xs text-muted-foreground">시리즈별 상승/하락 캔들 색을 설정합니다.</p>
          {hasSeries ? (
            <div className="space-y-2">
              {activeBlock.data.series.map((series, index) => (
                <CandleTrendColorRow
                  key={`${activeBlock.id}-candle-trend-${series.id}`}
                  block={activeBlock}
                  seriesId={series.id}
                  fallbackColor={chartStateColorMap[series.id] ?? series.color ?? BASE_PALETTE[index % BASE_PALETTE.length] ?? BASE_PALETTE[0]}
                  onBlockStyleChange={onBlockStyleChange}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              시리즈가 없어 캔들 색상 설정을 표시할 수 없습니다.
            </div>
          )}
        </section>
      )}

      {canConfigureGroupColors && groupedLegendEntries.length > 0 && onSetGroupColor && onRemoveGroupColor && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">그룹 색상 선택</h3>
          <p className="text-xs text-muted-foreground">그룹 헤더 색상을 제어합니다.</p>
          <div className="space-y-2">
            {groupedLegendEntries.map((group, index) => (
              <GroupColorRow
                key={`${activeBlock.id}-group-${group.id}`}
                blockId={activeBlock.id}
                groupId={group.id}
                fallbackColor={group.color ?? BASE_PALETTE[index % BASE_PALETTE.length] ?? BASE_PALETTE[0]}
                groupColors={groupColors}
                onSetColor={onSetGroupColor}
                onRemoveColor={onRemoveGroupColor}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
