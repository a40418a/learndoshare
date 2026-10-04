const GROUPS = {
  "브랜드 (org 테마를 따름)": [
    "accent-1",
    "accent-2",
    "accent-3",
    "accent-container-1",
    "accent-container-2",
    "accent-container-3",
    "on-accent-1",
    "border-accent-1"
  ],
  표면: [
    "surface-1",
    "surface-2",
    "surface-3",
    "surface-container-1",
    "surface-container-2",
    "surface-container-3",
    "on-surface-1",
    "on-surface-2",
    "on-surface-3"
  ],
  피드백: [
    "success-1",
    "success-container-1",
    "warning-1",
    "warning-container-1",
    "error-1",
    "error-container-1",
    "info-1",
    "info-container-1"
  ],
  테두리: ["border-1", "border-2"]
};

const PALETTE = [
  5, 10, 15, 20, 30, 35, 40, 45, 50, 55, 60, 65, 70, 80, 85, 90, 95
];

function swatch(variable) {
  const box = document.createElement("div");
  box.className = "sb-swatch";
  box.innerHTML = `<div class="sb-swatch__chip" style="background: var(${variable})"></div>
        <div class="sb-swatch__meta"><code>${variable}</code><br><span data-value></span></div>`;
  return box;
}

// 렌더 후 칩의 실제 배경색을 적는다. 변수 값은 color-mix 식일 수 있어서 브라우저가 계산한 결과를 보여 준다
// oklch(), color() 등 어떤 형식이든 canvas에 칠해 실제 sRGB 픽셀 값을 읽는다
const ctx = document
  .createElement("canvas")
  .getContext("2d", { willReadFrequently: true });

function toHex(color) {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  return a < 255 ? `${hex} (${Math.round((a / 255) * 100)}%)` : hex;
}

function fillValues(root) {
  requestAnimationFrame(() => {
    for (const el of root.querySelectorAll(".sb-swatch")) {
      el.querySelector("[data-value]").textContent = toHex(
        getComputedStyle(el.querySelector(".sb-swatch__chip")).backgroundColor
      );
    }
  });
}

function section(title, variables) {
  const wrap = document.createElement("section");
  wrap.innerHTML = `<h3 class="slds-text-heading_small slds-m-bottom_small">${title}</h3>`;
  const grid = document.createElement("div");
  grid.className = "sb-swatch-grid";
  grid.append(...variables.map(swatch));
  wrap.append(grid);
  return wrap;
}

export default {
  title: "Foundations/컬러",
  parameters: {
    docs: {
      description: {
        component: `컴포넌트는 색을 직접 쓰지 않고 SLDS 2 **global styling hook**(\`--slds-g-color-*\`)만 읽는다. 브랜드 계열(accent)은 org **Themes and Branding**의 브랜드 색을 따른다.

- 상단 툴바에서 브랜드를 바꾸면 이 페이지의 값이 바뀐다
- **Storybook의 브랜드 전환은 시뮬레이션이다.** org는 브랜드 색 하나로 팔레트를 실행 시점에 만든다. 여기서는 같은 규칙(단계 = 명도 L\*, 색상각 유지)으로 \`pnpm sync:theme\`이 계산해 둔 값을 쓴다. 실제 org 화면과 미세하게 다를 수 있다
- 컴포넌트 CSS에서는 \`var(--slds-g-color-accent-1, <fallback>)\`처럼 **fallback을 함께** 쓴다`
      }
    }
  }
};

export const Global_hook = {
  render: () => {
    const root = document.createElement("div");
    root.className = "sb-stack";
    root.append(
      ...Object.entries(GROUPS).map(([title, names]) =>
        section(
          title,
          names.map((n) => `--slds-g-color-${n}`)
        )
      )
    );
    fillValues(root);
    return root;
  }
};

export const 브랜드_팔레트 = {
  render: () => {
    const root = section(
      "참조 팔레트 --slds-r-color-brand-* (org가 브랜드 색으로 생성)",
      PALETTE.map((s) => `--slds-r-color-brand-${s}`)
    );
    fillValues(root);
    return root;
  }
};
