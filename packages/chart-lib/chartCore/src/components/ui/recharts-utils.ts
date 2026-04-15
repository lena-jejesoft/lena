/**
 * y=0 기준선의 스타일을 결정
 *
 * @param data - 차트 데이터
 * @param fields - Y축 필드명 배열
 * @returns 실선 여부, 축선 스타일 사용 여부, Y=0 보조선 표시 여부
 */
export function getZeroLineStyle(
  data: any[],
  fields: string[]
): { useSolid: boolean; useAxisStyle: boolean; showZeroLine: boolean } {
  // 실제 데이터에서 0이 아닌 값 수집
  const allValues: number[] = [];
  data.forEach(row => {
    fields.forEach(field => {
      const value = row[field];
      if (typeof value === 'number' && !isNaN(value) && value !== 0) {
        allValues.push(value);
      }
    });
  });

  // 값이 없으면 점선 유지, 보조선 숨김
  if (allValues.length === 0) {
    return { useSolid: false, useAxisStyle: false, showZeroLine: false };
  }

  // 양수/음수 혼재 여부 확인
  const hasPositive = allValues.some(v => v > 0);
  const hasNegative = allValues.some(v => v < 0);

  // 양수만 있으면 Y=0 보조선 숨김 (X축이 이미 Y=0)
  if (hasPositive && !hasNegative) {
    return { useSolid: false, useAxisStyle: false, showZeroLine: false };
  }

  // 양수/음수 혼재 또는 음수만: 보조선 표시
  return { useSolid: true, useAxisStyle: false, showZeroLine: true };
}
