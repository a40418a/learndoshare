import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { brandPalette, hexToLinear, SETUP_STEPS } from "../lib/palette.ts";
import { contrastRatio } from "../lib/contrast.ts";

// Setup > Themes and Branding 견본 7칸 실측. "_"로 시작하는 키는 설명이다
const measured: Record<string, Record<string, string>> = JSON.parse(
  readFileSync(new URL("../scripts/palette.measured.json", import.meta.url), "utf8"),
);

// ΔE = OKLab 거리 × 100. 사람 눈의 구분 한계는 약 2
function oklab(hex: string) {
  const [r, g, b] = hexToLinear(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
const deltaE = (p: string, q: string) => {
  const [a, b] = [oklab(p), oklab(q)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
};

// 7색과, 16×16×16 RGB 격자(0x00, 0x11, …, 0xff)의 0·5·10·15번째 값으로 만든 4×4×4 = 64색
const GRID = [0x00, 0x55, 0xaa, 0xff];
const hex2 = (n: number) => n.toString(16).padStart(2, "0");
const SAMPLES = [
  "#0176D3",
  "#2E7D32",
  "#FFD400",
  "#FF6F00",
  "#00A1E0",
  "#E01020",
  "#111827",
  ...GRID.flatMap((r) => GRID.flatMap((g) => GRID.map((b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`))),
];

test("Setup 실측 44색을 평균 ΔE 0.15 이하, 최대 1 이하로 재현한다", () => {
  const errors = Object.entries(measured)
    .filter(([brand]) => !brand.startsWith("_"))
    .flatMap(([brand, real]) => {
      const generated = brandPalette(brand);
      return SETUP_STEPS.map((step) => deltaE(generated[step], real[step]));
    });
  assert.equal(errors.length, 44 * 7);
  const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
  const max = Math.max(...errors);
  assert.ok(mean <= 0.15 && max <= 1, `평균 ΔE ${mean.toFixed(3)}, 최대 ${max.toFixed(3)} (기준 0.15 / 1.0)`);
});

test("#2E7D32의 50단계는 #468244다", () => {
  assert.equal(brandPalette("#2E7D32")[50], "#468244");
});

test("50·40·30단계는 흰색과 4.5:1 이상이다", () => {
  assert.equal(SAMPLES.length, 71);
  for (const hex of SAMPLES) {
    const palette = brandPalette(hex);
    for (const s of [50, 40, 30]) {
      const ratio = contrastRatio(palette[s], "#ffffff");
      assert.ok(ratio >= 4.5, `${hex}의 ${s}단계 ${palette[s]}: ${ratio.toFixed(2)}:1`);
    }
  }
});

test("contrastRatio('#000000','#ffffff')는 21", () => {
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#000000"), 21);
  assert.equal(contrastRatio("#2976ca", "#2976CA"), 1);
});

test("#rrggbb가 아닌 색은 던진다", () => {
  for (const bad of ["#fff", "red", "#12345g", ""]) {
    assert.throws(() => brandPalette(bad), /#rrggbb/);
    assert.throws(() => contrastRatio(bad, "#ffffff"), /#rrggbb/);
  }
});
