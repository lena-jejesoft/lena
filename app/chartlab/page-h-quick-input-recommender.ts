import type { CompanyMetricCatalogItem } from "./query"
import {
  fetchMockSectorbookCompanies,
  fetchMockSectorbookMetricCatalog,
  type MockSectorbookCompany,
} from "./mock-sectorbook-provider"

export type QuickInputRecommendation = {
  companyId: string
  companyLabel: string
  metricKey: string
  metricLabel: string
  queryText: string
  score: number
}

const METRIC_SYNONYM_MAP: Record<string, string[]> = {
  매출: ["매출액", "revenue"],
  영업이익: ["operatingincome"],
  순이익: ["당기순이익", "netincome"],
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\]{}\-_/\\.,:;'"`~!?]/g, " ")
    .replace(/\s+/g, "")
    .trim()
}

function splitTokens(value: string): string[] {
  return value
    .trim()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function getEditDistance(source: string, target: string): number {
  if (source === target) return 0
  if (!source.length) return target.length
  if (!target.length) return source.length

  const rows = source.length + 1
  const cols = target.length + 1
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0))

  for (let i = 0; i < rows; i += 1) {
    matrix[i]![0] = i
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0]![j] = j
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + substitutionCost
      )
    }
  }

  return matrix[rows - 1]![cols - 1]!
}

function getTextSimilarity(sourceValue: string, targetValue: string): number {
  const source = normalizeText(sourceValue)
  const target = normalizeText(targetValue)
  if (!source || !target) return 0
  if (source === target) return 1

  const maxLength = Math.max(source.length, target.length)
  let best = 1 - getEditDistance(source, target) / maxLength

  if (source.includes(target) || target.includes(source)) {
    const overlap = Math.min(source.length, target.length) / maxLength
    best = Math.max(best, overlap)
  }

  const shorterLength = Math.min(source.length, target.length)
  if (shorterLength >= 2) {
    const longer = source.length >= target.length ? source : target
    const shorter = source.length >= target.length ? target : source
    for (let i = 0; i <= longer.length - shorterLength; i += 1) {
      const fragment = longer.slice(i, i + shorterLength)
      const fragmentScore = 1 - getEditDistance(fragment, shorter) / shorterLength
      if (fragmentScore > best) {
        best = fragmentScore
      }
    }
  }

  return Math.max(0, Math.min(1, best))
}

function extractHints(query: string): { entityHint: string; metricHint: string } {
  const normalized = query.replace(/\s+/g, " ").trim()
  const markerIndex = normalized.indexOf("의")
  if (markerIndex > 0) {
    return {
      entityHint: normalized.slice(0, markerIndex).trim(),
      metricHint: normalized.slice(markerIndex + 1).trim(),
    }
  }

  const tokens = splitTokens(normalized)
  return {
    entityHint: tokens[0] ?? "",
    metricHint: tokens.slice(1).join(" "),
  }
}

function expandMetricHints(metricHint: string): string[] {
  const baseTokens = splitTokens(metricHint)
  const expanded = new Set<string>(baseTokens)
  for (const token of baseTokens) {
    const mapped = METRIC_SYNONYM_MAP[token]
    if (!mapped) continue
    mapped.forEach((candidate) => expanded.add(candidate))
  }
  return Array.from(expanded)
}

function scoreCompany(company: MockSectorbookCompany, entityHint: string, fullQuery: string): number {
  if (!entityHint) {
    return Math.round(getTextSimilarity(company.name, fullQuery) * 80)
  }

  const normalizedEntityHint = entityHint.toLowerCase().trim()
  const normalizedName = company.name.toLowerCase()
  let score = 0

  if (normalizedName === normalizedEntityHint) score += 140
  if (normalizedName.startsWith(normalizedEntityHint)) score += 70
  if (normalizedName.includes(normalizedEntityHint)) score += 45
  if (company.ticker.toLowerCase().includes(normalizedEntityHint)) score += 35

  const similarity = getTextSimilarity(company.name, entityHint)
  if (similarity >= 0.35) {
    score += Math.round(similarity * 90)
  }

  return score
}

function scoreMetric(metric: CompanyMetricCatalogItem, metricHint: string, fullQuery: string): number {
  const fallbackHint = metricHint.trim() || fullQuery.trim()
  if (!fallbackHint) return 0

  const normalizedMetricLabel = metric.metricLabel.toLowerCase()
  const normalizedMetricName = metric.metricName.toLowerCase()

  let score = 0
  const candidates = expandMetricHints(fallbackHint)
  if (candidates.length === 0) {
    candidates.push(fallbackHint)
  }

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase()
    if (!normalizedCandidate) continue

    if (normalizedMetricLabel === normalizedCandidate) score += 120
    if (normalizedMetricName === normalizedCandidate) score += 90
    if (normalizedMetricLabel.startsWith(normalizedCandidate)) score += 45
    if (normalizedMetricName.startsWith(normalizedCandidate)) score += 30
    if (normalizedMetricLabel.includes(normalizedCandidate)) score += 20
    if (normalizedMetricName.includes(normalizedCandidate)) score += 15

    const similarity = Math.max(
      getTextSimilarity(metric.metricLabel, candidate),
      getTextSimilarity(metric.metricName, candidate)
    )
    if (similarity >= 0.35) {
      score += Math.round(similarity * 70)
    }
  }

  return score
}

export async function recommendQuickInputFromMock(params: {
  query: string
  limit?: number
}): Promise<{ items: QuickInputRecommendation[]; error: string | null }> {
  const query = String(params.query ?? "").trim()
  const limit = Number.isFinite(Number(params.limit))
    ? Math.max(1, Math.floor(Number(params.limit)))
    : 3

  if (!query) {
    return {
      items: [],
      error: null,
    }
  }

  const { items: companies, error: companiesError } = await fetchMockSectorbookCompanies({
    limit: 50,
  })
  if (companiesError) {
    return {
      items: [],
      error: companiesError,
    }
  }

  if (companies.length === 0) {
    return {
      items: [],
      error: "추천할 기업 목록이 없습니다.",
    }
  }

  const { entityHint, metricHint } = extractHints(query)
  const companyCandidates = companies
    .map((company) => ({
      company,
      score: scoreCompany(company, entityHint, query),
    }))
    .sort((a, b) => b.score - a.score)

  const filteredCompanies = companyCandidates.filter((candidate) => candidate.score > 0)
  const prioritizedCompanies = (filteredCompanies.length > 0
    ? filteredCompanies
    : companyCandidates.slice(0, 3)
  ).slice(0, 3)

  const recommendations: Array<QuickInputRecommendation & { dedupeKey: string }> = []

  for (const candidate of prioritizedCompanies) {
    const catalogResponse = await fetchMockSectorbookMetricCatalog({ companyId: candidate.company.id })
    if (catalogResponse.error) {
      continue
    }

    for (const metric of catalogResponse.items) {
      const metricScore = scoreMetric(metric, metricHint, query)
      const totalScore = candidate.score + metricScore
      if (totalScore <= 0) continue

      recommendations.push({
        companyId: candidate.company.id,
        companyLabel: candidate.company.name,
        metricKey: metric.metricTypeId,
        metricLabel: metric.metricLabel,
        queryText: `${candidate.company.name} ${metric.metricLabel}`,
        score: totalScore,
        dedupeKey: `${candidate.company.id}:${metric.metricTypeId}`,
      })
    }
  }

  const dedupedMap = new Map<string, QuickInputRecommendation>()
  recommendations
    .sort((a, b) => b.score - a.score)
    .forEach((item) => {
      if (dedupedMap.has(item.dedupeKey)) return
      dedupedMap.set(item.dedupeKey, {
        companyId: item.companyId,
        companyLabel: item.companyLabel,
        metricKey: item.metricKey,
        metricLabel: item.metricLabel,
        queryText: item.queryText,
        score: item.score,
      })
    })

  return {
    items: Array.from(dedupedMap.values()).slice(0, limit),
    error: null,
  }
}
