// Storybook에는 org가 없다. 이 파일은 org Themes and Branding이 하는 일을 흉내 낸다(시뮬레이션).
// org는 브랜드 색 하나로 참조 팔레트(--slds-r-color-brand-*)를 만들고, accent 계열 global hook이 그 팔레트를 읽는다.
// 여기서는 브랜드 색을 50단계로 두고 나머지를 color-mix로 근사한다. 실제 org 팔레트와 미세하게 다를 수 있다.
const STEPS = [
  5, 10, 15, 20, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 85, 90, 95
];

export function brandPalette(color) {
  const palette = {};
  for (const step of STEPS) {
    let value = color;
    if (step < 50)
      value = `color-mix(in oklch, ${color}, black ${Math.round(((50 - step) / 50) * 88)}%)`;
    if (step > 50)
      value = `color-mix(in oklch, ${color}, white ${Math.round(((step - 50) / 50) * 92)}%)`;
    palette[`--slds-r-color-brand-${step}`] = value;
  }
  return palette;
}

const themes = Object.values(
  import.meta.glob("../brands/*/theme.json", { eager: true, import: "default" })
);

export const brands = Object.fromEntries(
  themes.map((theme) => [theme.name, theme])
);

// accent hook은 :root에서 계산되므로 팔레트도 :root에 둬야 반영된다 (org도 문서 루트에 테마를 적용한다)
export function applyBrand(name) {
  const theme = brands[name];
  const root = document.documentElement;
  for (const [key, value] of Object.entries(
    theme?.brandColor ? brandPalette(theme.brandColor) : {}
  )) {
    root.style.setProperty(key, value);
  }
  if (!theme?.brandColor) {
    for (const step of STEPS)
      root.style.removeProperty(`--slds-r-color-brand-${step}`);
  }
  root.dataset.milvusBrand = name;
}
