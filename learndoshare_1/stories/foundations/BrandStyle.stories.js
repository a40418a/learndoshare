import { brands, utilCss } from "../../.storybook/brand.js";

export default {
  title: "Foundations/브랜드 스타일 (util.css)",
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component: `브랜드마다 **\`brands/<브랜드>/util.css\` 파일 하나**로 모든 컴포넌트(\`lightning-*\` 포함)의 모양을 바꾼다. 상단 툴바에서 브랜드를 바꾸면 \`컴포넌트/기본\` 전체가 그 브랜드의 util.css로 그려진다.

- **쓸 수 있는 것은 \`:root\`의 global hook(\`--slds-g-*\`), 컴포넌트 hook(\`--slds-s-*\`), 밀버스 컴포넌트가 읽는 \`--milvus-*\` 변수뿐이다.** 클래스 규칙은 쓰지 않는다
- **global hook**은 같은 hook을 쓰는 컴포넌트 묶음을 함께 바꾼다. 예: \`--slds-g-radius-border-pill\`은 버튼과 뱃지 반경을 함께 바꾼다
- **컴포넌트 hook**은 그 컴포넌트만 바꾼다. 예: \`--slds-s-button-radius-border\`는 버튼 반경만 바꾼다. 쓸 수 있는 이름은 아래 **영향 지도**의 오른쪽 열에 있다. 색 hook(\`--slds-s-*color*\`)은 브랜드 색에 이어진 것이 많아 쓰지 않는다
- 컴포넌트 hook은 지금 org가 \`lightning-*\`를 synthetic shadow로 그려서 닿는다(2026-10-07 org 실측). npm 패키지가 156개를 native shadow 지원으로 지정해 두어 **native로 바뀌면 효과가 사라질 수 있다.** 그때도 유지해야 하는 모양은 밀버스 컴포넌트(\`--milvus-*\`)로 만든다 (예: \`컴포넌트/밀버스 추가/Button\`)
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
      "SLDS 2 CSS에서 자동으로 읽은 표 (색 hook 제외). 왼쪽 global hook을 util.css에서 바꾸면 오른쪽 컴포넌트 속성이 함께 바뀐다. 오른쪽 이름(--slds-s-<이름>)을 util.css에 직접 넣으면 그 컴포넌트 속성만 바뀐다.";
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
