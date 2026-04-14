"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PageHDbMetricKey } from "./page-h-db"
import type { DerivedFormulaPreset } from "./page-h-derived-types"

type DerivedMetricOption = {
  metricKey: PageHDbMetricKey
  label: string
}

type PageHDerivedPanelProps = {
  formulaOptions: DerivedFormulaPreset[]
  selectedFormulaId: string
  selectedFormulaInputCount: 1 | 2
  metricOptions: DerivedMetricOption[]
  primaryMetricKey: string
  secondaryMetricKey: string
  customName: string
  error: string | null
  onFormulaChange: (formulaId: string) => void
  onPrimaryMetricChange: (metricKey: string) => void
  onSecondaryMetricChange: (metricKey: string) => void
  onCustomNameChange: (value: string) => void
}

export function PageHDerivedPanel({
  formulaOptions,
  selectedFormulaId,
  selectedFormulaInputCount,
  metricOptions,
  primaryMetricKey,
  secondaryMetricKey,
  customName,
  error,
  onFormulaChange,
  onPrimaryMetricChange,
  onSecondaryMetricChange,
  onCustomNameChange,
}: PageHDerivedPanelProps) {
  const selectedFormula = formulaOptions.find((item) => item.id === selectedFormulaId) ?? formulaOptions[0]

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">파생 지표 계산</p>
        <p className="text-[11px] text-muted-foreground">원본 metric 계산식으로 새 시리즈를 생성합니다.</p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">계산식</span>
          <Select value={selectedFormulaId} onValueChange={onFormulaChange}>
            <SelectTrigger size="sm" className="h-7 w-full text-xs bg-transparent border-b border-border/40 rounded-none">
              <SelectValue placeholder="계산식을 선택해 주세요" />
            </SelectTrigger>
            <SelectContent>
              {formulaOptions.map((formula) => (
                <SelectItem key={`formula-${formula.id}`} value={formula.id}>
                  {formula.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedFormula && (
            <p className="text-[11px] text-muted-foreground">{selectedFormula.description}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">원본 지표 A</span>
          <Select value={primaryMetricKey} onValueChange={onPrimaryMetricChange}>
            <SelectTrigger size="sm" className="h-7 w-full text-xs bg-transparent border-b border-border/40 rounded-none">
              <SelectValue placeholder="metric A 선택" />
            </SelectTrigger>
            <SelectContent>
              {metricOptions.map((metric) => (
                <SelectItem key={`derived-primary-${metric.metricKey}`} value={metric.metricKey}>
                  {metric.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedFormulaInputCount === 2 && (
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">원본 지표 B</span>
            <Select value={secondaryMetricKey} onValueChange={onSecondaryMetricChange}>
              <SelectTrigger size="sm" className="h-7 w-full text-xs bg-transparent border-b border-border/40 rounded-none">
                <SelectValue placeholder="metric B 선택" />
              </SelectTrigger>
              <SelectContent>
                {metricOptions.map((metric) => (
                  <SelectItem key={`derived-secondary-${metric.metricKey}`} value={metric.metricKey}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">파생 지표명</span>
          <Input
            className="h-7 w-full text-xs bg-transparent border-b border-border/40 rounded-none"
            value={customName}
            onChange={(event) => onCustomNameChange(event.target.value)}
            placeholder="비워두면 자동 이름을 사용합니다."
          />
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
