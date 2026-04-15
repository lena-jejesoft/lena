"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { parseInputDataToChartData, extractSeriesFields } from "../recharts-adapter";
import { getThemeColors } from "../recharts-wrapper";
import { cn } from "@/lib/utils";

interface MixedChartConfirmationProps {
  inputData: string;
  suggestedYFieldTypes?: Record<string, "column" | "line">;
  status: "executing" | "complete" | "inProgress";
  onApprove: (
    yFieldTypes: Record<string, "column" | "line">,
    enabledSeries: string[]
  ) => void;
  onCancel: () => void;
  isLoading?: boolean;
  result?: { success: boolean; message?: string };
}

export function MixedChartConfirmation({
  inputData,
  suggestedYFieldTypes,
  status,
  onApprove,
  onCancel,
  isLoading = false,
  result,
}: MixedChartConfirmationProps) {
  const [internalLoading, setInternalLoading] = useState(false);

  const themeColors = getThemeColors();
  const seriesColors = themeColors.seriesColors;

  const seriesFields = useMemo(() => {
    try {
      const parsedData = parseInputDataToChartData(inputData);
      if (parsedData.length === 0) return [];
      const fields = extractSeriesFields(parsedData);
      return fields.sort((a, b) => a.localeCompare(b, 'ko'));
    } catch (err) {
      return [];
    }
  }, [inputData]);

  const [selectedTypes, setSelectedTypes] = useState<Record<string, "column" | "line">>({});
  const [enabledSeries, setEnabledSeries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (seriesFields.length === 0) return;

    const initialTypes: Record<string, "column" | "line"> = {};
    const initialEnabled = new Set<string>();

    seriesFields.forEach((field) => {
      const suggestedType = suggestedYFieldTypes?.[field];
      if (suggestedType) {
        initialTypes[field] = suggestedType;
        initialEnabled.add(field);
      } else {
        initialTypes[field] = 'column';
        if (!suggestedYFieldTypes || Object.keys(suggestedYFieldTypes).length === 0) {
          initialEnabled.add(field);
        }
      }
    });

    setSelectedTypes(initialTypes);
    setEnabledSeries(initialEnabled);
  }, [seriesFields, suggestedYFieldTypes]);

  useEffect(() => {
    if (status === "complete") {
      setInternalLoading(false);
    }
  }, [status]);

  const handleApprove = async () => {
    setInternalLoading(true);

    const finalTypes: Record<string, "column" | "line"> = {};
    enabledSeries.forEach((field) => {
      if (selectedTypes[field]) {
        finalTypes[field] = selectedTypes[field];
      }
    });

    await onApprove(finalTypes, Array.from(enabledSeries));
  };

  const loading = isLoading || internalLoading;

  if (status === "complete") {
    const success = result?.success ?? true;
    const message = result?.message ?? "혼합차트가 생성되었습니다.";
    return (
      <Card className={`w-full max-w-md border ${success ? "border-green-200" : "border-red-200"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {success ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
            혼합차트 생성 {success ? "완료" : "실패"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    );
  }

  if (seriesFields.length === 0) {
    return (
      <Card className="w-full max-w-md border border-yellow-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            데이터 없음
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            차트를 생성할 시리즈 데이터가 없습니다.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" size="sm" onClick={onCancel} className="w-full">
            확인
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md border border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">혼합차트 설정</CardTitle>
        <p className="text-xs text-muted-foreground">각 시리즈별로 차트 타입을 선택하세요</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label className="text-sm font-medium">시리즈별 타입 설정</Label>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {seriesFields.map((field, idx) => (
            <div key={field} className="flex items-center gap-3 justify-between">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div
                  style={{
                    width: '12px',
                    height: '8px',
                    backgroundColor: seriesColors[idx % seriesColors.length],
                    borderRadius: '2px',
                  }}
                />
                <span className={cn(
                  "text-sm truncate",
                  !enabledSeries.has(field) ? "text-muted-foreground/50 line-through" : "text-muted-foreground"
                )}>
                  {field}
                </span>
              </div>
              <Select
                value={!enabledSeries.has(field) ? 'none' : (selectedTypes[field] || 'column')}
                onValueChange={(value: string) => {
                  if (value === "none") {
                    const newSet = new Set(enabledSeries);
                    newSet.delete(field);
                    setEnabledSeries(newSet);
                  } else {
                    const newSet = new Set(enabledSeries);
                    newSet.add(field);
                    setEnabledSeries(newSet);
                    setSelectedTypes({
                      ...selectedTypes,
                      [field]: value as "column" | "line"
                    });
                  }
                }}
              >
                <SelectTrigger className="w-16 h-7 text-xs focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="column">막대</SelectItem>
                  <SelectItem value="line">라인</SelectItem>
                  <SelectItem value="none">사용 안 함</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
        >
          취소
        </Button>
        <Button
          size="sm"
          onClick={handleApprove}
          disabled={loading || enabledSeries.size === 0}
          className="flex-1"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              생성 중...
            </>
          ) : (
            "확인"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
