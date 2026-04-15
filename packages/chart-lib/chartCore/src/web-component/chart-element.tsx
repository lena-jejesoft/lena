import React from "react";
import ReactDOM from "react-dom/client";
import ChartToolView from "@chartCore/src/tools/chartTool/index";
import type { ChartToolViewProps } from "@chartCore/src/tools/chartTool/index";
import cssText from "@chartCore/src/app/globals.css?inline"; // CSS를 문자열로 import

// Portal (드롭다운 등)용 글로벌 스타일 - document.head에 주입
// Radix UI Portal은 Shadow DOM 외부 (document.body)에 렌더링됨
const portalGlobalStyles = `
  /* ==========================================
   * Radix UI Select (드롭다운) 스타일
   * Popper에서 data-side 속성으로 식별
   * ========================================== */

  /* Portal 컨테이너 */
  [data-radix-popper-content-wrapper] {
    z-index: 9999 !important;
  }

  /* SelectContent - Popper 내부의 listbox */
  [data-radix-popper-content-wrapper] [role="listbox"] {
    font-family: Arial, Helvetica, sans-serif !important;
    background: hsl(0 0% 10%) !important;
    color: hsl(0 0% 98%) !important;
    border: 1px solid hsl(0 0% 25%) !important;
    border-radius: 0.5rem !important;
    box-shadow: 0 10px 38px -10px rgba(0, 0, 0, 0.5), 0 10px 20px -15px rgba(0, 0, 0, 0.3) !important;
    overflow: hidden !important;
    min-width: 8rem !important;
  }

  /* SelectViewport */
  [data-radix-select-viewport] {
    padding: 4px !important;
  }

  /* SelectItem */
  [data-radix-popper-content-wrapper] [role="option"] {
    position: relative !important;
    display: flex !important;
    align-items: center !important;
    padding: 8px 12px 8px 28px !important;
    border-radius: 4px !important;
    font-size: 14px !important;
    color: hsl(0 0% 98%) !important;
    background: transparent !important;
    cursor: pointer !important;
    outline: none !important;
    user-select: none !important;
  }

  [data-radix-popper-content-wrapper] [role="option"][data-highlighted] {
    background: hsl(20 20% 20%) !important;
    color: hsl(0 0% 100%) !important;
  }

  [data-radix-popper-content-wrapper] [role="option"][data-state="checked"] {
    font-weight: 500 !important;
  }

  /* SelectItemIndicator (체크마크 컨테이너) - 숨기기 */
  [data-radix-popper-content-wrapper] [role="option"] > span:first-child {
    position: absolute !important;
    left: 8px !important;
    width: 16px !important;
    height: 16px !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  /* 체크 아이콘 */
  [data-radix-popper-content-wrapper] [role="option"] > span:first-child svg {
    width: 14px !important;
    height: 14px !important;
    stroke-width: 2 !important;
  }

  /* ==========================================
   * Radix UI Tooltip 스타일
   * ========================================== */
  [data-state][data-side][role="tooltip"] {
    font-family: Arial, Helvetica, sans-serif !important;
    background: hsl(0 0% 10%) !important;
    color: hsl(0 0% 98%) !important;
    border: 1px solid hsl(0 0% 25%) !important;
    border-radius: 0.375rem !important;
    padding: 6px 12px !important;
    font-size: 14px !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
  }

  /* ==========================================
   * Radix UI Popover 스타일
   * ========================================== */
  [data-radix-popper-content-wrapper] [data-state][data-side]:not([role="listbox"]):not([role="option"]) {
    font-family: Arial, Helvetica, sans-serif !important;
    background: hsl(0 0% 10%) !important;
    color: hsl(0 0% 98%) !important;
    border: 1px solid hsl(0 0% 25%) !important;
    border-radius: 0.5rem !important;
    box-shadow: 0 10px 38px -10px rgba(0, 0, 0, 0.5) !important;
  }

  /* ==========================================
   * Radix UI Dialog/AlertDialog 스타일
   * ========================================== */
  [role="dialog"][data-state] {
    font-family: Arial, Helvetica, sans-serif !important;
    background: hsl(0 0% 10%) !important;
    color: hsl(0 0% 98%) !important;
    border: 1px solid hsl(0 0% 25%) !important;
    border-radius: 0.5rem !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
  }

  [role="alertdialog"][data-state] {
    font-family: Arial, Helvetica, sans-serif !important;
    background: hsl(0 0% 10%) !important;
    color: hsl(0 0% 98%) !important;
    border: 1px solid hsl(0 0% 25%) !important;
    border-radius: 0.5rem !important;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5) !important;
  }
`;

// Shadow DOM 내부용 CSS 변수 (dark 모드)
const shadowCssVars = `
  :host, .chart-container, .chart-container * {
    --background: 0 0% 7%;
    --foreground: 0 0% 98%;
    --card: 0 0% 10%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 10%;
    --popover-foreground: 0 0% 98%;
    --primary: 20 75% 60%;
    --primary-foreground: 0 0% 100%;
    --secondary: 0 0% 15%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 18%;
    --muted-foreground: 0 0% 63.9%;
    --accent: 20 20% 20%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 18%;
    --input: 0 0% 18%;
    --ring: 20 75% 60%;
    --chart-1: 38 71% 75%;
    --chart-2: 158 26% 55%;
    --chart-3: 15 50% 70%;
    --chart-4: 177 25% 73%;
    --chart-5: 217 29% 68%;
    --chart-6: 95 36% 73%;
    --chart-7: 3 60% 78%;
    --chart-8: 38 21% 92%;
    --radius: 0.5rem;
  }

  :host {
    display: block;
    width: 100%;
    height: 100%;
  }

  .chart-container {
    width: 100%;
    height: 100%;
    padding: 0;
    background: transparent;
    color: hsl(var(--foreground));
    font-family: Arial, Helvetica, sans-serif;
  }

  /* 버튼 클릭 가능하도록 보장 */
  .chart-container button {
    cursor: pointer;
    pointer-events: auto;
  }

  .chart-container button:disabled {
    cursor: not-allowed;
    pointer-events: none;
    opacity: 0.5;
  }

  /* Card 및 레전드 패널 배경색 강제 */
  .chart-container [class*="bg-card"] {
    background-color: hsl(0 0% 10% / 0.5) !important;
  }

  .chart-container [class*="bg-background"] {
    background-color: hsl(0 0% 7%) !important;
  }

  .chart-container [class*="bg-popover"] {
    background-color: hsl(0 0% 10%) !important;
  }

  .chart-container [class*="border-l"],
  .chart-container [class*="border-r"],
  .chart-container [class*="border-t"],
  .chart-container [class*="border-b"],
  .chart-container [class*="border"] {
    border-color: hsl(0 0% 18%) !important;
  }

  /* SVG 텍스트 색상 */
  .chart-container svg text {
    fill: hsl(0 0% 63.9%) !important;
  }

  /* muted-foreground 색상 */
  .chart-container [class*="text-muted-foreground"] {
    color: hsl(0 0% 63.9%) !important;
  }
`;

// Web Component 클래스 정의
class ChartElement extends HTMLElement {
  private root: ReactDOM.Root | null = null;
  private shadow: ShadowRoot;

  // 관찰할 속성 목록
  static get observedAttributes() {
    return [
      "input-data",
      "chart-type",
      "show-outliers",
      "show-missing-values",
      "is-executed",
      "hide-toolbar",
      "y-field-types",
      "y-axis-placements",
      "y-axis-label",
    ];
  }

  constructor() {
    super();
    // Shadow DOM 생성 (CSS 격리)
    this.shadow = this.attachShadow({ mode: "open" });

    // Shadow DOM용 CSS 변수 주입
    const varsStyle = document.createElement("style");
    varsStyle.textContent = shadowCssVars;
    this.shadow.appendChild(varsStyle);

    // Tailwind CSS 주입
    const style = document.createElement("style");
    style.textContent = cssText;
    this.shadow.appendChild(style);

    // React 마운트 포인트
    const container = document.createElement("div");
    container.className = "chart-container dark";
    this.shadow.appendChild(container);
  }

  connectedCallback() {
    // Portal용 글로벌 스타일 주입 (한 번만)
    if (!document.getElementById("chart-tool-portal-styles")) {
      const globalStyle = document.createElement("style");
      globalStyle.id = "chart-tool-portal-styles";
      globalStyle.textContent = portalGlobalStyles;
      document.head.appendChild(globalStyle);
    }
    this.render();
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  attributeChangedCallback() {
    this.render();
  }

  private getProps(): ChartToolViewProps {
    const showOutliersAttr = this.getAttribute("show-outliers");
    const showMissingAttr = this.getAttribute("show-missing-values");
    const chartTypeAttr = this.getAttribute("chart-type");
    const hideToolbarAttr = this.getAttribute("hide-toolbar");

    return {
      inputData: this.getAttribute("input-data") || undefined,
      // chartType은 속성이 없으면 undefined → 컴포넌트 내부 상태 사용
      chartType: chartTypeAttr ? (chartTypeAttr as any) : undefined,
      // 속성이 없으면 undefined → 컴포넌트 내부 상태 사용
      showOutliers: showOutliersAttr !== null ? showOutliersAttr !== "false" : undefined,
      showMissingValues: showMissingAttr !== null ? showMissingAttr === "true" : undefined,
      isExecuted: this.getAttribute("is-executed") !== "false",
      yFieldTypes: this.parseJson("y-field-types"),
      yAxisPlacements: this.parseJson("y-axis-placements"),
      unitSettings: this.parseJson("unit-settings"),
      hideToolbar: hideToolbarAttr === "true",
      yAxisLabel: this.getAttribute("y-axis-label") || undefined,
    };
  }

  private parseJson(attr: string): any {
    const value = this.getAttribute(attr);
    if (!value) return undefined;
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }

  private render() {
    const container = this.shadow.querySelector(".chart-container");
    if (!container) return;

    if (!this.root) {
      this.root = ReactDOM.createRoot(container);
    }

    const props = this.getProps();
    this.root.render(
      React.createElement(ChartToolView, props)
    );
  }
}

// Custom Element 등록
if (typeof window !== "undefined" && !customElements.get("chart-tool")) {
  customElements.define("chart-tool", ChartElement);
}

export default ChartElement;
