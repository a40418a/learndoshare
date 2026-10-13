/**
 * lightning-base-components에 들어 있는 Salesforce 공식 예제(src/lightning/<컴포넌트>/__examples__)를
 * Storybook "컴포넌트/기본" 섹션으로 만든다. 예제를 직접 쓰지 않고 공식 예제를 그대로 컴파일한다.
 *
 * 만드는 것 (출력 폴더, 저장소에서는 stories/slds-catalog/, 커밋하지 않음):
 *   examples.json      Rollup alias 목록 { name, rel } (scripts/build-lwc.ts가 읽는다)
 *   entry.js           Rollup 진입 파일 → @milvus/lwc/catalog.js
 *   <Name>.stories.js  컴포넌트마다 스토리 파일 (예제 하나 = 스토리 하나, Show code = 예제 HTML 원본)
 *                      마지막 스토리 "원본과 hook"(설계 9.5): 정적 반영 검사(scripts/audit)를 여기서 다시 돌려 만든 요약·hook 표·빈틈 표와
 *                      Salesforce 원본 파일. 그리는 코드는 stories/salesforce-source.js다
 *   hook-info.js       hook마다 페이지와 상관없는 정보(종류, 이어지는 hook, 기본값, util.css 허용, 명세 항목). 모든 스토리가 함께 읽는다
 *
 * 결과에는 개발자 PC의 절대 경로와 node_modules/ 경로를 넣지 않는다. 패키지에 넣어 다른 프로젝트에서도 쓴다
 *   rel                lightning-base-components/src/lightning 기준 상대 경로. 빌드할 때 절대 경로로 바꾼다
 *   ?raw import        bare specifier (lightning-base-components/src/lightning/..., @salesforce-ux/design-system-2/dist/components/...).
 *                      원본은 생성 파일에 넣지 않고 Storybook이 빌드할 때 읽는다. 원본 절을 열 때 불러온다(동적 import)
 *   LWC 번들           @milvus/lwc (Storybook alias)
 *
 * 사용: pnpm build:lwc 가 먼저 실행하고, prepack이 패키지에 넣을 카탈로그를 만든다.
 *   node scripts/generate-slds-catalog.ts [출력 폴더]   (기본 stories/slds-catalog)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { list as cssList, parse, type AtRule, type Rule } from "postcss";
import { FIXED_ITEMS } from "../lib/fixed-list.ts";
import { buildHooksIndex } from "../lib/hooks-index.ts";
import { lightningBaseComponentsDir } from "../lib/lwc-build.ts";
import { declProblem, LBC_ONLY_G } from "../lib/rules.ts";
import { SPEC_ITEMS } from "../lib/spec-items.ts";
import { blueprintOf, classify } from "./audit/classify.ts";
import { fixedItemsOf, judge, modesOf, RANK, type Judged, type Mode, type Status } from "./audit/report.ts";
import { readSources } from "./audit/run.ts";

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

// ── 원본과 hook 보기 (설계 9.5) ──────────────────────────────────────────────

/** 선언 하나가 읽는 변수. at은 "선택자 { 속성 }"(선택자 목록은 첫 부분만) */
type Read = { name: string; at: string; modes: Mode[] };
type Audit = {
  judged: Judged[];
  reads: Map<string, Read[]>; // "slds2 <블루프린트>" | "lbc <폴더>"
  next: Map<string, string>; // var(--a, var(--b))의 a → b (처음 본 것)
  lbcBlueprints: Map<string, Set<string>>; // 기본 컴포넌트 폴더 CSS의 규칙이 쓰는 블루프린트
  sldsBlueprints: Set<string>;
  sldsFiles: Map<string, Set<string>>; // 블루프린트 → SLDS 2 컴포넌트 CSS(dist/components 기준)
  hookDefs: Map<string, string>; // SLDS 2 :where(html)의 hook 기본값
  defined: Set<string>; // 어디서든 정의되는 변수
  nativeList: string[];
  utilCtx: Parameters<typeof declProblem>[2];
  iconColors: number;
};

// 설계 9.2: native에서만 메울 수 있어 준비만 하고 금지를 유지하는 c hook
const C_HOOK_CANDIDATES = [
  "--slds-c-card-shadow",
  "--slds-c-tooltip-color-background",
  "--slds-c-tooltip-text-color",
  "--slds-c-tooltip-font-size",
  "--slds-c-badge-radius-border",
  "--slds-c-checkbox-toggle-radius-border",
  "--slds-c-pill-radius-border",
  "--slds-c-input-sizing-border",
  "--slds-c-modalheader-heading-font-size",
  "--slds-c-modalfooter-shadow",
  "--slds-c-pill-sizing-border",
];
// ponytail: util.css 허용은 이름으로 정해지고 값은 형식만 본다. 형식 규칙(중립 색은 light-dark, 색 s hook은 중립 g 참조, 배경막 짝)을 통과하는 견본 값 중 하나라도 되면 "예"다
const UTIL_SAMPLES = ["0", "light-dark(#fff, #000)", "var(--slds-g-color-surface-container-2)", "var(--slds-g-color-neutral-10-opacity-50)"];
const oneSpace = (s: string) => s.replace(/\s+/g, " ").trim();

function readAudit(): Audit {
  const src = readSources();
  const index = buildHooksIndex({ sldsCss: src.sldsCss, lbcCss: src.lbcFiles.map((f) => f.css) });
  const a: Audit = {
    judged: judge(classify(src), SPEC_ITEMS, src.bridgeCss, FIXED_ITEMS),
    reads: new Map(),
    next: new Map(),
    lbcBlueprints: new Map(),
    sldsBlueprints: new Set(),
    sldsFiles: new Map(),
    hookDefs: new Map(),
    defined: new Set(),
    nativeList: src.nativeList,
    utilCtx: { readSHooks: new Set(index.readSHooks), readGHooks: new Set(index.readGHooks), milvusVars: new Set() },
    iconColors: 0,
  };
  const scan = (css: string, s: "slds2" | "lbc", file: string, keyOf: (selector: string) => string) =>
    parse(css).walkDecls((d) => {
      const parent = d.parent as Rule | AtRule;
      const selector = parent.type === "rule" ? oneSpace(parent.selector) : `@${parent.name}`;
      if (d.prop.startsWith("--")) {
        a.defined.add(d.prop);
        if (selector === ":where(html)") a.hookDefs.set(d.prop, oneSpace(d.value));
      }
      // 이어지는 이름: var(--a, var(--b ...))의 a → b. 겹쳐 찾도록 뒤쪽 var(는 앞보기로만 본다
      for (const [, from, to] of d.value.matchAll(/var\(\s*(--[\w-]+)\s*,\s*(?=var\(\s*(--[\w-]+))/g)) if (!a.next.has(from)) a.next.set(from, to);
      const modes = modesOf({ src: s, file, selector });
      const comp = keyOf(selector);
      if (s === "slds2") a.sldsBlueprints.add(comp);
      const list = a.reads.get(`${s} ${comp}`) ?? [];
      const at = `${cssList.comma(selector)[0]} { ${d.prop} }`;
      for (const [, name] of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) list.push({ name, at, modes });
      a.reads.set(`${s} ${comp}`, list);
    });
  scan(src.sldsCss, "slds2", "slds2.cosmos.css", blueprintOf);
  for (const f of src.lbcFiles) {
    scan(f.css, "lbc", f.file, () => f.comp);
    const set = a.lbcBlueprints.get(f.comp) ?? new Set<string>();
    parse(f.css).walkRules((r) => void set.add(blueprintOf(r.selector)));
    a.lbcBlueprints.set(f.comp, set);
  }

  // SLDS 2 컴포넌트 CSS(원본 탭). 최상위 규칙의 블루프린트로 묶는다. 정적 검사는 같은 내용을 합친 slds2.cosmos.css를 읽는다
  const req = createRequire(import.meta.url);
  const slds = dirname(req.resolve("@salesforce-ux/design-system-2/package.json"));
  const comps = join(slds, "dist/components");
  for (const dir of readdirSync(comps).sort()) {
    for (const f of readdirSync(join(comps, dir)).filter((f) => f.endsWith(".css")).sort()) {
      parse(readFileSync(join(comps, dir, f), "utf8")).each((n) => {
        if (n.type !== "rule") return;
        const b = blueprintOf(n.selector);
        a.sldsFiles.set(b, (a.sldsFiles.get(b) ?? new Set()).add(`${dir}/${f}`));
      });
    }
  }
  // JS에 박힌 개체 아이콘 색(설계 9.5). CSS 정적 검사에는 보이지 않는다
  const lbc = dirname(req.resolve("lightning-base-components/package.json"));
  a.iconColors = (readFileSync(join(lbc, "src/lightning/iconUtils/iconColors.js"), "utf8").match(/"rgb\(/g) ?? []).length;
  return a;
}

function hookKind(name: string, a: Audit): string {
  if (name.startsWith("--slds-s-")) return "s";
  if (/^--(slds|sds)-c-/.test(name)) return "c";
  if (LBC_ONLY_G.includes(name)) return "기본 컴포넌트 전용";
  if (name.startsWith("--slds-g-") && a.hookDefs.has(name)) return "g";
  return a.defined.has(name) ? "내부 전용" : "정의 없음";
}

// light-dark(라이트, 다크). 괄호는 한 겹까지 본다
const LIGHT_DARK = /^light-dark\(((?:[^(),]|\([^()]*\))+),\s*((?:[^(),]|\([^()]*\))+)\)$/;

// 이유는 lib/rules.ts 메시지의 첫 문장이다(앞의 이름은 뗀다)
const utilVerdict = (name: string, a: Audit) =>
  UTIL_SAMPLES.some((v) => !declProblem(name, v, a.utilCtx)) ? "예" : `아니요: ${declProblem(name, "0", a.utilCtx)![1].replace(/^[^:]+: /, "").split(". ")[0]}`;

/** 페이지와 상관없는 hook 정보. 모든 페이지가 hook-info.js 하나를 함께 읽는다(같은 hook이 여러 페이지에 나온다) */
function hookInfo(name: string, a: Audit) {
  const def = a.hookDefs.get(name);
  const ld = def && LIGHT_DARK.exec(def);
  const kind = hookKind(name, a);
  return {
    kind,
    // 이어지는 hook은 c → s → g 사슬에서만 적는다. g 뒤의 fallback(--lwc-* 등)은 hook이 아니다
    next: kind === "s" || kind === "c" ? a.next.get(name) : undefined,
    light: ld ? ld[1].trim() : def,
    dark: ld ? ld[2].trim() : def,
    util: utilVerdict(name, a),
    items: SPEC_ITEMS.filter((i) => i.hooks.includes(name)).map((i) => i.label),
  };
}

const itemLabel = (id: string) => SPEC_ITEMS.find((i) => i.id === id)?.label ?? id;

/** 컴포넌트 페이지 하나의 데이터. 기본 컴포넌트 폴더의 CSS와, 그 CSS가 쓰는 SLDS 블루프린트의 SLDS 2 선언을 함께 본다 */
function viewOf(comp: string, tag: string, a: Audit) {
  // 폴더 이름이 그대로 블루프린트 이름이면(input, card) 그 블루프린트도 넣는다. report.json도 두 출처를 같은 키로 센다
  const own = a.lbcBlueprints.get(comp) ?? new Set<string>();
  const blueprints = [...own, kebab(comp)].filter((b, i, all) => b !== "(global)" && a.sldsBlueprints.has(b) && all.indexOf(b) === i).sort();
  const mine = (d: { src: string; comp: string }) => (d.src === "lbc" ? d.comp === comp : blueprints.includes(d.comp));
  const judged = a.judged.filter((j) => mine(j.d));

  const cell = (item: string, mode: Mode) => {
    const all = judged.filter((j) => j.item === item && j.mode === mode).map((j) => j.status);
    const n = (s: Status) => all.filter((x) => x === s).length;
    const [reached, bridge, fixed, gap] = [n("reached"), n("bridge"), n("fixed"), n("gap")];
    const status = all.reduce<Status>((w, s) => (RANK.indexOf(s) > RANK.indexOf(w) ? s : w), "n/a");
    const label = !all.length ? "해당 없음" : !(fixed + gap) ? "반영" : !(reached + bridge) ? "안 됨" : "일부";
    return { status, label, counts: { reached, bridge, fixed, gap } };
  };
  const summary = SPEC_ITEMS.filter((i) => judged.some((j) => j.item === i.id)).map((i) => ({
    item: i.id,
    label: i.label,
    now: cell(i.id, "now"),
    native: cell(i.id, "native"),
  }));

  const reads = [...(a.reads.get(`lbc ${comp}`) ?? []), ...blueprints.flatMap((b) => a.reads.get(`slds2 ${b}`) ?? [])];
  // 읽는 곳: 모드마다 곳 수와 첫 곳. ponytail: 생성 파일 크기 때문에 첫 곳만 넣는다. 나머지는 원본 탭에서 hook 이름으로 찾는다
  const hooks = [...Map.groupBy(reads, (r) => r.name)]
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([name, rs]) => {
      const at = (mode: Mode) => [...new Set(rs.filter((r) => r.modes.includes(mode)).map((r) => r.at))];
      const [now, native] = [at("now"), at("native")];
      return { name, now: now.length, nowAt: now[0] ?? "", native: native.length, nativeAt: native[0] ?? "" };
    });

  const how = (j: Judged) => {
    if (j.status === "bridge") {
      const vars = SPEC_ITEMS.find((i) => i.id === j.item)?.bridgeVars ?? [];
      return `브리지${vars.length ? ` (${vars.join(", ")})` : ""}`;
    }
    if (j.status === "gap") return "빈틈: 9.4 고정 목록에 없다(사용자 합의 필요)";
    const labels = fixedItemsOf(j.d, FIXED_ITEMS).filter((f) => j.mode === "native" || f.mode === "both").map((f) => f.label);
    const cHooks = C_HOOK_CANDIDATES.filter((c) => new RegExp(`${c}(?![\\w-])`).test(j.d.value));
    return `Salesforce 고정${labels.length ? `: ${labels.join(", ")}` : ""}${cHooks.length ? ` · c hook 후보 ${cHooks.join(", ")}(설계 9.2, 지금은 쓰지 않음)` : ""}`;
  };
  const gaps = judged
    .filter((j) => j.status !== "reached")
    .map((j) => {
      // 선택자 목록은 첫 부분만 적는다. 정확한 자리는 파일:줄이다
      const parts = cssList.comma(j.d.selector);
      const selector = parts.length > 1 ? `${parts[0]} 외 ${parts.length - 1}개` : parts[0];
      return { prop: j.d.prop, value: j.d.value, selector, at: `${basename(j.d.file)}:${j.d.line}`, mode: j.mode, item: itemLabel(j.item), how: how(j) };
    });

  // JS에 박힌 값은 CSS 정적 검사에 보이지 않아 따로 적는다(설계 9.5). 카탈로그에 있는 것은 개체 아이콘 색을 쓰는 icon·avatar다
  const ICON_JS = `lightning/iconUtils의 iconColors.js에 개체 아이콘 배경색 ${a.iconColors}개가 박혀 있다`;
  const js =
    comp === "icon"
      ? [`${ICON_JS}. icon.js가 인라인 스타일 --sds-c-icon-color-background: var(--slds-c-icon-color-background, <색>)으로 넣는다. 메우는 방법: 브리지가 클래스마다 --slds-c-icon-color-background를 정의한다(--milvus-icon-*, 지금만)`]
      : comp === "avatar"
        ? [`${ICON_JS}. avatar.js가 대체 아이콘 이니셜 배경을 background-color: var(--slds-c-icon-color-background, <색>)으로 넣는다. 메우는 방법: 브리지(--milvus-icon-*, 지금만)`]
        : [];

  return {
    tag,
    folder: comp,
    blueprints,
    native: a.nativeList.includes(tag),
    summary,
    hooks,
    gaps,
    js,
  };
}

/** 원본 탭에 보일 파일(bare specifier): 기본 컴포넌트 폴더의 html·js·css(native용 *.slds.css 포함)와 블루프린트의 SLDS 2 컴포넌트 CSS */
const sourcesOf = (lbcDir: string, comp: string, blueprints: string[], a: Audit) => [
  ...readdirSync(join(lbcDir, comp))
    .filter((f) => /\.(html|js|css)$/.test(f))
    .sort()
    .map((f) => `lightning-base-components/src/lightning/${comp}/${f}`),
  ...[...new Set(blueprints.flatMap((b) => [...(a.sldsFiles.get(b) ?? [])]))].sort().map((f) => `@salesforce-ux/design-system-2/dist/components/${f}`),
];

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
  const audit = readAudit();
  const hookNames = new Set<string>();
  for (const [comp, list] of byComp) {
    const tagName = `lightning-${kebab(comp)}`;
    const view = viewOf(comp, tagName, audit);
    view.hooks.forEach((h) => hookNames.add(h.name));
    const lines = [
      `// 자동 생성 파일: scripts/generate-slds-catalog.ts. 직접 고치지 않는다.`,
      `import { createElement } from "@milvus/lwc/index.js";`,
      `import * as ex from "@milvus/lwc/catalog.js";`,
      `import { sourceAndHooks } from "../salesforce-source.js";`,
      `import hookInfo from "./hook-info.js";`,
      ...list.map((e, i) => `import html${i} from "lightning-base-components/src/lightning/${e.html}?raw";`),
      ``,
      `const view = ${JSON.stringify(view)};`,
      `const sources = [`,
      ...sourcesOf(o.lbcDir, comp, view.blueprints, audit).map((f) => `  [${JSON.stringify(f)}, () => import(${JSON.stringify(`${f}?raw`)})],`),
      `];`,
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
      ),
      ``,
      `export const SourceAndHooks = {`,
      `  name: "원본과 hook",`,
      `  render: () => sourceAndHooks(view, sources, hookInfo),`,
      `  parameters: { docs: { codePanel: false, canvas: { sourceState: "none" } } }`,
      `};`
    ];
    writeFileSync(join(out, `${title(comp).replace(/ /g, "")}.stories.js`), lines.join("\n") + "\n");
  }
  const info = Object.fromEntries([...hookNames].sort().map((n) => [n, hookInfo(n, audit)]));
  writeFileSync(join(out, "hook-info.js"), `// 자동 생성 파일: scripts/generate-slds-catalog.ts. hook마다 종류·이어지는 hook·기본값·util.css 허용·명세 항목\nexport default ${JSON.stringify(info)};\n`);
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
