// SLDS 2 CSS와 기본 컴포넌트(lightning-base-components) CSS의 선언을 "항목(cat) × 값 종류(kind)"로 나눈다 (설계 9.6의 1).
// 분류 기준은 docs/research/2026-10-08/extract.cjs다. 다른 점:
// - var()를 custom property 정의와 :where(html)의 hook 정의까지 따라가 판정한다. g·s hook에 닿으면 g·s,
//   기본값까지 풀어 키워드만 남으면(정의 없는 c hook 등) keyword다. 그래서 private 변수(--_slds-*)를 거쳐 g hook에 닿는 값은 빈틈이 아니다
// - @keyframes 안 선언은 속성과 상관없이 kind keyframes(cat motion)다
// - 값은 자르지 않고 공백만 하나로 줄인다. cursor를 cat에 더한다(명세 항목 "커서·링크 밑줄")
import { parse, type AtRule, type Declaration, type Node, type Rule } from "postcss";

export type Kind = "g" | "s" | "c" | "r" | "otherVar" | "keyword" | "literal" | "keyframes";
export type Decl = {
  src: "slds2" | "lbc";
  comp: string;
  cat: string;
  kind: Kind;
  prop: string;
  value: string;
  selector: string;
  file: string;
  line: number;
};
export type LbcFile = { comp: string; file: string; css: string };

export const SLDS2_FILE = "@salesforce-ux/design-system-2/dist/css/bundled/slds2.cosmos.css";

const CAT: [string, RegExp][] = [
  ["motion", /^(transition|animation)/],
  ["transform", /^(transform|translate|rotate|scale)$/],
  ["shadow", /^(box-shadow|text-shadow)$/],
  ["radius", /radius$/],
  ["borderWidth", /^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?-width$|^outline-width$|^outline-offset$/],
  ["focusOutline", /^outline(-style|-color)?$/],
  ["color", /(^|-)color$|^background(-color|-image)?$|^fill$|^stroke$|^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?$|^caret-color$|^accent-color$/],
  ["typography", /^(font|font-size|font-weight|font-family|line-height|letter-spacing|text-transform|text-decoration.*)$/],
  ["spacing", /^(padding|margin|gap|row-gap|column-gap)(-.*)?$|^inset/],
  ["sizing", /^(width|height|min-width|min-height|max-width|max-height|block-size|inline-size|min-block-size|min-inline-size|max-block-size|max-inline-size)$/],
  ["opacity", /^opacity$/],
  ["zIndex", /^z-index$/],
  ["cursor", /^cursor$/],
];
// extract.cjs의 키워드. postcss는 !important를 값에서 떼므로 "... !important" 변형은 필요 없다
const KEYWORD = /^(inherit|initial|unset|none|0|auto|transparent|currentcolor|100%|50%|0%|normal|-1|1|bold)$/i;
const VAR_NAME = /var\(\s*(--[\w-]+)/g;

type Defs = (name: string) => string[] | undefined;
const oneSpace = (s: string) => s.replace(/\s+/g, " ").trim();

function definitions(css: string[]): Map<string, string[]> {
  const defs = new Map<string, string[]>();
  for (const text of css) {
    parse(text).walkDecls(/^--/, (d) => {
      const values = defs.get(d.prop);
      if (values) values.push(d.value);
      else defs.set(d.prop, [d.value]);
    });
  }
  return defs;
}

// 값이 읽는 변수의 정의를 끝까지 이어 붙인다. g hook은 끝점이라 더 따라가지 않는다
function chain(value: string, defs: Defs, seen = new Set<string>()): string {
  let out = "";
  for (const [, name] of value.matchAll(VAR_NAME)) {
    if (name.startsWith("--slds-g-") || seen.has(name)) continue;
    seen.add(name);
    for (const v of defs(name) ?? []) out += ` ${v}${chain(v, defs, seen)}`;
  }
  return out;
}

function kindOf(value: string, defs: Defs): Kind {
  if (!value.includes("var(")) return KEYWORD.test(value) ? "keyword" : "literal";
  const resolved = value + chain(value, defs);
  if (/var\(\s*--slds-g-/.test(resolved)) return "g";
  if (/var\(\s*--slds-s-/.test(resolved)) return "s";
  // 지시서 표와 달리 c·otherVar보다 먼저 본다(R29 승인): 변수 이름을 지우고 남은 기본값·정의가 키워드뿐이면(정의 없으면 unset) keyword. 실측 거짓 빈틈 약 230개를 막는다
  if (resolved.replace(VAR_NAME, " ").split(/[\s,()]+/).every((t) => !t || KEYWORD.test(t))) return "keyword";
  if (/var\(\s*--(slds|sds)-c-/.test(value)) return "c";
  if (/var\(\s*--slds-r-/.test(value)) return "r";
  return "otherVar";
}

function keyframesOf(d: Declaration): string | null {
  for (let p: Node | undefined = d.parent; p; p = p.parent) {
    if (p.type === "atrule" && /keyframes$/i.test((p as AtRule).name)) return `@keyframes ${(p as AtRule).params}`;
  }
  return null;
}

function scan(css: string, src: Decl["src"], file: string, compOf: (selector: string) => string, defs: Defs, out: Decl[]): void {
  parse(css).walkDecls((d) => {
    if (d.prop.startsWith("--")) return;
    const keyframes = keyframesOf(d);
    const cat = keyframes ? "motion" : CAT.find(([, re]) => re.test(d.prop))?.[0];
    if (!cat) return;
    const parent = d.parent as Rule | AtRule;
    const rule = parent.type === "rule" ? oneSpace(parent.selector) : `@${parent.name}`;
    const selector = keyframes ? `${keyframes} ${rule}` : rule;
    const value = oneSpace(d.value);
    out.push({
      src,
      comp: compOf(selector),
      cat,
      kind: keyframes ? "keyframes" : kindOf(value, defs),
      prop: d.prop,
      value,
      selector,
      file,
      line: d.source?.start?.line ?? 0,
    });
  });
}

/** SLDS 블루프린트 이름: 선택자의 첫 .slds-<이름>에서 __·_ 앞부분. 없으면 (global) */
export const blueprintOf = (sel: string) => /\.slds-([a-z0-9]+(?:-[a-z0-9]+)*)/.exec(sel)?.[1].split(/__|_/)[0] ?? "(global)";

/** 컴포넌트 이름: SLDS 2는 선택자의 첫 .slds-<이름>(블루프린트), 기본 컴포넌트는 폴더 이름이다 */
export function classify(o: { sldsCss: string; lbcFiles: LbcFile[] }): Decl[] {
  const hooks = new Map<string, string[]>();
  parse(o.sldsCss).walkRules((r) => {
    if (r.selector.trim() === ":where(html)") r.walkDecls(/^--/, (d) => void hooks.set(d.prop, [d.value]));
  });
  const sldsDefs = definitions([o.sldsCss]);
  const out: Decl[] = [];
  scan(o.sldsCss, "slds2", SLDS2_FILE, blueprintOf, (n) => hooks.get(n) ?? sldsDefs.get(n), out);

  // 기본 컴포넌트는 자기 폴더와 공통 sldsCommon의 정의를 본다. 문서의 hook 정의(:where(html))는 shadow 경계를 넘어 상속된다
  const byComp = Map.groupBy(o.lbcFiles, (f) => f.comp);
  const common = definitions((byComp.get("sldsCommon") ?? []).map((f) => f.css));
  for (const [comp, files] of byComp) {
    const own = definitions(files.map((f) => f.css));
    for (const f of files) scan(f.css, "lbc", f.file, () => comp, (n) => hooks.get(n) ?? own.get(n) ?? common.get(n), out);
  }
  return out;
}
