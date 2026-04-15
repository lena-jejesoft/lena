"use client";

import { cn } from "@/lib/utils";

interface StackedGroupedSettingsSidebarProps {
  open: boolean;
  seriesFields: string[];
  seriesColors: string[];
  groupCount: number;
  seriesGroupAssignments: Record<string, number>;
  onGroupCountChange: (count: number) => void;
  onSeriesGroupChange: (field: string, group: number) => void;
}

export function StackedGroupedSettingsSidebar({
  open,
  seriesFields,
  seriesColors,
  groupCount,
  seriesGroupAssignments,
  onGroupCountChange,
  onSeriesGroupChange,
}: StackedGroupedSettingsSidebarProps) {
  if (!open) return null;

  return (
    <div className="w-[220px] border-l bg-card/50 flex flex-col flex-shrink-0 px-4 pt-[22px] pb-4">
      {/* 헤더 - 레전드와 동일한 스타일 */}
      <div className="mb-3 text-sm font-medium text-foreground pb-2 border-b border-border">
        시리즈별 그룹 설정
      </div>

      {/* 그룹 개수 선택 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">그룹 개수</span>
        <div className="flex items-center bg-muted/40 rounded-md p-0.5">
          {Array.from(
            { length: Math.max(0, Math.min(seriesFields.length, 4) - 1) },
            (_, i) => i + 2
          ).map((count) => (
            <button
              key={count}
              onClick={() => onGroupCountChange(count)}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition-all",
                groupCount === count
                  ? "bg-background shadow-sm text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* 시리즈 목록 */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {seriesFields.map((field, idx) => {
          const color = seriesColors[idx % seriesColors.length];
          const currentGroup = seriesGroupAssignments[field] ?? 1;
          const isHidden = currentGroup === 0;

          return (
            <div
              key={field}
              className={cn(
                "flex items-center justify-between py-1.5 rounded-lg",
                isHidden && "opacity-40"
              )}
            >
              {/* 마커 + 시리즈명 */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  style={{
                    width: '12px',
                    height: '8px',
                    backgroundColor: color,
                    borderRadius: '2px',
                    flexShrink: 0,
                  }}
                />
                <span className="text-xs text-foreground truncate">
                  {field}
                </span>
              </div>

              {/* 그룹 선택 */}
              <div className="flex items-center gap-0.5 bg-muted/30 rounded p-0.5">
                {Array.from({ length: groupCount }, (_, i) => i + 1).map((group) => (
                  <button
                    key={group}
                    onClick={() => onSeriesGroupChange(field, group)}
                    className={cn(
                      "w-6 h-5 text-[10px] rounded transition-all",
                      currentGroup === group
                        ? "bg-background shadow-sm text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {group}
                  </button>
                ))}
                <button
                  onClick={() => onSeriesGroupChange(field, 0)}
                  className={cn(
                    "px-1.5 h-5 text-[10px] rounded transition-all",
                    isHidden
                      ? "bg-background shadow-sm text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
