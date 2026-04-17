"use client";

import type { ChartType, ChartStyle, CartesianStyle, PieStyle } from "./types";
import { CHART_STYLE_OPTIONS } from "./registry";

const selectClass =
  "w-full py-2 pr-7 pl-2.5 bg-[#2a2a2a] border border-[#444] rounded text-white text-xs font-light cursor-pointer appearance-none hover:border-[#666] hover:bg-[#333] focus:outline-none focus:border-[#666]";

const SelectArrow = () => (
  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-[#888] pointer-events-none" />
);

interface StyleTabProps {
  chartType: ChartType;
  style: ChartStyle;
  onStyleChange: (style: ChartStyle) => void;
}

export function StyleTab({ chartType, style, onStyleChange }: StyleTabProps) {
  const spec = CHART_STYLE_OPTIONS[chartType];
  const options = spec.options;

  const update = (patch: Partial<ChartStyle>) => {
    onStyleChange({ ...style, ...patch });
  };

  return (
    <div className="flex flex-col">
      {options.includes("lineWidth") && (
        <Section title="라인 스타일">
          <Field label="선 두께">
            <div className="relative">
              <select
                className={selectClass}
                value={(style as CartesianStyle).lineWidth ?? 2}
                onChange={(e) => update({ lineWidth: Number(e.target.value) } as Partial<CartesianStyle>)}
              >
                <option value={1}>1px</option>
                <option value={2}>2px</option>
                <option value={3}>3px</option>
                <option value={4}>4px</option>
              </select>
              <SelectArrow />
            </div>
          </Field>
          {options.includes("markerEnabled") && (
            <Field label="마커 표시">
              <div className="relative">
                <select
                  className={selectClass}
                  value={(style as CartesianStyle).markerEnabled !== false ? "true" : "false"}
                  onChange={(e) =>
                    update({ markerEnabled: e.target.value === "true" } as Partial<CartesianStyle>)
                  }
                >
                  <option value="true">표시</option>
                  <option value="false">숨김</option>
                </select>
                <SelectArrow />
              </div>
            </Field>
          )}
        </Section>
      )}

      {options.includes("yAxes") && (
        <Section title="축 설정">
          <Field label="Y축 위치">
            <div className="relative">
              <select
                className={selectClass}
                value={getFirstYAxisPosition(style)}
                onChange={(e) => {
                  const pos = e.target.value as "left" | "right";
                  const s = style as CartesianStyle;
                  const yAxes = (s.yAxes ?? [{ id: "default" }]).map((a) => ({
                    ...a,
                    position: pos,
                  }));
                  update({ yAxes } as Partial<CartesianStyle>);
                }}
              >
                <option value="left">왼쪽</option>
                <option value="right">오른쪽</option>
              </select>
              <SelectArrow />
            </div>
          </Field>
        </Section>
      )}

      {options.includes("legend") && (
        <Section title="범례">
          <Field label="위치">
            <div className="relative">
              <select
                className={selectClass}
                value={style.legend?.position ?? "none"}
                onChange={(e) =>
                  update({
                    legend: {
                      position: e.target.value as "top" | "bottom" | "left" | "right" | "none",
                    },
                  })
                }
              >
                <option value="none">숨김</option>
                <option value="top">상단</option>
                <option value="bottom">하단</option>
                <option value="right">오른쪽</option>
                <option value="left">왼쪽</option>
              </select>
              <SelectArrow />
            </div>
          </Field>
        </Section>
      )}

      {options.includes("dataLabels") && (
        <Section title="데이터 라벨">
          <label className="flex items-center gap-2 text-xs text-card-foreground cursor-pointer [&_input]:accent-primary">
            <input
              type="checkbox"
              checked={getDataLabels(style, spec.styleType)}
              onChange={(e) => update({ dataLabels: e.target.checked } as Partial<CartesianStyle>)}
            />
            <span>라벨 표시</span>
          </label>
        </Section>
      )}

      {options.includes("innerRadius") && (
        <Section title="도넛">
          <Field label="내부 반지름 (%)">
            <div className="relative">
              <select
                className={selectClass}
                value={(style as PieStyle).innerRadius ?? 0}
                onChange={(e) =>
                  update({ innerRadius: Number(e.target.value) } as Partial<PieStyle>)
                }
              >
                <option value={0}>0% (Pie)</option>
                <option value={40}>40%</option>
                <option value={50}>50%</option>
                <option value={60}>60%</option>
              </select>
              <SelectArrow />
            </div>
          </Field>
        </Section>
      )}

      {options.includes("showPercentage") && (
        <Section title="퍼센트">
          <label className="flex items-center gap-2 text-xs text-card-foreground cursor-pointer [&_input]:accent-primary">
            <input
              type="checkbox"
              checked={(style as PieStyle).showPercentage ?? false}
              onChange={(e) =>
                update({ showPercentage: e.target.checked } as Partial<PieStyle>)
              }
            />
            <span>퍼센트 표시</span>
          </label>
        </Section>
      )}

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 pb-4 border-b border-[#2a2a2a]">
      <div className="text-[11px] font-medium text-[#999] mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="text-[10px] text-[#888] mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 mb-2 last:mb-0">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-6 border border-[#444] rounded cursor-pointer bg-transparent p-0"
      />
      <span className="text-[10px] text-[#888]">{label}</span>
    </div>
  );
}

function getFirstYAxisPosition(style: ChartStyle): "left" | "right" {
  const s = style as CartesianStyle;
  return s.yAxes?.[0]?.position ?? "right";
}

function getDataLabels(style: ChartStyle, styleType: string): boolean {
  if (styleType === "pie") return (style as PieStyle).dataLabels !== false;
  return (style as CartesianStyle).dataLabels ?? false;
}
