import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// main.ts의 managerHead가 기본 브랜드의 로고(data URL)와 버튼 색(50단계)을 넣어 준다
const brand = (window as { MILVUS_BRAND?: { logoUrl?: string; color?: string } }).MILVUS_BRAND ?? {};

addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "밀버스 디자인 시스템",
    brandUrl: "./",
    brandImage: brand.logoUrl,
    brandTarget: "_self",
    colorPrimary: brand.color,
    colorSecondary: brand.color,
    fontBase: '"Salesforce Sans", "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif',
  }),
});
