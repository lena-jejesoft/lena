"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ChartBlock } from "@/packages/chart-lib/types"
import {
  BASE_PALETTE,
  getSeriesDisplayColors,
} from "@/packages/chart-lib/utils/chart-helpers"
import { cn } from "@/lib/utils"

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

// ─── Full-width color row (page-h style) ───

export function SeriesColorRow({
  block,
  seriesId,
  seriesColors,
  onSetColor,
  onRemoveColor,
}: {
  block: ChartBlock
  seriesId: string
  seriesColors: Record<string, string>
  onSetColor: (blockId: string, seriesId: string, color: string) => void
  onRemoveColor: (blockId: string, seriesId: string) => void
}) {
  const displayLabel = block.data.series.find((series) => series.id === seriesId)?.name?.trim() || seriesId
  const colorMap = getSeriesDisplayColors(block, seriesColors)
  const displayColor = colorMap[seriesId] ?? BASE_PALETTE[0]
  const hasOverride = Boolean(seriesColors[seriesId])
  const [hexInput, setHexInput] = useState(displayColor)

  useEffect(() => {
    setHexInput(displayColor)
  }, [displayColor])

  const applyHexInput = () => {
    const normalized = normalizeHexColor(hexInput)
    if (!normalized) {
      setHexInput(displayColor)
      return
    }
    onSetColor(block.id, seriesId, normalized)
    setHexInput(normalized)
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{displayLabel}</p>
        <span className="inline-block h-4 w-4 rounded-sm border border-border" style={{ backgroundColor: displayColor }} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BASE_PALETTE.map((color) => (
          <button
            key={`${seriesId}-${color}`}
            type="button"
            className={cn(
              "h-5 w-5 rounded-sm border",
              displayColor === color ? "border-foreground" : "border-border"
            )}
            style={{ backgroundColor: color }}
            onClick={() => onSetColor(block.id, seriesId, color)}
            aria-label={`${displayLabel} 색상 ${color}`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={hexInput}
          onChange={(event) => setHexInput(event.target.value)}
          onBlur={applyHexInput}
          placeholder="#FFFFFF"
          className="h-8 text-xs"
        />
        <Input
          type="color"
          value={displayColor}
          onChange={(event) => onSetColor(block.id, seriesId, event.target.value)}
          className="h-8 w-11 p-1"
          aria-label={`${displayLabel} 컬러피커`}
        />
      </div>

      {hasOverride && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7"
          onClick={() => onRemoveColor(block.id, seriesId)}
        >
          커스텀 해제
        </Button>
      )}
    </div>
  )
}

// ─── Compact popover color picker (card-body style) ───

export function SeriesColorPopover({
  block,
  seriesId,
  seriesColors,
  onSetColor,
  onRemoveColor,
}: {
  block: ChartBlock
  seriesId: string
  seriesColors: Record<string, string>
  onSetColor: (blockId: string, seriesId: string, color: string) => void
  onRemoveColor: (blockId: string, seriesId: string) => void
}) {
  const displayLabel = block.data.series.find((series) => series.id === seriesId)?.name?.trim() || seriesId
  const colorMap = getSeriesDisplayColors(block, seriesColors)
  const displayColor = colorMap[seriesId] ?? BASE_PALETTE[0]
  const hasOverride = Boolean(seriesColors[seriesId])
  const [hexInput, setHexInput] = useState(displayColor)

  useEffect(() => {
    setHexInput(displayColor)
  }, [displayColor])

  const applyHexInput = () => {
    const normalized = normalizeHexColor(hexInput)
    if (!normalized) {
      setHexInput(displayColor)
      return
    }
    onSetColor(block.id, seriesId, normalized)
    setHexInput(normalized)
  }

  return (
    <Popover>
      <div className="flex items-center gap-2">
        <p className="truncate text-[11px] text-muted-foreground">{displayLabel}</p>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="ml-auto h-4 w-4 shrink-0 rounded-sm border-border cursor-pointer"
            style={{ backgroundColor: displayColor }}
            aria-label={`${displayLabel} 색상 선택`}
          />
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-44 p-2" align="start">
        <Tabs defaultValue="palette">
          <TabsList className="w-full mb-2">
            <TabsTrigger value="palette" className="flex-1 text-xs">팔레트</TabsTrigger>
            <TabsTrigger value="custom" className="flex-1 text-xs">커스텀</TabsTrigger>
          </TabsList>
          <TabsContent value="palette" className="mt-0">
            <div className="flex flex-wrap gap-1">
              {BASE_PALETTE.map((color) => (
                <button
                  key={`${seriesId}-${color}`}
                  type="button"
                  className={cn(
                    "h-4 w-4 rounded-sm",
                    displayColor.toLowerCase() === color.toLowerCase()
                      ? "border-foreground border-2"
                      : "border-border"
                  )}
                  style={{ backgroundColor: color }}
                  title={color}
                  onClick={() => onSetColor(block.id, seriesId, color)}
                  aria-label={`${displayLabel} 색상 ${color}`}
                />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="custom" className="mt-0 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="h-8 w-8 shrink-0 rounded-sm border border-border"
                style={{ backgroundColor: displayColor }}
              />
              <Input
                value={hexInput}
                onChange={(event) => setHexInput(event.target.value)}
                onBlur={applyHexInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyHexInput()
                }}
                placeholder="#FFFFFF"
                className="h-8 text-xs"
              />
            </div>
            {hasOverride && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-7 w-full"
                onClick={() => onRemoveColor(block.id, seriesId)}
              >
                커스텀 해제
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  )
}
