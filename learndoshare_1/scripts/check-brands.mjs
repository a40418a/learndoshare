// brands/*/util.css 규칙을 검사한다. 사용: node scripts/check-brands.mjs (pnpm test에 포함)
//  - :root에 --slds-g-* global hook, --slds-s-* 컴포넌트 hook, --milvus-* 변수만 정의한다. 클래스 규칙은 쓰지 않는다
//  - --slds-s-*는 지금 org가 기본 컴포넌트를 synthetic으로 그려서 닿는다(#16). native로 바뀌어도 g·s 구분 없이 상속되지만,
//    기본 컴포넌트의 native CSS가 읽는 이름에만 효과가 남는다(추정, 실측 필요. #18, docs/research/2026-10-08/synthesis.md 0장 5번)
//  - --slds-s-*는 SLDS 2 CSS가 정의하는 이름만, --milvus-*는 밀버스 컴포넌트가 읽는 이름만 쓴다. 오타는 아무 효과 없이 지나가기 때문이다
//  - 브랜드 색 hook은 org Themes and Branding이 원본이다(pnpm sync:theme이 palette로 가져온다)
import { existsSync, readFileSync, readdirSync } from "node:fs";

const BRAND_COLOR =
  /^--slds-(g-color-(accent|on-accent|border-accent|brand-base)|r-color-brand)/;

// 이름에 color가 들어간 컴포넌트 hook은 브랜드 색(accent)에 이어진 것이 많다 (예: --slds-s-button-color)
const COMPONENT_COLOR = /^--slds-s-.*color/;

// SLDS 2 CSS가 정의하는 컴포넌트 hook 이름 (Storybook 영향 지도와 같은 출처).
// 기본 컴포넌트 CSS만 읽는 이름(예: --slds-s-button-font-weight)은 org(synthetic)에서 효과가 없어서 뺀다
const SLDS_S = new Set(
  readFileSync(
    "node_modules/@salesforce-ux/design-system-2/dist/css/bundled/slds2.cosmos.css",
    "utf8"
  ).match(/--slds-s-[\w-]+(?=\s*:)/g)
);

const MILVUS = new Set(
  readdirSync("force-app", { recursive: true })
    .filter((f) => /\.(css|js)$/.test(f) && !f.includes("__tests__"))
    .flatMap(
      (f) =>
        readFileSync(`force-app/${f}`, "utf8").match(/--milvus-[\w-]+/g) ?? []
    )
);

const errors = [];
for (const brand of readdirSync("brands", { withFileTypes: true })) {
  const path = `brands/${brand.name}/util.css`;
  if (!brand.isDirectory() || !existsSync(path)) continue;
  const css = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (selector.trim() !== ":root") {
      errors.push(
        `${path}  "${selector.trim()}": :root만 쓴다. 클래스 규칙은 기본 컴포넌트가 native shadow로 바뀌면 닿지 않는다`
      );
    }
    for (const [, name] of body.matchAll(/(--[\w-]+)\s*:/g)) {
      if (name.startsWith("--milvus-")) {
        if (!MILVUS.has(name))
          errors.push(
            `${path}  ${name}: 이 변수를 읽는 밀버스 컴포넌트가 없다`
          );
      } else if (name.startsWith("--slds-s-")) {
        if (COMPONENT_COLOR.test(name))
          errors.push(
            `${path}  ${name}: 색 컴포넌트 hook은 브랜드 색에 이어진 것이 많다. 색은 org 테마가 원본이다`
          );
        else if (!SLDS_S.has(name))
          errors.push(
            `${path}  ${name}: SLDS 2 CSS가 정의하지 않는 컴포넌트 hook이다 (영향 지도 오른쪽 열의 이름만 쓴다)`
          );
      } else if (!name.startsWith("--slds-g-"))
        errors.push(
          `${path}  ${name}: --slds-g-* global hook과 --slds-s-* 컴포넌트 hook만 쓴다`
        );
      else if (BRAND_COLOR.test(name))
        errors.push(`${path}  ${name}: 브랜드 색은 org 테마가 원본이다`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  "✓ brands 검사: util.css는 :root의 global hook, 컴포넌트 hook, 밀버스 컴포넌트 변수만 정의하고 브랜드 색을 바꾸지 않음"
);
