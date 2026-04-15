import type { ChartData, ChartStyle, ChartType } from "@/packages/chart-lib/types"
import type { PageHDbDimensionKey, PageHDbMetricKey } from "./page-h-db"
import type { MetricDimension, MetricEntitySource, MetricValueRow } from "./query"

export type UploadSlotId = "A" | "B"

export type UploadedSourceInfo = {
  slot: UploadSlotId
  fileName: string
  fileSize: number
  mimeType: string
  columns: string[]
  rowCount: number | null
  rows: Array<Record<string, string | number | null>>
  uploadedAt: number
}

/** 트리의 메트릭 노드 (company/upload 공통) */
export type UnifiedMetricNode = {
  metricKey: PageHDbMetricKey
  label: string
  unit?: string
  origin: "company" | "upload"
  // company 메트릭 전용
  metricTypeId?: string
  entitySource?: MetricEntitySource
  dimensions?: MetricDimension[]
  hierarchyPath?: string[]
  // upload 메트릭 전용
  uploadSlot?: UploadSlotId
  columnName?: string
}

/** fetch 완료된 시리즈 데이터 */
export type ResolvedSeries = {
  metricKey: PageHDbMetricKey
  label: string
  unit?: string
  origin: "company" | "upload" | "derived"
  rows: MetricValueRow[]
}

/** 트리 표시용 그룹 (최상위) */
export type SeriesTreeSourceGroup = {
  id: string
  label: string
  origin: "company" | "upload"
  categories: SeriesTreeCategory[]
}

/** 트리 카테고리 노드 */
export type SeriesTreeCategory = {
  id: string
  label: string
  metrics: UnifiedMetricNode[]
  groups: SeriesTreeGroup[]
}

/** 트리 그룹 노드 (재귀적) */
export type SeriesTreeGroup = {
  id: string
  label: string
  metrics: UnifiedMetricNode[]
  children: SeriesTreeGroup[]
}

/** 패널 Props */
export type SeriesAdditionPanelProps = {
  activeBlock:
    | {
        id: string
        title: string
        description: string
        chartType: ChartType
        data: ChartData
        style: ChartStyle
      }
    | undefined
  onUpdateBlock: (data: ChartData, title: string, description: string) => void
  onCreateBlock: (data: ChartData, title: string, description: string, chartType: ChartType) => void
  uploadedSources: { A: UploadedSourceInfo | null; B: UploadedSourceInfo | null }
  onOpenUploadDialog: () => void
  onDerivedSectionElementChange?: (node: HTMLElement | null) => void
}

/** 시리즈 추가 패널 상태 */
export type SeriesAdditionPanelState = {
  companyId: string
  companySearchTerm: string
  metricSearchTerm: string
  dimensionKey: PageHDbDimensionKey
  checkedMetricKeys: PageHDbMetricKey[]
}
