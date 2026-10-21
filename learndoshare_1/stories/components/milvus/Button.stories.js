import {
  MilvusButton,
  ORIGIN,
  lwc,
  row,
  sourceFor,
  sourceStory
} from "../../helpers.js";

const VARIANTS = [
  "base",
  "neutral",
  "brand",
  "brand-outline",
  "destructive",
  "destructive-text",
  "inverse",
  "success"
];

const button = (args, onClick) =>
  lwc("c-milvus-button", MilvusButton, args, { click: onClick });

// 현재 브랜드에서 어떤 모드로 그려지는지 스토리 위에 표시한다 (milvusButton과 같은 신호를 읽는다)
const withMode = (story) => {
  const custom =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--milvus-button-custom")
      .trim() === "on";
  const wrap = document.createElement("div");
  const mode = document.createElement("p");
  mode.className = "slds-text-body_small slds-m-bottom_small";
  mode.textContent = `현재 브랜드 모드: ${custom ? "밀버스 커스텀" : "SLDS 기본"}`;
  wrap.append(mode, story());
  return wrap;
};

export default {
  title: "컴포넌트/밀버스 추가/Button",
  decorators: [withMode],
  render: ({ onClick, ...args }) => button(args, onClick),
  args: {
    label: "저장",
    variant: "brand",
    iconName: "",
    iconPosition: "left",
    disabled: false
  },
  argTypes: {
    variant: { control: "select", options: VARIANTS, description: "버튼 모양" },
    iconName: {
      control: "text",
      description: "SLDS 아이콘 이름. 예: `utility:save`"
    },
    iconPosition: { control: "inline-radio", options: ["left", "right"] },
    disabled: { control: "boolean" },
    onClick: { action: "click", table: { disable: true } }
  },
  parameters: {
    docs: {
      source: sourceFor("c-milvus-button", { events: ["click"] }),
      description: {
        component: `${ORIGIN.milvus}

비교용 예시입니다. 실제 화면에는 \`lightning-button\`을 쓰세요.

- 버튼 모서리·굵기·여백은 브랜드 명세에 적으면 \`lightning-button\`에 그대로 반영됩니다.
- 툴바에서 브랜드를 바꿔 두 모양을 비교해 보세요.`
      }
    }
  }
};

export const 기본 = {};

export const 변형_모음 = {
  render: () =>
    row(
      ...VARIANTS.map((variant) => {
        const el = button({ label: variant, variant });
        if (variant !== "inverse") return el;
        // inverse는 어두운 배경용이다. 밝은 배경에 두면 보이지 않는다
        const surface = document.createElement("span");
        surface.className = "slds-theme_inverse slds-p-around_x-small";
        surface.append(el);
        return surface;
      })
    ),
  parameters: {
    docs: {
      source: {
        transform: (code) => code,
        code:
          VARIANTS.map(
            (v) =>
              `<c-milvus-button label="${v}" variant="${v}"></c-milvus-button>`
          ).join("\n") +
          "\n<!-- inverse는 어두운 배경(slds-theme_inverse) 위에 둔다 -->"
      }
    }
  }
};

export const 아이콘 = {
  args: { label: "다운로드", variant: "neutral", iconName: "utility:download" }
};

export const 비활성 = { args: { disabled: true } };

export const 소스_코드 = sourceStory("milvusButton");
