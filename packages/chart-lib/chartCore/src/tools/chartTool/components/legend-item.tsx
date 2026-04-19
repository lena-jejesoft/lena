"use client";

import type { CSSProperties } from "react";
import { cn } from "@chartCore/src/lib/utils";
import type { ChartType, LegendValueState, YAxisPlacement, HierarchyGroup } from "@chartCore/src/types/chart-config";
import { formatFull, formatLegendValue, formatPercent } from "@/packages/chart-lib/utils/number-formatters";
import { TruncatedTitle } from "@/packages/chart-lib/components/truncated-title";

interface LegendItemProps {
  name: string;
  displayName?: string;
  color: string;
  enabled: boolean;
  value: number | null;
  originalValue?: number | null;
  valueState: LegendValueState;
  onClick: () => void;
  chartType?: ChartType;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacement?: YAxisPlacement;
  isMixedChart?: boolean;
  onTypeChange?: (field: string, type: "column" | "line" | "none") => void;
  totalPieValue?: number;  // 파이 차트 전체 합계 (비율 계산용)
  // 이중축/혼합 편집 모드 관련
  isEditMode?: boolean;
  onAxisPlacementChange?: (field: string, placement: YAxisPlacement) => void;
  // 그룹형 누적막대 편집 모드 관련
  groupCount?: number;
  seriesGroupAssignment?: number;
  onSeriesGroupChange?: (field: string, group: number) => void;
  usedGroups?: Set<number>;  // 실제 사용 중인 그룹 Set
  // 2단계 원형 편집 모드 관련
  hierarchyGroups?: HierarchyGroup[];
  onHierarchySeriesChange?: (field: string, groupName: string | null) => void;
}

// 아이콘 컴포넌트들 (이중축 편집 모드용)
const LineIcon = ({ active }: { active: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path
      d="M2 12L6 6L10 9L14 4"
      stroke={active ? "currentColor" : "hsl(0 0% 60%)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BarIcon = ({ active }: { active: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="8" width="3" height="6" rx="0.5" fill={active ? "currentColor" : "hsl(0 0% 60%)"} />
    <rect x="6.5" y="5" width="3" height="9" rx="0.5" fill={active ? "currentColor" : "hsl(0 0% 60%)"} />
    <rect x="11" y="2" width="3" height="12" rx="0.5" fill={active ? "currentColor" : "hsl(0 0% 60%)"} />
  </svg>
);

const HideIcon = ({ active }: { active: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <path
      d="M2 8C2 8 4.5 4 8 4C11.5 4 14 8 14 8C14 8 11.5 12 8 12C4.5 12 2 8 2 8Z"
      stroke={active ? "currentColor" : "hsl(0 0% 60%)"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="8"
      cy="8"
      r="2"
      stroke={active ? "currentColor" : "hsl(0 0% 60%)"}
      strokeWidth="1.5"
    />
    <path
      d="M3 13L13 3"
      stroke={active ? "currentColor" : "hsl(0 0% 60%)"}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const legendMutedForegroundStyle = {
  "--muted-foreground": "0 0% 45.1%",
} as CSSProperties;

export function LegendItem({
  name,
  displayName,
  color,
  enabled,
  value,
  originalValue,
  valueState,
  onClick,
  chartType,
  yFieldTypes,
  yAxisPlacement,
  isMixedChart,
  onTypeChange,
  totalPieValue,
  isEditMode,
  onAxisPlacementChange,
  groupCount,
  seriesGroupAssignment,
  onSeriesGroupChange,
  usedGroups,
  hierarchyGroups,
  onHierarchySeriesChange,
}: LegendItemProps) {
  const label = displayName ?? name;

  // 시리즈 타입 결정 (마커 렌더링용)
  const getSeriesType = (): "line" | "bar" | "pie" | "treemap" => {
    if (chartType === "pie" || chartType === "two-level-pie") return "pie";
    if (chartType === "treemap" || chartType === "multi-level-treemap") return "treemap";
    if (chartType === "column" || chartType === "stacked" || chartType === "stacked-100" || chartType === "stacked-grouped") return "bar";
    if (chartType === "dual-axis-stacked-bar") {
      return yFieldTypes?.[name] === "line" ? "line" : "bar";
    }
    if ((chartType === "mixed" || chartType === "dual-axis") && yFieldTypes?.[name]) {
      // yFieldTypes의 "column" 값을 마커 렌더링용 "bar"로 변환
      return yFieldTypes[name] === 'column' ? 'bar' : 'line';
    }
    return "line";
  };

  const seriesType = getSeriesType();

  // 값 포맷팅 — 축약(compact)과 원본(full)을 함께 계산해 title 로 원본 노출
  const formatDisplayValue = (): { compact: string; full: string } => {
    if (valueState === 'missing') return { compact: '-', full: '-' };
    if (value === null) return { compact: '', full: '' };

    // 100% 누적막대/영역: 원본값 (퍼센트%) 형식
    if ((chartType === "stacked-100" || chartType === "area-100") && originalValue !== null && originalValue !== undefined) {
      const pct = formatPercent(value, { scale: "percent" });
      return {
        compact: `${formatLegendValue(originalValue)} (${pct})`,
        full: `${formatFull(originalValue)} (${pct})`,
      };
    }

    // 파이 차트, 트리맵: 값 (비율%) 형식
    if ((chartType === "pie" || chartType === "two-level-pie" || chartType === "treemap") && totalPieValue && totalPieValue > 0) {
      const pct = formatPercent(value / totalPieValue);
      return {
        compact: `${formatLegendValue(value)} (${pct})`,
        full: `${formatFull(value)} (${pct})`,
      };
    }

    return { compact: formatLegendValue(value), full: formatFull(value) };
  };

  const { compact: displayValue, full: displayValueFull } = formatDisplayValue();

  // 값 색상 (inline style로 강제 적용)
  const getValueStyle = () => {
    if (valueState === 'outlier') {
      return { color: '#ef4444', fontWeight: 'bold' };
    }
    return undefined;
  };

  const getValueColor = () => {
    if (valueState === 'missing') return 'text-muted-foreground';
    if (valueState === 'outlier') return '!text-red-500';
    return 'text-muted-foreground';
  };

  // 이중축/혼합 편집 모드 전용 렌더링
  if (isEditMode && (chartType === 'dual-axis' || chartType === 'dual-axis-stacked-bar' || chartType === 'mixed') && onTypeChange) {
    const currentType = yFieldTypes?.[name] || (chartType === 'dual-axis-stacked-bar' ? 'column' : 'line');
    const currentPlacement = yAxisPlacement || 'left';
    const currentGroup = seriesGroupAssignment ?? 1;
    const isHidden = !enabled;

    return (
      <div className={cn("w-full py-1", isHidden && "opacity-50")}>
        <div className="flex items-center gap-2">
          {/* 마커 */}
          <div
            style={{
              width: '12px',
              height: currentType === 'line' ? '3px' : '8px',
              backgroundColor: color,
              borderRadius: currentType === 'column' ? '2px' : '0',
              flexShrink: 0,
            }}
          />
          {/* 시리즈명 */}
          <span className="text-xs text-foreground truncate flex-1 min-w-0">
            {label}
          </span>
          {/* 축 배치 토글 - 이중축에서만 표시 */}
          {(chartType === 'dual-axis' || chartType === 'dual-axis-stacked-bar') && !isHidden && onAxisPlacementChange && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAxisPlacementChange(name, currentPlacement === 'left' ? 'right' : 'left');
              }}
              className={cn(
                "px-1.5 py-0.5 text-[10px] rounded bg-muted/40 hover:bg-muted/60 transition-colors flex-shrink-0",
                "text-muted-foreground hover:text-foreground"
              )}
              title={`현재: ${currentPlacement === 'left' ? '좌측' : '우측'} 축 (클릭하여 변경)`}
            >
              {currentPlacement === 'left' ? '좌' : '우'}
            </button>
          )}
          {/* 그룹 선택 - 하이브리드 차트에서 표시 */}
          {chartType === 'dual-axis-stacked-bar' && onSeriesGroupChange && (
            <div className="flex items-center gap-1 flex-shrink-0" style={legendMutedForegroundStyle}>
              {[1, 2, 3, 4].map((group) => {
                const isSelected = currentGroup === group;
                const isActive = usedGroups ? usedGroups.has(group) : false;
                return (
                  <button
                    key={group}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSeriesGroupChange(name, group);
                    }}
                    className="w-4 h-4 flex items-center justify-center rounded transition-all hover:bg-muted/40"
                    title={`그룹 ${group}`}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? 'hsl(var(--muted-foreground))' : 'transparent',
                        border: `1.5px solid ${isSelected ? 'hsl(var(--muted-foreground))' : isActive ? 'hsl(0 0% 60%)' : 'hsl(0 0% 85%)'}`,
                        opacity: isActive || isSelected ? 1 : 0.4,
                        transition: 'all 0.15s ease',
                      }}
                    />
                  </button>
                );
              })}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSeriesGroupChange(name, 0);
                }}
                className="w-4 h-4 flex items-center justify-center rounded transition-all hover:bg-muted/40"
                title="그룹 숨김"
              >
                <div
                  style={{
                    width: '10px',
                    height: '2px',
                    backgroundColor: currentGroup === 0 ? 'hsl(0 0% 40%)' : 'hsl(0 0% 70%)',
                    borderRadius: '1px',
                    transition: 'all 0.15s ease',
                  }}
                />
              </button>
            </div>
          )}
          {/* 타입 선택 아이콘 */}
          <div className="flex items-center gap-0.5 bg-muted/40 rounded p-0.5 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTypeChange(name, 'line');
              }}
              className={cn(
                "p-0.5 rounded transition-all",
                currentType === 'line' && enabled
                  ? "bg-background shadow-sm text-foreground"
                  : "hover:bg-background/50 text-muted-foreground"
              )}
              title="라인"
            >
              <LineIcon active={currentType === 'line' && enabled} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTypeChange(name, 'column');
              }}
              className={cn(
                "p-0.5 rounded transition-all",
                currentType === 'column' && enabled
                  ? "bg-background shadow-sm text-foreground"
                  : "hover:bg-background/50 text-muted-foreground"
              )}
              title="막대"
            >
              <BarIcon active={currentType === 'column' && enabled} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTypeChange(name, 'none');
              }}
              className={cn(
                "p-0.5 rounded transition-all",
                isHidden
                  ? "bg-background shadow-sm text-foreground"
                  : "hover:bg-background/50 text-muted-foreground"
              )}
              title="숨김"
            >
              <HideIcon active={isHidden} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 그룹형 누적막대 편집 모드 전용 렌더링
  if (isEditMode && chartType === 'stacked-grouped' && onSeriesGroupChange) {
    const currentGroup = seriesGroupAssignment ?? 1;
    const isHidden = currentGroup === 0;


    return (
      <div className={cn("w-full py-1", isHidden && "opacity-50")}>
        <div className="flex items-center gap-2">
          {/* 마커 */}
          <div
            style={{
              width: '12px',
              height: '8px',
              backgroundColor: color,
              borderRadius: '2px',
              flexShrink: 0,
            }}
          />
          {/* 시리즈명 */}
          <span className="text-xs text-foreground truncate flex-1 min-w-0">
            {label}
          </span>
          {/* 그룹 선택 - 항상 4개 도트 표시 */}
          <div className="flex items-center gap-1 flex-shrink-0" style={legendMutedForegroundStyle}>
            {[1, 2, 3, 4].map((group) => {
              const isSelected = currentGroup === group;
              const isActive = usedGroups ? usedGroups.has(group) : false;
              return (
                <button
                  key={group}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeriesGroupChange(name, group);
                  }}
                  className="w-4 h-4 flex items-center justify-center rounded transition-all hover:bg-muted/40"
                  title={`그룹 ${group}`}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: isSelected ? 'hsl(var(--muted-foreground))' : 'transparent',
                      border: `1.5px solid ${isSelected ? 'hsl(var(--muted-foreground))' : isActive ? 'hsl(0 0% 60%)' : 'hsl(0 0% 85%)'}`,
                      opacity: isActive || isSelected ? 1 : 0.4,
                      transition: 'all 0.15s ease',
                    }}
                  />
                </button>
              );
            })}
            {/* 숨김 버튼 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSeriesGroupChange(name, 0);
              }}
              className="w-4 h-4 flex items-center justify-center rounded transition-all hover:bg-muted/40"
              title="숨김"
            >
              <div
                style={{
                  width: '10px',
                  height: '2px',
                  backgroundColor: isHidden ? 'hsl(0 0% 40%)' : 'hsl(0 0% 70%)',
                  borderRadius: '1px',
                  transition: 'all 0.15s ease',
                }}
              />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2단계 원형 / 멀티레벨 트리맵 편집 모드 전용 렌더링
  if (isEditMode && (chartType === 'two-level-pie' || chartType === 'multi-level-treemap') && onHierarchySeriesChange) {
    // 현재 시리즈가 속한 그룹 찾기
    const currentGroupName = hierarchyGroups?.find(g => g.series.includes(name))?.name || null;

    return (
      <div className="w-full py-1">
        <div className="flex items-center gap-2">
          {/* 마커 */}
          <div
            style={{
              width: '10px',
              height: '10px',
              backgroundColor: color,
              borderRadius: '50%',
              flexShrink: 0,
            }}
          />
          {/* 시리즈명 */}
          <span className="text-xs text-foreground truncate flex-1 min-w-0">
            {label}
          </span>
          {/* 그룹 선택 드롭다운 */}
          <select
            value={currentGroupName || ''}
            onChange={(e) => {
              const newGroupName = e.target.value || null;
              onHierarchySeriesChange(name, newGroupName);
            }}
            className="text-xs bg-muted/40 border-none outline-none rounded px-1.5 py-0.5 text-foreground cursor-pointer w-16"
          >
            <option value="">미할당</option>
            {(hierarchyGroups || []).map((group) => (
              <option key={group.name} value={group.name}>
                {group.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <button
        onClick={onClick}
        className={cn(
          "flex items-center justify-between gap-2 w-full rounded-lg",
          "cursor-pointer transition-all duration-200 text-left",
          (chartType !== "ranking-bar" && chartType !== "geo-grid" && chartType !== "regression-scatter") ? "py-1.5 px-2" : "px-0 py-2.5",
          enabled
            ? "hover:scale-[1.02]"
            : "opacity-50"
        )}
      >
        {/* 색상 인디케이터 */}
        <div className={cn(
          "flex items-center min-w-0 flex-1",
          (chartType !== "ranking-bar" && chartType !== "geo-grid" && chartType !== "regression-scatter") ? "gap-2" : "gap-1.5"
        )}>
          {seriesType === "pie" ? (
            // 파이 차트 마커: 원형
            <div
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: color,
                borderRadius: '50%',
                flexShrink: 0,
              }}
            />
          ) : seriesType === "line" ? (
            // 라인 차트 마커: 단일 선
            <div
              style={{
                width: '12px',
                height: '3px',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
          ) : seriesType === "treemap" ? (
            // 트리맵 마커: 8x8 직사각형 (멀티레벨 트리맵과 동일)
            <div
              style={{
                width: '8px',
                height: '8px',
                backgroundColor: color,
                flexShrink: 0,
              }}
            />
          ) : (
            // 막대 차트 마커: 직사각형 박스
            <div
              style={{
                width: '12px',
                height: '8px',
                backgroundColor: color,
                borderRadius: '2px',
                flexShrink: 0,
              }}
            />
          )}

          {/* 시리즈명 — 잘릴 때만 title 표시 */}
          <TruncatedTitle
            text={label}
            className={cn(
              "text-xs truncate",
              (chartType !== "ranking-bar" && chartType !== "geo-grid" && chartType !== "regression-scatter") ? "text-foreground" : "font-medium text-muted-foreground",
              !enabled && "opacity-60"
            )}
          >
            {label}
            {/* 이중축 배치 표시 뱃지 */}
            {yAxisPlacement && (
              <span className="ml-1 text-[10px] text-muted-foreground/70">
                ({yAxisPlacement === 'right' ? '우' : '좌'})
              </span>
            )}
          </TruncatedTitle>
        </div>

        {/* 값 (우측 정렬) — 축약 + title 에 원본 */}
        {displayValue && (
          <span
            className={cn(
              "text-xs flex-shrink-0",
              enabled ? "font-medium" : "font-normal",
              getValueColor()
            )}
            style={getValueStyle()}
            title={displayValueFull !== displayValue ? displayValueFull : undefined}
          >
            {displayValue}
          </span>
        )}
      </button>
    </div>
  );
}
