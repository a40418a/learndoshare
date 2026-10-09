// WCAG 2.x 대비율. 공식: https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
import { brandPalette, hexToLinear } from "./palette.ts";

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

/**
 * 글자색 text가 대비 기준에 못 미칠 때 제안할 색 (설계 5.3).
 * 같은 색조 팔레트의 40, 30, 20단계 중 bg 위와 흰색 위에서 모두 4.5:1을 넘는 첫 색이다.
 * ponytail: 배경이 어두우면 셋 다 못 넘는다. 그때는 가장 진한 20단계를 돌려준다(어두운 배경의 글자색은 다루지 않음)
 */
export function suggestPassingText(text: string, bg: string): string {
  const palette = brandPalette(text);
  const passes = (c: string) => contrastRatio(c, bg) >= 4.5 && contrastRatio(c, "#ffffff") >= 4.5;
  return [40, 30, 20].map((s) => palette[s]).find(passes) ?? palette[20];
}

// SLDS 2 기본 피드백 hook의 단계 간격과 같다: 배경 90 → hover 80, 글자·테두리 40 → 30
const STEP_LADDER = [95, 90, 80, 70, 60, 50, 40, 30, 20, 10];

/** 같은 색조에서 한 단계 진한 색 (hover·active용). hex에 가장 가까운 단계의 다음 단계다. 10단계보다 진하게는 가지 않는다 */
export function darkerStep(hex: string): string {
  const palette = brandPalette(hex);
  const nearest = STEP_LADDER.reduce((a, b) => (contrastRatio(hex, palette[b]) < contrastRatio(hex, palette[a]) ? b : a));
  return palette[STEP_LADDER[Math.min(STEP_LADDER.indexOf(nearest) + 1, STEP_LADDER.length - 1)]];
}
