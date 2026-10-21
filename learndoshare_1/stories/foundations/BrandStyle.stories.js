import { brands, mode } from "../../.storybook/brand.ts";

export default {
  title: "Foundations/브랜드 스타일 (util.css)",
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        component: `브랜드 모양(모서리, 간격, 글자, 그림자 등)은 파일 하나(\`milvusBrand.css\`)로 모든 컴포넌트에 함께 적용됩니다.

- 직접 고치지 말고 **시작하기 / 브랜드 명세**에 적은 뒤 Claude Code에 반영을 맡기세요.
- 브랜드 색은 이 파일이 아니라 org 테마에서 바뀝니다.
- 아래 **영향 지도**에서 값 하나가 어느 컴포넌트에 닿는지 볼 수 있습니다.`
      }
    }
  }
};

export const 현재_브랜드 = {
  render: () => {
    const name = document.documentElement.dataset.milvusBrand;
    const brand = brands.find((b) => b.name === name);
    const css = brand?.utilCss;
    const root = document.createElement("div");
    root.className = "sb-stack";
    const title = document.createElement("p");
    title.className = "slds-text-title_caps";
    title.textContent = css
      ? mode === "project"
        ? "force-app/main/default/staticresources/milvusBrand.css"
        : `brands/${name}/util.css`
      : `${brand?.label ?? name}: util.css 없음 → SLDS 2 기본 모양`;
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
      "왼쪽 값을 바꾸면 오른쪽 컴포넌트가 함께 바뀝니다.";
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
