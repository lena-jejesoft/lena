"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCompanySearch } from "@/hooks/useCompanySearch";
import type { Company } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartRenderer } from "@/packages/chart-lib/ChartRenderer";
import type { ChartData, ChartType } from "@/packages/chart-lib/types";
import {
  fetchCompanyMetricCatalog,
  type CompanyMetricCatalogItem,
  type MetricDimension,
  type MetricEntitySource,
} from "./query";

type PeriodType = "yearly" | "quarterly" | "monthly" | "daily";
type PeriodMode = "auto" | PeriodType;

interface IntentInput {
  entityName: string;
  metricName: string;
  lookbackYears: number;
  chartType: ChartType;
}

interface MetricItemRow {
  ts_date: string;
  period_type: string | null;
  value: number | string;
  dimension_key: string | null;
  metadata: Record<string, unknown> | null;
}

interface ResolvedSummary {
  companyName: string;
  metricLabel: string;
  metricCode: string;
  periodType: PeriodType;
  latestDate: string;
}

interface RowPoint {
  label: string;
  tsDate: string;
  value: number;
}

interface SelectedCompany {
  id: string;
  name: string;
  ticker?: string | null;
}

interface SelectedMetric {
  metricTypeId: string;
  metricName: string;
  metricLabel: string;
  entitySource: MetricEntitySource;
  dimensions: MetricDimension[];
}

interface LoadIntentChartOverrides {
  nextIntent?: IntentInput;
  nextPeriodMode?: PeriodMode;
  company?: SelectedCompany | null;
  metric?: SelectedMetric | null;
}

const DEFAULT_INTENT: IntentInput = {
  entityName: "카카오",
  metricName: "매출액",
  lookbackYears: 5,
  chartType: "column",
};

const PERIOD_PRIORITY: PeriodType[] = ["yearly", "quarterly", "monthly", "daily"];

const CHART_TYPE_OPTIONS: Array<{ value: ChartType; label: string }> = [
  { value: "bar", label: "Bar" },
  { value: "column", label: "Column" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
];

const PERIOD_OPTIONS: Array<{ value: PeriodMode; label: string }> = [
  { value: "auto", label: "자동" },
  { value: "yearly", label: "연간" },
  { value: "quarterly", label: "분기" },
  { value: "monthly", label: "월간" },
  { value: "daily", label: "일간" },
];

function getRangeStartDate(latestDate: string, lookbackYears: number): string {
  const base = new Date(`${latestDate}T00:00:00`);
  const startYear = base.getFullYear() - lookbackYears + 1;
  return `${startYear}-01-01`;
}

function normalizeNumeric(value: number | string): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function periodLabelFromRow(periodType: PeriodType, row: MetricItemRow): string {
  const year = row.ts_date.slice(0, 4);

  if (periodType === "yearly") {
    return year;
  }

  if (periodType === "quarterly") {
    const quarter = row.metadata?.fiscal_quarter;
    const q = typeof quarter === "number" ? quarter : Number(quarter);
    if (Number.isFinite(q) && q >= 1 && q <= 4) {
      return `${year}-Q${q}`;
    }

    const month = Number(row.ts_date.slice(5, 7));
    const monthToQuarter: Record<number, number> = { 3: 1, 6: 2, 9: 3, 12: 4 };
    const derived = monthToQuarter[month];
    return derived ? `${year}-Q${derived}` : row.ts_date;
  }

  if (periodType === "monthly") {
    return row.ts_date.slice(0, 7);
  }

  return row.ts_date;
}

function formatPeriodType(periodType: PeriodType): string {
  if (periodType === "yearly") return "연간";
  if (periodType === "quarterly") return "분기";
  if (periodType === "monthly") return "월간";
  return "일간";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function normalizeMetricText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\]{}\-_/\\.,:;'"`~!?]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function getEditDistance(source: string, target: string): number {
  if (source === target) return 0;
  if (!source.length) return target.length;
  if (!target.length) return source.length;

  const rows = source.length + 1;
  const cols = target.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i]![0] = i;
  }
  for (let j = 0; j < cols; j += 1) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const substitutionCost = source[i - 1] === target[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + substitutionCost
      );
    }
  }

  return matrix[rows - 1]![cols - 1]!;
}

function getTextSimilarity(sourceValue: string, targetValue: string): number {
  const source = normalizeMetricText(sourceValue);
  const target = normalizeMetricText(targetValue);
  if (!source || !target) return 0;
  if (source === target) return 1;

  const maxLength = Math.max(source.length, target.length);
  let best = 1 - getEditDistance(source, target) / maxLength;

  if (source.includes(target) || target.includes(source)) {
    const overlap = Math.min(source.length, target.length) / maxLength;
    best = Math.max(best, overlap);
  }

  const shorterLength = Math.min(source.length, target.length);
  if (shorterLength >= 2) {
    const longer = source.length >= target.length ? source : target;
    const shorter = source.length >= target.length ? target : source;
    for (let i = 0; i <= longer.length - shorterLength; i += 1) {
      const fragment = longer.slice(i, i + shorterLength);
      const fragmentScore = 1 - getEditDistance(fragment, shorter) / shorterLength;
      if (fragmentScore > best) {
        best = fragmentScore;
      }
    }
  }

  return Math.max(0, Math.min(1, best));
}

function scoreCatalogMetric(metric: SelectedMetric, query: string): number {
  const q = query.trim().toLowerCase();
  const label = metric.metricLabel.toLowerCase();
  const name = metric.metricName.toLowerCase();

  let score = 0;

  if (label === q) score += 100;
  if (name === q) score += 90;
  if (label.includes(q)) score += 20;
  if (name.includes(q)) score += 20;

  if (metric.metricName.startsWith("dart:summary:")) score += 20;

  const similarity = Math.max(
    getTextSimilarity(metric.metricLabel, query),
    getTextSimilarity(metric.metricName, query)
  );
  const fuzzyThreshold = q.length <= 2 ? 0.5 : q.length <= 4 ? 0.42 : 0.35;
  if (similarity >= fuzzyThreshold) {
    score += Math.round(similarity * 60);
  }
  if (similarity >= 0.85) {
    score += 20;
  }

  return score;
}

function toSelectedCompany(company: Company): SelectedCompany {
  return {
    id: company.id,
    name: company.name,
    ticker: company.ticker ?? null,
  };
}

function toSelectedMetric(item: CompanyMetricCatalogItem): SelectedMetric {
  return {
    metricTypeId: item.metricTypeId,
    metricName: item.metricName,
    metricLabel: item.metricLabel,
    entitySource: item.entitySource,
    dimensions: item.dimensions,
  };
}

export default function ChartlabSheetIntentPage() {
  const supabase = useMemo(() => createClient(), []);
  const didInitRef = useRef(false);
  const companyContainerRef = useRef<HTMLDivElement>(null);
  const metricContainerRef = useRef<HTMLDivElement>(null);

  const [intent, setIntent] = useState<IntentInput>(DEFAULT_INTENT);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("auto");

  const [selectedCompany, setSelectedCompany] = useState<SelectedCompany | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<SelectedMetric | null>(null);

  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [metricDropdownOpen, setMetricDropdownOpen] = useState(false);
  const [metricLoading, setMetricLoading] = useState(false);
  const [metricCatalogMap, setMetricCatalogMap] = useState<Record<string, SelectedMetric[]>>({});

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedSummary | null>(null);
  const [rows, setRows] = useState<RowPoint[]>([]);

  const {
    setQuery: setCompanyQuery,
    results: companySuggestions,
    isLoading: companyLoading,
  } = useCompanySearch(DEFAULT_INTENT.entityName);

  const chartData: ChartData = useMemo(() => {
    if (rows.length === 0) {
      return { xAxisType: "category", series: [] };
    }

    return {
      xAxisType: "category",
      series: [
        {
          id: "intent-series",
          name: `${intent.entityName} ${intent.metricName}`,
          data: rows.map((row) => ({ x: row.label, y: row.value })),
        },
      ],
    };
  }, [intent.entityName, intent.metricName, rows]);

  const activeMetricCatalog = useMemo(() => {
    if (!selectedCompany) return [];
    return metricCatalogMap[selectedCompany.id] ?? [];
  }, [metricCatalogMap, selectedCompany]);

  const filteredMetricSuggestions = useMemo(() => {
    if (!selectedCompany) return [];

    const query = intent.metricName.trim().toLowerCase();
    const source = activeMetricCatalog;

    if (!query) {
      return source.slice(0, 30);
    }

    return source
      .filter((metric) => {
        return (
          metric.metricLabel.toLowerCase().includes(query) ||
          metric.metricName.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => scoreCatalogMetric(b, query) - scoreCatalogMetric(a, query))
      .slice(0, 30);
  }, [activeMetricCatalog, intent.metricName, selectedCompany]);

  const loadMetricCatalogForCompany = useCallback(async (company: SelectedCompany): Promise<SelectedMetric[]> => {
    const cached = metricCatalogMap[company.id];
    if (cached) {
      return cached;
    }

    setMetricLoading(true);
    const { items, error } = await fetchCompanyMetricCatalog(supabase, { companyId: company.id });
    setMetricLoading(false);

    if (error) {
      setErrorMessage(error);
      return [];
    }

    const mapped = items.map((item) => toSelectedMetric(item));

    setMetricCatalogMap((prev) => ({
      ...prev,
      [company.id]: mapped,
    }));

    return mapped;
  }, [metricCatalogMap, supabase]);

  const loadIntentChart = useCallback(async (overrides?: LoadIntentChartOverrides) => {
    setLoading(true);
    setErrorMessage(null);

    const activeIntent = overrides?.nextIntent ?? intent;
    const activePeriodMode = overrides?.nextPeriodMode ?? periodMode;

    let activeCompany = overrides?.company !== undefined ? overrides.company : selectedCompany;
    let activeMetric = overrides?.metric !== undefined ? overrides.metric : selectedMetric;

    const trimmedEntityName = activeIntent.entityName.trim();
    const trimmedMetricName = activeIntent.metricName.trim();
    const lookbackYears = Number.isFinite(activeIntent.lookbackYears)
      ? Math.max(1, Math.floor(activeIntent.lookbackYears))
      : 5;

    try {
      if (!trimmedEntityName || !trimmedMetricName) {
        setRows([]);
        setResolved(null);
        setErrorMessage("기업명과 메트릭명을 입력해주세요.");
        return;
      }

      if (!activeCompany) {
        const { data: exactCompany, error: exactCompanyError } = await supabase
          .from("entity_item")
          .select("id, name, type:entity_type!inner(name), data")
          .eq("type.name", "company")
          .eq("name", trimmedEntityName)
          .limit(1)
          .maybeSingle();

        if (exactCompanyError) {
          setRows([]);
          setResolved(null);
          setErrorMessage(exactCompanyError.message);
          return;
        }

        let resolvedCompany = exactCompany as (Company & { data?: Record<string, unknown> | null }) | null;

        if (!resolvedCompany) {
          const { data: fallbackCompany, error: fallbackCompanyError } = await supabase
            .from("entity_item")
            .select("id, name, type:entity_type!inner(name), data")
            .eq("type.name", "company")
            .ilike("name", `%${trimmedEntityName}%`)
            .order("name")
            .limit(1)
            .maybeSingle();

          if (fallbackCompanyError) {
            setRows([]);
            setResolved(null);
            setErrorMessage(fallbackCompanyError.message);
            return;
          }

          resolvedCompany = (fallbackCompany as (Company & { data?: Record<string, unknown> | null }) | null) ?? null;
        }

        if (!resolvedCompany) {
          setRows([]);
          setResolved(null);
          setErrorMessage(`기업을 찾을 수 없습니다: ${trimmedEntityName}`);
          return;
        }

        activeCompany = {
          id: resolvedCompany.id,
          name: resolvedCompany.name,
          ticker: resolvedCompany.ticker ?? null,
        };

        setSelectedCompany(activeCompany);
      }

      if (!activeCompany) {
        setRows([]);
        setResolved(null);
        setErrorMessage("기업을 확인할 수 없습니다.");
        return;
      }

      const companyMetricCatalog = await loadMetricCatalogForCompany(activeCompany);

      if (!activeMetric) {
        const candidates = companyMetricCatalog
          .filter((metric) => {
            return (
              metric.metricLabel.toLowerCase().includes(trimmedMetricName.toLowerCase()) ||
              metric.metricName.toLowerCase().includes(trimmedMetricName.toLowerCase())
            );
          })
          .sort((a, b) => scoreCatalogMetric(b, trimmedMetricName) - scoreCatalogMetric(a, trimmedMetricName));

        if (candidates.length === 0) {
          setRows([]);
          setResolved(null);
          setErrorMessage(`선택한 회사에서 메트릭을 찾을 수 없습니다: ${trimmedMetricName}`);
          return;
        }

        activeMetric = candidates[0];
        setSelectedMetric(activeMetric);
      }

      if (!activeMetric) {
        setRows([]);
        setResolved(null);
        setErrorMessage("메트릭을 확인할 수 없습니다.");
        return;
      }

      if (activePeriodMode !== "auto" && !activeMetric.dimensions.includes(activePeriodMode)) {
        setRows([]);
        setResolved(null);
        setErrorMessage("선택한 메트릭에 해당 주기 데이터가 없습니다.");
        return;
      }

      let targetEntityId = activeCompany.id;
      if (activeMetric.entitySource === "issuer") {
        const { data: issuerRelation, error: issuerError } = await supabase
          .from("relation_item")
          .select("to_entity_id, type:relation_type!inner(name)")
          .eq("from_entity_id", activeCompany.id)
          .eq("type.name", "Issuer")
          .limit(1)
          .maybeSingle();

        if (issuerError) {
          setRows([]);
          setResolved(null);
          setErrorMessage(issuerError.message);
          return;
        }

        if (!issuerRelation?.to_entity_id) {
          setRows([]);
          setResolved(null);
          setErrorMessage(`${activeCompany.name} Issuer 관계를 찾을 수 없습니다.`);
          return;
        }

        targetEntityId = issuerRelation.to_entity_id;
      }

      const periodCandidates = activePeriodMode === "auto"
        ? PERIOD_PRIORITY.filter((period) => activeMetric!.dimensions.includes(period))
        : [activePeriodMode];

      if (periodCandidates.length === 0) {
        setRows([]);
        setResolved(null);
        setErrorMessage("선택한 메트릭에서 사용 가능한 period가 없습니다.");
        return;
      }

      let selectedPeriodType: PeriodType | null = null;
      let latestDate: string | null = null;

      for (const periodType of periodCandidates) {
        const { data: latestByPeriod, error: latestByPeriodError } = await supabase
          .from("metric_item")
          .select("ts_date")
          .eq("entity_id", targetEntityId)
          .eq("type_id", activeMetric.metricTypeId)
          .eq("period_type", periodType)
          .order("ts_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestByPeriodError) {
          setRows([]);
          setResolved(null);
          setErrorMessage(latestByPeriodError.message);
          return;
        }

        if (latestByPeriod?.ts_date) {
          selectedPeriodType = periodType;
          latestDate = latestByPeriod.ts_date;
          break;
        }
      }

      if (!selectedPeriodType || !latestDate) {
        setRows([]);
        setResolved(null);
        setErrorMessage("조회 가능한 시계열 데이터가 없습니다.");
        return;
      }

      const startDate = getRangeStartDate(latestDate, lookbackYears);

      const { data: rawItems, error: rawItemsError } = await supabase
        .from("metric_item")
        .select("ts_date, period_type, value, dimension_key, metadata")
        .eq("entity_id", targetEntityId)
        .eq("type_id", activeMetric.metricTypeId)
        .eq("period_type", selectedPeriodType)
        .gte("ts_date", startDate)
        .lte("ts_date", latestDate)
        .order("ts_date", { ascending: true });

      if (rawItemsError) {
        setRows([]);
        setResolved(null);
        setErrorMessage(rawItemsError.message);
        return;
      }

      const candidates = (rawItems ?? []) as MetricItemRow[];
      if (candidates.length === 0) {
        setRows([]);
        setResolved(null);
        setErrorMessage("선택된 조건에 해당하는 데이터가 없습니다.");
        return;
      }

      const dedupByDate = new Map<string, MetricItemRow>();
      for (const item of candidates) {
        const prev = dedupByDate.get(item.ts_date);
        if (!prev) {
          dedupByDate.set(item.ts_date, item);
          continue;
        }

        // 목적: 동일 날짜의 다차원 데이터 중 기본 축 값을 우선 노출한다.
        const prevIsBase = (prev.dimension_key ?? "") === "";
        const nextIsBase = (item.dimension_key ?? "") === "";
        if (!prevIsBase && nextIsBase) {
          dedupByDate.set(item.ts_date, item);
        }
      }

      const normalizedRows: RowPoint[] = Array.from(dedupByDate.values())
        .map((item) => {
          const value = normalizeNumeric(item.value);
          if (value === null) return null;

          return {
            label: periodLabelFromRow(selectedPeriodType as PeriodType, item),
            tsDate: item.ts_date,
            value,
          };
        })
        .filter((row): row is RowPoint => row !== null)
        .sort((a, b) => a.tsDate.localeCompare(b.tsDate));

      if (normalizedRows.length === 0) {
        setRows([]);
        setResolved(null);
        setErrorMessage("숫자형 데이터가 없어 차트를 만들 수 없습니다.");
        return;
      }

      setRows(normalizedRows);
      setResolved({
        companyName: activeCompany.name,
        metricLabel: activeMetric.metricLabel,
        metricCode: activeMetric.metricName,
        periodType: selectedPeriodType,
        latestDate,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
      setRows([]);
      setResolved(null);
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [intent, loadMetricCatalogForCompany, periodMode, selectedCompany, selectedMetric, supabase]);

  const handleCompanySelect = useCallback((company: Company) => {
    const selected = toSelectedCompany(company);
    const nextIntent: IntentInput = {
      ...intent,
      entityName: selected.name,
    };

    setIntent(nextIntent);
    setCompanyQuery(selected.name);
    setSelectedCompany(selected);
    setSelectedMetric(null);
    setCompanyDropdownOpen(false);
    setMetricDropdownOpen(false);

    if (nextIntent.metricName.trim()) {
      void loadIntentChart({
        nextIntent,
        company: selected,
        metric: null,
      });
    }
  }, [intent, loadIntentChart, setCompanyQuery]);

  const handleMetricSelect = useCallback((metric: SelectedMetric) => {
    const nextIntent: IntentInput = {
      ...intent,
      metricName: metric.metricLabel,
    };

    setIntent(nextIntent);
    setSelectedMetric(metric);
    setMetricDropdownOpen(false);

    void loadIntentChart({
      nextIntent,
      metric,
    });
  }, [intent, loadIntentChart]);

  useEffect(() => {
    if (!selectedCompany) return;

    const timer = window.setTimeout(() => {
      void loadMetricCatalogForCompany(selectedCompany);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadMetricCatalogForCompany, selectedCompany]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (companyContainerRef.current && !companyContainerRef.current.contains(target)) {
        setCompanyDropdownOpen(false);
      }

      if (metricContainerRef.current && !metricContainerRef.current.contains(target)) {
        setMetricDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    const timer = window.setTimeout(() => {
      void loadIntentChart();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadIntentChart]);

  const metricDimensions = selectedMetric?.dimensions ?? null;

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Intent 기반 차트 미리보기</h1>
          <p className="text-sm text-muted-foreground">
            자연어 파싱 단계 없이 intent를 직접 입력해 기업/메트릭을 해석해 데이터를 조회합니다.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="text-sm text-muted-foreground">Intent 입력</div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1" ref={companyContainerRef}>
              <label className="text-xs text-muted-foreground">기업명</label>
              <div className="relative">
                <Input
                  value={intent.entityName}
                  onFocus={() => {
                    if (companySuggestions.length > 0) {
                      setCompanyDropdownOpen(true);
                    }
                  }}
                  onChange={(event) => {
                    const value = event.target.value;
                    setIntent((prev) => ({ ...prev, entityName: value }));
                    setCompanyQuery(value);
                    setSelectedCompany(null);
                    setSelectedMetric(null);
                    setMetricDropdownOpen(false);
                    setCompanyDropdownOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && companySuggestions.length > 0) {
                      event.preventDefault();
                      handleCompanySelect(companySuggestions[0]);
                    }
                  }}
                  placeholder="예: 카카오"
                />

                {companyDropdownOpen && companySuggestions.length > 0 && (
                  <div className="absolute top-full left-0 z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {companySuggestions.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => handleCompanySelect(company)}
                      >
                        <span className="text-foreground">{company.name}</span>
                        <span className="text-xs text-muted-foreground">{company.ticker ?? "-"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1" ref={metricContainerRef}>
              <label className="text-xs text-muted-foreground">메트릭명</label>
              <div className="relative">
                <Input
                  value={intent.metricName}
                  onFocus={() => {
                    if (filteredMetricSuggestions.length > 0) {
                      setMetricDropdownOpen(true);
                    }
                  }}
                  onChange={(event) => {
                    const value = event.target.value;
                    setIntent((prev) => ({ ...prev, metricName: value }));
                    setSelectedMetric(null);
                    setMetricDropdownOpen(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && filteredMetricSuggestions.length > 0) {
                      event.preventDefault();
                      handleMetricSelect(filteredMetricSuggestions[0]);
                    }
                  }}
                  placeholder={selectedCompany ? "예: 매출액" : "기업을 먼저 선택하세요"}
                  disabled={!selectedCompany}
                />

                {metricDropdownOpen && filteredMetricSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {filteredMetricSuggestions.map((metric) => (
                      <button
                        key={metric.metricTypeId}
                        type="button"
                        className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left hover:bg-accent"
                        onClick={() => handleMetricSelect(metric)}
                      >
                        <span className="text-sm text-foreground">{metric.metricLabel}</span>
                        <span className="text-xs text-muted-foreground">
                          {metric.metricName} · {metric.dimensions.join(", ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {!selectedCompany && (
                <p className="text-xs text-muted-foreground">메트릭 자동완성은 기업 선택 후 활성화됩니다.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">조회 연수</label>
              <Input
                type="number"
                min={1}
                value={String(intent.lookbackYears)}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  setIntent((prev) => ({
                    ...prev,
                    lookbackYears: Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1,
                  }));
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">차트 타입</label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={intent.chartType}
                onChange={(event) => {
                  setIntent((prev) => ({ ...prev, chartType: event.target.value as ChartType }));
                }}
              >
                {CHART_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Period</label>
              <select
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                value={periodMode}
                onChange={(event) => {
                  setPeriodMode(event.target.value as PeriodMode);
                }}
              >
                {PERIOD_OPTIONS.map((option) => {
                  const disabled =
                    option.value !== "auto" &&
                    metricDimensions !== null &&
                    !metricDimensions.includes(option.value as MetricDimension);

                  return (
                    <option key={option.value} value={option.value} disabled={disabled}>
                      {option.label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadIntentChart()} disabled={loading}>
              조회
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={loading}
              onClick={() => {
                setIntent(DEFAULT_INTENT);
                setPeriodMode("auto");
                setSelectedCompany(null);
                setSelectedMetric(null);
                setCompanyQuery(DEFAULT_INTENT.entityName);
                setCompanyDropdownOpen(false);
                setMetricDropdownOpen(false);

                void loadIntentChart({
                  nextIntent: DEFAULT_INTENT,
                  nextPeriodMode: "auto",
                  company: null,
                  metric: null,
                });
              }}
            >
              기본값 복원
            </Button>
            {loading && <span className="text-muted-foreground">조회 중...</span>}
            {!loading && resolved && (
              <span className="text-muted-foreground">
                {resolved.companyName} · {resolved.metricLabel} · {formatPeriodType(resolved.periodType)} · 최신 {formatDateLabel(resolved.latestDate)}
              </span>
            )}
          </div>

          {(companyLoading || metricLoading) && (
            <p className="text-xs text-muted-foreground">
              {companyLoading ? "기업 자동완성 로딩 중..." : "메트릭 자동완성 로딩 중..."}
            </p>
          )}

          {errorMessage && (
            <p className="text-sm text-destructive">{errorMessage}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">표시할 차트 데이터가 없습니다.</p>
          ) : (
            <ChartRenderer
              data={chartData}
              chartType={intent.chartType}
              height={420}
            />
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">조회 데이터</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">데이터가 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>기간</TableHead>
                  <TableHead>기준일</TableHead>
                  <TableHead className="text-right">값</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.tsDate}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell>{row.tsDate}</TableCell>
                    <TableCell className="text-right">{formatNumber(row.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {resolved && (
          <div className="text-xs text-muted-foreground">
            metric_code: <span className="font-mono">{resolved.metricCode}</span>
          </div>
        )}
      </div>
    </div>
  );
}
