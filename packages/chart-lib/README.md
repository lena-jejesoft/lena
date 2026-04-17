# chart-lib

65종 이상의 차트를 렌더링하는 React 컴포넌트 라이브러리.
`<DataChart>` 하나에 `data`와 `chartType`만 넘기면 동작한다.
내부적으로 Recharts, Lightweight Charts 2개 렌더러(+ 내부 chartCore/core 구현)를 차트 유형에 따라 자동 라우팅한다.

## 제약사항

**이 라이브러리는 현재 사내 레포 내부 패키지 형태입니다. Next.js + Tailwind 4 + shadcn/ui 스택이 갖춰진 프로젝트에서만 동작합니다.**

| 의존성 | 버전 | 비고 |
|---|---|---|
| Next.js | 16.x | `"use client"` + `dynamic()` SSR 비활성 |
| React | 19.x | |
| Tailwind CSS | 4.x | `@tailwindcss/postcss` |
| shadcn/ui | — | `Input`, `Button`, `Select`, `Popover`, `Tabs` 등 |
| Recharts | 2.x | grouped-bar, sankey, radar, gauge 등 |
| Lightweight Charts | 5.x | candlestick (`lightweight/candles`) |

## 설치 방법

이 라이브러리는 npm 패키지가 아니다. 호스트 프로젝트에 직접 복사하여 사용한다.

### 1. 레포 클론

```bash
git clone https://github.com/lena-jejesoft/lena.git
cd lena
```

### 2. 파일 복사

`packages/chart-lib/` 디렉토리 전체를 자기 프로젝트의 동일 경로에 복사한다.

```
your-project/
├── packages/
│   └── chart-lib/          ← 이 디렉토리 전체 복사
├── components/
│   └── ui/                 ← shadcn/ui 컴포넌트 필요 (Button, Input, Select, Popover, Tabs 등)
├── lib/
│   └── utils.ts            ← cn() 유틸 필요 (tailwind-merge + clsx)
└── tsconfig.json
```

### 3. tsconfig.json alias 설정

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@chartCore/*": ["./packages/chart-lib/chartCore/*"]
    }
  }
}
```

- `@/*` — 프로젝트 루트 기준 절대 경로. 라이브러리 내부의 모든 import가 `@/packages/chart-lib/...` 형태를 사용한다.
- `@chartCore/*` — chartCore 렌더러 내부 모듈 참조용.

### 4. 의존성 설치

차트 렌더링 엔진 (필수):

```bash
npm install recharts@^2.15.4 lightweight-charts@^5.1.0
```

호스트 앱에 아직 없다면 아래도 함께 필요하다:

```bash
npm install next@16 react@19 react-dom@19
npm install tailwindcss@^4.1 @tailwindcss/postcss@^4.1
npm install tailwind-merge@^3.4 clsx@^2.1 class-variance-authority@^0.7 lucide-react@^0.563
```

## 기본 사용법

가장 간단한 라인 차트 예제:

```tsx
import { DataChart } from "@/packages/chart-lib/DataChart"
import type { ChartData } from "@/packages/chart-lib/types"

const data: ChartData = {
  xAxisType: "category",
  series: [
    {
      id: "revenue",
      name: "매출",
      data: [
        { x: "1월", y: 100 },
        { x: "2월", y: 150 },
        { x: "3월", y: 130 },
      ],
    },
  ],
}

export default function MyChart() {
  return <DataChart data={data} chartType="chartCore/line" />
}
```

### Props

**필수:**

| prop | 타입 | 설명 |
|---|---|---|
| `data` | `ChartData` | 시리즈 배열 + xAxisType |
| `chartType` | `ChartType` | 차트 유형 (아래 목록 참고) |

**선택:**

| prop | 타입 | 설명 |
|---|---|---|
| `style` | `ChartStyle` | 차트 스타일 (제목, 팔레트, 범례, 축 설정 등) |
| `onChartTypeChange` | `(type: ChartType) => void` | 차트 유형 변경 콜백 |
| `onStyleChange` | `(style: ChartStyle) => void` | 스타일 변경 콜백 |
| `height` | `number` | 차트 높이 (px) |
| `scenario` | `Scenario` | lightweight/candles 전용 (`"BASE"` / `"BULL"` / `"BEAR"`) |
| `isEmpty` | `boolean` | 빈 상태 표시 (기본 `false`) |
| `emptyMessage` | `string` | 빈 상태 메시지 (기본 `"데이터가 없습니다"`) |

> 실제 동작하는 예제는 `app/chart-demo` 참고 (추후 추가)

## 지원 차트 유형

UI에서 선택 가능한 활성 차트 유형 목록.

### ChartCore

| 차트 유형 | 레이블 |
|---|---|
| `chartCore/line` | Line |
| `chartCore/column` | Column |
| `chartCore/stacked` | Stacked Column |
| `chartCore/stacked-100` | Stacked Column 100% |
| `chartCore/stacked-grouped` | Grouped Stacked Column |
| `chartCore/dual-axis` | Dual Axis |
| `chartCore/dual-axis-stacked-bar` | Dual Axis Stacked Bar |
| `chartCore/mixed` | Mixed |
| `chartCore/area` | Area |
| `chartCore/area-100` | Area 100% |
| `chartCore/stacked-area` | Stacked Area |
| `chartCore/synced-area` | Synced Area |
| `chartCore/pie` | Pie |
| `chartCore/two-level-pie` | Two-Level Pie |
| `chartCore/treemap` | Treemap |
| `chartCore/multi-level-treemap` | Multi-Level Treemap |
| `chartCore/ranking-bar` | Ranking Bar |
| `chartCore/geo-grid` | Geo Grid |
| `chartCore/regression-scatter` | Regression Scatter |

### Recharts 전용

| 차트 유형 | 레이블 |
|---|---|
| `recharts/grouped-bar` | Grouped Bar |
| `recharts/ownership-stacked` | Ownership Stacked |
| `recharts/gauge` | Gauge (Recharts) |
| `recharts/value-conversion-bridge` | Value Conversion Bridge |
| `recharts/sankey-diagram` | Sankey Diagram |
| `recharts/dual-axis-stacked-bar` | Dual Axis Stacked Bar (Recharts) |
| `recharts/radar` | Radar |

### 특수

| 차트 유형 | 레이블 | 렌더러 |
|---|---|---|
| `lightweight/candles` | Candlestick | Lightweight Charts |
| `core/grid` | Core / Grid | Core |
| `core/insider-trading` | Core / Insider Trading | Core |

## 더 자세한 정보

차트 유형별 데이터 형식, Point 타입, Style 옵션은 [DATA_FORMAT.md](./DATA_FORMAT.md) 참고.
