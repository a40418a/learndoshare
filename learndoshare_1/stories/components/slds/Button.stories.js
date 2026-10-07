import { LightningButton, ORIGIN, lwc, row, sourceFor } from "../../helpers.js";

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

export default {
  title: "컴포넌트/SLDS 기반/Button",
  render: ({ onClick, ...args }) =>
    lwc("lightning-button", LightningButton, args, { click: onClick }),
  args: { label: "저장", variant: "brand", iconName: "", disabled: false },
  argTypes: {
    variant: { control: "select", options: VARIANTS, description: "버튼 모양" },
    iconName: {
      control: "text",
      description: "SLDS 아이콘 이름. 예: `utility:save`"
    },
    disabled: { control: "boolean" },
    onClick: { action: "click", table: { disable: true } }
  },
  parameters: {
    docs: {
      source: sourceFor("lightning-button", { events: ["click"] }),
      description: {
        component: `${ORIGIN.slds}

- **현재 브랜드 모드:** SLDS 기본 (\`lightning-button\`). 브랜드 root에 버튼 custom 값이 생기면 밀버스 스타일로 자동 전환된다 (#4)
- **색:** \`brand\` 변형의 배경은 accent hook을 따르므로, 상단 툴바에서 브랜드를 바꾸면 함께 바뀐다
- **쓰는 곳:** 화면의 모든 버튼. 버튼을 직접 \`<button>\`으로 만들지 않는다`
      }
    }
  }
};

export const 기본 = {};

export const 변형_모음 = {
  render: () =>
    row(
      ...VARIANTS.map((variant) => {
        const button = lwc("lightning-button", LightningButton, {
          label: variant,
          variant
        });
        if (variant !== "inverse") return button;
        // inverse는 어두운 배경용이다. 밝은 배경에 두면 보이지 않는다
        const surface = document.createElement("span");
        surface.className = "slds-theme_inverse slds-p-around_x-small";
        surface.append(button);
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
              `<lightning-button label="${v}" variant="${v}"></lightning-button>`
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
