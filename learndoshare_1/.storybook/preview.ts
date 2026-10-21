// SLDS 2 (Cosmos). org 테마 SLDS_v2와 같은 계열. 브랜드 팔레트는 :where(html)에 선언돼 있어 brand.ts가 덮어쓸 수 있다
import "@salesforce-ux/design-system-2/dist/css/bundled/slds2.cosmos.css";
import "./preview.css";
import { applyBrand, brands } from "./brand.ts";

const DEFAULT_BRAND = brands[0].name;
const SOURCE_LABEL = { org: "org", sample: "샘플", project: "프로젝트", slds: "기본" };

// 브랜드를 읽지 못하면(설계 4.2, 10장) SLDS 기본으로 그리고 화면 위에 이유를 보여 준다. 스토리 밖(body 맨 앞)에 두어 스토리 모양과 섞이지 않는다
function errorBanner(error: string | undefined) {
  let banner = document.getElementById("milvus-brand-error");
  if (!error) return banner?.remove();
  if (!banner) {
    banner = Object.assign(document.createElement("div"), { id: "milvus-brand-error", role: "alert" });
    banner.className = "slds-notify slds-notify_alert slds-alert_error";
    banner.style.whiteSpace = "pre-line";
    banner.style.textAlign = "left";
    document.body.prepend(banner);
  }
  banner.textContent = `브랜드를 불러오지 못해 SLDS 기본 브랜드로 보여 줍니다.\n${error}`;
}

export default {
  tags: ["autodocs"],
  globalTypes: {
    brand: {
      description: "브랜드 (org Themes and Branding 시뮬레이션)",
      toolbar: {
        title: "브랜드",
        icon: "paintbrush",
        items: brands.map((b) => ({ value: b.name, title: b.label, right: SOURCE_LABEL[b.source] })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { brand: DEFAULT_BRAND },
  decorators: [
    (story: () => unknown, context: { globals: { brand?: string } }) => {
      errorBanner(applyBrand(context.globals.brand ?? DEFAULT_BRAND).error);
      return story();
    },
  ],
  parameters: {
    layout: "padded",
    controls: { expanded: true },
    docs: { codePanel: true, source: { language: "html" } },
    options: {
      storySort: {
        order: [
          "시작하기",
          "런북",
          "Foundations",
          ["브랜드 스타일 (util.css)", "컬러", "타이포그래피"],
          "컴포넌트",
          ["기본", "밀버스 추가"],
        ],
      },
    },
  },
};
