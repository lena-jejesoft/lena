import type { PageHDbDimensionKey, PageHDbMetricKey } from "./page-h-db"
import type { MetricDimension, MetricEntitySource } from "./query"

export type HierarchyMetricCandidate = {
  metricKey: PageHDbMetricKey
  metricTypeId: string
  metricName: string
  label: string
  unit?: string
  entitySource: MetricEntitySource
  dimensions: MetricDimension[]
  hierarchyPath?: string[]
}

export type HierarchyMetricNode = HierarchyMetricCandidate & {
  categoryId: string
  categoryLabel: string
}

export type HierarchyCategoryNode = {
  id: string
  label: string
  metrics: HierarchyMetricNode[]
  groups: HierarchyTreeNode[]
}

export type HierarchyTreeNode = {
  id: string
  label: string
  metrics: HierarchyMetricNode[]
  children: HierarchyTreeNode[]
}

export type HierarchySourceNode = {
  id: MetricEntitySource
  label: string
  categories: HierarchyCategoryNode[]
}

export type HierarchySelectedMetric = {
  metricKey: PageHDbMetricKey
  label: string
  unit?: string
  entitySource: MetricEntitySource
}

export type PageHHierarchyState = {
  companyId: string
  companySearchTerm: string
  metricSearchTerm: string
  dimensionKey: PageHDbDimensionKey
  selectedMetricKeys: PageHDbMetricKey[]
}
