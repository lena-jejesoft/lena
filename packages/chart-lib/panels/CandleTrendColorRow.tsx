"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { CartesianStyle, ChartBlock, ChartStyle } from "@/packages/chart-lib/types"

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim()
  const isValidHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)
  if (!isValidHex) return null
  if (trimmed.length === 7) return trimmed.toUpperCase()

  const expanded = trimmed
    .slice(1)
    .split("")
    .map((char) => `${char}${char}`)
    .join("")

  return `#${expanded.toUpperCase()}`
}

export function CandleTrendColorRow({
  block,
  seriesId,
  fallbackColor,
  onBlockStyleChange,
}: {
  block: ChartBlock
  seriesId: string
  fallbackColor: string
  onBlockStyleChange: (blockId: string, updater: (prev: ChartStyle) => ChartStyle) => void
}) {
  const candleSeriesColors = ((block.style as CartesianStyle | undefined)?.lightweightCandles?.candleSeriesColors ?? {})
  const seriesOverride = candleSeriesColors[seriesId]
  const displayUpColor = seriesOverride?.up ?? fallbackColor
  const displayDownColor = seriesOverride?.down ?? fallbackColor
  const hasOverride = seriesId in candleSeriesColors
  const [upHexInput, setUpHexInput] = useState(displayUpColor)
  const [downHexInput, setDownHexInput] = useState(displayDownColor)

  useEffect(() => {
    setUpHexInput(displayUpColor)
  }, [displayUpColor])

  useEffect(() => {
    setDownHexInput(displayDownColor)
  }, [displayDownColor])

  const setCandleTrendColor = (patch: Partial<{ up: string; down: string }>) => {
    onBlockStyleChange(block.id, (prev) => {
      const base = (prev as CartesianStyle) ?? {}
      const prevLightweight = base.lightweightCandles ?? {}
      const prevSeriesColors = prevLightweight.candleSeriesColors ?? {}
      const prevSeriesColor = prevSeriesColors[seriesId] ?? { up: fallbackColor, down: fallbackColor }
      const nextSeriesColors = {
        ...prevSeriesColors,
        [seriesId]: {
          up: patch.up ?? prevSeriesColor.up,
          down: patch.down ?? prevSeriesColor.down,
        },
      }
      return {
        ...base,
        lightweightCandles: {
          ...prevLightweight,
          candleSeriesColors: nextSeriesColors,
        },
      } as ChartStyle
    })
  }

  const applyUpHexInput = () => {
    const normalized = normalizeHexColor(upHexInput)
    if (!normalized) {
      setUpHexInput(displayUpColor)
      return
    }
    setCandleTrendColor({ up: normalized })
    setUpHexInput(normalized)
  }

  const applyDownHexInput = () => {
    const normalized = normalizeHexColor(downHexInput)
    if (!normalized) {
      setDownHexInput(displayDownColor)
      return
    }
    setCandleTrendColor({ down: normalized })
    setDownHexInput(normalized)
  }

  const clearCandleTrendColor = () => {
    onBlockStyleChange(block.id, (prev) => {
      const base = (prev as CartesianStyle) ?? {}
      const prevLightweight = base.lightweightCandles ?? {}
      const prevSeriesColors = prevLightweight.candleSeriesColors ?? {}
      if (!(seriesId in prevSeriesColors)) return prev
      const nextSeriesColors = { ...prevSeriesColors }
      delete nextSeriesColors[seriesId]
      return {
        ...base,
        lightweightCandles: {
          ...prevLightweight,
          candleSeriesColors: Object.keys(nextSeriesColors).length > 0 ? nextSeriesColors : undefined,
        },
      } as ChartStyle
    })
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{seriesId}</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">상승 색</Label>
        <div className="flex items-center gap-2">
          <Input
            value={upHexInput}
            onChange={(event) => setUpHexInput(event.target.value)}
            onBlur={applyUpHexInput}
            placeholder="#FFFFFF"
            className="h-8 text-xs"
          />
          <Input
            type="color"
            value={displayUpColor}
            onChange={(event) => setCandleTrendColor({ up: event.target.value })}
            className="h-8 w-11 p-1"
            aria-label={`${seriesId} 상승 색`}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">하락 색</Label>
        <div className="flex items-center gap-2">
          <Input
            value={downHexInput}
            onChange={(event) => setDownHexInput(event.target.value)}
            onBlur={applyDownHexInput}
            placeholder="#FFFFFF"
            className="h-8 text-xs"
          />
          <Input
            type="color"
            value={displayDownColor}
            onChange={(event) => setCandleTrendColor({ down: event.target.value })}
            className="h-8 w-11 p-1"
            aria-label={`${seriesId} 하락 색`}
          />
        </div>
      </div>

      {hasOverride && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7"
          onClick={clearCandleTrendColor}
        >
          커스텀 해제
        </Button>
      )}
    </div>
  )
}
