"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CHART_TYPES = ["line", "column", "pie", "area", "scatter"];

export default function NewChartPage() {
  const router = useRouter();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [chartType, setChartType] = useState("line");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const { data, error } = await supabase
      .from("user_charts")
      .insert({
        user_id: user.id,
        title: title.trim(),
        chart_type: chartType,
        config: { series: [], xAxis: {}, yAxis: {} },
        is_public: isPublic,
      })
      .select("id")
      .single();

    if (!error && data) {
      router.push(`/chartlab/${data.id}`);
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="pt-10 px-6 pb-5 border-b border-border shrink-0">
        <h1 className="text-xl font-medium text-foreground">새 차트 만들기</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 max-w-[480px]">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">차트 이름</Label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-card text-[13px]"
              placeholder="차트 제목을 입력하세요"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5">차트 유형</Label>
            <div className="flex gap-2 flex-wrap">
              {CHART_TYPES.map((t) => (
                <Button
                  key={t}
                  variant={chartType === t ? "default" : "outline"}
                  onClick={() => setChartType(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-[13px] text-card-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            공개 차트로 설정
          </label>

          <div className="flex gap-2 mt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? "저장 중..." : "차트 생성"}
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              취소
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
