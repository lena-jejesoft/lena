export type PricePoint = [number, number]; // [timestamp, price]

export interface EventItem {
  id: string;
  x: number;
  type: string;
  impact: number;
  title: string;
  text: string;
  desc: string;
  content: string;
  source: string;
  sourceDate: string;
}

export interface Decision {
  x: number;
  title: string;
  note: string;
  who: string;
  stance: "BUY" | "HOLD" | "SELL";
}

export type Scenario = "BASE" | "BULL" | "BEAR";

export const DAY = 24 * 3600 * 1000;

export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function genPriceSeries(
  startTs: number,
  days: number,
  startPrice = 100
): PricePoint[] {
  const data: PricePoint[] = [];
  let p = startPrice;
  for (let i = 0; i < days; i++) {
    const t = startTs + i * DAY;
    const r = (seededRandom(i * 13.37) - 0.48) * 0.018;
    const shock = i % 57 === 0 ? (seededRandom(i * 7.77) - 0.5) * 0.12 : 0;
    p = Math.max(10, p * (1 + r + shock));
    data.push([t, +p.toFixed(2)]);
  }
  return data;
}

export const EVENT_TYPES: Record<string, { name: string; short: string }> = {
  EARNINGS: { name: "실적", short: "E" },
  FUNDING: { name: "증자/조달", short: "F" },
  CONTRACT: { name: "수주/계약", short: "C" },
  REGULATION: { name: "규제/정책", short: "R" },
  INSIDER: { name: "오너/지배", short: "I" },
};

export function genEvents(priceData: PricePoint[]): EventItem[] {
  const idxs = [25, 55, 90, 120, 150, 185, 210, 240, 275, 310];
  const types = ["EARNINGS", "FUNDING", "CONTRACT", "REGULATION", "INSIDER"];
  const titles: Record<string, string[]> = {
    EARNINGS: ["실적 서프라이즈", "실적 부진", "가이던스 상향", "가이던스 하향"],
    FUNDING: ["유상증자", "CB 발행", "BW 발행", "자사주 소각"],
    CONTRACT: ["대형 수주", "공급 계약", "파트너십", "계약 해지"],
    REGULATION: ["규제 완화", "규제 강화", "정책 수혜", "정책 불확실"],
    INSIDER: ["최대주주 변경", "경영권 이슈", "임원 매수", "임원 매도"],
  };

  const contents: Record<string, string[]> = {
    EARNINGS: [
      "시장 예상치를 크게 상회하는 분기 실적을 발표. 매출과 영업이익 모두 컨센서스 대비 15% 이상 초과 달성하며 주가에 긍정적 영향.",
      "시장 기대에 미치지 못하는 분기 실적 발표. 매출은 소폭 하회, 영업이익은 컨센서스 대비 20% 하회하며 투자심리 위축.",
      "경영진이 향후 분기 실적 가이던스를 상향 조정. 수요 회복과 원가 절감 효과를 반영하여 연간 목표치도 함께 상향.",
      "향후 분기 실적 가이던스를 하향 조정. 글로벌 수요 둔화와 원자재 가격 상승 압력으로 수익성 악화 전망.",
    ],
    FUNDING: [
      "운영 자금 확보를 위한 유상증자 결정 공시. 기존 주주 희석 우려로 단기 주가 하락 압력 예상.",
      "전환사채(CB) 발행을 통한 자금 조달 결정. 전환가액과 조건에 따라 향후 희석 가능성 존재.",
      "신주인수권부사채(BW) 발행 결정. 조달 자금은 신규 사업 투자에 활용 예정이나 잠재 희석 리스크.",
      "자사주 소각을 통한 주주가치 제고 결정. 유통 주식수 감소로 주당 가치 상승 효과 기대.",
    ],
    CONTRACT: [
      "대규모 프로젝트 수주 확정. 계약 규모는 연매출의 약 30%에 해당하며 향후 2년간 매출 인식 예정.",
      "주요 고객사와 장기 공급 계약 체결. 안정적 매출 기반 확보로 실적 가시성 향상.",
      "글로벌 기업과의 전략적 파트너십 체결. 기술 협력 및 공동 마케팅을 통한 시너지 효과 기대.",
      "주요 계약 해지 통보 수신. 해당 계약은 전체 매출의 약 15%를 차지하여 실적 영향 불가피.",
    ],
    REGULATION: [
      "정부의 산업 규제 완화 발표. 진입 장벽 완화와 사업 확장 기회 확대로 수혜 전망.",
      "새로운 산업 규제 도입 발표. 컴플라이언스 비용 증가와 사업 모델 조정 필요성 대두.",
      "정부 정책 수혜 대상으로 선정. 세제 혜택 및 보조금 지원으로 수익성 개선 기대.",
      "정책 방향성 불확실성 확대. 규제 환경 변화에 따른 사업 전략 재검토 필요.",
    ],
    INSIDER: [
      "최대주주 지분 변동 공시. 경영권 이전 가능성에 따른 기업 전략 방향 변화 주시 필요.",
      "경영권 분쟁 이슈 부각. 주주 간 갈등으로 의사결정 지연 및 기업가치 훼손 우려.",
      "주요 임원의 자사주 매수 공시. 경영진의 기업가치 자신감 표현으로 긍정적 시그널.",
      "주요 임원의 자사주 매도 공시. 대량 매도의 경우 내부 정보 활용 가능성에 대한 시장 우려.",
    ],
  };

  const sources: Record<string, { name: string; label: string }[]> = {
    EARNINGS: [
      { name: "DART 분기보고서", label: "DART 전자공시" },
      { name: "DART 반기보고서", label: "DART 전자공시" },
      { name: "한국경제 기사", label: "한국경제신문" },
      { name: "매일경제 기사", label: "매일경제신문" },
    ],
    FUNDING: [
      { name: "DART 주요사항보고서", label: "DART 전자공시" },
      { name: "DART 증권발행실적보고서", label: "DART 전자공시" },
      { name: "DART 주요사항보고서", label: "DART 전자공시" },
      { name: "DART 자기주식취득·처분결과보고서", label: "DART 전자공시" },
    ],
    CONTRACT: [
      { name: "DART 단일판매·공급계약체결", label: "DART 전자공시" },
      { name: "DART 단일판매·공급계약체결", label: "DART 전자공시" },
      { name: "머니투데이 기사", label: "머니투데이" },
      { name: "DART 단일판매·공급계약해지", label: "DART 전자공시" },
    ],
    REGULATION: [
      { name: "국가법령정보센터 고시", label: "법령정보센터" },
      { name: "국가법령정보센터 시행령", label: "법령정보센터" },
      { name: "기획재정부 보도자료", label: "기획재정부" },
      { name: "조선비즈 기사", label: "조선비즈" },
    ],
    INSIDER: [
      { name: "DART 주식등의대량보유상황보고서", label: "DART 전자공시" },
      { name: "DART 임원·주요주주특정증권등소유상황보고서", label: "DART 전자공시" },
      { name: "DART 임원·주요주주특정증권등소유상황보고서", label: "DART 전자공시" },
      { name: "DART 임원·주요주주특정증권등소유상황보고서", label: "DART 전자공시" },
    ],
  };

  return idxs.map((idx, k) => {
    const i = Math.min(idx, priceData.length - 1);
    const t = priceData[i][0];
    const type = types[k % types.length];
    const impact = 1 + (k % 3);
    const text = titles[type][k % titles[type].length];
    const contentIdx = k % contents[type].length;
    const sourceInfo = sources[type][contentIdx];
    const srcDate = new Date(t - (1 + (k % 3)) * DAY);
    const sourceDate = srcDate.toISOString().slice(0, 10);
    return {
      id: "EVT_" + k,
      x: t,
      type,
      impact,
      title: EVENT_TYPES[type].short,
      text,
      desc: `${EVENT_TYPES[type].name} • ${text} • Impact ${impact}`,
      content: contents[type][contentIdx],
      source: sourceInfo.name,
      sourceDate,
    };
  });
}

export function buildScenarioBands(
  scenario: Scenario,
  priceData: PricePoint[]
): { pivot: number; band: [number, number, number][] } {
  const lastVal = priceData[priceData.length - 1][1];
  const lastX = priceData[priceData.length - 1][0];
  const horizonDays = 120;
  const band: [number, number, number][] = [];

  for (let i = 0; i <= horizonDays; i++) {
    const x = lastX + i * DAY;
    let drift = 0.0006;
    if (scenario === "BULL") drift = 0.0012;
    if (scenario === "BEAR") drift = 0.0001;

    const mid = lastVal * Math.pow(1 + drift, i);
    const width =
      scenario === "BULL" ? 0.22 : scenario === "BEAR" ? 0.28 : 0.25;

    band.push([x, +(mid * (1 - width)).toFixed(2), +(mid * (1 + width)).toFixed(2)]);
  }

  return { pivot: lastX, band };
}

export function sliceByRange(
  series: PricePoint[],
  minX: number,
  maxX: number
): PricePoint[] {
  return series.filter((p) => p[0] >= minX && p[0] <= maxX);
}

export function volApprox(series: PricePoint[]): number | null {
  if (series.length < 3) return null;
  const rets: number[] = [];
  for (let i = 1; i < series.length; i++) {
    rets.push(series[i][1] / series[i - 1][1] - 1);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const v = Math.sqrt(
    rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / rets.length
  );
  return v * 100;
}

export function pct(a: number | undefined, b: number | undefined): number | null {
  if (!a || !b) return null;
  return ((b - a) / a) * 100;
}

export function fmtPct(x: number | null | undefined): string {
  if (x === null || x === undefined || isNaN(x)) return "-";
  return (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
}

/* ── Report types ── */

export type ReportBlockType =
  | "title"
  | "summary"
  | "kpi"
  | "chart"
  | "events"
  | "decisions"
  | "freetext";

export interface ReportBlock {
  id: string;
  type: ReportBlockType;
  content: string;
  visible: boolean;
  order: number;
}

export interface ReportDraft {
  blocks: ReportBlock[];
  lastModified: number;
}

export function createDefaultReport(
  events: EventItem[],
  decisions: Decision[],
  price: PricePoint[],
  scenario: Scenario
): ReportDraft {
  const first = price[0];
  const last = price[price.length - 1];
  const startDate = new Date(first[0]).toISOString().slice(0, 10);
  const endDate = new Date(last[0]).toISOString().slice(0, 10);
  const returnPct = pct(first[1], last[1]);
  const highImpact = events.filter((e) => e.impact >= 3).length;

  const blocks: ReportBlock[] = [
    {
      id: "blk_title",
      type: "title",
      content: "SectorBook 분석 리포트",
      visible: true,
      order: 0,
    },
    {
      id: "blk_summary",
      type: "summary",
      content: `분석 기간: ${startDate} ~ ${endDate}\n시나리오: ${scenario}\n기간 수익률: ${fmtPct(returnPct)}\n\n[여기에 분석 요약을 작성하세요]`,
      visible: true,
      order: 1,
    },
    {
      id: "blk_kpi",
      type: "kpi",
      content: "",
      visible: true,
      order: 2,
    },
    {
      id: "blk_chart",
      type: "chart",
      content: "",
      visible: true,
      order: 3,
    },
    {
      id: "blk_events",
      type: "events",
      content: "",
      visible: true,
      order: 4,
    },
    {
      id: "blk_decisions",
      type: "decisions",
      content: "",
      visible: true,
      order: 5,
    },
  ];

  return { blocks, lastModified: Date.now() };
}
