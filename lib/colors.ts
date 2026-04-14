// 차트 색상 팔레트 (Anthropic 브랜드 스타일)
export const chartColors: string[] = [
  "#C15F3C",   // Crail (러스트 오렌지)
  "#B1ADA1",   // Cloudy (웜 그레이)
  "#7D8471",   // Sage (세이지 그린)
  "#9B8AA6",   // Lavender (라벤더)
  "#D4A574",   // Tan (탄 베이지)
  "#6B7B8C",   // Slate (슬레이트 그레이)
  "#da7756",   // Terra Cotta (테라코타)
  "#A67B5B",   // Coffee (커피 브라운)
  "#2e5a8c",
  "#7c5cba",
  "#4a90d9",
  "#e67e22"
]

/**
 * 헥스 색상을 HSL로 변환
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 50 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}