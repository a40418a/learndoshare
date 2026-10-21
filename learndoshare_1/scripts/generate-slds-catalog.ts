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
 *   shared-info.js     여러 페이지가 함께 보는 절(SLDS 블루프린트, 여러 폴더에 복사된 공용 파일)의 명세 항목별 개수·hook 행·빈틈 행. 한 번만 쓴다
 *   hook-info.js       hook마다 페이지와 상관없는 정보(종류, 이어지는 hook, 기본값, util.css 허용, 명세 항목). 모든 스토리가 함께 읽는다
 *   fixed-rules.js     정적 검사가 두 모드 고정으로 판정한 선언(선택자·속성·고정 항목). 반영 검사 페이지가 고정 범위로 쓴다
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
import { FIXED_ITEMS, type FixedItem } from "../lib/fixed-list.ts";
import { buildHooksIndex } from "../lib/hooks-index.ts";
import { lightningBaseComponentsDir } from "../lib/lwc-build.ts";
import type { FixedRule } from "../lib/reflect.ts";
import { declProblem, LBC_ONLY_G } from "../lib/rules.ts";
import { SPEC_ITEMS } from "../lib/spec-items.ts";
import { blueprintOf, classify } from "./audit/classify.ts";
import { fixedItemsOf, judge, modesOf, type Judged, type Mode } from "./audit/report.ts";
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

/** 선언 하나가 읽는 변수. at은 "선택자 { 속성 }"(선택자 목록은 첫 부분만, 기본 컴포넌트는 앞에 파일 이름) */
type Read = { name: string; at: string; modes: Mode[] };
type Audit = {
  judged: Map<string, Judged[]>; // "slds2 <블루프린트>" | "lbc <폴더>/<파일>"
  reads: Map<string, Read[]>; // 키는 judged와 같다
  lbcFiles: Map<string, string[]>; // 기본 컴포넌트 폴더 → CSS 파일 이름
  next: Map<string, string>; // var(--a, var(--b))의 a → b (처음 본 것)
  // 기본 컴포넌트 폴더 → 블루프린트 → 그 블루프린트를 쓰는 폴더 안 CSS 파일 이름
  lbcBlueprints: Map<string, Map<string, Set<string>>>;
  // 여러 폴더에 같은 이름으로 복사해 넣은 공용 파일("<폴더>/<파일>", 예: helptext/form-element.slds.css). 폴더 이름과 같은 파일은 그 폴더 것이다
  sharedFiles: Set<string>;
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

function readAudit(lbcDir: string): Audit {
  const src = readSources(lbcDir);
  const index = buildHooksIndex({ sldsCss: src.sldsCss, lbcCss: src.lbcFiles.map((f) => f.css) });
  const a: Audit = {
    judged: Map.groupBy(judge(classify(src), SPEC_ITEMS, src.bridgeCss, FIXED_ITEMS), (j) => (j.d.src === "lbc" ? `lbc ${j.d.comp}/${basename(j.d.file)}` : `slds2 ${j.d.comp}`)),
    lbcFiles: new Map(),
    reads: new Map(),
    next: new Map(),
    lbcBlueprints: new Map(),
    sharedFiles: new Set(),
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
      const where = s === "lbc" ? `${basename(file)} · ` : "";
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
      // native 표시 :host([data-render-mode="shadow"])는 모드 열이 말해 주므로 읽는 곳에서는 뗀다(생성 파일 크기)
      // 선택자가 그것뿐이면 :host로 적는다
      const at = `${where}${cssList.comma(selector)[0].replace(/^:host\(\[data-render-mode="shadow"\]\)\s*/, "") || ":host"} { ${d.prop} }`;
      for (const [, name] of d.value.matchAll(/var\(\s*(--[\w-]+)/g)) list.push({ name, at, modes });
      a.reads.set(`${s} ${comp}`, list);
    });
  scan(src.sldsCss, "slds2", "slds2.cosmos.css", blueprintOf);
  const foldersOf = Map.groupBy(src.lbcFiles, (f) => basename(f.file));
  for (const f of src.lbcFiles) {
    const name = basename(f.file);
    scan(f.css, "lbc", f.file, () => `${f.comp}/${name}`);
    a.lbcFiles.set(f.comp, [...(a.lbcFiles.get(f.comp) ?? []), name]);
    const own = name.split(".")[0].replace(/-/g, "").toLowerCase() === f.comp.toLowerCase() || foldersOf.get(name)!.length === 1;
    if (!own) a.sharedFiles.add(`${f.comp}/${name}`);
    const byBlueprint = a.lbcBlueprints.get(f.comp) ?? new Map<string, Set<string>>();
    parse(f.css).walkRules((r) => {
      const b = blueprintOf(r.selector);
      byBlueprint.set(b, (byBlueprint.get(b) ?? new Set()).add(name));
    });
    a.lbcBlueprints.set(f.comp, byBlueprint);
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
  a.iconColors = (readFileSync(join(lbcDir, "iconUtils/iconColors.js"), "utf8").match(/"rgb\(/g) ?? []).length;
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

/** 기본값 안의 var()를 :where(html) 정의(없으면 fallback)로 푼다. 브라우저가 계산한 값과 비교하려고 쓴다. 못 푸는 var()는 그대로 둔다 */
function resolveVars(value: string, defs: Map<string, string>): string {
  let v = value;
  // 안쪽 var()부터 푼다(fallback에 괄호가 없는 것). 순환 정의를 막으려고 10번까지만
  for (let i = 0; i < 10; i++) {
    const next = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (m, name: string, fb?: string) => defs.get(name) ?? fb?.trim() ?? m);
    if (next === v) break;
    v = next;
  }
  return v;
}

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
    // 기본값에 var()가 있으면 푼 식. 지금 값(계산된 값)이 이것과 같으면 "기본값"이다
    resolved: def?.includes("var(") ? resolveVars(def, a.hookDefs) : undefined,
    util: utilVerdict(name, a),
    items: SPEC_ITEMS.filter((i) => i.hooks.includes(name)).map((i) => i.label),
  };
}

// 명세 항목 → 모드 → [hook, 브리지, 고정, 빈틈] 선언 수
type Counts = Record<string, Record<Mode, number[]>>;
const COUNT_AT = { reached: 0, bridge: 1, fixed: 2, gap: 3 } as const;

// 메우는 방법. 브리지가 잇는 변수는 그리는 쪽(stories/salesforce-source.js)이 SPEC_ITEMS에서 붙인다
function how(j: Judged): string {
  if (j.status === "bridge") return "브리지";
  if (j.status === "gap") return "빈틈: 9.4 고정 목록에 없다(사용자 합의 필요)";
  const labels = fixedItemsOf(j.d, FIXED_ITEMS).filter((f) => j.mode === "native" || f.mode === "both").map((f) => f.label);
  const cHooks = C_HOOK_CANDIDATES.filter((c) => new RegExp(`${c}(?![\\w-])`).test(j.d.value));
  return `Salesforce 고정${labels.length ? `: ${labels.join(", ")}` : ""}${cHooks.length ? ` · c hook 후보 ${cHooks.join(", ")}(설계 9.2, 지금은 쓰지 않음)` : ""}`;
}

/** 출처 하나(기본 컴포넌트 폴더 하나 또는 SLDS 블루프린트 하나)의 명세 항목별 개수, hook 행, 빈틈 행 */
function sectionOf(judged: Judged[], reads: Read[]) {
  const counts: Counts = {};
  for (const j of judged) (counts[j.item] ??= { now: [0, 0, 0, 0], native: [0, 0, 0, 0] })[j.mode][COUNT_AT[j.status]]++;
  // hook 행: [이름, 지금 곳 수, 지금 첫 곳, native 곳 수, native 첫 곳](생성 파일 크기 때문에 배열).
  // ponytail: 읽는 곳은 첫 곳만 넣는다. 나머지는 원본 탭에서 hook 이름으로 찾는다
  const hooks = [...Map.groupBy(reads, (r) => r.name)]
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([name, rs]) => {
      const at = (mode: Mode) => [...new Set(rs.filter((r) => r.modes.includes(mode)).map((r) => r.at))];
      const [now, native] = [at("now"), at("native")];
      return [name, now.length, now[0] ?? "", native.length, native[0] ?? ""] as const;
    });
  const gaps = judged
    .filter((j) => j.status !== "reached")
    .map((j) => {
      // 선택자 목록은 첫 부분만 적는다. 정확한 자리는 파일:줄이다
      const parts = cssList.comma(j.d.selector);
      const selector = parts.length > 1 ? `${parts[0]} 외 ${parts.length - 1}개` : parts[0];
      return { prop: j.d.prop, value: j.d.value, selector, at: `${basename(j.d.file)}:${j.d.line}`, mode: j.mode, item: j.item, how: how(j) };
    });
  return { counts, hooks, gaps };
}

type Section = ReturnType<typeof sectionOf>;
/** 출처 키(judged·reads의 키) 여러 개를 한 절로 */
const sectionFor = (keys: string[], a: Audit): Section =>
  sectionOf(
    keys.flatMap((k) => a.judged.get(k) ?? []),
    keys.flatMap((k) => a.reads.get(k) ?? []),
  );

/**
 * 컴포넌트 페이지 하나의 데이터. 출처마다 절을 나눠 다른 컴포넌트의 판정이 섞여 보이지 않게 한다.
 * - own: 기본 컴포넌트 폴더의 자기 파일(폴더 이름과 같은 파일이거나 이 폴더에만 있는 파일)
 * - shared: 여러 폴더에 같은 이름으로 복사해 넣은 공용 사본(form-element.slds.css 등). 절 내용은 shared-info.js에 파일 이름으로 한 번만 쓴다
 * - blueprints: 폴더 CSS가 쓰는 SLDS 블루프린트와 폴더 이름과 같은 블루프린트. 직접(shared: false)은 자기 파일이 쓰는 것과 폴더 이름과 같은 것이다.
 *   폴더 이름과 같으면 공용 사본에서만 와도 직접이다(accordion. report.json도 폴더와 같은 키로 함께 센다). 그 밖에 공용 사본에서만 오면 shared.
 *   files는 그 블루프린트를 쓰는 폴더 안 파일이다. 절 내용은 shared-info.js에 블루프린트마다 한 번만 쓴다
 */
function viewOf(comp: string, tag: string, a: Audit) {
  const files = a.lbcFiles.get(comp) ?? [];
  const isShared = (f: string) => a.sharedFiles.has(`${comp}/${f}`);
  const ownFiles = files.filter((f) => !isShared(f));
  const used = a.lbcBlueprints.get(comp) ?? new Map<string, Set<string>>();
  const blueprints = [...new Set([...used.keys(), kebab(comp)])]
    .filter((b) => b !== "(global)" && a.sldsBlueprints.has(b))
    .sort()
    .map((name) => {
      const files = [...(used.get(name) ?? [])].sort();
      return { name, shared: name !== kebab(comp) && files.length > 0 && files.every(isShared), files };
    });

  // JS에 박힌 값은 CSS 정적 검사에 보이지 않아 따로 적는다(설계 9.5). 카탈로그에 있는 것은 개체 아이콘 색을 쓰는 icon·avatar다
  const ICON_JS = `lightning/iconUtils의 iconColors.js에 개체 아이콘 배경색 ${a.iconColors}개가 박혀 있다`;
  const js =
    comp === "icon"
      ? [`${ICON_JS}. icon.js가 인라인 스타일 --sds-c-icon-color-background: var(--slds-c-icon-color-background, <색>)으로 넣는다. Salesforce 고정: 개체 아이콘 배경색`]
      : comp === "avatar"
        ? [`${ICON_JS}. avatar.js가 대체 아이콘 이니셜 배경을 background-color: var(--slds-c-icon-color-background, <색>)으로 넣는다. Salesforce 고정: 개체 아이콘 배경색`]
        : [];

  return {
    tag,
    folder: comp,
    native: a.nativeList.includes(tag),
    // 폴더 절. 이 폴더에 복사해 넣은 공용 파일도 이 컴포넌트가 native에서 실제로 싣는 CSS라 함께 센다(report.json의 폴더 키와 같다)
    own: { files: ownFiles, ...sectionFor(ownFiles.map((f) => `lbc ${comp}/${f}`), a) },
    // 절 내용은 shared-info.js의 files[file]. 이 폴더에서 판정이 다른 부분만 generateCatalog가 여기에 덧붙인다
    shared: files.filter(isShared).map((file): { file: string } & Partial<Section> => ({ file })),
    blueprints,
    js,
  };
}

/** 원본 탭에 보일 파일(bare specifier): 기본 컴포넌트 폴더의 html·js·css(native용 *.slds.css 포함)와 블루프린트의 SLDS 2 컴포넌트 CSS */
const sourcesOf = (lbcDir: string, comp: string, blueprints: { name: string }[], a: Audit) => [
  ...readdirSync(join(lbcDir, comp))
    .filter((f) => /\.(html|js|css)$/.test(f))
    .sort()
    .map((f) => `lightning-base-components/src/lightning/${comp}/${f}`),
  ...[...new Set(blueprints.flatMap((b) => [...(a.sldsFiles.get(b.name) ?? [])]))].sort().map((f) => `@salesforce-ux/design-system-2/dist/components/${f}`),
];

/**
 * 반영 검사(stories/start/reflect-check-page.ts)의 9.4 고정 선언 목록. 정적 검사가 지금 모드에서 두 모드 고정으로 판정한 선언마다
 * 선택자 목록을 하나씩 나누고 가상 요소(::before·::after)를 뗀다. 페이지는 el.matches(선택자)로 맞춰 정적 검사와 같은 범위에서만 고정으로 본다
 */
export function fixedRulesOf(judged: Judged[], fixed: FixedItem[]): FixedRule[] {
  const out = new Map<string, FixedRule>();
  for (const j of judged) {
    if (j.status !== "fixed" || j.mode !== "now" || j.d.selector.startsWith("@")) continue;
    const id = fixedItemsOf(j.d, fixed).find((f) => f.mode === "both")?.id;
    if (!id) continue;
    for (const part of cssList.comma(j.d.selector)) {
      const pseudo = /::?(before|after)$/.exec(part)?.[1];
      const selector = pseudo ? part.replace(/::?(before|after)$/, "") || "*" : part;
      const rule: FixedRule = { selector, pseudo: pseudo ? `::${pseudo}` : "", prop: j.d.prop, id, ...(j.d.src === "lbc" && { comp: j.d.comp }) };
      out.set(JSON.stringify(rule), rule);
    }
  }
  return [...out.values()];
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
  const audit = readAudit(lbcDir);
  const pages = [...byComp].map(([comp, list]) => ({ comp, list, view: viewOf(comp, `lightning-${kebab(comp)}`, audit) }));
  // 여러 페이지가 함께 보는 절은 shared-info.js에 한 번만 쓴다.
  // 공용 사본은 폴더마다 내용이 같지만 폴더 안 변수 정의에 따라 판정이 조금 다를 수 있다(button.slds.css의 컨트롤 높이 1곳 등). 처음 본 것과 다른 부분만 페이지에 둔다
  const shared: { blueprints: Record<string, Section>; files: Record<string, Section> } = { blueprints: {}, files: {} };
  for (const { comp, view } of pages) {
    for (const s of view.shared) {
      const section = sectionFor([`lbc ${comp}/${s.file}`], audit);
      const base = (shared.files[s.file] ??= section);
      for (const k of ["counts", "hooks", "gaps"] as const) if (JSON.stringify(base[k]) !== JSON.stringify(section[k])) Object.assign(s, { [k]: section[k] });
    }
    for (const b of view.blueprints) shared.blueprints[b.name] ??= sectionFor([`slds2 ${b.name}`], audit);
  }
  writeFileSync(
    join(out, "shared-info.js"),
    `// 자동 생성 파일: scripts/generate-slds-catalog.ts. 여러 페이지가 함께 보는 절(SLDS 블루프린트, 공용 사본 파일)의 명세 항목별 개수·hook 행·빈틈 행\nexport default ${JSON.stringify(shared)};\n`,
  );
  const hookNames = new Set([...pages.map((p) => p.view.own), ...Object.values(shared.blueprints), ...Object.values(shared.files)].flatMap((s) => s.hooks.map((h) => h[0])));
  const info = Object.fromEntries([...hookNames].sort().map((n) => [n, hookInfo(n, audit)]));
  writeFileSync(join(out, "hook-info.js"), `// 자동 생성 파일: scripts/generate-slds-catalog.ts. hook마다 종류·이어지는 hook·기본값·util.css 허용·명세 항목\nexport default ${JSON.stringify(info)};\n`);
  const rules = fixedRulesOf([...audit.judged.values()].flat(), FIXED_ITEMS);
  writeFileSync(join(out, "fixed-rules.js"), `// 자동 생성 파일: scripts/generate-slds-catalog.ts. 반영 검사가 쓰는 9.4 고정 선언(정적 검사 판정)\nexport default ${JSON.stringify(rules)};\n`);

  for (const { comp, list, view } of pages) {
    const tagName = view.tag;
    const lines = [
      `// 자동 생성 파일: scripts/generate-slds-catalog.ts. 직접 고치지 않는다.`,
      `import { createElement } from "@milvus/lwc/index.js";`,
      `import * as ex from "@milvus/lwc/catalog.js";`,
      `import { sourceAndHooks } from "../salesforce-source.js";`,
      `import hookInfo from "./hook-info.js";`,
      `import sharedInfo from "./shared-info.js";`,
      ...list.map((e, i) => `import html${i} from "lightning-base-components/src/lightning/${e.html}?raw";`),
      ``,
      `const view = ${JSON.stringify(view)};`,
      `const sources = [`,
      ...sourcesOf(lbcDir, comp, view.blueprints, audit).map((f) => `  [${JSON.stringify(f)}, () => import(${JSON.stringify(`${f}?raw`)})],`),
      `];`,
      ``,
      `export default {`,
      `  title: "컴포넌트/기본/${title(comp)}",`,
      `  parameters: {`,
      `    controls: { disable: true },`,
      `    docs: {`,
      `      description: {`,
      `        component: ${JSON.stringify(
        `> **Salesforce 공식 예제** · \`${tagName}\`. 예제 아래 **Show code**를 눌러 코드를 복사하세요.\n\n속성은 공식 문서를 보세요: [${tagName}](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/${tagName}.html)`
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
      `  render: () => sourceAndHooks(view, sources, hookInfo, sharedInfo),`,
      `  parameters: { docs: { codePanel: false, canvas: { sourceState: "none" } } }`,
      `};`
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
