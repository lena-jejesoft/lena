"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { getButtonBorderColor } from "../recharts-wrapper";
import type { HierarchyGroup } from "../recharts-type";
import { Plus, X } from "lucide-react";

interface HierarchyGroupPanelProps {
  open: boolean;
  seriesFields: string[];
  seriesColors: string[];
  groups: HierarchyGroup[];
  onGroupsChange: (groups: HierarchyGroup[]) => void;
}

export function HierarchyGroupPanel({
  open,
  seriesFields,
  seriesColors,
  groups,
  onGroupsChange,
}: HierarchyGroupPanelProps) {
  const [borderColor, setBorderColor] = useState<string>("hsl(0 0% 66%)");

  useEffect(() => {
    const updateColor = () => setBorderColor(getButtonBorderColor());
    updateColor();

    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  if (!open) return null;

  // 이미 할당된 시리즈들
  const assignedSeries = new Set(groups.flatMap(g => g.series));

  // 미할당 시리즈
  const unassignedSeries = seriesFields.filter(f => !assignedSeries.has(f));

  // 새 그룹 추가
  const handleAddGroup = () => {
    const newGroup: HierarchyGroup = {
      name: `그룹 ${groups.length + 1}`,
      series: [],
    };
    onGroupsChange([...groups, newGroup]);
  };

  // 그룹 삭제
  const handleDeleteGroup = (index: number) => {
    const newGroups = groups.filter((_, i) => i !== index);
    onGroupsChange(newGroups);
  };

  // 그룹명 변경
  const handleNameChange = (index: number, name: string) => {
    const newGroups = [...groups];
    newGroups[index] = { ...newGroups[index], name };
    onGroupsChange(newGroups);
  };

  // 시리즈 할당/해제
  const handleSeriesToggle = (groupIndex: number, field: string) => {
    const newGroups = [...groups];
    const group = newGroups[groupIndex];

    if (group.series.includes(field)) {
      // 해제
      newGroups[groupIndex] = {
        ...group,
        series: group.series.filter(s => s !== field),
      };
    } else {
      // 할당 (다른 그룹에서 제거 후 이 그룹에 추가)
      newGroups.forEach((g, i) => {
        if (i !== groupIndex && g.series.includes(field)) {
          newGroups[i] = {
            ...g,
            series: g.series.filter(s => s !== field),
          };
        }
      });
      newGroups[groupIndex] = {
        ...group,
        series: [...group.series, field],
      };
    }

    onGroupsChange(newGroups);
  };

  // 시리즈 색상 가져오기 (그룹 색상 미리보기)
  const getSeriesColor = (field: string) => {
    // 시리즈가 속한 그룹 찾기
    const groupIdx = groups.findIndex(g => g.series.includes(field));
    if (groupIdx >= 0) {
      // 그룹에 할당됨 -> 그룹 색상
      return seriesColors[groupIdx % seriesColors.length];
    }
    // 미할당 -> 회색
    return "hsl(0 0% 60%)";
  };

  return (
    <div className="w-[220px] border-l bg-card/50 flex flex-col flex-shrink-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-[22px] pb-3">
        <h3 className="text-xs font-medium text-muted-foreground">그룹 설정</h3>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={handleAddGroup}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* 그룹 목록 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        {groups.map((group, groupIndex) => (
          <div key={groupIndex} className="border rounded-md p-2 space-y-2">
            {/* 그룹명 입력 + 삭제 */}
            <div className="flex items-center gap-1">
              <Input
                value={group.name}
                onChange={(e) => handleNameChange(groupIndex, e.target.value)}
                className="h-6 text-xs flex-1"
                placeholder="그룹명"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteGroup(groupIndex)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>

            {/* 시리즈 선택 */}
            <div className="space-y-1">
              {seriesFields.map((field) => {
                const isInThisGroup = group.series.includes(field);
                const isInOtherGroup = !isInThisGroup && assignedSeries.has(field);
                const color = getSeriesColor(field);

                return (
                  <button
                    key={field}
                    className={`w-full flex items-center gap-2 px-1.5 py-1 rounded text-xs transition-colors ${
                      isInThisGroup
                        ? "bg-accent"
                        : isInOtherGroup
                        ? "opacity-40"
                        : "hover:bg-accent/50"
                    }`}
                    onClick={() => handleSeriesToggle(groupIndex, field)}
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        backgroundColor: color,
                        borderRadius: '2px',
                        flexShrink: 0,
                      }}
                    />
                    <span className="truncate text-muted-foreground">{field}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* 미할당 시리즈 */}
        {unassignedSeries.length > 0 && groups.length > 0 && (
          <div className="pt-2 border-t">
            <span className="text-xs text-muted-foreground">미할당</span>
            <div className="mt-1 space-y-1">
              {unassignedSeries.map((field) => {
                const color = getSeriesColor(field);
                return (
                  <div
                    key={field}
                    className="flex items-center gap-2 px-1.5 py-1 text-xs text-muted-foreground opacity-60"
                  >
                    <div
                      style={{
                        width: '10px',
                        height: '10px',
                        backgroundColor: color,
                        borderRadius: '2px',
                        flexShrink: 0,
                      }}
                    />
                    <span className="truncate">{field}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 그룹이 없을 때 안내 */}
        {groups.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-4">
            + 버튼을 눌러 그룹을 추가하세요
          </div>
        )}
      </div>
    </div>
  );
}
