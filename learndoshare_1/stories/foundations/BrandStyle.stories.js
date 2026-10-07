import { brands, utilCss } from "../../.storybook/brand.js";

export default {
  title: "Foundations/브랜드 스타일 (util.css)",
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component: `브랜드마다 **\`brands/<브랜드>/util.css\` 파일 하나**로 모든 컴포넌트(\`lightning-*\` 포함)의 모양을 바꾼다. 상단 툴바에서 브랜드를 바꾸면 \`컴포넌트/기본\` 전체가 그 브랜드의 util.css로 그려진다.

- **쓸 수 있는 것은 \`:root\`의 SLDS 2 global hook(\`--slds-g-*\`)과 밀버스 컴포넌트가 읽는 \`--milvus-*\` 변수뿐이다.** \`lightning-button\`·\`-input\` 같은 Salesforce 기본 컴포넌트 다수(패키지가 지정한 156개)는 native shadow DOM으로 그려져서, \`.slds-button\` 같은 클래스 규칙이나 컴포넌트 hook(\`--slds-c-*\`·\`--sds-c-*\`·\`--slds-s-*\`)은 안으로 들어가지 못한다. 상속되는 global hook만 닿는다 (Storybook 실측, org 화면은 미확인)
- 그래도 global hook마다 영향을 주는 컴포넌트 묶음이 달라서 묶음별 조절은 된다. 아래 **영향 지도**를 보고 고른다. 예: 버튼 반경은 \`--slds-g-radius-border-pill\`, 입력창은 \`-2\`, 카드는 \`-4\`
- 특정 컴포넌트 하나만 따로 바꾸는 것은 기본 컴포넌트로는 안 된다. 그런 요구는 밀버스 컴포넌트로 만들고, 그 컴포넌트가 읽는 \`--milvus-*\` 변수를 util.css에 넣는다 (예: \`--milvus-button-*\` → \`컴포넌트/밀버스 추가/Button\`)
- **브랜드 색은 바꾸지 않는다.** 색은 org Themes and Branding이 원본이고 \`pnpm sync:theme\`이 가져온다. \`pnpm test\`가 util.css 규칙을 검사한다
- **공식 권고 밖이다.** SLDS는 global hook 재정의를 권하지 않는다. Salesforce 릴리스마다 Storybook과 org 화면을 다시 확인한다
- org에서는 util.css를 정적 리소스로 올려 \`loadStyle\`로 문서에 넣는다. 이때 **같은 화면의 표준 Salesforce UI에도 적용된다**`
      }
    }
  }
};

export const 현재_브랜드 = {
  render: () => {
    const name = document.documentElement.dataset.milvusBrand;
    const css = utilCss[name];
    const root = document.createElement("div");
    root.className = "sb-stack";
    const title = document.createElement("p");
    title.className = "slds-text-title_caps";
    title.textContent = css
      ? `brands/${name}/util.css`
      : `${brands[name]?.label ?? name}: util.css 없음 → SLDS 2 기본 모양`;
    root.append(title);
    if (css) {
      const pre = document.createElement("pre");
      pre.className = "sb-code";
      pre.textContent = css.trim();
      root.append(pre);
    }
    return root;
  }
};

// SLDS 2 CSS의 컴포넌트 공유 hook(--slds-s-<컴포넌트>-<속성>: var(--slds-g-…))을 읽어
// "global hook → 영향받는 컴포넌트 속성" 표를 만든다. SLDS 버전이 바뀌어도 자동으로 따라간다
function influenceMap() {
  const map = new Map();
  for (const sheet of document.styleSheets) {
    let text = "";
    try {
      text = [...sheet.cssRules].map((r) => r.cssText).join(" ");
    } catch {
      continue;
    }
    for (const [, shared, value] of text.matchAll(
      /--slds-s-([a-z0-9-]+)\s*:\s*([^;]+)/g
    )) {
      for (const [, global] of value.matchAll(
        /var\((--slds-g-(?!color)[a-z0-9-]+)/g
      )) {
        if (!map.has(global)) map.set(global, new Set());
        map.get(global).add(shared);
      }
    }
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export const 영향_지도 = {
  name: "영향 지도 (global hook → 컴포넌트)",
  render: () => {
    const wrap = document.createElement("div");
    const note = document.createElement("p");
    note.className = "slds-text-body_small slds-m-bottom_small";
    note.textContent =
      "SLDS 2 CSS에서 자동으로 읽은 표. 왼쪽 hook을 util.css에서 바꾸면 오른쪽 컴포넌트 속성이 함께 바뀐다 (색 hook 제외).";
    const table = document.createElement("table");
    table.className = "slds-table slds-table_bordered slds-table_cell-buffer";
    table.innerHTML =
      '<thead><tr><th scope="col">global hook</th><th scope="col">영향받는 컴포넌트 속성 (--slds-s-*)</th></tr></thead>';
    const body = document.createElement("tbody");
    for (const [global, shared] of influenceMap()) {
      const row = document.createElement("tr");
      const a = document.createElement("td");
      a.innerHTML = `<code>${global}</code>`;
      const b = document.createElement("td");
      b.className = "slds-cell-wrap";
      b.textContent = [...shared].sort().join(", ");
      row.append(a, b);
      body.append(row);
    }
    table.append(body);
    wrap.append(note, table);
    return wrap;
  }
};
