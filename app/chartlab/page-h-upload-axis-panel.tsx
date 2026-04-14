"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type PageHUploadAxisPanelProps = {
  title: string
  description?: string
  availableXKeys: string[]
  selectedXKey: string
  xKeyLabelMap?: Record<string, string>
  availableYKeys: string[]
  selectedYKeys: string[]
  onXChange?: (xKey: string) => void
  readonlyXLabel?: string
  onYToggle: (yKey: string) => void
  onYSelectAll: () => void
  onYClear: () => void
}

export function PageHUploadAxisPanel({
  title,
  description,
  availableXKeys,
  selectedXKey,
  xKeyLabelMap,
  availableYKeys,
  selectedYKeys,
  onXChange,
  readonlyXLabel,
  onYToggle,
  onYSelectAll,
  onYClear,
}: PageHUploadAxisPanelProps) {
  return (
    <div className="space-y-1.5 rounded-sm border border-border p-2">
      <p className="text-xs font-medium">{title}</p>
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}

      <div className="space-y-1">
        <Label className="text-xs">X축</Label>
        {typeof onXChange === "function" ? (
          <Select value={selectedXKey} onValueChange={onXChange}>
            <SelectTrigger size="sm" className="h-8 text-xs">
              <SelectValue placeholder="X축 컬럼 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableXKeys.map((column) => (
                <SelectItem key={`axis-x-${column}`} value={column}>
                  {xKeyLabelMap?.[column] ?? column}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="rounded-sm border border-border/70 px-2 py-1.5 text-[11px] text-muted-foreground">
            {readonlyXLabel || "-"}
          </p>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Y축</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={onYSelectAll}
              disabled={availableYKeys.length === 0}
            >
              전체 선택
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={onYClear}
              disabled={selectedYKeys.length === 0}
            >
              전체 해제
            </Button>
          </div>
        </div>

        {availableYKeys.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">선택 가능한 Y 컬럼이 없습니다.</p>
        ) : (
          <div className="max-h-[140px] space-y-1 overflow-auto rounded-sm border border-border/70 p-1.5">
            {availableYKeys.map((column) => (
              <label
                key={`axis-y-${column}`}
                className="flex cursor-pointer items-center gap-1.5 rounded-sm px-1 py-0.5 text-[11px] hover:bg-accent/40"
              >
                <input
                  type="checkbox"
                  checked={selectedYKeys.includes(column)}
                  onChange={() => onYToggle(column)}
                />
                <span className="truncate">{column}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
