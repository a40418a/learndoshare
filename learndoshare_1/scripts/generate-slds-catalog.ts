/**
 * lightning-base-components에 들어 있는 Salesforce 공식 예제(src/lightning/<컴포넌트>/__examples__)를
 * Storybook "컴포넌트/기본" 섹션으로 만든다. 예제를 직접 쓰지 않고 공식 예제를 그대로 컴파일한다.
 *
 * 만드는 것 (출력 폴더, 저장소에서는 stories/slds-catalog/, 커밋하지 않음):
 *   examples.json      Rollup alias 목록 { name, rel } (scripts/build-lwc.ts가 읽는다)
 *   entry.js           Rollup 진입 파일 → @milvus/lwc/catalog.js
 *   <Name>.stories.js  컴포넌트마다 스토리 파일 (예제 하나 = 스토리 하나, Show code = 예제 HTML 원본)
 *
 * 결과에는 개발자 PC의 절대 경로와 node_modules/ 경로를 넣지 않는다. 패키지에 넣어 다른 프로젝트에서도 쓴다
 *   rel                lightning-base-components/src/lightning 기준 상대 경로. 빌드할 때 절대 경로로 바꾼다
 *   ?raw import        bare specifier (lightning-base-components/src/lightning/...)
 *   LWC 번들           @milvus/lwc (Storybook alias)
 *
 * 사용: pnpm build:lwc 가 먼저 실행하고, prepack이 패키지에 넣을 카탈로그를 만든다.
 *   node scripts/generate-slds-catalog.ts [출력 폴더]   (기본 stories/slds-catalog)
 */
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { lightningBaseComponentsDir } from "../lib/lwc-build.ts";

type Example = {
  comp: string;
  example: string;
  module: string;
  tag: string;
  exportName: string;
  rel: string;
  html: string;
  story: boolean;
};

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const title = (s: string) =>
  kebab(s)
    .split("-")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
// 예제 이름에 default, if 같은 예약어가 있어 export 이름으로 그대로 쓸 수 없다
const RESERVED = new Set([
  "default", "if", "for", "new", "class", "delete", "in", "do", "switch", "case", "with", "var", "let", "const",
  "function", "return", "import", "export", "this", "super", "null", "true", "false", "typeof", "void", "while",
  "try", "catch", "finally", "throw", "break", "continue", "enum", "await", "yield", "static", "extends", "instanceof"
]);
const ident = (s: string) => {
  const id = s.replace(/[^A-Za-z0-9]/g, "_").replace(/^(\d)/, "_$1");
  return RESERVED.has(id) ? `${id}Example` : id;
};

class UnsafeOutputError extends Error {}

// 출력 폴더를 지워도 되는 경우만 통과시킨다. 없거나 비었거나 이 생성기가 만든 폴더(examples.json이 있음)여야 한다
function assertErasable(dir: string): void {
  if (!existsSync(dir) || existsSync(join(dir, "examples.json"))) return;
  if (statSync(dir).isDirectory() && readdirSync(dir).length === 0) return;
  throw new UnsafeOutputError(`출력 위치가 비어 있지 않고 카탈로그 생성기가 만든 폴더(examples.json이 있는 폴더)도 아니다. 지우지 않는다: ${dir}`);
}

export function generateCatalog(o: { lbcDir: string; outStories: string }): { components: number; examples: number } {
  const { lbcDir, outStories: out } = o;
  const examples: Example[] = [];
  for (const comp of readdirSync(lbcDir).sort()) {
    const dir = `${lbcDir}/${comp}/__examples__`;
    // primitive*, *Private는 Salesforce 내부용이다. org의 커스텀 컴포넌트에서 쓸 수 없으므로 카탈로그에서 뺀다
    if (!existsSync(dir) || comp.startsWith("primitive") || comp.endsWith("Private")) continue;
    for (const ex of readdirSync(dir, { withFileTypes: true })) {
      if (!ex.isDirectory() || !existsSync(`${dir}/${ex.name}/${ex.name}.js`)) continue;
      // 공식 예제끼리는 "<컴포넌트 소문자>/<예제>" 이름으로 서로 import한다 (예: overlay/alert). 같은 규칙을 쓴다
      const ns = comp.toLowerCase();
      examples.push({
        comp,
        example: ex.name,
        module: `${ns}/${ex.name}`,
        tag: `${ns}-${kebab(ex.name)}`,
        exportName: `${comp}${ex.name[0].toUpperCase()}${ex.name.slice(1)}`,
        rel: `${comp}/__examples__/${ex.name}/${ex.name}.js`,
        html: `${comp}/__examples__/${ex.name}/${ex.name}.html`,
        // html이 없는 예제(context/provider 등)는 다른 예제가 import하는 보조 모듈이다. 별칭만 등록하고 스토리는 만들지 않는다
        story: existsSync(`${dir}/${ex.name}/${ex.name}.html`)
      });
    }
  }

  assertErasable(out);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "examples.json"), JSON.stringify(examples.map(({ module, rel }) => ({ name: module, rel })), null, 2));
  writeFileSync(join(out, "entry.js"), examples.map((e) => `export { default as ${e.exportName} } from "${e.module}";`).join("\n") + "\n");

  const byComp = Map.groupBy(examples.filter((e) => e.story), (e) => e.comp);
  for (const [comp, list] of byComp) {
    const tagName = `lightning-${kebab(comp)}`;
    const lines = [
      `// 자동 생성 파일: scripts/generate-slds-catalog.ts. 직접 고치지 않는다.`,
      `import { createElement } from "@milvus/lwc/index.js";`,
      `import * as ex from "@milvus/lwc/catalog.js";`,
      ...list.map((e, i) => `import html${i} from "lightning-base-components/src/lightning/${e.html}?raw";`),
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
    writeFileSync(join(out, `${title(comp).replace(/ /g, "")}.stories.js`), lines.join("\n") + "\n");
  }
  return { components: byComp.size, examples: [...byComp.values()].flat().length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2] ?? "stories/slds-catalog";
  try {
    const { components, examples } = generateCatalog({ lbcDir: lightningBaseComponentsDir(), outStories: resolve(out) });
    console.log(`✓ SLDS 카탈로그: 컴포넌트 ${components}개, 공식 예제 ${examples}개 → ${out}/`);
  } catch (e) {
    // 출력 위치를 지울 수 없는 경우만 한국어 오류로 끝낸다. 그 밖의 오류는 스택과 함께 그대로 낸다
    if (!(e instanceof UnsafeOutputError)) throw e;
    console.error(e.message);
    process.exitCode = 1;
  }
}
