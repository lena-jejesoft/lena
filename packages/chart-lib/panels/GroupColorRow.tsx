"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  BASE_PALETTE,
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

export function GroupColorRow({
  blockId,
  groupId,
  fallbackColor,
  groupColors,
  onSetColor,
  onRemoveColor,
}: {
  blockId: string
  groupId: string
  fallbackColor: string
  groupColors: Record<string, string>
  onSetColor: (blockId: string, groupId: string, color: string) => void
  onRemoveColor: (blockId: string, groupId: string) => void
}) {
  const displayColor = groupColors[groupId] ?? fallbackColor
  const hasOverride = Boolean(groupColors[groupId])
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
    onSetColor(blockId, groupId, normalized)
    setHexInput(normalized)
  }

  return (
    <div className="rounded-md border border-border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{groupId}</p>
        <span className="inline-block h-4 w-4 rounded-sm border border-border" style={{ backgroundColor: displayColor }} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BASE_PALETTE.map((color) => (
          <button
            key={`${groupId}-${color}`}
            type="button"
            className={cn(
              "h-5 w-5 rounded-sm border",
              displayColor === color ? "border-foreground" : "border-border"
            )}
            style={{ backgroundColor: color }}
            onClick={() => onSetColor(blockId, groupId, color)}
            aria-label={`${groupId} 색상 ${color}`}
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
          onChange={(event) => onSetColor(blockId, groupId, event.target.value)}
          className="h-8 w-11 p-1"
          aria-label={`${groupId} 컬러피커`}
        />
      </div>

      {hasOverride && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="h-7"
          onClick={() => onRemoveColor(blockId, groupId)}
        >
          커스텀 해제
        </Button>
      )}
    </div>
  )
}
