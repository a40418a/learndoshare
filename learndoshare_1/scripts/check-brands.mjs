// brands/*/util.css 규칙을 검사한다. 사용: node scripts/check-brands.mjs (pnpm test에 포함)
//  - :root에 --slds-g-* global hook과 --milvus-* 변수만 정의한다. 지금 org는 기본 컴포넌트를 synthetic으로 그리지만,
//    native shadow로 바뀌면 클래스 규칙이나 컴포넌트 hook(--slds-c-*, --sds-c-*, --slds-s-*)은 안으로 들어가지 못한다
//  - --milvus-*는 밀버스 컴포넌트(force-app)가 실제로 읽는 이름만 쓴다. 오타는 아무 효과 없이 지나가기 때문이다
//  - 브랜드 색 hook은 org Themes and Branding이 원본이다(pnpm sync:theme이 palette로 가져온다)
import { existsSync, readFileSync, readdirSync } from "node:fs";

const BRAND_COLOR =
  /^--slds-(g-color-(accent|on-accent|border-accent|brand-base)|r-color-brand)/;

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
      } else if (!name.startsWith("--slds-g-"))
        errors.push(
          `${path}  ${name}: --slds-g-* global hook만 native shadow 안까지 닿는다`
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
  "✓ brands 검사: util.css는 :root의 global hook과 밀버스 컴포넌트 변수만 정의하고 브랜드 색을 바꾸지 않음"
);
