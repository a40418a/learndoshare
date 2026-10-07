// SLDS 2 (Cosmos). org 테마 SLDS_v2와 같은 계열. 브랜드 팔레트는 :where(html)에 선언돼 있어 brand.js가 덮어쓸 수 있다
import "@salesforce-ux/design-system-2/dist/css/bundled/slds2.cosmos.css";
import "./preview.css";
import { applyBrand, brands } from "./brand.js";

const DEFAULT_BRAND = "Milvus_DesignSystem";

export default {
  tags: ["autodocs"],
  globalTypes: {
    brand: {
      description: "브랜드 (org Themes and Branding 시뮬레이션)",
      toolbar: {
        title: "브랜드",
        icon: "paintbrush",
        items: Object.values(brands).map((theme) => ({
          value: theme.name,
          title: theme.label,
          right: theme.source === "org" ? "org" : "샘플"
        })),
        dynamicTitle: true
      }
    }
  },
  initialGlobals: { brand: DEFAULT_BRAND },
  decorators: [
    (story, context) => {
      applyBrand(context.globals.brand ?? DEFAULT_BRAND);
      return story();
    }
  ],
  parameters: {
    layout: "padded",
    controls: { expanded: true },
    docs: { codePanel: true, source: { language: "html" } },
    options: {
      storySort: {
        order: [
          "시작하기",
          "Foundations",
          ["컬러", "타이포그래피"],
          "컴포넌트",
          ["기본", "밀버스 추가"]
        ]
      }
    }
  }
};
