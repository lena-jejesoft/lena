"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { UnitSettings } from "@chartCore/src/types/chart-unit-settings";
import type { ChartType, YAxisPlacement } from "@chartCore/src/types/chart-config";

const ChartToolView = dynamic(() => import("@chartCore/src/tools/chartTool/index"), { ssr: false });

interface ChartConfig {
  dataJson: string;
  chartType: ChartType;
  showOutliers: boolean;
  yFieldTypes?: Record<string, "column" | "line">;
  yAxisPlacements?: Record<string, YAxisPlacement>;
  unitSettings?: UnitSettings;
}

export default function EmbedPage() {
  const [config, setConfig] = useState<ChartConfig | null>(null);

  useEffect(() => {
    // postMessage 리스너
    const handleMessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};

      if (type === "CHART_CONFIG" && payload) {
        setConfig({
          dataJson: payload.dataJson || "",
          chartType: payload.chartType || "line",
          showOutliers: payload.showOutliers ?? true,
          yFieldTypes: payload.yFieldTypes,
          yAxisPlacements: payload.yAxisPlacements,
          unitSettings: payload.unitSettings,
        });
      }
    };

    window.addEventListener("message", handleMessage);

    // 부모에게 준비 완료 알림
    window.parent.postMessage({ type: "CHART_READY" }, "*");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // 호버/클릭 이벤트를 부모로 전달
  const handleTooltipChange = (payload: any[] | null, label: string | null) => {
    window.parent.postMessage(
      {
        type: "CHART_HOVER",
        payload: { data: payload, label },
      },
      "*"
    );
  };

  // 기본 unitSettings
  const defaultUnitSettings: UnitSettings = config?.unitSettings || {
    datetime_type: "quarter",
    datetime_range: {
      datetime_start: "",
      datetime_end: "",
    },
    datetime_unit: 1,
  };

  return (
    <div className="h-screen bg-background">
      {!config ? (
        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
          데이터 대기 중...
        </div>
      ) : (
        <ChartToolView
          inputData={config.dataJson}
          unitSettings={defaultUnitSettings}
          isExecuted={true}
          chartType={config.chartType}
          yFieldTypes={config.yFieldTypes}
          yAxisPlacements={config.yAxisPlacements}
          showOutliers={config.showOutliers}
        />
      )}
    </div>
  );
}
