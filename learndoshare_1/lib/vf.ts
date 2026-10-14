// VF용 브랜드 팔레트 CSS (설계 5.5, 10/9 D2)
// Visualforce Settings의 SLDS 2 설정을 켠 `<apex:slds/>`는 SLDS 2이지만 org 테마의 브랜드 팔레트는 들어오지 않는다(org 프로브 3.8).
// 그래서 빠진 팔레트만 `:root{--slds-r-color-brand-<단계>}`로 넣는다. SLDS 2 CSS 사본은 받지도 만들지도 않는다.
import { brandPalette } from "./palette.ts";

/** 브랜드 색(#rrggbb) → milvusVf.css 내용. 17단계(5~95)가 약 620바이트다. 색 형식이 틀리면 brandPalette가 던진다 */
export function buildMilvusVfCss(brandColor: string): string {
  const decls = Object.entries(brandPalette(brandColor)).map(([step, color]) => `  --slds-r-color-brand-${step}: ${color};\n`);
  return `:root {\n${decls.join("")}}\n`;
}
