"use client";

import { Card, CardContent } from "@chartCore/src/components/ui/card";
import type { DataAnalysisResult, ChartType } from "@chartCore/src/types/chart-config";

// 이상치 미지원 차트 타입
const OUTLIER_UNSUPPORTED_CHARTS: ChartType[] = [
  'stacked', 'stacked-100', 'stacked-grouped', 'dual-axis-stacked-bar',
  'area', 'area-100', 'stacked-area', 'synced-area',
  'pie', 'two-level-pie',
  'treemap', 'multi-level-treemap',
  'ranking-bar', 'geo-grid',
  'regression-scatter', // 회귀 산점도는 별도 처리 (regressionOutlierCount 사용)
];

interface DataQualityCardProps {
  analysisResult: DataAnalysisResult;
  showOutliers: boolean;
  showMissingValues: boolean;
  regressionOutlierCount?: number;
  chartType?: ChartType;
  enabledSeries?: Set<string>;
}

export function DataQualityCard({
  analysisResult,
  showOutliers,
  showMissingValues,
  regressionOutlierCount,
  chartType,
  enabledSeries,
}: DataQualityCardProps) {
  const { outliers, missingValues } = analysisResult;

  // 활성화된 시리즈의 이상치만 필터링
  const filteredOutliers = enabledSeries
    ? outliers.filter(o => enabledSeries.has(o.field))
    : outliers;

  // 회귀 산점도일 때는 회귀 잔차 기반 이상치 수 사용
  const displayOutlierCount = regressionOutlierCount !== undefined
    ? regressionOutlierCount
    : filteredOutliers.length;

  // 이상치 표시 지원 여부 (회귀 산점도는 regressionOutlierCount가 있을 때만 지원)
  const supportsOutliers = chartType
    ? (chartType === 'regression-scatter'
      ? regressionOutlierCount !== undefined
      : !OUTLIER_UNSUPPORTED_CHARTS.includes(chartType))
    : true;

  const hasOutliers = displayOutlierCount > 0 && supportsOutliers;
  const hasMissingValues = missingValues.length > 0;

  if (!showOutliers && !showMissingValues) {
    return null;
  }

  if (!hasOutliers && !hasMissingValues) {
    return null;
  }

  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 결측치 칼럼 */}
          {showMissingValues && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                결측치 ({missingValues.length}건)
              </h4>
              {hasMissingValues ? (
                <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
                  {missingValues.map((mv, i) => (
                    <li key={i} className="text-muted-foreground">
                      {mv.dateDisplay}: {mv.fields.join(", ")}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">결측치 없음</p>
              )}
            </div>
          )}

          {/* 이상치 칼럼 */}
          {showOutliers && supportsOutliers && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">
                이상치 ({displayOutlierCount}건)
              </h4>
              <div className="text-xs text-muted-foreground space-y-1">
                {regressionOutlierCount !== undefined ? (
                  <>
                    <p>판별 기준: 회귀 잔차 1.5 IQR</p>
                    <p className="text-muted-foreground/70">
                      (잔차 Q1 - 1.5×IQR ~ Q3 + 1.5×IQR 범위 외)
                    </p>
                  </>
                ) : (
                  <>
                    <p>판별 기준: 1.5 IQR</p>
                    <p className="text-muted-foreground/70">
                      (Q1 - 1.5×IQR ~ Q3 + 1.5×IQR 범위 외)
                    </p>
                  </>
                )}
                <p>표현 방법: 빨간색 점으로 표시</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
