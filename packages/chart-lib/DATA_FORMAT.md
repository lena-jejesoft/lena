# Data Format

`<DataChart>`에 어떤 데이터를 넘기면 어떤 차트가 뜨는지 정리한 문서. 독자는 같은 스택(Next.js 16 + React 19 + Tailwind 4 + shadcn/ui)에서 `packages/chart-lib`을 사용하는 개발자.

---

## 1. 개요

차트는 하나의 컴포넌트에서 출발한다.

```tsx
<DataChart
  data={data}          // ChartData — 공통 구조
  chartType="chartCore/line"
  style={style}        // ChartStyle — 선택, 차트별로 shape이 다름
/>
```

`data.series[].data`에 값을 넣는 방법이 두 가지다.

- **Point mode** — 각 원소가 `{ x, y }`. 타입에 정의된 공식 경로.
- **Row mode** — `series.length === 1`일 때 `data`에 객체 배열(raw 테이블)을 넣으면 `toChartCoreTable()`이 자동으로 감지해 여러 시리즈로 풀어낸다. `regression-scatter`, `ranking-bar`, `geo-grid`, `radar`, `gauge`, `sankey-diagram`, `two-level-pie`, `multi-level-treemap`, `insider-trading` 등은 Row mode가 사실상 표준.

둘은 동등한 경로다. 차트 유형이 요구하는 쪽을 골라 쓴다.

UI 드롭다운(`chart-type-options.ts`)에 노출되는 차트는 총 **27종**: chartCore 19 · core 2 · recharts 5 · lightweight 1. 각 차트의 예제는 §7·§8 참고.

---

## 2. 가져다 쓰기

```tsx
"use client";

import { DataChart } from "@/packages/chart-lib/DataChart";
import type { ChartData } from "@/packages/chart-lib/types";
```

- `"use client"`가 **반드시** 필요하다. `DataChart`는 내부에서 `next/dynamic`으로 렌더러를 SSR 비활성(`ssr: false`)으로 불러오므로 서버 컴포넌트에서는 동작하지 않는다 (`DataChart.tsx:1,9-12`).
- 설치·alias 설정·전체 props 목록은 [README.md](./README.md) 참고.

---

## 3. 공통 타입

`types.ts`의 정의를 그대로 옮겨둔다.

### 3.1 ChartData / ChartSeries

```ts
interface ChartData {
  series: ChartSeries<PointType>[];
  xAxisType: "datetime" | "category" | "numeric";
}

interface ChartSeries<P = CartesianPoint> {
  id: string;             // 시리즈 고유 키. Row mode에선 자동 추출된 필드명이 곧 id
  name: string;           // 범례 표시명
  data: P[];              // Point mode는 {x,y}[], Row mode는 {date, …}[]
  unit?: string;          // 툴팁 단위 표기
  color?: string;         // 스타일 colorPalette보다 우선
  yAxisId?: string;       // dual-axis에서 "left" / "right"
  chartType?: ChartType;  // mixed 차트에서 per-series override
  visible?: boolean;      // 기본 true
  dashStyle?: string;
  opacity?: number;
  lineWidth?: number;
  linkedTo?: string;      // 다른 series.id와 연결 (범례 그룹핑 등)
}
```

### 3.2 Point 타입

```ts
interface CartesianPoint {
  x: number | string;     // category는 string, datetime은 number(ms) 또는 string(ISO)
  y: number;
  label?: string;
  color?: string;
  size?: number;          // bubble/regression-scatter에서 점 크기
}

interface OHLCPoint {       // lightweight/candles 전용
  x: number;               // UTC timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  turnover?: number | null;
}
```

### 3.3 xAxisType

| 값 | 정렬·해석 규칙 |
|---|---|
| `"category"` | 정렬 없음. `x`는 문자열 카테고리로 취급. 순서가 배열 순서대로 유지 |
| `"datetime"` | `x`를 숫자로 파싱 후 오름차순 정렬. ISO 문자열도 허용 (`Date.parse`로 파싱) |
| `"numeric"` | `x`를 숫자 정렬 |

`toChartCoreTable.ts:42-53`에서 numeric/datetime은 숫자 변환 후 정렬하고, category는 원본 순서 유지.

### 3.4 ChartStyle 유니온

`ChartStyle`은 네 가지 shape의 유니온이다.

```ts
type ChartStyle = CartesianStyle | PieStyle | TreemapStyle | GeoGridStyle;
```

**이 문서는 데이터 해석에 영향을 주는 스타일 필드만 설명한다.** (아래 목록)

- `CartesianStyle.regressionScatter.{xField, yField}`
- `CartesianStyle.stackedGrouped.{assignments, groupCount}`
- `CartesianStyle.rankingBar.selectedKey`
- `CartesianStyle.timepointLine.{enabled, showOutliers}`
- `CartesianStyle.dualAxis.{placements, yFieldTypes}`
- `CartesianStyle.syncedArea.{leftField, rightField}`
- `CartesianStyle.lightweightCandles.{scenario, showVolume, showMa5, …}`
- `PieStyle.timepointPie.{selectedKey, enabled}`
- `PieStyle.twoLevelPie.{assignments, selectedKey, hierarchyGroups}`
- `TreemapStyle.treemap.{selectedKey, enabled, hierarchyGroups}`
- `GeoGridStyle.geoGrid.{mapLevel, selectedTimepoint, metricId}`

색상·제목·범례 위치·축 제목 같은 presentation 옵션은 `types.ts`에 정의된 `ChartStyleBase`·`CartesianStyle` 전체를 참고.

---

## 4. Point mode

가장 단순한 경로. `{ x, y }` 포인트 배열을 시리즈마다 직접 구성한다.

### 4.1 최소 예제 — 라인 1개

```tsx
const data: ChartData = {
  xAxisType: "category",
  series: [
    {
      id: "revenue",
      name: "매출",
      data: [
        { x: "Q1", y: 120 },
        { x: "Q2", y: 150 },
        { x: "Q3", y: 135 },
        { x: "Q4", y: 170 },
      ],
    },
  ],
};

<DataChart data={data} chartType="chartCore/line" />;
```

### 4.2 xAxisType 변형

```tsx
// datetime — x는 UTC ms 또는 ISO 문자열
{ x: "2024-01-01", y: 100 }
{ x: 1704067200000, y: 100 }

// numeric — x는 실수
{ x: 0.5, y: 2.3 }
```

`xAxisType: "datetime" | "numeric"`이면 렌더 전에 오름차순 정렬된다.

### 4.3 다중 시리즈

```tsx
const data: ChartData = {
  xAxisType: "datetime",
  series: [
    {
      id: "rev",
      name: "매출",
      unit: "억원",
      color: "#4C9AFF",
      data: [
        { x: "2024-01", y: 120 },
        { x: "2024-02", y: 138 },
        { x: "2024-03", y: 145 },
        { x: "2024-04", y: 160 },
        { x: "2024-05", y: 170 },
      ],
    },
    {
      id: "cost",
      name: "비용",
      unit: "억원",
      data: [
        { x: "2024-01", y: 80 },
        { x: "2024-02", y: 90 },
        { x: "2024-03", y: 95 },
        { x: "2024-04", y: 105 },
        { x: "2024-05", y: 110 },
      ],
    },
  ],
};
```

- `unit` → 툴팁에 단위 표시
- `color` → 이 시리즈만 고정 색상
- `visible: false` → 렌더 시작부터 숨김

### 4.4 yAxisId / chartType override / linkedTo

- `yAxisId` — dual-axis 차트에서 `"left"` / `"right"` 지정 (§7.3 표 참고).
- `chartType` — `chartCore/mixed` 차트에서 시리즈마다 유형을 override (예: 한 시리즈는 `"chartCore/line"`, 다른 시리즈는 `"chartCore/column"`).
- `linkedTo` — 다른 `series.id`와 범례/이벤트 상 그룹핑.

---

## 5. Row mode (raw table 자동 감지)

`series.length === 1`이고 `data[0]`에 `x`·`y`가 없으면 자동으로 Row mode로 전환된다 (`toChartCoreTable.ts:16-24`).

### 5.1 발동 조건

```ts
// looksLikeRowMode()
series.length === 1 &&
typeof data[0] === "object" &&
!Array.isArray(data[0]) &&
!("x" in data[0] && "y" in data[0])
```

즉 "시리즈 한 덩어리 안에 테이블 row들이 들어온" 형태라고 감지되면, `toChartCoreTable()`이 각 numeric 필드를 시리즈로 풀어낸다.

### 5.2 필수 필드

| 필드 | 역할 | 우선순위 |
|---|---|---|
| `date_display` | X축 라벨(카테고리 이름) | 1순위 |
| `x` | 위가 없으면 라벨로 사용 | 2순위 |
| `date` | ISO 날짜 문자열. 시간순 정렬용 | 정렬 키 (라벨과는 별개) |

`date_display`와 `date`를 둘 다 넣으면 "라벨은 분기명, 정렬은 시간순"이 된다.

### 5.3 자동 추출 규칙

```ts
excluded = { "date", "date_display", "x", "y" }
yFields = row의 모든 key 중 excluded가 아니고 numeric 값을 가진 것
```

자동 추출된 시리즈는 `id = name = 필드명`이 된다. 즉 "매출" 필드가 있으면 시리즈 id도 `"매출"`이다.

### 5.4 null 처리

누락된 필드는 명시적으로 `null`로 채워진다 (`toChartCoreTable.ts:122-128`). Recharts는 `null`을 "데이터 없음"으로 처리해 해당 구간에 점/선이 찍히지 않는다.

### 5.5 Row mode 예제

```tsx
const rows = [
  { date: "2024-01-01", date_display: "1월", 매출: 120, 비용: 80 },
  { date: "2024-02-01", date_display: "2월", 매출: 138, 비용: 90 },
  { date: "2024-03-01", date_display: "3월", 매출: 145, 비용: 95 },
  { date: "2024-04-01", date_display: "4월", 매출: 160, 비용: 105 },
  { date: "2024-05-01", date_display: "5월", 매출: 170, 비용: 110 },
];

const data: ChartData = {
  xAxisType: "datetime",
  series: [{ id: "raw", name: "raw", data: rows as unknown as CartesianPoint[] }],
};

<DataChart data={data} chartType="chartCore/line" />;
```

`매출`·`비용` 두 numeric 필드가 자동으로 시리즈가 된다. Row mode는 런타임 감지 기능이라 타입 시스템으로는 표현되지 않으므로 `as unknown as CartesianPoint[]` 2단 캐스팅으로 우회한다.

### 5.6 Style에서 필드 참조하기

여러 차트가 Row mode의 특정 필드나 타임포인트를 지정받기 위해 스타일에 필드명을 담는다. 각 차트 섹션(§7·§8)에서 상세히 다룬다.

---

## 6. 차트 크기 제어

`DataChart.tsx:99`에서 최상위 엘리먼트는 `<div className="flex flex-row w-full h-full">`. 즉 **부모 박스의 폭·높이를 항상 100% 채운다**.

### 6.1 두 축

| 축 | 동작 |
|---|---|
| 폭 | 항상 반응형. `width` prop은 없다. Recharts는 내부에서 `ResponsiveContainer width="100%"` 사용 |
| 높이 | 부모의 높이를 상속. `height` prop(number, px)을 넘기면 그 값을 내부 렌더러에 그대로 전달 |

### 6.2 케이스별 예제

**고정 크기 박스**
```tsx
<div style={{ width: 600, height: 400 }}>
  <DataChart data={data} chartType="chartCore/line" />
</div>
```

**반응형 폭 + 고정 높이**
```tsx
<div className="w-full h-[480px]">
  <DataChart data={data} chartType="chartCore/area" />
</div>
```

**flex 부모 채우기** — 사이드바 있는 대시보드 등
```tsx
<div className="flex flex-col h-screen">
  <Header />
  <main className="flex-1 min-h-0">
    <DataChart data={data} chartType="chartCore/column" />
  </main>
</div>
```

**그리드 셀 안에서** — `height` prop으로 명시하는 방식
```tsx
<div className="grid grid-cols-2 gap-4">
  {charts.map((c) => (
    <div key={c.id} className="overflow-hidden">
      <DataChart data={c.data} chartType={c.chartType} height={320} />
    </div>
  ))}
</div>
```

### 6.3 자주 마주치는 문제

- **차트가 안 보임 / 높이가 0** — 부모가 명시적 높이(`h-[Npx]`·`h-full`·flex child `flex-1`)를 못 받은 경우. flex 컬럼 내부에선 `min-h-0`가 없으면 overflow로 인해 높이가 안 잡힌다.
- **폭이 넘침** — Recharts 계열이 다음 렌더 직후 폭을 재측정한다. flex 부모에 `min-w-0` 추가.
- **SSR 경고** — 최상위 컴포넌트에 `"use client"`가 없으면 `dynamic` import가 서버에서 평가되다 실패한다.

---

## 7. 공통 계열 — 라인·면적·막대 (12종)

대상: `chartCore/{line, column, area, area-100, stacked, stacked-100, stacked-area, synced-area, stacked-grouped, dual-axis, dual-axis-stacked-bar, mixed}`.

데이터 형식은 전부 공통. Point mode·Row mode 둘 다 동작한다.

### 7.1 공통 Point mode 예제

```tsx
const data: ChartData = {
  xAxisType: "datetime",
  series: [
    { id: "rev",  name: "매출", data: pts("rev") },
    { id: "cost", name: "비용", data: pts("cost") },
  ],
};

<DataChart data={data} chartType="chartCore/column" />;
// chartType만 바꾸면 line / area / stacked / stacked-100 / stacked-area 등으로 교체
```

### 7.2 공통 Row mode 예제 (같은 차트를 테이블로)

```tsx
const rows = [
  { date: "2024-01-01", date_display: "1월", 매출: 120, 비용: 80 },
  { date: "2024-02-01", date_display: "2월", 매출: 138, 비용: 90 },
  // …5개 이상
];

const data: ChartData = {
  xAxisType: "datetime",
  series: [{ id: "raw", name: "raw", data: rows as unknown as CartesianPoint[] }],
};

<DataChart data={data} chartType="chartCore/stacked-area" />;
```

### 7.3 차트별 차이점

| chartType | 최소 시점 | 최소 시리즈 | 음수 | 필요한 style 필드 |
|---|---|---|---|---|
| `chartCore/line` | 5 | — | ✓ | — |
| `chartCore/column` | — | — | ✓ | — |
| `chartCore/area` | 5 | — | ✓ | — |
| `chartCore/area-100` | 5 | 2 | ✗ | `stacking: "percent"` (자동) |
| `chartCore/stacked` | — | 2 | ✓ | `stacking: "normal"` |
| `chartCore/stacked-100` | — | 2 | ✗ | `stacking: "percent"` |
| `chartCore/stacked-area` | 5 | 2 | ✗ | — |
| `chartCore/synced-area` | 5 | 2 | ✓ | `syncedArea.{leftField, rightField}` — Row mode에서 좌우 패널 각각이 볼 필드 |
| `chartCore/stacked-grouped` | — | 3 | ✗ | `stackedGrouped.{assignments: Record<seriesId, 1|2|3|4>, groupCount}` — 각 시리즈를 몇 번 그룹에 넣을지 |
| `chartCore/dual-axis` | 5 | 2 | ✓ | Point mode: `series[].yAxisId` / Row mode: `dualAxis.{placements: {fieldName: "left"|"right"}, yFieldTypes: {fieldName: "column"|"line"}}` |
| `chartCore/dual-axis-stacked-bar` | 3 | 3 | ✗ | 위와 동일 |
| `chartCore/mixed` | 5 | 2 | ✓ | `series[].chartType` — 시리즈마다 `"chartCore/line"` / `"chartCore/column"` 지정 |

제약 원본은 `recharts-core/recharts-adapter.ts:1237-1319`.

### 7.4 dual-axis — Point mode에서 축 지정

```tsx
const data: ChartData = {
  xAxisType: "datetime",
  series: [
    { id: "rev",    name: "매출",   yAxisId: "left",  data: pts("rev") },
    { id: "margin", name: "이익률", yAxisId: "right", data: pts("margin") },
  ],
};

<DataChart
  data={data}
  chartType="chartCore/dual-axis"
  style={{
    yAxes: [
      { id: "left",  position: "left",  title: "매출(억)" },
      { id: "right", position: "right", title: "이익률(%)" },
    ],
  }}
/>;
```

### 7.5 mixed — 시리즈별 유형

```tsx
const data: ChartData = {
  xAxisType: "datetime",
  series: [
    { id: "rev",  name: "매출",   chartType: "chartCore/column", data: pts("rev") },
    { id: "ma",   name: "이동평균", chartType: "chartCore/line",   data: pts("ma") },
  ],
};

<DataChart data={data} chartType="chartCore/mixed" />;
```

### 7.6 stacked-grouped — 그룹 배정

```tsx
<DataChart
  data={data}  // 시리즈 최소 3개
  chartType="chartCore/stacked-grouped"
  style={{
    stackedGrouped: {
      groupCount: 2,
      assignments: {
        seriesA: 1,
        seriesB: 1,
        seriesC: 2,
        seriesD: 2,
      },
    },
  }}
/>;
```

`0 = hidden`, `1..N = N번 그룹`. `groupCount`는 2~4.

---

## 8. 개별 섹션 — 특수 차트 (15종)

각 섹션 템플릿: **한 줄 요약 → 권장 입력 모드 → 최소 예제 → 필수 style → 유효성**.

### 8.1 chartCore/pie

원형 차트. 각 포인트가 한 조각.

- **권장**: Point mode. `x` = 조각 이름, `y` = 값.
- **예제**:
  ```tsx
  const data: ChartData = {
    xAxisType: "category",
    series: [{
      id: "share", name: "점유율",
      data: [
        { x: "A사", y: 45 },
        { x: "B사", y: 30 },
        { x: "C사", y: 15 },
        { x: "기타", y: 10 },
      ],
    }],
  };
  <DataChart data={data} chartType="chartCore/pie" />
  ```
- **style**: `innerRadius?`로 도넛화. Row mode 사용 시 `timepointPie.selectedKey`로 시점 선택, `timepointPie.enabled`로 필드 토글.
- **유효성**: 음수 불허.

### 8.2 chartCore/two-level-pie **[WIP]**

2단 원형(그룹 링 + 항목 링). 그룹 설정이 필요해서 Row mode가 사실상 필수.

- **권장**: Row mode.
- **예제**:
  ```tsx
  const rows = [
    { date: "2024-01", date_display: "1월", 서울: 40, 경기: 30, 부산: 20, 대구: 10 },
    { date: "2024-02", date_display: "2월", 서울: 42, 경기: 28, 부산: 22, 대구: 8  },
  ];
  <DataChart
    data={{ xAxisType: "datetime", series: [{ id: "raw", name: "raw", data: rows as unknown as CartesianPoint[] }] }}
    chartType="chartCore/two-level-pie"
    style={{
      twoLevelPie: {
        selectedKey: "1월",
        hierarchyGroups: [
          { name: "수도권", series: ["서울", "경기"] },
          { name: "지방",   series: ["부산", "대구"] },
        ],
      },
    }}
  />
  ```
- **style**: `PieStyle.twoLevelPie.{selectedKey, hierarchyGroups, assignments}`. `assignments`로 시리즈별 그룹 번호를 직접 줄 수도 있음.
- **유효성**: 음수 불허. 현재 **WIP 상태**(드롭다운에 표시됨) — 범례/그룹 색상 관련 수정 진행 중.

### 8.3 chartCore/treemap

단층 트리맵. 각 사각형이 하나의 시리즈.

- **권장**: Row mode.
- **예제**:
  ```tsx
  const rows = [
    { date_display: "Q1", 서울: 40, 경기: 30, 부산: 20, 대구: 10 },
  ];
  <DataChart
    data={{ xAxisType: "category", series: [{ id: "raw", name: "raw", data: rows as unknown as CartesianPoint[] }] }}
    chartType="chartCore/treemap"
    style={{ treemap: { selectedKey: "Q1", enabled: { 서울: true, 경기: true, 부산: true, 대구: false } } }}
  />
  ```
- **style**: `TreemapStyle.treemap.{selectedKey, enabled}`. 값의 절댓값이 사각형 면적이 된다.
- **유효성**: 시리즈 ≥ 2, 음수 불허.

### 8.4 chartCore/multi-level-treemap **[WIP]**

다층 트리맵. 그룹 설정이 추가됨.

- **권장**: Row mode.
- **예제**:
  ```tsx
  <DataChart
    data={data}
    chartType="chartCore/multi-level-treemap"
    style={{
      treemap: {
        selectedKey: "Q1",
        hierarchyGroups: [
          { name: "수도권", series: ["서울", "경기"] },
          { name: "영남",   series: ["부산", "대구"] },
        ],
      },
    }}
  />
  ```
- **style**: `treemap.hierarchyGroups`가 핵심. 없으면 단층으로 동작.
- **유효성**: 시리즈 ≥ 1, 음수 불허. 현재 **WIP 상태** — 범례 시리즈 라벨 관련 수정 진행 중.

### 8.5 chartCore/ranking-bar

한 시점의 순위 막대.

- **권장**: Row mode.
- **예제**:
  ```tsx
  const rows = [
    { date_display: "1월", A: 120, B: 90, C: 80, D: 40 },
    { date_display: "2월", A: 140, B: 85, C: 100, D: 35 },
    { date_display: "3월", A: 160, B: 95, C: 110, D: 45 },
  ];
  <DataChart
    data={{ xAxisType: "category", series: [{ id: "raw", name: "raw", data: rows as unknown as CartesianPoint[] }] }}
    chartType="chartCore/ranking-bar"
    style={{ rankingBar: { selectedKey: "3월" } }}
  />
  ```
- **style**: `rankingBar.selectedKey` — 보여줄 시점의 `date_display` 값. 없으면 첫 시점 기본.
- **유효성**: 시리즈 ≥ 3.

### 8.6 chartCore/regression-scatter

선형회귀 + 산점도.

- **권장**: Row mode (2개 이상의 numeric 필드에서 `xField`/`yField`를 style로 선택). Point mode도 지원하며, 이 경우 `size`를 주면 버블 크기.
- **예제 (Row mode)**:
  ```tsx
  const rows = [
    { date_display: "A사", 매출: 120, 영업이익: 18 },
    { date_display: "B사", 매출: 200, 영업이익: 25 },
    { date_display: "C사", 매출: 180, 영업이익: 22 },
    // … 시점 ≥ 10
  ];
  <DataChart
    data={{ xAxisType: "category", series: [{ id: "raw", name: "raw", data: rows as unknown as CartesianPoint[] }] }}
    chartType="chartCore/regression-scatter"
    style={{ regressionScatter: { xField: "매출", yField: "영업이익" } }}
  />
  ```
- **style**: `regressionScatter.{xField, yField}`. Row mode에서 필수.
- **유효성**: 시점 ≥ 10, 시리즈 ≥ 2 (Row mode에선 numeric 필드 ≥ 2).

### 8.7 chartCore/geo-grid

한국 지도를 격자(cartogram)로 렌더. 서울 자치구 또는 전국 광역시/도.

- **권장**: Row mode.
- **데이터 shape**: row마다 `districtId`·`districtName`·`value`를 가진 항목이 필요.
  ```ts
  interface GeoGridDataItem { districtId: string; districtName: string; value: number; }
  ```
  `districtId`는 렌더러가 매칭해야 하므로 정해진 키(예: `"Gangnam-gu"`, `"Seoul"`)를 써야 한다. 예시 전체 목록은 `recharts-core/recharts-geo-grid-wrapper.tsx:140-188`의 `MOCK_SEOUL_DATA` / `MOCK_NATIONAL_DATA` 참고.
- **style**: `GeoGridStyle.geoGrid.{mapLevel: "seoul" | "national", selectedTimepoint, metricId}`.
- **유효성**: 시점은 **1개만** 허용 (`maxDataPoints: 1`), 지역 데이터 필요.

### 8.8 recharts/radar

레이더(거미줄) 차트. 한 시점의 여러 필드를 축으로.

- **권장**: Row mode. 가장 최신 row의 numeric 필드들이 각 축이 된다.
- **예제**:
  ```tsx
  const rows = [
    { date: "2024-03", date_display: "3월", 기술력: 90, 디자인: 85, 가격: 70, 서비스: 80, 브랜드: 95 },
  ];
  <DataChart
    data={{ xAxisType: "datetime", series: [{ id: "raw", name: "raw", data: rows as unknown as CartesianPoint[] }] }}
    chartType="recharts/radar"
  />
  ```

### 8.9 recharts/gauge

게이지(단일 값 미터).

- **권장**: Row mode. 시리즈별 값을 바늘로 표시.
- **유효성**: 시점 ≥ 1.

### 8.10 recharts/sankey-diagram

노드-링크 흐름도.

- **권장**: Row mode. 최신 row의 numeric 필드가 노드/링크로 변환된다.

### 8.11 recharts/ownership-stacked

지분율 누적.

- **권장**: Point 또는 Row mode 혼합 가능. 시리즈별 값이 지분 구성 조각.

### 8.12 recharts/value-conversion-bridge

Waterfall 형태 가치 변환 다리.

- **권장**: Row mode. 각 필드가 증감 스텝.

### 8.13 lightweight/candles

캔들스틱 차트. 유일하게 **OHLCPoint**를 사용.

- **권장**: Point mode — OHLCPoint 전용.
- **예제**:
  ```tsx
  import type { ChartData, OHLCPoint } from "@/packages/chart-lib/types";

  const candles: OHLCPoint[] = [
    { x: 1704067200, open: 100, high: 105, low: 98,  close: 103, volume: 12000 },
    { x: 1704153600, open: 103, high: 108, low: 101, close: 107, volume: 14500 },
    // x는 초 단위 UNIX timestamp
  ];

  const data: ChartData = {
    xAxisType: "datetime",
    series: [{ id: "samsung", name: "005930", data: candles as any }],
  };

  <DataChart
    data={data}
    chartType="lightweight/candles"
    scenario="BASE"
    style={{
      lightweightCandles: {
        showVolume: true,
        showMa5: true,
        maPeriod: 5,
        showBandsIndicator: true,
        candleSeriesColors: {
          samsung: { up: "#C15F3C", down: "#6B7B8C" },
        },
      },
    }}
  />;
  ```
- **style 옵션 (`lightweightCandles`)**:
  - `scenario`: `"BASE" | "BULL" | "BEAR"` — 시나리오 밴드 표시
  - `showBandsIndicator`: 밴드 플러그인 표시 (기본 true)
  - `showVolume`: 거래량 히스토그램
  - `showMa5`: 5일 이평선
  - `maPeriod`: 이평선 기간 (기본 5)
  - `candleSeriesColors[seriesId].{up, down}`: 시리즈별 상승·하락 색
- **주의**: `x`는 **초 단위 UNIX timestamp**. ms를 넘기면 파싱이 깨진다.

### 8.14 core/grid

유연한 스키마의 표 그리드 렌더러. Point mode든 Row mode든 받아들이고 테이블화.

- **권장**: 원하는 모드. 필드 조합이 자유롭다.

### 8.15 core/insider-trading

내부자 거래 특화 렌더러. 기간 버킷(0~3, 3~6, 6~9, 9~12개월)으로 집계.

- **권장**: Row mode.
- **필수 필드**:
  - `date`: Date 객체 또는 파싱 가능한 문자열/숫자
  - `action`: `"buy"` / `"sell"` (또는 한국어 `"매수"` / `"매도"`)
  - `shares`: 거래 주식 수
  - `value` 또는 `amount`: 금액(USD)
  - `entityType` (선택): `"individual"` / `"company"` — 없으면 문자열에 `"company"`/`"corp"`/`"법인"`이 들어있는지로 자동 분류
- **예제**:
  ```tsx
  const rows = [
    { date: "2024-01-15", action: "buy",  shares: 10000, value: 520000, entityType: "individual" },
    { date: "2024-02-20", action: "sell", shares: 5000,  value: 280000, entityType: "company"    },
    // …
  ];
  <DataChart
    data={{ xAxisType: "datetime", series: [{ id: "raw", name: "raw", data: rows as unknown as CartesianPoint[] }] }}
    chartType="core/insider-trading"
  />
  ```
- **제약**: 렌더러가 `{x,y}`·OHLC 형태의 row는 걸러내고 내부자 거래 row만 집계 (`CoreInsiderTradingRenderer.tsx:41-46`).

---

## 9. 유효성 체크리스트

차트 유형별 `getValidChartTypes()` 기반 제약 (`recharts-adapter.ts:1253-1272`).

| chartType | 최소 시점 | 최소 시리즈 | 음수 허용 | 기타 |
|---|---|---|---|---|
| `chartCore/line` | 5 | — | ✓ | |
| `chartCore/area` | 5 | — | ✓ | |
| `chartCore/area-100` | 5 | 2 | ✗ | |
| `chartCore/stacked-area` | 5 | 2 | ✗ | |
| `chartCore/synced-area` | 5 | 2 | ✓ | |
| `chartCore/column` | — | — | ✓ | |
| `chartCore/mixed` | 5 | 2 | ✓ | |
| `chartCore/stacked` | — | 2 | ✓ | |
| `chartCore/stacked-100` | — | 2 | ✗ | |
| `chartCore/stacked-grouped` | — | 3 | ✗ | |
| `chartCore/dual-axis` | 5 | 2 | ✓ | |
| `chartCore/dual-axis-stacked-bar` | 3 | 3 | ✗ | |
| `chartCore/pie` | — | — | ✗ | |
| `chartCore/two-level-pie` **[WIP]** | — | — | ✗ | |
| `chartCore/treemap` | — | 2 | ✗ | |
| `chartCore/multi-level-treemap` **[WIP]** | — | 1 | ✗ | |
| `chartCore/ranking-bar` | — | 3 | ✓ | |
| `chartCore/geo-grid` | 1 (최대) | — | ✓ | `districtId` 필요 |
| `chartCore/regression-scatter` | 10 | 2 | ✓ | |

### 9.1 빈 상태 처리

데이터가 없을 때는 `isEmpty` / `emptyMessage` prop으로 처리한다.

```tsx
<DataChart data={data} chartType="chartCore/line" isEmpty emptyMessage="데이터가 없습니다" />
```

---

## 10. 더 읽기

- [README.md](./README.md) — 설치·alias 설정·`<DataChart>` props 전체 목록·활성 차트 목록
- [MIGRATION_NOTES.md](./MIGRATION_NOTES.md) — 라이브러리 구조 이력
- `packages/chart-lib/types.ts` — 타입 정의 전체. 색·제목·범례 위치 등 presentation 스타일은 여기서.
- `packages/chart-lib/chart-type-options.ts` — UI 드롭다운에 노출되는 27개 차트의 canonical 목록.
- `packages/chart-lib/recharts-core/toChartCoreTable.ts` — Row mode 자동 감지 규칙의 원본.
- `app/chartlab/samples/*.csv` — ChartLab에서 사용하는 예시 CSV.
