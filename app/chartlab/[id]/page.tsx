"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SavedChart } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function ChartDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [chart, setChart] = useState<SavedChart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChart();
  }, [params.id]);

  async function loadChart() {
    const { data } = await supabase
      .from("user_charts")
      .select("*")
      .eq("id", params.id as string)
      .single();

    if (data) setChart(data as SavedChart);
    setLoading(false);
  }

  async function handleDelete() {
    if (!chart) return;
    await supabase.from("user_charts").delete().eq("id", chart.id);
    router.push("/chartlab");
  }

  if (loading) return <div className="flex flex-col h-full overflow-hidden bg-background"><div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-3">불러오는 중...</div></div>;
  if (!chart) return <div className="flex flex-col h-full overflow-hidden bg-background"><div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-3">차트를 찾을 수 없습니다</div></div>;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="pt-10 px-6 pb-5 border-b border-border shrink-0">
        <Button
          variant="link"
          className="p-0 mb-3 text-muted-foreground hover:text-primary text-[13px] h-auto"
          onClick={() => router.push("/chartlab")}
        >
          ← 차트 목록
        </Button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-medium text-foreground">{chart.title}</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {chart.chart_type} · {new Date(chart.updated_at).toLocaleDateString("ko-KR")}
              {chart.is_public && " · 공개"}
            </p>
          </div>
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-accent text-[13px]"
            onClick={handleDelete}
          >
            삭제
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-center h-[400px] bg-card border border-border rounded-lg text-muted-foreground/60 text-sm">
          차트 편집기는 Highcharts 연동 후 활성화됩니다
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-medium text-foreground mb-2">차트 설정 (JSON)</h3>
          <pre className="p-4 bg-card border border-border rounded-lg text-xs text-card-foreground overflow-auto max-h-[300px]">
            {JSON.stringify(chart.config, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
