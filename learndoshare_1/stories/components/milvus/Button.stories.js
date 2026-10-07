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

**브랜드에 따라 자동 전환한다.** 화면 코드는 항상 \`<c-milvus-button>\` 하나만 쓴다.

| 브랜드 \`brands/<브랜드>/util.css\`에 | 그려지는 것 |
| --- | --- |
| \`--milvus-button-custom\`이 없음 | **SLDS 기본**: \`lightning-button\` 그대로 |
| \`--milvus-button-custom: on\` | **밀버스 커스텀**: SLDS 버튼 블루프린트 + \`--milvus-button-radius\` · \`-font-weight\` · \`-padding-inline\` |

- **언제 쓰나:** util.css의 global hook은 같은 hook을 쓰는 컴포넌트를 모두 바꾼다. 예를 들어 \`--slds-g-radius-border-pill\`을 바꾸면 버튼과 함께 뱃지 등도 바뀐다. **버튼만** 다르게 하려면 \`--milvus-button-*\`를 쓴다
- 상단 툴바에서 브랜드를 바꿔 보면 된다. \`Milvus_DesignSystem\`은 SLDS 기본이고, \`Sample_Forest\`는 밀버스 커스텀(굵은 글씨)이다
- \`--milvus-button-*\`를 정하지 않으면 SLDS 값으로 떨어진다. 그래서 커스텀 모드에서도 util.css의 global hook(반경 등)을 따른다
- 색은 두 모드 모두 org 브랜드 색(accent hook)을 따른다
- 버튼을 직접 \`<button>\`이나 \`lightning-button\`으로 만들지 않는다. 브랜드가 바뀌어도 화면 코드를 고치지 않기 위해서다`
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
