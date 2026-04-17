# Chart Library Migration Notes

## 완료된 작업 (2026-04-14 ~ 04-16)

### 1단계: 폴더 분리

- `components/chart/` → `packages/chart-lib/` 이동 (git mv, 히스토리 보존)
- `tsconfig.json`의 `@chartCore/*` alias 경로 업데이트
- 모든 import `@/components/chart/` → `@/packages/chart-lib/` 전역 갱신
- `chart-block-sidebar.tsx`, `chart-type-options.ts`, `chart-type-icon.tsx`를 `packages/chart-lib/`로 이동

### 2단계: 헬퍼 함수 + 타입 추출

**`packages/chart-lib/utils/chart-helpers.ts` 생성** — 순수 함수 15개 + 상수 5개 + 타입 1개:

순수 함수 (app 의존 없음):
- `resolveCoreType`, `getSeriesControlMode`, `isLegendPanelChartType`
- `isOhlcPoint`, `isOhlcChartData`, `toSeriesRows`
- `getEnabledSeriesMap`, `getChartCoreLegendMetaSignature`, `getLegendStateSignature`

ChartBlock 의존 함수 (일반화 완료):
- `hasRenderableSeries`, `isOutlierSupported`, `getOutlierCount`
- `getSeriesDisplayColors`, `getAnalysisResultForSeries`, `applyViewStateToStyle`
- `BASE_PALETTE`

**`packages/chart-lib/types.ts`에 `ChartBlock` 인터페이스 추가:**
```ts
export interface ChartBlock {
  id: string;
  chartType: ChartType;
  data: ChartData;
  style: ChartStyle;
}
```

app 쪽 `BlendedChartBlock`은 `ChartBlock & { title: string; description: string }`으로 확장.

### UI 정리

- /chartlab 우측 패널(최근/저장된/미리보기) 제거, 중앙 전폭 확장
- SAMPLE_BLOCKS 하드코딩 데모 데이터 → 빈 블록 1개로 교체
- 차트 아래 데이터 테이블 제거 (`chartCore/src/tools/chartTool/index.tsx`)
- 복제/삭제 버튼 제거
- 이상치/툴팁 상태 라벨 제거
- 좌측 패널 "패널1"/"패널2/3" 헤더 제거, 접기 아이콘을 드롭다운 옆으로 재배치
- "+ 새 차트 추가" 버튼 제거
- 차트 카드 접기/펼치기 토글 제거
- 다크 테마: `#1F1F29` 계열 cool-dark + primary `#F5C0C0` 연핑크

---

## 3단계: 컴포넌트 이동

`StylePanelContent`와 `SeriesPanelContent`를 `app/chartlab/` → `packages/chart-lib/`로 이동.

### 3-1: SeriesPanelContent 이동 (완료, 04-17)

- `packages/chart-lib/panels/SeriesPanel.tsx` 생성
- `BlendedChartBlock` → `ChartBlock` 타입으로 일반화
- `chartState: BlendedChartViewState` → `seriesColors: Record<string, string>` 개별 prop으로 분해
- page-h.tsx, chart-block-card-body.tsx 두 동일 복사본 → import로 교체
- 미사용 import 정리 (`ChartLegendPanel`, `LegendPanelChartType`, `ExtendedDataAnalysisResult`)

### 현재 위치

| 컴포넌트 | page-h.tsx | chart-block-card-body.tsx |
|----------|-----------|--------------------------|
| StylePanelContent | line ~1295 (~120줄) | line ~1330 (~77줄, 간소화 버전) |
| SeriesPanelContent | line ~1416 (~188줄) | line ~1408 (~188줄, 동일 복사) |

### 해결해야 할 의존성

**StylePanelContent:**
- `useBlendedChartViewContext()` 사용 → props 콜백으로 교체 필요
  - `getChartState`, `setShowOutliers`, `setShowTooltip`, `setShowLegend` 추출
- 서브컴포넌트 동반 이동 필요: `ToggleSwitch` (또는 `ToggleRow`), `SeriesColorRow`, `CandleTrendColorRow`, `GroupColorRow` (page-h.tsx 버전), `SeriesColorPopover` (card-body 버전)
- page-h.tsx와 card-body.tsx 두 버전이 다름 → 통합 또는 canonical 선정 필요

**SeriesPanelContent:**
- context 미사용 (props만) — 이동 용이
- `ChartLegendPanel` (이미 lib에 있음)에 의존
- `BlendedChartBlock` → `ChartBlock` 타입 교체
- `BlendedChartViewState` → lib용 일반 타입 필요 (또는 props로 풀기)

### 작업 순서 제안

1. **SeriesPanelContent 먼저 이동** (context 미사용, 비교적 단순)
   - `BlendedChartViewState` 의존을 개별 props로 분해
   - 두 파일 동일 복사본이므로 1개 canonical 버전으로 통합
   - `packages/chart-lib/panels/SeriesPanel.tsx` 생성
   - 두 원본 파일에서 import로 교체

2. **StylePanelContent 이동**
   - `useBlendedChartViewContext()` → `onShowOutliersChange`, `onShowTooltipChange`, `onShowLegendChange` props로 전환
   - 서브컴포넌트(ToggleSwitch, SeriesColorRow 등) 동반 이동
   - page-h.tsx 버전을 canonical로 선정 (더 풍부), card-body 버전은 import로 대체
   - `packages/chart-lib/panels/StylePanel.tsx` 생성

3. **정리**
   - 두 app 파일에서 중복 제거 확인
   - lib에서 export 정리 (index.ts 또는 직접 export)

### 관련 파일

```
packages/chart-lib/
├── types.ts                          # ChartBlock 인터페이스
├── utils/chart-helpers.ts            # 헬퍼 함수 15개
├── recharts-core/chartTool/
│   └── chart-legend-panel.tsx        # SeriesPanelContent가 사용
├── panels/                           # 3단계에서 생성 예정
│   ├── SeriesPanel.tsx
│   └── StylePanel.tsx

app/chartlab/
├── page-h.tsx                        # StylePanelContent + SeriesPanelContent 원본
├── chart-block-card-body.tsx         # 복제본
├── page-h-context.tsx                # BlendedChartViewContext (StylePanel 의존)
└── page-h-types.ts                   # BlendedChartViewState 타입
```
