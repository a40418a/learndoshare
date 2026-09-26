import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

// main.mjs의 managerHead가 brands/Milvus_DesignSystem/theme.json 내용을 넣어 준다
const brand = window.MILVUS_BRAND ?? {};

addons.setConfig({
  theme: create({
    base: "light",
    brandTitle: "밀버스 디자인 시스템",
    brandUrl: "./",
    brandImage: brand.logo
      ? `static/brands/${brand.name}/${brand.logo}`
      : undefined,
    brandTarget: "_self",
    colorPrimary: brand.brandColor,
    colorSecondary: brand.brandColor,
    fontBase:
      '"Salesforce Sans", "Pretendard", "Apple SD Gothic Neo", system-ui, sans-serif'
  })
});
