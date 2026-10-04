// Storybook에는 org가 없다. 이 파일은 org Themes and Branding이 하는 일을 흉내 낸다(시뮬레이션).
// 팔레트 값은 여기서 계산하지 않는다. `pnpm sync:theme <브랜드명>`이 org 브랜드 색으로 계산해
// brands/<브랜드>/theme.json의 palette에 저장한다 (규칙: scripts/palette.mjs).
const themes = Object.values(
  import.meta.glob("../brands/*/theme.json", { eager: true, import: "default" })
);

export const brands = Object.fromEntries(
  themes.map((theme) => [theme.name, theme])
);

// accent hook은 :root에서 계산되므로 팔레트도 :root에 둬야 반영된다 (org도 문서 루트에 테마를 적용한다)
export function applyBrand(name) {
  const root = document.documentElement;
  for (const prop of [...root.style]) {
    if (prop.startsWith("--slds-r-color-brand-"))
      root.style.removeProperty(prop);
  }
  // palette가 없으면 SLDS 2 Cosmos 기본 팔레트를 그대로 쓴다
  for (const [step, color] of Object.entries(brands[name]?.palette ?? {})) {
    root.style.setProperty(`--slds-r-color-brand-${step}`, color);
  }
  root.dataset.milvusBrand = name;
}
