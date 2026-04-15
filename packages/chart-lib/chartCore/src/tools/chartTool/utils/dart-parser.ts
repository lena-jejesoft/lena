import * as cheerio from 'cheerio';

export interface FinancialRecord {
  [key: string]: string | number | null;
}

export interface ParsedTable {
  records: FinancialRecord[];
  tableIndex: number;
}

/**
 * 숫자 문자열인지 확인 (콤마 포함, 괄호 음수 포함)
 * 예: "123,456", "(123,456)"
 */
function isNumericString(str: string): boolean {
  const cleaned = str.trim();
  if (!cleaned) return false;
  return /^[\d,]+$/.test(cleaned) || /^\([\d,]+\)$/.test(cleaned);
}

/**
 * 괄호 음수 형태인지 확인
 * 예: "(1,189,180,758)"
 */
function isNegativeFormat(str: string): boolean {
  return /^\([\d,]+\)$/.test(str.trim());
}

/**
 * 숫자 문자열을 Number로 변환
 * - 콤마 제거
 * - 괄호 음수 처리: (xxx) → -xxx
 */
function parseNumber(str: string): number | null {
  const cleaned = str.trim();
  if (!cleaned) return null;

  // 괄호 음수 형태 처리
  if (isNegativeFormat(cleaned)) {
    const numStr = cleaned.replace(/[(),]/g, '');
    return -Number(numStr);
  }

  // 일반 숫자
  if (isNumericString(cleaned)) {
    const numStr = cleaned.replace(/,/g, '');
    return Number(numStr);
  }

  return null;
}

/**
 * 셀 텍스트 정규화
 * - &nbsp; 제거
 * - <BR/> 등은 빈 문자열로 처리
 * - 앞뒤 공백 제거
 */
function normalizeText($: cheerio.CheerioAPI, cell: ReturnType<cheerio.CheerioAPI>): string {
  // BR 태그만 있는 경우 빈 문자열 반환
  const html = cell.html() || '';
  if (/^(<br\s*\/?>|\s|&nbsp;)*$/i.test(html)) {
    return '';
  }

  // 텍스트 추출 및 정규화
  let text = cell.text();
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/**
 * 항목명 정규화 (키로 사용)
 * - 앞뒤 공백, 대괄호 제거
 * - 내부 공백 정리
 */
function normalizeItemName(name: string): string {
  let result = name.trim();
  // 대괄호 제거
  result = result.replace(/^\[/, '').replace(/\]$/, '');
  // 내부 다중 공백을 단일 공백으로
  result = result.replace(/\s+/g, '');
  return result;
}

/**
 * 테이블이 재무 테이블 조건을 만족하는지 확인
 * 1. 열 개수: 4개 이상
 * 2. 행 개수: 5개 이상 (TBODY 내 TR 기준)
 * 3. 수치 칼럼: 2개 이상
 * 4. 음수값 존재: (xxx,xxx) 형태 1개 이상
 */
function isFinancialTable($: cheerio.CheerioAPI, table: ReturnType<cheerio.CheerioAPI>): boolean {
  // 열 개수 확인 (COLGROUP의 COL 또는 첫 행의 셀 개수)
  const cols = table.find('colgroup col');
  const firstRow = table.find('tr').first();
  const colCount = cols.length || firstRow.find('td, th').length;

  if (colCount < 4) return false;

  // 행 개수 확인 (TBODY 내 TR)
  const tbodyRows = table.find('tbody tr');
  if (tbodyRows.length < 5) return false;

  // 모든 셀 텍스트 수집
  const allCells: string[] = [];
  table.find('td').each((_, cell) => {
    const text = normalizeText($, $(cell));
    if (text) allCells.push(text);
  });

  // 수치 셀 개수 확인
  const numericCells = allCells.filter(isNumericString);
  if (numericCells.length < 2) return false;

  // 음수값 존재 확인
  const hasNegative = allCells.some(isNegativeFormat);
  if (!hasNegative) return false;

  return true;
}

/**
 * 헤더에서 기간 정보 추출
 * rowspan/colspan 처리 포함
 */
function extractHeaders($: cheerio.CheerioAPI, table: ReturnType<cheerio.CheerioAPI>): string[] {
  const thead = table.find('thead');
  const headerRows = thead.length ? thead.find('tr') : table.find('tr').slice(0, 2);

  if (headerRows.length === 0) return [];

  // 첫 번째 헤더 행에서 기간 정보 추출 (첫 번째 열 제외)
  const headers: string[] = [];
  const firstHeaderRow = headerRows.first();

  firstHeaderRow.find('th, td').each((idx, cell) => {
    if (idx === 0) return; // 첫 번째 열(과목명)은 건너뜀

    const text = normalizeText($, $(cell));
    if (text) {
      headers.push(text);
    }
  });

  return headers;
}

/**
 * DART 사업보고서 HTML에서 재무 테이블 파싱
 *
 * @param html - DART 사업보고서 HTML 문자열
 * @returns 파싱된 재무 테이블 배열
 */
export function parseDartFinancialTables(html: string): ParsedTable[] {
  const $ = cheerio.load(html);
  const results: ParsedTable[] = [];

  $('table').each((tableIndex, tableEl) => {
    const table = $(tableEl);

    // 재무 테이블 조건 확인
    if (!isFinancialTable($, table)) return;

    // 헤더 추출
    const headers = extractHeaders($, table);
    if (headers.length === 0) return;

    // 기간별 레코드 초기화
    const records: FinancialRecord[] = headers.map(() => ({}));

    // TBODY 데이터 파싱
    const tbody = table.find('tbody');
    const dataRows = tbody.length ? tbody.find('tr') : table.find('tr').slice(2);

    dataRows.each((_, rowEl) => {
      const row = $(rowEl);
      const cells = row.find('td, th');

      if (cells.length < 2) return;

      // 첫 번째 셀: 항목명
      const itemName = normalizeText($, cells.first());
      if (!itemName) return;

      const normalizedName = normalizeItemName(itemName);
      if (!normalizedName) return;

      // 나머지 셀: 각 기간의 값
      cells.slice(1).each((colIdx, cell) => {
        if (colIdx >= records.length) return;

        const cellText = normalizeText($, $(cell));

        if (!cellText || cellText === '-' || cellText === '−') {
          records[colIdx][normalizedName] = null;
        } else {
          const numValue = parseNumber(cellText);
          records[colIdx][normalizedName] = numValue !== null ? numValue : cellText;
        }
      });
    });

    // 빈 레코드 제외
    const validRecords = records.filter(record =>
      Object.keys(record).length > 0
    );

    if (validRecords.length > 0) {
      results.push({
        records: validRecords,
        tableIndex,
      });
    }
  });

  return results;
}

/**
 * 단일 재무 테이블의 레코드만 반환 (첫 번째 매칭 테이블)
 */
export function parseDartFinancialTable(html: string): FinancialRecord[] | null {
  const tables = parseDartFinancialTables(html);
  return tables.length > 0 ? tables[0].records : null;
}

export default parseDartFinancialTables;
