// 명세 항목별 반영 판정 (설계 9.6의 1·4). classify 결과를 "컴포넌트 × 명세 항목 → 지금·native 상태"로 모은다.
// - 지금: SLDS 2 CSS + 기본 컴포넌트 CSS 중 native 전용이 아닌 것. native: 기본 컴포넌트 CSS 중 synthetic 전용이 아닌 것
//   (native 전용은 *.slds.css와 :host([data-render-mode]) 선택자, synthetic 전용은 *.lbc.synthetic.css)
// - 선언 하나의 상태: g·s hook이면 reached. 아니면 브리지가 덮으면 bridge(지금만), FIXED_ITEMS에 맞으면 fixed, 나머지는 gap
// - 컴포넌트·항목의 상태는 가장 나쁜 선언을 따른다: gap > fixed > bridge > reached. 선언이 없으면 n/a. keyword·keyframes는 세지 않는다
import { list, parse, type Rule } from "postcss";
import type { FixedItem } from "../../lib/fixed-list.ts";
import type { SpecItem } from "../../lib/spec-items.ts";
import type { Decl } from "./classify.ts";

export type Status = "reached" | "bridge" | "gap" | "fixed" | "n/a";
type Mode = "now" | "native";
type Count = { reached: number; total: number };
export type Gap = { comp: string; item: string; selector: string; prop: string; value: string };
export type Report = {
  byComponent: Record<string, Record<string, { now: Status; native: Status }>>;
  byItem: Record<string, { now: Count; native: Count }>;
  gaps: Gap[];
};

const RANK: Status[] = ["n/a", "reached", "bridge", "fixed", "gap"];
// 컨트롤 높이 대상(설계 5.6): 버튼, 입력, 선택, 버튼형 라디오·체크박스. 기본 컴포넌트 native CSS는 part 속성으로 고른다
const CONTROLS = /\.slds-(button|input|input_faux|select|radio_button|checkbox_button)(?![\w-])|\[part~?=['"]?(button|input)['"]?\]/;
// 음수·0·퍼센트·1px·env()는 배치용 값이라 밀도에서 뺀다 (연구 cov2.cjs의 relevant와 같은 취지)
const GEOMETRY = /^(-|0(px|rem|em)?$)|\*\s*-1|%|^1px$|env\(/;

// ponytail: 명세 항목 hook을 읽지 않는 선언을 속성과 선택자로 항목 하나에 넣는 1차 규칙이다. 항목에 없는 값(일반 폭, 배치)은 세지 않는다.
// 빈틈 목록이 실제와 어긋나면 이 표를 고친다
function ruleItem(d: Decl): string | null {
  const sel = d.selector;
  const hoverOrActive = /:hover|:active/.test(sel);
  switch (d.cat) {
    case "motion":
      if (/timing-function$/.test(d.prop)) return "motion-easing";
      return /^(transition|animation)(-duration|-delay)?$/.test(d.prop) ? "motion-speed" : null;
    case "cursor":
      return /disabled/.test(sel) ? "cursor-underline" : null;
    case "focusOutline":
      return "focus-ring";
    case "shadow":
      return /:focus/.test(sel) ? "focus-ring" : hoverOrActive ? "hover-press" : "shadow";
    case "transform":
      return hoverOrActive ? "hover-press" : null;
    case "zIndex":
    case "opacity":
      return "fixed";
    case "radius":
      return "radius";
    case "borderWidth":
      return d.prop.startsWith("outline") ? "focus-ring" : "border-width";
    case "sizing":
      if (/icon/i.test(sel)) return "icon-size";
      if (CONTROLS.test(sel) && /height/.test(d.prop)) return "control-height";
      return /modal__container/.test(sel) && /width/.test(d.prop) ? "component" : null;
    case "spacing":
      return /^(padding|margin|gap|row-gap|column-gap)/.test(d.prop) && !GEOMETRY.test(d.value) ? "density" : null;
    case "typography":
      if (d.prop === "line-height") return CONTROLS.test(sel) ? "control-height" : "line-height";
      if (d.prop === "letter-spacing") return "letter-spacing";
      if (d.prop === "text-transform") return "text-case";
      if (d.prop.startsWith("text-decoration")) return /:hover/.test(sel) ? "cursor-underline" : null;
      return d.prop === "font-family" ? null : "typography";
    case "color":
      if (/backdrop/.test(sel)) return "backdrop";
      if (/(^|[\s,>+~(])mark(?![\w-])/.test(sel)) return "highlight";
      if (/disabled/.test(sel)) return "disabled";
      if (/inverse|tooltip|bubble/.test(sel)) return "inverse";
      if (/:hover|:active|selected|is-active/.test(sel)) return "hover-selected";
      if (/^(border|outline)/.test(d.prop)) return "border-color";
      return /^background/.test(d.prop) ? "surface" : "text-color";
  }
  return null;
}

// 기본 컴포넌트의 *.lbc.synthetic.css는 synthetic일 때만 쓰인다
// 반경 자리에서 간격·두께 hook을 읽으면(native 모달·필·탭 등) 모서리 설정이 닿지 않는다(연구 post.cjs의 fam). hook이 아닌 것처럼 판정한다
const offFamily = (d: Decl) =>
  d.cat === "radius" && /var\(\s*--slds-[gs]-/.test(d.value) && !/--slds-g-radius-border|--slds-s-[\w-]*radius/.test(d.value);

const modesOf = (d: Decl): Mode[] =>
  d.src === "slds2" || /\.lbc\.synthetic\.css$/.test(d.file)
    ? ["now"]
    : /\.slds\.css$/.test(d.file) || /data-render-mode/.test(d.selector)
      ? ["native"]
      : ["now", "native"];

type BridgeRule = { parts: Set<string>; prop: string };
/** 브리지 CSS에서 --milvus-* 변수를 읽는 규칙. 줄인 움직임 규칙처럼 값을 직접 쓰는 규칙은 브랜드가 바꿀 수 없어 뺀다 */
function bridgeRules(css: string): BridgeRule[] {
  const rules: BridgeRule[] = [];
  parse(css).walkDecls((d) => {
    if (d.parent?.type !== "rule" || !/var\(\s*--milvus-/.test(d.value)) return;
    rules.push({ parts: new Set((d.parent as Rule).selectors.map((s) => s.replace(/\s+/g, " ").trim())), prop: d.prop });
  });
  return rules;
}
export const bridgeSelectors = (css: string): string[] => [...new Set(bridgeRules(css).flatMap((r) => [...r.parts]))];

// 같은 속성이거나 한쪽이 다른 쪽의 longhand다 (transition ↔ transition-duration)
const related = (a: string, b: string) => a === b || a.startsWith(`${b}-`) || b.startsWith(`${a}-`);
const bridged = (d: Decl, rules: BridgeRule[]) =>
  list.comma(d.selector).every((part) => rules.some((r) => r.parts.has(part) && related(r.prop, d.prop)));

// FIXED_ITEMS.match 계약(lib/fixed-list.ts): 주어진 조건을 모두 만족하면 맞는다. js 출처는 CSS 선언과 맞추지 않는다
const isFixed = (d: Decl, mode: Mode, fixed: FixedItem[]) =>
  fixed.some(({ mode: m, match }) =>
    (mode === "native" || m === "both") &&
    match.source !== "js" &&
    (!match.selector || match.selector.test(`${d.comp} ${d.selector}`)) &&
    (!match.property || [match.property].flat().some((p) => d.prop === p || d.prop.startsWith(`${p}-`))) &&
    (!match.value || match.value.test(d.value)),
  );

export function buildReport(decls: Decl[], items: SpecItem[], bridgeCss: string, fixed: FixedItem[]): Report {
  const ids = new Set(items.map((i) => i.id));
  const itemsOfHook = new Map<string, string[]>();
  for (const i of items) for (const h of i.hooks) itemsOfHook.set(h, [...(itemsOfHook.get(h) ?? []), i.id]);
  const bridge = bridgeRules(bridgeCss);

  const status = new Map<string, Map<string, Record<Mode, Status>>>();
  const gaps = new Map<string, Gap>();
  for (const d of decls) {
    if (d.kind === "keyword" || d.kind === "keyframes") continue;
    const hook = (d.kind === "g" || d.kind === "s") && !offFamily(d);
    // hook 선언은 그 hook을 가진 명세 항목 모두에 넣는다. 그런 항목이 없거나 hook이 아니면 규칙 표로 항목 하나를 고른다
    const byHook = hook ? [...d.value.matchAll(/var\(\s*(--slds-[gs]-[\w-]+)/g)].flatMap(([, n]) => itemsOfHook.get(n) ?? []) : [];
    const byRule = ruleItem(d);
    const targets = new Set(byHook.length ? byHook : byRule && ids.has(byRule) ? [byRule] : []);
    const row = status.get(d.comp) ?? new Map<string, Record<Mode, Status>>();
    for (const item of targets) {
      status.set(d.comp, row);
      for (const mode of modesOf(d)) {
        const s: Status = hook ? "reached" : mode === "now" && bridged(d, bridge) ? "bridge" : isFixed(d, mode, fixed) ? "fixed" : "gap";
        const cur = row.get(item) ?? { now: "n/a", native: "n/a" };
        if (RANK.indexOf(s) > RANK.indexOf(cur[mode])) cur[mode] = s;
        row.set(item, cur);
        if (s === "gap") {
          const g: Gap = { comp: d.comp, item, selector: d.selector, prop: d.prop, value: d.value };
          gaps.set(JSON.stringify(g), g);
        }
      }
    }
  }

  const byComponent: Report["byComponent"] = {};
  for (const comp of [...status.keys()].sort()) {
    const row = status.get(comp)!;
    byComponent[comp] = Object.fromEntries(items.filter((i) => row.has(i.id)).map((i) => [i.id, row.get(i.id)!]));
  }
  const count = (item: string, mode: Mode): Count => {
    const all = [...status.values()].map((row) => row.get(item)?.[mode] ?? "n/a").filter((s) => s !== "n/a");
    return { reached: all.filter((s) => s === "reached" || s === "bridge").length, total: all.length };
  };
  const byItem = Object.fromEntries(items.map((i) => [i.id, { now: count(i.id, "now"), native: count(i.id, "native") }]));
  return { byComponent, byItem, gaps: [...gaps.values()] };
}
