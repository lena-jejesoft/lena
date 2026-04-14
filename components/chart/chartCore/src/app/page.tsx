"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import sampleData from "@chartCore/src/tools/chartTool/data/sample-data.json";
import type { UnitSettings } from "@chartCore/src/types/chart-unit-settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@chartCore/src/components/ui/select";
import { chartColors } from "@/lib/colors";

const ChartToolView = dynamic(() => import("@chartCore/src/tools/chartTool/index"), { ssr: false });

const SAMPLE_FILES = ["sample_1", "sample_2", "sample_3", "sample_4"];

// sample_3 전용 멀티레벨 트리맵 색상 팔레트 (Anthropic 브랜드 스타일)
const SAMPLE_3_TREEMAP_COLORS = chartColors

export default function Home() {
  const defaultUnitSettings: UnitSettings = {
    datetime_type: "quarter",
    datetime_range: {
      datetime_start: sampleData[0].date,
      datetime_end: sampleData[sampleData.length - 1].date,
    },
    datetime_unit: 1,
  };

  const [selectedSample, setSelectedSample] = useState<string>("default");
  const [inputData, setInputData] = useState<string>(JSON.stringify(sampleData, null, 2));

  const unitSettings = useMemo(() => {
    try {
      const data = JSON.parse(inputData);
      if (!data.length) return defaultUnitSettings;

      const firstDisplay = data[0].date_display || "";
      const isDaily = /^\d{4}-\d{2}-\d{2}$/.test(firstDisplay);
      const isMonthly = /^\d{4}-\d{2}$/.test(firstDisplay);

      // 실제 min/max 날짜 계산 (데이터 순서와 무관)
      const dates = data.map((d: { date: string }) => new Date(d.date).getTime());
      const minDate = new Date(Math.min(...dates)).toISOString();
      const maxDate = new Date(Math.max(...dates)).toISOString();

      return {
        datetime_type: isDaily ? "day" : isMonthly ? "month" : "quarter",
        datetime_range: {
          datetime_start: minDate,
          datetime_end: maxDate,
        },
        datetime_unit: 1,
      } as UnitSettings;
    } catch {
      return defaultUnitSettings;
    }
  }, [inputData]);

  const handleSampleSelect = async (filename: string) => {
    setSelectedSample(filename);
    localStorage.setItem('selectedSample', filename);
    if (filename === "default") {
      setInputData(JSON.stringify(sampleData, null, 2));
      return;
    }
    try {
      const res = await fetch(`/parsedTables/${filename}.json`);
      const data = await res.json();
      setInputData(JSON.stringify(data, null, 2));
    } catch (err) {
      // 에러 시 기존 데이터 유지
    }
  };

  // 페이지 로드 시 localStorage에서 저장된 샘플 복원
  useEffect(() => {
    const saved = localStorage.getItem('selectedSample');
    if (saved && saved !== 'default' && SAMPLE_FILES.includes(saved)) {
      (async () => {
        try {
          const res = await fetch(`/parsedTables/${saved}.json`);
          const data = await res.json();
          setSelectedSample(saved);
          setInputData(JSON.stringify(data, null, 2));
        } catch {
          // 에러 시 기본 샘플 유지
        }
      })();
    }
  }, []);

  return (
    <div className="h-screen p-4">
      <div className="flex items-center justify-end gap-2 mb-4">
        <Select value={selectedSample} onValueChange={handleSampleSelect}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="샘플 데이터 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">기본 샘플</SelectItem>
            {SAMPLE_FILES.map(file => (
              <SelectItem key={file} value={file}>{file}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ChartToolView
        inputData={inputData}
        unitSettings={unitSettings}
        isExecuted={true}
        devMode={true}
        showBrush={true}
        skipConstraints={selectedSample === "default"}
        multiLevelTreemapColors={selectedSample === "sample_3" ? SAMPLE_3_TREEMAP_COLORS : undefined}
      />
    </div>
  );
}
