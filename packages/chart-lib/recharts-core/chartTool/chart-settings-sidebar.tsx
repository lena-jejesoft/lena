"use client";

import { cn } from "@/lib/utils";
import type { YAxisPlacement, ChartType } from "../recharts-type";

interface ChartSettingsSidebarProps {
  open: boolean;
  seriesFields: string[];
  seriesColors: string[];
  seriesLabelMap?: Record<string, string>;
  getCurrentTypeForField: (field: string) => "line" | "column" | "none";
  onTypeChange: (field: string, type: "column" | "line" | "none") => void;
  chartType?: ChartType;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  onAxisPlacementChange?: (field: string, placement: YAxisPlacement) => void;
}

// 아이콘 컴포넌트들
const LineIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="8" width="3" height="6" rx="0.5" fill={active ? "currentColor" : "hsl(0 0% 60%)"} />
    <rect x="6.5" y="5" width="3" height="9" rx="0.5" fill={active ? "currentColor" : "hsl(0 0% 60%)"} />
    <rect x="11" y="2" width="3" height="12" rx="0.5" fill={active ? "currentColor" : "hsl(0 0% 60%)"} />
  </svg>
);

const HideIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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

export function ChartSettingsSidebar({
  open,
  seriesFields,
  seriesColors,
  seriesLabelMap,
  getCurrentTypeForField,
  onTypeChange,
  chartType,
  yAxisPlacements,
  onAxisPlacementChange,
}: ChartSettingsSidebarProps) {
  const getSeriesLabel = (field: string) => seriesLabelMap?.[field] ?? field;

  // 이중축 차트용 렌더링 (컴팩트 디자인)
  if (chartType === 'dual-axis' || chartType === 'dual-axis-stacked-bar') {
    return (
      <div className="w-[220px] border-l bg-card/50 flex flex-col flex-shrink-0 px-4 pt-[22px] pb-4">
        {/* 헤더 - 레전드와 동일한 스타일 */}
        <div className="mb-3 text-sm font-medium text-foreground pb-2 border-b border-border">
          시리즈별 타입 설정
        </div>

        {/* 시리즈 목록 */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {seriesFields.map((field, idx) => {
            const currentType = getCurrentTypeForField(field);
            const color = seriesColors[idx % seriesColors.length];
            const currentPlacement = yAxisPlacements?.[field] ?? 'left';
            const isHidden = currentType === 'none';

            return (
              <div
                key={field}
                className={cn(
                  "py-1.5",
                  isHidden && "opacity-50"
                )}
              >
                {/* 마커 + 시리즈명 */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    style={{
                      width: '12px',
                      height: currentType === 'line' ? '3px' : '8px',
                      backgroundColor: color,
                      borderRadius: currentType === 'column' ? '2px' : '0',
                      flexShrink: 0,
                    }}
                  />
                  <span className="text-xs text-foreground truncate flex-1">
                    {getSeriesLabel(field)}
                  </span>
                </div>

                {/* 컨트롤: 축 배치 + 타입 */}
                <div className="flex items-center gap-2">
                  {/* 축 배치 선택 (텍스트) */}
                  {onAxisPlacementChange && yAxisPlacements && !isHidden && (
                    <div className="flex items-center gap-0.5 bg-muted/40 rounded-md p-0.5">
                      <button
                        onClick={() => onAxisPlacementChange(field, "left")}
                        className={cn(
                          "px-2 py-1 text-[10px] rounded transition-all",
                          currentPlacement === "left"
                            ? "bg-background shadow-sm text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        좌
                      </button>
                      <button
                        onClick={() => onAxisPlacementChange(field, "right")}
                        className={cn(
                          "px-2 py-1 text-[10px] rounded transition-all",
                          currentPlacement === "right"
                            ? "bg-background shadow-sm text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        우
                      </button>
                    </div>
                  )}

                  {/* 타입 선택 (아이콘) */}
                  <div className="flex items-center gap-0.5 bg-muted/40 rounded-md p-0.5">
                    <button
                      onClick={() => onTypeChange(field, "line")}
                      className={cn(
                        "p-1 rounded transition-all",
                        currentType === "line"
                          ? "bg-background shadow-sm text-foreground"
                          : "hover:bg-background/50 text-muted-foreground"
                      )}
                      title="라인"
                    >
                      <LineIcon active={currentType === "line"} />
                    </button>
                    <button
                      onClick={() => onTypeChange(field, "column")}
                      className={cn(
                        "p-1 rounded transition-all",
                        currentType === "column"
                          ? "bg-background shadow-sm text-foreground"
                          : "hover:bg-background/50 text-muted-foreground"
                      )}
                      title="막대"
                    >
                      <BarIcon active={currentType === "column"} />
                    </button>
                    <button
                      onClick={() => onTypeChange(field, "none")}
                      className={cn(
                        "p-1 rounded transition-all",
                        currentType === "none"
                          ? "bg-background shadow-sm text-foreground"
                          : "hover:bg-background/50 text-muted-foreground"
                      )}
                      title="숨김"
                    >
                      <HideIcon active={currentType === "none"} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 그룹형 누적 막대 차트용 렌더링 (텍스트 기반)
  if (chartType === 'stacked-grouped') {
    return (
      <div className="w-[220px] border-l bg-card/50 flex flex-col flex-shrink-0">
        {/* 헤더 */}
        <div className="flex items-start px-4 pt-[22px] pb-3">
          <h3 className="text-xs font-medium text-muted-foreground">시리즈별 설정</h3>
        </div>

        {/* 시리즈 목록 */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {seriesFields.map((field, idx) => {
            const currentType = getCurrentTypeForField(field);
            const color = seriesColors[idx % seriesColors.length];

            return (
              <div key={field} className="py-3 border-b border-border/40 last:border-b-0">
                {/* 마커 + 시리즈명 */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div
                    style={{
                      width: '10px',
                      height: '7px',
                      backgroundColor: currentType === 'none' ? 'hsl(0 0% 50%)' : color,
                      borderRadius: '1px',
                      flexShrink: 0,
                      opacity: currentType === 'none' ? 0.4 : 1,
                    }}
                  />
                  <span className={cn(
                    "text-xs font-medium truncate",
                    currentType === 'none' ? "text-muted-foreground/50" : "text-foreground"
                  )}>
                    {getSeriesLabel(field)}
                  </span>
                </div>

                {/* 타입 선택 */}
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-muted-foreground/70">타입</span>
                  <div className="flex">
                    <button
                      onClick={() => onTypeChange(field, "column")}
                      className="px-1.5 py-0.5 rounded-l transition-colors"
                      style={{
                        border: currentType === "column" ? "0.5px solid hsl(0 0% 45%)" : "0.5px solid transparent",
                        backgroundColor: currentType === "column" ? "hsl(0 0% 90% / 0.3)" : "transparent",
                        color: currentType === "column" ? "hsl(0 0% 30%)" : "hsl(0 0% 55%)",
                      }}
                    >
                      표시
                    </button>
                    <button
                      onClick={() => onTypeChange(field, "none")}
                      className="px-1.5 py-0.5 rounded-r transition-colors"
                      style={{
                        border: currentType === "none" ? "0.5px solid hsl(0 0% 45%)" : "0.5px solid transparent",
                        backgroundColor: currentType === "none" ? "hsl(0 0% 90% / 0.3)" : "transparent",
                        color: currentType === "none" ? "hsl(0 0% 30%)" : "hsl(0 0% 55%)",
                      }}
                    >
                      숨김
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 혼합 차트용 렌더링 (이중축과 동일한 스타일)
  return (
    <div className="w-[220px] border-l bg-card/50 flex flex-col flex-shrink-0 px-4 pt-[22px] pb-4">
      {/* 헤더 - 레전드와 동일한 스타일 */}
      <div className="mb-3 text-sm font-medium text-foreground pb-2 border-b border-border">
        시리즈별 타입 설정
      </div>

      {/* 시리즈 목록 */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {seriesFields.map((field, idx) => {
          const currentType = getCurrentTypeForField(field);
          const color = seriesColors[idx % seriesColors.length];
          const isHidden = currentType === 'none';

          return (
            <div
              key={field}
              className={cn(
                "py-1.5",
                isHidden && "opacity-50"
              )}
            >
              {/* 마커 + 시리즈명 */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  style={{
                    width: '12px',
                    height: currentType === 'line' ? '3px' : '8px',
                    backgroundColor: color,
                    borderRadius: currentType === 'column' ? '2px' : '0',
                    flexShrink: 0,
                  }}
                />
                <span className="text-xs text-foreground truncate flex-1">
                  {getSeriesLabel(field)}
                </span>
              </div>

              {/* 타입 선택 (아이콘) */}
              <div className="flex items-center gap-0.5 bg-muted/40 rounded-md p-0.5 w-fit">
                <button
                  onClick={() => onTypeChange(field, "line")}
                  className={cn(
                    "p-1 rounded transition-all",
                    currentType === "line"
                      ? "bg-background shadow-sm text-foreground"
                      : "hover:bg-background/50 text-muted-foreground"
                  )}
                  title="라인"
                >
                  <LineIcon active={currentType === "line"} />
                </button>
                <button
                  onClick={() => onTypeChange(field, "column")}
                  className={cn(
                    "p-1 rounded transition-all",
                    currentType === "column"
                      ? "bg-background shadow-sm text-foreground"
                      : "hover:bg-background/50 text-muted-foreground"
                  )}
                  title="막대"
                >
                  <BarIcon active={currentType === "column"} />
                </button>
                <button
                  onClick={() => onTypeChange(field, "none")}
                  className={cn(
                    "p-1 rounded transition-all",
                    currentType === "none"
                      ? "bg-background shadow-sm text-foreground"
                      : "hover:bg-background/50 text-muted-foreground"
                  )}
                  title="숨김"
                >
                  <HideIcon active={currentType === "none"} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
