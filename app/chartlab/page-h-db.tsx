"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type PageHDbUploadSlotId = "A" | "B"

export type PageHDbCompanyOption = {
  id: string
  name: string
  ticker?: string
  market?: string
}

export type PageHDbDateRange = {
  start: string
  end: string
}

export type PageHDbMetricKey = string
export type PageHDbMeasureKey = "candlestick" | "line"
export type PageHDbDimensionKey = "auto" | "daily" | "monthly" | "quarterly" | "yearly"
export type PageHDbQueryMode = "ohlcv" | "metric"

export type PageHDbOption = {
  value: string
  label: string
}

export type PageHDbPreviewRow = Record<string, string | number | null>

type PageHDbDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetSlot: PageHDbUploadSlotId
  onTargetSlotChange: (slot: PageHDbUploadSlotId) => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  companies: PageHDbCompanyOption[]
  selectedCompanyId: string
  onSelectedCompanyIdChange: (companyId: string) => void
  queryMode: PageHDbQueryMode
  onQueryModeChange: (mode: PageHDbQueryMode) => void
  selectedMetric: PageHDbMetricKey
  onSelectedMetricChange: (metric: PageHDbMetricKey) => void
  metricOptions: PageHDbOption[]
  selectedDimension: PageHDbDimensionKey
  onSelectedDimensionChange: (dimension: PageHDbDimensionKey) => void
  dimensionOptions: PageHDbOption[]
  dateRange: PageHDbDateRange
  onDateRangeChange: (next: PageHDbDateRange) => void
  previewColumns: string[]
  rows: PageHDbPreviewRow[]
  companyName: string
  isCompaniesLoading: boolean
  isMetricsLoading: boolean
  isPreviewLoading: boolean
  error: string | null
  canFetchPreview: boolean
  onSearchCompanies: () => void
  onFetchPreview: () => void
  onApply: () => void
}

export function PageHDbDialog({
  open,
  onOpenChange,
  targetSlot,
  onTargetSlotChange,
  searchTerm,
  onSearchTermChange,
  companies,
  selectedCompanyId,
  onSelectedCompanyIdChange,
  queryMode,
  onQueryModeChange,
  selectedMetric,
  onSelectedMetricChange,
  metricOptions,
  selectedDimension,
  onSelectedDimensionChange,
  dimensionOptions,
  dateRange,
  onDateRangeChange,
  previewColumns,
  rows,
  companyName,
  isCompaniesLoading,
  isMetricsLoading,
  isPreviewLoading,
  error,
  canFetchPreview,
  onSearchCompanies,
  onFetchPreview,
  onApply,
}: PageHDbDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[940px]">
        <DialogHeader>
          <DialogTitle className="text-base">DB 데이터 불러오기</DialogTitle>
          <DialogDescription>
            상단에서 기업과 기간을 선택해 Supabase에서 조회하고, 하단 테이블을 확인한 뒤 슬롯 A/B에 적용합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 rounded-sm border border-border p-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">적용 슬롯</Label>
              <Select value={targetSlot} onValueChange={(value) => onTargetSlotChange(value as PageHDbUploadSlotId)}>
                <SelectTrigger size="sm" className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">기준 데이터 (A)</SelectItem>
                  <SelectItem value="B">보조 데이터 (B)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">기업 검색</Label>
              <div className="flex gap-2">
                <Input
                  value={searchTerm}
                  onChange={(event) => onSearchTermChange(event.target.value)}
                  placeholder="기업명 검색"
                  className="h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={onSearchCompanies}
                  disabled={isCompaniesLoading}
                >
                  {isCompaniesLoading ? "조회 중..." : "검색"}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">DB 데이터 선택</Label>
              <Select value={selectedCompanyId} onValueChange={onSelectedCompanyIdChange}>
                <SelectTrigger size="sm" className="w-full h-8 text-xs">
                  <SelectValue placeholder="기업을 선택해 주세요" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                      {company.ticker ? ` (${company.ticker})` : ""}
                      {company.market ? ` · ${company.market}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">조회 모드</Label>
              <Select value={queryMode} onValueChange={(value) => onQueryModeChange(value as PageHDbQueryMode)}>
                <SelectTrigger size="sm" className="w-full h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ohlcv">주가(OHLCV)</SelectItem>
                  <SelectItem value="metric">단일 metric</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {queryMode === "metric" && (
              <div className="space-y-1.5">
                <Label className="text-xs">metric</Label>
                <Select value={selectedMetric} onValueChange={(value) => onSelectedMetricChange(value as PageHDbMetricKey)}>
                  <SelectTrigger size="sm" className="w-full h-8 text-xs">
                    <SelectValue placeholder={isMetricsLoading ? "metric 로딩 중..." : "metric 선택"} />
                  </SelectTrigger>
                  <SelectContent>
                    {metricOptions.map((option) => (
                      <SelectItem key={`metric-${option.value}`} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">dimension</Label>
              <Select
                value={selectedDimension}
                onValueChange={(value) => onSelectedDimensionChange(value as PageHDbDimensionKey)}
                disabled={queryMode === "ohlcv"}
              >
                <SelectTrigger size="sm" className="w-full h-8 text-xs">
                  <SelectValue placeholder="dimension 선택" />
                </SelectTrigger>
                <SelectContent>
                  {dimensionOptions.map((option) => (
                    <SelectItem key={`dimension-${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">시작일</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(event) => onDateRangeChange({ ...dateRange, start: event.target.value })}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">종료일</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(event) => onDateRangeChange({ ...dateRange, end: event.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-muted-foreground">
              {companyName ? `${companyName} · ${rows.length}행` : "기업을 선택하고 조회를 실행해 주세요."}
            </div>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={onFetchPreview}
              disabled={!selectedCompanyId || !canFetchPreview || isPreviewLoading || isMetricsLoading}
            >
              {isPreviewLoading ? "데이터 조회 중..." : "데이터 조회"}
            </Button>
          </div>

          <div className="rounded-sm border border-border">
            <div className="h-[280px] overflow-auto">
              <table className="w-full border-collapse text-[11px]">
                <thead className="sticky top-0 z-10 bg-muted/40">
                  <tr>
                    {previewColumns.map((column) => (
                      <th key={`db-column-${column}`} className="border-b border-border px-2 py-1.5 text-left font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row, index) => (
                    <tr
                      key={`db-row-${String(row.ts_date ?? "")}-${index}`}
                      className="border-b border-border/60"
                    >
                      {previewColumns.map((column) => (
                        <td key={`db-row-${index}-${column}`} className="px-2 py-1.5">
                          {row[column] ?? "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={previewColumns.length} className="px-2 py-8 text-center text-muted-foreground">
                        조회 결과가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {rows.length > 200 && (
            <p className="text-[11px] text-muted-foreground">
              미리보기는 200행까지만 표시합니다. (총 {rows.length}행)
            </p>
          )}

          {error && (
            <div className="rounded-sm border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            onClick={onApply}
            disabled={rows.length === 0}
          >
            슬롯에 적용
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
