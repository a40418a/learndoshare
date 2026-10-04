/**
 * 브랜드 색 하나로 SLDS 2 참조 팔레트(--slds-r-color-brand-5 ~ 95)를 만든다.
 *
 * Salesforce가 Themes and Branding에서 쓰는 규칙을 SLDS 2 Cosmos 팔레트에서 역산했다 (#3 PR 댓글 참고).
 *   - 단계 번호 = CIELAB 명도 L* (brand-50 → L* ≈ 50, brand-90 → L* ≈ 90)
 *   - 색상각(hue)은 브랜드 색 그대로 유지
 *   - 채도(chroma)는 브랜드 색 그대로, 그 명도에서 sRGB로 표현할 수 없으면 줄인다
 *   - 브랜드 색과 명도가 가장 가까운 단계에는 원본 색을 그대로 둔다
 *     (Setup 화면에서 #0176D3(L* 49)이 50단계 칸과 같은 명도로 표시됨. 밝은 브랜드 색에서도 같은지는 미확인)
 * Cosmos 기본색 #066afe로 재현하면 평균 ΔE(OKLab×100) 1.98.
 *
 * ponytail: OKLCH로 근사한다. Salesforce의 실제 구현(HCT 계열로 추정)과는 단계별로 약간 다를 수 있다.
 *           org 화면과 차이가 눈에 띄면 그 단계만 비교해 보정한다.
 */

export const STEPS = [
  5, 10, 15, 20, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 85, 90, 95
];

// Setup > Themes and Branding의 "브랜드 기반 색상 팔레트" 7칸이 보여 주는 단계
export const SETUP_STEPS = [95, 90, 50, 40, 30, 20, 10];

const toLinear = (c) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

function hexToRgb(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex))
    throw new Error(`브랜드 색 형식이 아닙니다: ${hex}`);
  return [1, 3, 5].map((i) =>
    toLinear(parseInt(hex.slice(i, i + 2), 16) / 255)
  );
}

const rgbToHex = (rgb) =>
  "#" +
  rgb
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("");

function rgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  ];
}

function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
}

// CIELAB L* (D65)
function lstar([r, g, b]) {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

// 주어진 hue·chroma에서 L*가 tone이 되는 OKLab L을 이분 탐색으로 찾는다
function solveLightness(tone, chroma, hue) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (
      lstar(oklabToRgb([mid, chroma * Math.cos(hue), chroma * Math.sin(hue)])) <
      tone
    )
      lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function toneOf(hex) {
  return lstar(hexToRgb(hex));
}

export function brandPalette(brandColor) {
  const [, a, b] = rgbToOklab(hexToRgb(brandColor));
  const hue = Math.atan2(b, a);
  const palette = {};
  for (const tone of STEPS) {
    let chroma = Math.hypot(a, b);
    let rgb;
    // 표현할 수 있을 때까지 채도를 3%씩 줄인다
    for (let i = 0; i < 200; i++) {
      const L = solveLightness(tone, chroma, hue);
      rgb = oklabToRgb([L, chroma * Math.cos(hue), chroma * Math.sin(hue)]);
      if (inGamut(rgb)) break;
      chroma *= 0.97;
    }
    palette[tone] = rgbToHex(rgb);
  }
  const brandTone = toneOf(brandColor);
  const nearest = STEPS.reduce((best, s) =>
    Math.abs(s - brandTone) < Math.abs(best - brandTone) ? s : best
  );
  palette[nearest] = brandColor.toLowerCase();
  return palette;
}

// 직접 실행하면 Cosmos 기본 팔레트와 비교해 규칙이 깨지지 않았는지 확인한다: node scripts/palette.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const COSMOS = {
    5: "#000314",
    10: "#001642",
    15: "#001e5b",
    20: "#002775",
    30: "#022ac0",
    35: "#003ecd",
    40: "#0250d9",
    45: "#045dec",
    50: "#066afe",
    55: "#287efe",
    60: "#4992fe",
    65: "#5f9ffe",
    70: "#7cb1fe",
    80: "#a8cbff",
    85: "#c2daff",
    90: "#d6e6ff",
    95: "#edf4ff"
  };
  const generated = brandPalette("#066afe");
  const deltaE = (x, y) => {
    const [p, q] = [rgbToOklab(hexToRgb(x)), rgbToOklab(hexToRgb(y))];
    return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 100;
  };
  const avg =
    STEPS.reduce((sum, s) => sum + deltaE(generated[s], COSMOS[s]), 0) /
    STEPS.length;
  if (generated[50] !== "#066afe")
    throw new Error("브랜드 색이 가장 가까운 단계(50)에 그대로 있어야 합니다");
  for (const s of STEPS.filter((step) => step !== 50)) {
    if (Math.abs(toneOf(generated[s]) - s) > 1)
      throw new Error(`brand-${s}의 명도가 단계와 다릅니다`);
  }
  if (avg > 2.5)
    throw new Error(
      `Cosmos 팔레트와 평균 ΔE ${avg.toFixed(2)} (기준 2.5 초과)`
    );
  console.log(
    `✓ palette 규칙 확인: Cosmos 대비 평균 ΔE ${avg.toFixed(2)}, 브랜드 단계 외 명도 ±1 이내`
  );
}
