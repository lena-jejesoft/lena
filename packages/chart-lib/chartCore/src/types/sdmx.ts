/**
 * SDMX (Statistical Data and Metadata eXchange) 관련 타입 정의
 */

// ============================================================================
// Codelist 관련 타입
// ============================================================================

/**
 * Codelist의 개별 코드 항목
 */
export interface CodelistItem {
  id: string;
  nameKo: string;
  nameEn?: string;
  description?: string;
}

/**
 * Codelist (코드 리스트)
 */
export interface Codelist {
  id: string;
  name: string;
  description?: string;
  items: CodelistItem[];
}

/**
 * Codelist 맵 (코드 ID를 키로 사용)
 */
export type CodelistMap = Map<string, Codelist>;

// ============================================================================
// 파싱된 데이터 타입 (LONG 형식)
// ============================================================================

/**
 * 파싱된 SDMX 데이터 (LONG 형식)
 * - flat한 객체 구조 (nested 없음)
 * - 필드명: DSD의 실제 한글명 사용
 */
export interface ParsedSDMXData {
  시점: string;           // TIME_PERIOD (예: "2025-Q3")
  주기: string;           // FREQ의 한글명 (예: "분기")
  계정항목: string;       // ACC_ITEM의 한글명 (예: "국내총생산(GDP)(실질, 계절조정, 전기비)")
  관측값: number;         // OBS_VALUE
}

// ============================================================================
// 차트 데이터 타입 (Wide 형식)
// ============================================================================

/**
 * 차트 인풋 데이터 (Wide 형식)
 * - X축: 시간 (date)
 * - 동적 컬럼: 각 계정항목의 값
 */
export interface ChartData {
  date: string;           // ISO 8601 datetime (KST) - 차트 시간축용
  date_display: string;   // 표시용 원본 날짜 (예: "2025-Q3")
  [accountItem: string]: string | number;  // 동적 계정항목 컬럼
}

// ============================================================================
// SDMX XML 파싱 관련 타입
// ============================================================================

/**
 * DSD XML에서 추출한 Dimension 정보
 */
export interface DimensionInfo {
  id: string;             // Dimension ID (예: "FREQ", "ACC_ITEM", "TIME_PERIOD")
  nameKo: string;         // 한글명 (예: "주기", "계정항목", "시점")
  nameEn?: string;        // 영문명
  position: number;       // 위치
  codelistId?: string;    // 연결된 Codelist ID (있는 경우)
}

/**
 * Generic XML에서 추출한 Observation 원시 데이터
 */
export interface RawObservation {
  FREQ: string;           // 주기 코드 (예: "Q")
  ACC_ITEM: string;       // 계정항목 코드 (예: "10111")
  TIME_PERIOD: string;    // 시점 (예: "2025-Q3")
  OBS_VALUE: number;      // 관측값
}

/**
 * SDMX 파서 옵션
 */
export interface SDMXParserOptions {
  dsdXmlPath: string;     // DSD XML 파일 경로
  genericXmlPath: string; // Generic XML 파일 경로
}

/**
 * 데이터 트랜스포머 옵션
 */
export interface TransformerOptions {
  timezone?: string;      // 타임존 (기본: "Asia/Seoul")
}
