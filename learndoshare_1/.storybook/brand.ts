// Storybook에는 org가 없다. 이 파일은 org Themes and Branding과 loadBrand(밀버스 LWC)가 하는 일을 흉내 낸다(시뮬레이션).
// 브랜드 데이터는 lib/storybook-plugin.ts가 만든다(저장소: brands/, 프로젝트: BrandingSet과 staticresources)
import { brands, mode } from "virtual:milvus-brands";
import { sentinelCss } from "virtual:milvus-sentinel";

export { brands, mode };

/**
 * 반영 검사(시작하기/반영 검사, 설계 9.6의 2)의 센티널 브랜드 이름. 기본 브랜드의 팔레트·브리지·override에 util.css만 센티널로 바꾼다.
 * 툴바에는 없고 스토리 URL의 globals=brand:milvus-sentinel로만 연다. 이름에 -가 있어 브랜드 이름과 겹치지 않는다
 */
export const SENTINEL = "milvus-sentinel";

const STYLES = [
  ["milvus-brand-bridge", "bridgeCss"],
  ["milvus-brand-util", "utilCss"],
  ["milvus-brand-override", "overrideCss"],
] as const;

/** 브랜드를 문서에 적용하고 적용한 브랜드를 돌려준다. 없는 이름이면 첫 브랜드(기본 브랜드)다 */
export function applyBrand(name: string) {
  const brand =
    name === SENTINEL
      ? { ...brands[0], name: SENTINEL, label: "센티널", utilCss: sentinelCss }
      : (brands.find((b) => b.name === name) ?? brands[0]);
  // accent hook은 :root에서 계산되므로 팔레트도 :root에 둬야 반영된다 (org도 문서 루트에 테마를 적용한다)
  const root = document.documentElement;
  for (const prop of [...root.style]) {
    if (prop.startsWith("--slds-r-color-brand-")) root.style.removeProperty(prop);
  }
  // palette가 비면(SLDS 기본) SLDS 2 Cosmos 기본 팔레트를 그대로 쓴다
  for (const [step, color] of Object.entries(brand.palette)) {
    root.style.setProperty(`--slds-r-color-brand-${step}`, color);
  }
  root.dataset.milvusBrand = brand.name;

  // loadBrand와 같은 순서(브리지 → util.css → override)로 문서 끝에 넣는다. SLDS 2 CSS는 @layer 안에 있어서 이 규칙들이 우선한다
  for (const [id, key] of STYLES) {
    const style =
      document.getElementById(id) ?? document.head.appendChild(Object.assign(document.createElement("style"), { id }));
    style.textContent = brand[key];
  }
  return brand;
}
