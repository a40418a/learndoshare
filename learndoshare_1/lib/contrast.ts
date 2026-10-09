// WCAG 2.x 대비율. 공식: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
import { hexToLinear } from "./palette.ts";

// 상대 휘도. https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
function luminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 두 색(#rrggbb)의 대비율, 1~21. 기준(4.5:1)과 비교하므로 반올림하지 않는다 */
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
