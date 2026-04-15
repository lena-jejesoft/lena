# DataChart

범용 차트 컴포넌트. 주가, 재무, 문서 인라인, 사용자 생성 차트 등 모든 차트 시나리오를 하나의 컴포넌트로 처리한다.

## 구조

```
components/chart/
├── types.ts              # 타입 정의 (ChartType, ChartData, ChartStyle, DataChartProps)
├── registry.ts           # 차트유형별 데이터/스타일 요구사항 레지스트리
├── DataChart.tsx          # Shell: controlMode에 따라 sidebar/toolbar/none 렌더링
├── ChartRenderer.tsx      # Highcharts 래퍼 (순수 렌더링)
├── ChartToolbar.tsx       # 좁은 패널용 상단 툴바 (설정 버튼 → 모달)
├── ChartStyleModal.tsx    # 스타일 편집 모달 (Radix Dialog)
├── adapters.ts            # 도메인 데이터 → ChartData 변환 함수
└── sidebar/
    ├── ChartSidebar.tsx   # 사이드바 컨테이너 (데이터/스타일 탭)
    ├── DataTab.tsx        # 차트유형, X축, 시리즈 관리
    └── StyleTab.tsx       # 차트유형별 동적 스타일 UI
```

## 사용법

### 기본

```tsx
import { DataChart } from "@/packages/chart-lib/DataChart";
import type { ChartData, ChartType, ChartStyle } from "@/packages/chart-lib/types";

<DataChart
  data={chartData}
  chartType="line"
  onChartTypeChange={setChartType}
  style={chartStyle}
  onStyleChange={setChartStyle}
/>
```

### Props

| Prop | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `data` | `ChartData` | 필수 | 시리즈 배열 + xAxisType |
| `chartType` | `ChartType` | 필수 | 현재 차트 유형 |
| `onChartTypeChange` | `(type) => void` | - | 차트 유형 변경 콜백 |
| `style` | `ChartStyle` | 내부 기본값 | 스타일 설정 |
| `onStyleChange` | `(style) => void` | - | 스타일 변경 콜백 |
| `controlMode` | `"sidebar" \| "toolbar" \| "none"` | `"sidebar"` | 컨트롤 방식 |
| `availableChartTypes` | `ChartType[]` | 전체 | 선택 가능한 차트 유형 제한 |
| `height` | `number` | 부모 100% | 고정 높이 (px) |
| `onTimeRangeChange` | `(range) => void` | - | 시간 범위 변경 콜백 |
| `isEmpty` | `boolean` | `false` | 빈 상태 표시 |
| `emptyMessage` | `string` | `"데이터가 없습니다"` | 빈 상태 메시지 |

### controlMode

- **`"sidebar"`**: 넓은 패널용. 왼쪽에 200px 사이드바(데이터/스타일 탭). 데이터와 스타일 모두 컨트롤 가능.
- **`"toolbar"`**: 좁은 패널용. 차트 상단에 제목 + 설정(gear) 아이콘. 설정 클릭 시 모달로 스타일만 편집. 데이터 변경 불가.
- **`"none"`**: 컨트롤 UI 없이 순수 렌더링만.

## 차트 유형

### 지원 유형

| ChartType | 데이터 포인트 | X축 | 설명 |
|-----------|-------------|-----|------|
| `line` | `CartesianPoint` | datetime, category, numeric | 선 차트 |
| `area` | `CartesianPoint` | datetime, category, numeric | 영역 차트 |
| `stacked-area` | `CartesianPoint` | datetime, category | 누적 영역 |
| `100-stacked-area` | `CartesianPoint` | datetime, category | 100% 누적 영역 |
| `column` | `CartesianPoint` | datetime, category, numeric | 세로 막대 |
| `stacked-column` | `CartesianPoint` | category | 누적 막대 |
| `100-stacked-column` | `CartesianPoint` | category | 100% 누적 막대 |
| `bar` | `CartesianPoint` | category | 가로 막대 |
| `stacked-bar` | `CartesianPoint` | category | 누적 가로 막대 |
| `100-stacked-bar` | `CartesianPoint` | category | 100% 누적 가로 막대 |
| `candlestick` | `OHLCPoint` | datetime | 캔들스틱 (Highstock) |
| `scatter` | `ScatterPoint` | numeric | 산점도 |
| `pie` | `PiePoint` | (없음) | 원형 |
| `histogram` | `CartesianPoint` | numeric | 히스토그램 |
| `waterfall` | `WaterfallPoint` | category | 폭포 차트 |

### 포인트 타입

```typescript
// 대부분의 차트
interface CartesianPoint {
  x: number | string;  // timestamp, category명, 숫자
  y: number;
  color?: string;      // 개별 포인트 색상
}

// Candlestick
interface OHLCPoint {
  x: number;           // timestamp
  open: number;
  high: number;
  low: number;
  close: number;
}

// Pie
interface PiePoint {
  name: string;
  value: number;
  color?: string;
}

// Scatter
interface ScatterPoint {
  x: number;
  y: number;
  size?: number;       // 버블 크기
  color?: string;
}

// Waterfall
interface WaterfallPoint {
  name: string;
  y: number;
  isSum?: boolean;              // 합계 막대
  isIntermediateSum?: boolean;  // 중간 소계
  color?: string;
}
```

## 스타일

차트 유형에 따라 적용 가능한 스타일이 다르다. `registry.ts`의 `CHART_STYLE_OPTIONS`에서 확인 가능.

```typescript
// Cartesian 계열 (line, area, column, bar, scatter 등)
interface CartesianStyle {
  title?: string;
  colorPalette?: string[];
  legend?: { position: "top" | "bottom" | "left" | "right" | "none" };
  tooltip?: { shared?: boolean; split?: boolean };
  lineWidth?: number;
  markerEnabled?: boolean;
  stacking?: "normal" | "percent";
  dataLabels?: boolean;
  yAxes?: YAxisStyle[];
}

// Pie
interface PieStyle {
  title?: string;
  colorPalette?: string[];
  innerRadius?: number;     // >0이면 도넛
  dataLabels?: boolean;
  showPercentage?: boolean;
}

// Waterfall
interface WaterfallStyle {
  title?: string;
  positiveColor?: string;   // 양수 막대 (기본: #4ECDC4)
  negativeColor?: string;   // 음수 막대 (기본: #FF6B6B)
  sumColor?: string;        // 합계 막대
  dataLabels?: boolean;
}
```

## 어댑터

도메인 데이터를 `ChartData`로 변환하는 함수들.

### stockDataToChartData

```typescript
import { stockDataToChartData, stockDataDefaultStyle } from "@/packages/chart-lib/adapters";

const chartData = stockDataToChartData(stockData, financialMetrics, {
  activeIndicators: ["revenue", "per"],
  seriesVisibility: { stock: true, revenue: true, per: true },
  showForecast: false,
});

const style = stockDataDefaultStyle(); // 3개 Y축, legend: none
```

### documentChartToChartData

```typescript
import { documentChartToChartData } from "@/packages/chart-lib/adapters";

const { data, chartType, style } = documentChartToChartData(chart);

<DataChart
  data={data}
  chartType={chartType}
  style={style}
  controlMode="toolbar"
  height={200}
/>
```

## 레지스트리

### CHART_TYPE_REGISTRY

각 차트 유형이 요구하는 데이터 포인트 형식과 지원하는 X축 유형을 정의.

```typescript
import { CHART_TYPE_REGISTRY } from "@/packages/chart-lib/registry";

const spec = CHART_TYPE_REGISTRY["line"];
// { pointType: "cartesian", xAxisTypes: ["datetime", "category", "numeric"], ... }
```

### CHART_STYLE_OPTIONS

각 차트 유형에 적용 가능한 스타일 옵션 목록. 사이드바/모달 UI가 이를 참조하여 동적으로 컨트롤을 표시.

```typescript
import { CHART_STYLE_OPTIONS } from "@/packages/chart-lib/registry";

const styleSpec = CHART_STYLE_OPTIONS["line"];
// { styleType: "cartesian", options: ["colorPalette", "lineWidth", "markerEnabled", ...] }
```
