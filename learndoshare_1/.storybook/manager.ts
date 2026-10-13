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
    // 오류 상태(SLDS 기본)에는 색이 없다. undefined를 넘기면 기본 색까지 지워져 사이드바 선택 항목이 안 보이고 검색이 깨진다
    ...(brand.color && { colorPrimary: brand.color, colorSecondary: brand.color }),
    fontBase: '"Salesforce Sans", "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif',
  }),
});
