#!/usr/bin/env node
/**
 * lightning-base-components에 들어 있는 Salesforce 공식 예제(src/lightning/<컴포넌트>/__examples__)를
 * Storybook "컴포넌트/기본" 섹션으로 만든다. 예제를 직접 쓰지 않고 공식 예제를 그대로 컴파일한다.
 *
 * 만드는 것 (stories/slds-catalog/, 커밋하지 않음):
 *   examples.json      Rollup alias 목록 (rollup.lwc.config.mjs가 읽는다)
 *   entry.js           Rollup 진입 파일 → dist/lwc/catalog.js
 *   <Name>.stories.js  컴포넌트마다 스토리 파일 (예제 하나 = 스토리 하나, Show code = 예제 HTML 원본)
 *
 * 사용: pnpm build:lwc 가 먼저 실행한다.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { resolve } from "node:path";

const SRC = "node_modules/lightning-base-components/src/lightning";
const OUT = "stories/slds-catalog";

const kebab = (s) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const title = (s) =>
  kebab(s)
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
// 예제 이름에 default, if 같은 예약어가 있어 export 이름으로 그대로 쓸 수 없다
const RESERVED = new Set([
  "default",
  "if",
  "for",
  "new",
  "class",
  "delete",
  "in",
  "do",
  "switch",
  "case",
  "with",
  "var",
  "let",
  "const",
  "function",
  "return",
  "import",
  "export",
  "this",
  "super",
  "null",
  "true",
  "false",
  "typeof",
  "void",
  "while",
  "try",
  "catch",
  "finally",
  "throw",
  "break",
  "continue",
  "enum",
  "await",
  "yield",
  "static",
  "extends",
  "instanceof"
]);
const ident = (s) => {
  const id = s.replace(/[^A-Za-z0-9]/g, "_").replace(/^(\d)/, "_$1");
  return RESERVED.has(id) ? `${id}Example` : id;
};

const examples = [];
for (const comp of readdirSync(SRC).sort()) {
  const dir = `${SRC}/${comp}/__examples__`;
  // primitive*, *Private는 Salesforce 내부용이다. org의 커스텀 컴포넌트에서 쓸 수 없으므로 카탈로그에서 뺀다
  if (
    !existsSync(dir) ||
    comp.startsWith("primitive") ||
    comp.endsWith("Private")
  )
    continue;
  for (const ex of readdirSync(dir, { withFileTypes: true })) {
    if (!ex.isDirectory() || !existsSync(`${dir}/${ex.name}/${ex.name}.js`))
      continue;
    // 공식 예제끼리는 "<컴포넌트 소문자>/<예제>" 이름으로 서로 import한다 (예: overlay/alert). 같은 규칙을 쓴다
    const ns = comp.toLowerCase();
    const name = `${comp}${ex.name[0].toUpperCase()}${ex.name.slice(1)}`;
    examples.push({
      comp,
      example: ex.name,
      module: `${ns}/${ex.name}`,
      tag: `${ns}-${kebab(ex.name)}`,
      exportName: `${name}`,
      path: resolve(dir, ex.name, `${ex.name}.js`),
      html: `${dir}/${ex.name}/${ex.name}.html`,
      // html이 없는 예제(context/provider 등)는 다른 예제가 import하는 보조 모듈이다. 별칭만 등록하고 스토리는 만들지 않는다
      story: existsSync(`${dir}/${ex.name}/${ex.name}.html`)
    });
  }
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeFileSync(
  `${OUT}/examples.json`,
  JSON.stringify(
    examples.map(({ module, path }) => ({ name: module, path })),
    null,
    2
  )
);
writeFileSync(
  `${OUT}/entry.js`,
  examples
    .map((e) => `export { default as ${e.exportName} } from "${e.module}";`)
    .join("\n") + "\n"
);

const byComp = Object.groupBy(
  examples.filter((e) => e.story),
  (e) => e.comp
);
for (const [comp, list] of Object.entries(byComp)) {
  const tagName = `lightning-${kebab(comp)}`;
  const lines = [
    `// 자동 생성 파일: scripts/generate-slds-catalog.mjs. 직접 고치지 않는다.`,
    `import { createElement } from "../../dist/lwc/index.js";`,
    `import * as ex from "../../dist/lwc/catalog.js";`,
    ...list.map((e, i) => `import html${i} from "../../${e.html}?raw";`),
    ``,
    `export default {`,
    `  title: "컴포넌트/기본/${title(comp)}",`,
    `  parameters: {`,
    `    controls: { disable: true },`,
    `    docs: {`,
    `      description: {`,
    `        component: ${JSON.stringify(
      `> **Salesforce 공식 예제** · \`${tagName}\`. npm \`lightning-base-components\`에 들어 있는 예제를 그대로 렌더한다. Show code는 예제의 HTML 원본이다.\n\n공식 문서: [${tagName}](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/${tagName}.html)`
    )}`,
    `      }`,
    `    }`,
    `  }`,
    `};`,
    ``,
    ...list.map(
      (e, i) =>
        `export const ${ident(e.example)} = {\n` +
        `  name: ${JSON.stringify(e.example)},\n` +
        `  render: () => createElement(${JSON.stringify(e.tag)}, { is: ex.${e.exportName} }),\n` +
        `  parameters: { docs: { source: { code: html${i}, language: "html" } } }\n` +
        `};`
    )
  ];
  writeFileSync(
    `${OUT}/${title(comp).replace(/ /g, "")}.stories.js`,
    lines.join("\n") + "\n"
  );
}

console.log(
  `✓ SLDS 카탈로그: 컴포넌트 ${Object.keys(byComp).length}개, 공식 예제 ${Object.values(byComp).flat().length}개 → ${OUT}/`
);
