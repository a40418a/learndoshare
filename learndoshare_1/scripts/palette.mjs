/**
 * 브랜드 색 하나로 SLDS 2 참조 팔레트(--slds-r-color-brand-5 ~ 95)를 만든다.
 *
 * Salesforce Setup > Themes and Branding이 만드는 "브랜드 기반 색상 팔레트"를 실측해 역산한 규칙이다.
 * 실측 데이터: scripts/palette.measured.json (44색 × 7칸, 새 테마 화면의 DOM에서 읽은 값)
 *
 *   1. 브랜드 색을 CIELAB LCh(ab, D65)로 바꾼다. 색상각(h)은 정수로 반올림해 모든 단계에 그대로 쓴다.
 *   2. 단계마다 명도 L*가 고정이다. 브랜드 색의 밝기와 무관하다 (밝은 노랑도 50단계는 L* 49).
 *      Setup에 보이는 단계: 95→96, 90→91, 50→49, 40→39, 30→29, 20→19, 10→8
 *   3. 채도는 정수다: C = min(floor(r × M), M, cap)
 *      M   = 그 명도·색상각에서 sRGB로 낼 수 있는 최대 정수 채도
 *      cap = 25 (90단계), 10 (95단계). 어두운 단계는 제한 없음
 *   4. r(브랜드의 상대 채도)은 두 값을 섞는다
 *      x   = 브랜드 채도 / 그 색상각에서 낼 수 있는 최대 채도(모든 명도 중 최대)
 *      rel = 브랜드 채도 / 브랜드 자신의 명도에서 낼 수 있는 최대 채도 (최대 1)
 *      r   = x + t × (rel − x),  t = 0.4725 (어두운 단계), 0.4275 (밝은 단계)
 *   원본 브랜드 색은 팔레트에 그대로 들어가지 않는다. 50단계는 항상 L* 49로, 흰 글자와 대비 4.5:1 이상이다.
 *
 * 정확도 (Setup 실측 대비, ΔE = OKLab 거리 × 100. 사람 눈의 구분 한계는 약 2):
 *   학습 24색 평균 0.02 / 최대 0.46, 학습에 쓰지 않은 검증 20색 평균 0.13 / 최대 0.64
 *
 * ponytail: 4번의 t 값은 실측에 맞춘 경험식이다. Salesforce의 실제 식은 공개돼 있지 않다.
 *           어긋나는 색이 나오면 palette.measured.json에 실측을 추가하고 t를 다시 맞춘다.
 * ponytail: Setup에 보이지 않는 10단계(5, 15, 35, 45, 55~85)의 명도는 SLDS 2 기본 팔레트에서 가져온 추정값이고,
 *           55~85단계는 채도 상한도 모른다. 라이트 모드 accent hook은 50·40·30단계만 쓰므로 영향이 작다.
 */

// 단계 → [L*, 채도 상한]
const LEVELS = {
  5: [1],
  10: [8],
  15: [14],
  20: [19],
  30: [29],
  35: [34],
  40: [39],
  45: [44],
  50: [49],
  55: [55],
  60: [61],
  65: [65],
  70: [72],
  80: [81],
  85: [86],
  90: [91, 25],
  95: [96, 10]
};

export const STEPS = Object.keys(LEVELS).map(Number);

// Setup > Themes and Branding의 "브랜드 기반 색상 팔레트" 7칸 (COLOR_95 ~ COLOR_10)
export const SETUP_STEPS = [95, 90, 50, 40, 30, 20, 10];

const T_DARK = 0.4725;
const T_LIGHT = 0.4275;

const WHITE = [0.95047, 1, 1.08883]; // D65
const EPSILON = 216 / 24389;
const KAPPA = 24389 / 27;

const toLinear = (c) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toGamma = (c) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const f = (t) => (t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
const fInverse = (t) => (t ** 3 > EPSILON ? t ** 3 : (116 * t - 16) / KAPPA);

function assertHex(hex) {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new Error(`브랜드 색 형식이 아닙니다 (#rrggbb): ${hex}`);
  }
}

function lch(hex) {
  const [r, g, b] = [1, 3, 5].map((i) =>
    toLinear(parseInt(hex.slice(i, i + 2), 16) / 255)
  );
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const [fx, fy, fz] = [x / WHITE[0], y, z / WHITE[2]].map(f);
  const a = 500 * (fx - fy);
  const bb = 200 * (fy - fz);
  return [
    116 * fy - 16,
    Math.hypot(a, bb),
    ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
  ];
}

function linearRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const fy = (L + 16) / 116;
  const x = fInverse(fy + a / 500) * WHITE[0];
  const y = L > 8 ? fy ** 3 : L / KAPPA;
  const z = fInverse(fy - b / 200) * WHITE[2];
  return [
    3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
    -0.969266 * x + 1.8760108 * y + 0.041556 * z,
    0.0556434 * x - 0.2040259 * y + 1.0572252 * z
  ];
}

const inGamut = (L, C, h) =>
  linearRgb(L, C, h).every((c) => c >= -1e-6 && c <= 1 + 1e-6);

// 명도 L, 색상각 h에서 sRGB로 낼 수 있는 최대 채도
function maxChroma(L, h) {
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(L, mid, h)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// 색상각 h에서 모든 명도를 통틀어 낼 수 있는 최대 채도
function cuspChroma(h) {
  let max = 0;
  for (let i = 10; i < 1000; i++) max = Math.max(max, maxChroma(i / 10, h));
  return max;
}

const toHex = (L, C, h) =>
  "#" +
  linearRgb(L, C, h)
    .map((c) =>
      Math.round(toGamma(Math.min(1, Math.max(0, c))) * 255)
        .toString(16)
        .padStart(2, "0")
    )
    .join("");

/** CIELAB 명도 L* */
export function toneOf(hex) {
  assertHex(hex);
  return lch(hex)[0];
}

export function brandPalette(brandColor) {
  assertHex(brandColor);
  const [L, C, rawHue] = lch(brandColor);
  const hue = Math.round(rawHue) % 360;
  const gray = Math.round(C) === 0; // 흰색·회색·검정은 모두 같은 무채색 팔레트가 된다
  const x = gray ? 0 : C / cuspChroma(rawHue);
  const rel = gray
    ? 0
    : Math.min(1, Math.round(C) / maxChroma(Math.round(L), hue));

  const palette = {};
  for (const [step, [Lk, cap = Infinity]] of Object.entries(LEVELS)) {
    const r = x + (Lk > 50 ? T_LIGHT : T_DARK) * (rel - x);
    const M = Math.floor(maxChroma(Lk, hue));
    palette[step] = toHex(Lk, Math.min(Math.floor(r * M), M, cap), hue);
  }
  return palette;
}

// 직접 실행하면 Setup 실측값과 비교해 규칙이 깨지지 않았는지 확인한다: node scripts/palette.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import("node:fs");
  const measured = JSON.parse(
    readFileSync(new URL("./palette.measured.json", import.meta.url), "utf8")
  );
  const oklab = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) =>
      toLinear(parseInt(hex.slice(i, i + 2), 16) / 255)
    );
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    ];
  };
  const deltaE = (p, q) => {
    const [a, b] = [oklab(p), oklab(q)];
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
  };
  const errors = [];
  let exact = 0;
  for (const [brand, real] of Object.entries(measured)) {
    if (brand.startsWith("_")) continue;
    const generated = brandPalette(brand);
    for (const step of SETUP_STEPS) {
      errors.push(deltaE(generated[step], real[step]));
      if (generated[step] === real[step].toLowerCase()) exact++;
    }
  }
  const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
  const max = Math.max(...errors);
  if (mean > 0.15 || max > 1) {
    throw new Error(
      `Setup 실측과 차이가 큽니다: 평균 ΔE ${mean.toFixed(3)}, 최대 ${max.toFixed(3)} (기준 0.15 / 1.0)`
    );
  }
  console.log(
    `✓ palette 규칙 확인: Setup 실측 ${errors.length / 7}색 × 7칸 대비 평균 ΔE ${mean.toFixed(3)}, 최대 ${max.toFixed(3)}, 정확히 일치 ${exact}/${errors.length}`
  );
}
