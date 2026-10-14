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
export type Mode = "now" | "native";
type Count = { reached: number; total: number };
export type Gap = { comp: string; item: string; selector: string; prop: string; value: string };
export type Report = {
  byComponent: Record<string, Record<string, { now: Status; native: Status }>>;
  byItem: Record<string, { now: Count; native: Count }>;
  gaps: Gap[];
};

export const RANK: Status[] = ["n/a", "reached", "bridge", "fixed", "gap"];
// control-height 항목에 넣는 컨트롤(명세 9.3): 버튼, 입력, 선택, 버튼형 라디오·체크박스. 기본 컴포넌트 native CSS는 part 속성으로 고른다
const CONTROLS = /\.slds-(button|input|input_faux|select|radio_button|checkbox_button)(?![\w-])|\[part~?=['"]?(button|input)['"]?\]/;
// 음수·0·퍼센트·1px·env()는 배치용 값이라 밀도에서 뺀다 (연구 cov2.cjs의 relevant와 같은 취지)
const GEOMETRY = /^(-|0(px|rem|em)?$)|\*\s*-1|%|^1px$|env\(/;
// CSS 곡선 값(easing function)
const EASING = /\b(ease(-in|-out|-in-out)?|linear|step-start|step-end)\b|\b(cubic-bezier|steps)\(/;

// 브랜드 항목이 아닌 선언 (2026-10-12 사용자 결정, 설계 9.6의 4). 항목에서 빼면 배정되는 항목이 없어 세지 않는다
// - 간격: em만 쓴 들여쓰기(글자 크기 배수), 0과 auto만 쓴 margin(가운데·오른쪽 정렬), revert 기본값
const EM_ONLY = /^\d*\.?\d+em( \d*\.?\d+em)*$/;
const AUTO_ALIGN = /^(?=.*\bauto\b)(0|auto)( (0|auto))*$/;
// - 컨트롤 높이: 숨긴 입력(선택자 끝이 [type='checkbox'|'radio'])과 트리 표(table_tree) 안 트리 버튼
const HIDDEN_INPUT = /\[type=['"]?(checkbox|radio)['"]?\]$/;
const TREE_TABLE_BUTTON = /\.slds-table(_|--)tree[^,]*\.slds-tree__item/;
// - hover·눌림: :hover의 뒤집기(rotate), 가운데 맞춤(translate -50%), 확대(scale). 떠오름(-50%가 아닌 translate)이 섞인 값과 :active 눌림은 남는다
const SHAPE_MOTION = /rotate|scale|translate[XY]?\(\s*-50%/;
const LIFT = /translate[XY]?\(\s*(?!-50%)/;
// - 글자 크기: 상대 크기(em·%). var() 기본값도 본다
const RELATIVE_SIZE = /^\d*\.?\d+(em|%)$/;
// - 색: 이미지(url(), 이름에 image가 든 변수), 색이 없는 값(transparent·currentColor·시스템 색·color-mix·0 0, 색을 적지 않은 border)
const IMAGE = /url\(|var\(\s*--[\w-]*image/;
const COLORLESS_TOKEN =
  /^(transparent|currentcolor|-?\d*\.?\d+(px|rem|em|%|deg)?|solid|dotted|dashed|double|none|linear-gradient|color-mix|in|srgb|oklab|to|top|bottom|left|right|highlight|highlighttext|buttontext|buttonface|buttonborder|canvas|canvastext|linktext|visitedtext|activetext|graytext|field|fieldtext|mark|marktext|selecteditem|selecteditemtext|accentcolor|accentcolortext)$/i;
// var(--x, 기본값)은 기본값만 남긴다. 기본값 없는 var()는 색을 알 수 없어 그대로 둔다(토큰 var가 남아 색으로 본다)
const fallbackOnly = (v: string) => v.replace(/var\(\s*--[\w-]+\s*,\s*/g, "");
const colorless = (v: string) => fallbackOnly(v).split(/[\s,()/]+/).every((t) => !t || COLORLESS_TOKEN.test(t));
// - 비활성: :not() 안의 disabled는 활성 상태다
const outsideNot = (sel: string) => sel.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "");

/**
 * border로 그린 삼각형: ::before·::after이고, 같은 규칙에서 너비·높이가 0이거나 테두리가 transparent인데 한 변에만 색이 있다.
 * 투명 테두리 위에 그라데이션을 깐 테두리(Agentforce 입력창)는 변 색이 없어 삼각형이 아니다
 */
const isTriangle = (d: Decl, sameRule: Decl[]) =>
  list.comma(d.selector).every((p) => /::?(before|after)$/.test(p)) &&
  (sameRule.some((s) => /^(width|height)$/.test(s.prop) && s.value === "0") ||
    (sameRule.some((s) => /^border.*color$/.test(s.prop) && /transparent/.test(s.value)) &&
      sameRule.some((s) => /^border-.+-color$/.test(s.prop) && !/transparent/.test(s.value))));

// ponytail: 명세 항목 hook을 읽지 않는 선언을 속성과 선택자로 항목 하나에 넣는 1차 규칙이다(곡선이 든 움직임 shorthand는 buildReport가 곡선 항목에도 넣는다).
// 항목에 없는 값(일반 폭, 배치)은 세지 않는다.
// 빈틈 목록이 실제와 어긋나면 이 표를 고친다
function ruleItem(d: Decl, sameRule: Decl[]): string | null {
  const sel = d.selector;
  const hoverOrActive = /:hover|:active/.test(sel);
  const disabled = /disabled/.test(outsideNot(sel));
  switch (d.cat) {
    case "motion":
      if (/timing-function$/.test(d.prop)) return "motion-easing";
      // 속도는 지속 시간이다. 지연(*-delay)은 세지 않는다
      return /^(transition|animation)(-duration)?$/.test(d.prop) ? "motion-speed" : null;
    case "cursor":
      return disabled ? "cursor-underline" : null;
    case "focusOutline":
      return "focus-ring";
    case "shadow":
      return /:focus/.test(sel) ? "focus-ring" : hoverOrActive ? "hover-press" : "shadow";
    case "transform":
      if (!hoverOrActive) return null;
      return /:hover/.test(sel) && SHAPE_MOTION.test(d.value) && !LIFT.test(d.value) ? null : "hover-press";
    case "zIndex":
    case "opacity":
      return "fixed";
    case "radius":
      // 크기 hook(두께가 아닌 sizing)으로 만든 원
      return /var\(\s*--slds-g-sizing-(?!border)/.test(d.value) ? null : "radius";
    case "borderWidth":
      // outline-offset은 링 위치(배치값)다
      if (d.prop === "outline-offset") return null;
      return d.prop.startsWith("outline") ? "focus-ring" : isTriangle(d, sameRule) ? null : "border-width";
    case "sizing":
      if (/icon/i.test(sel)) return "icon-size";
      if (CONTROLS.test(sel) && /height/.test(d.prop))
        return list.comma(sel).every((p) => HIDDEN_INPUT.test(p)) || TREE_TABLE_BUTTON.test(sel) ? null : "control-height";
      return /modal__container/.test(sel) && /width/.test(d.prop) ? "component" : null;
    case "spacing":
      if (!/^(padding|margin|gap|row-gap|column-gap)/.test(d.prop) || GEOMETRY.test(d.value)) return null;
      return EM_ONLY.test(d.value) || (d.prop.startsWith("margin") && AUTO_ALIGN.test(d.value)) || /\brevert\b/.test(d.value) ? null : "density";
    case "typography":
      if (d.prop === "line-height") return CONTROLS.test(sel) ? "control-height" : "line-height";
      if (d.prop === "letter-spacing") return "letter-spacing";
      if (d.prop === "text-transform") return "text-case";
      if (d.prop.startsWith("text-decoration")) return /:hover/.test(sel) ? "cursor-underline" : null;
      if (d.prop === "font-size" && RELATIVE_SIZE.test(fallbackOnly(d.value).replace(/\)+$/, ""))) return null;
      return d.prop === "font-family" ? null : "typography";
    case "color":
      if (IMAGE.test(d.value) || colorless(d.value) || (d.prop.startsWith("border") && isTriangle(d, sameRule))) return null;
      if (/backdrop/.test(sel)) return "backdrop";
      if (/(^|[\s,>+~(])mark(?![\w-])/.test(sel)) return "highlight";
      if (disabled) return "disabled";
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

export const modesOf = (d: Pick<Decl, "src" | "file" | "selector">): Mode[] =>
  d.src === "slds2" || /\.lbc\.synthetic\.css$/.test(d.file)
    ? ["now"]
    : /\.slds\.css$/.test(d.file) || /data-render-mode/.test(d.selector)
      ? ["native"]
      : ["now", "native"];

type BridgeRule = { parts: Set<string>; prop: string };
/** 브리지 CSS에서 --milvus-* 변수를 읽는 규칙. 원본 값을 그대로 다시 넣은 선언(var 없음)은 브랜드가 바꿀 수 없어 뺀다 */
function bridgeRules(css: string): BridgeRule[] {
  const rules: BridgeRule[] = [];
  parse(css).walkDecls((d) => {
    if (d.parent?.type !== "rule" || !/var\(\s*--milvus-/.test(d.value)) return;
    rules.push({ parts: new Set((d.parent as Rule).selectors.map((s) => s.replace(/\s+/g, " ").trim())), prop: d.prop });
  });
  return rules;
}
export const bridgeSelectors = (css: string): string[] => [...new Set(bridgeRules(css).flatMap((r) => [...r.parts]))];

// 같은 속성이거나 한쪽이 다른 쪽의 longhand다 (border ↔ border-width)
const related = (a: string, b: string) => a === b || a.startsWith(`${b}-`) || b.startsWith(`${a}-`);
// 움직임은 항목마다 맞는 longhand가 필요하다. 시간만 잇는 브리지가 곡선까지 덮었다고 보지 않는다
const MOTION_PART: Record<string, string> = { "motion-speed": "duration", "motion-easing": "timing-function" };
function covers(bridgeProp: string, d: Decl, item: string): boolean {
  const part = MOTION_PART[item];
  if (!part) return related(bridgeProp, d.prop);
  const base = d.prop.startsWith("animation") ? "animation" : "transition";
  return bridgeProp === base || bridgeProp === (d.prop === base ? `${base}-${part}` : d.prop);
}
// 선택자 목록의 모든 부분을 브리지가 덮어야 bridge다
const bridged = (d: Decl, item: string, rules: BridgeRule[]) =>
  list.comma(d.selector).every((part) => rules.some((r) => r.parts.has(part) && covers(r.prop, d, item)));

// FIXED_ITEMS.match 계약(lib/fixed-list.ts): 주어진 조건을 모두 만족하면 맞는다. 매처가 여러 개면 하나라도 맞으면 된다. js 출처는 CSS 선언과 맞추지 않는다
const matchesFixed = (d: Decl, item: FixedItem) =>
  [item.match].flat().some(
    (m) =>
      m.source !== "js" &&
      (!m.selector || m.selector.test(`${d.comp} ${d.selector}`)) &&
      (!m.property || [m.property].flat().some((p) => d.prop === p || d.prop.startsWith(`${p}-`))) &&
      (!m.value || m.value.test(d.value)),
  );
const isFixed = (d: Decl, mode: Mode, fixed: FixedItem[]) => fixed.some((f) => (mode === "native" || f.mode === "both") && matchesFixed(d, f));
/** 선언이 쓰이는 모드에서 맞는 고정 항목. --check가 새 하드코딩 줄에 붙인다 */
export const fixedItemsOf = (d: Decl, fixed: FixedItem[]) => fixed.filter((f) => modesOf(d).some((mode) => isFixed(d, mode, [f])));

/** 선언 하나 × 명세 항목 × 모드의 판정. buildReport와 Storybook "원본과 hook" 보기(scripts/generate-slds-catalog.ts)가 쓴다 */
export type Judged = { d: Decl; item: string; mode: Mode; status: Exclude<Status, "n/a"> };

export function judge(decls: Decl[], items: SpecItem[], bridgeCss: string, fixed: FixedItem[]): Judged[] {
  const ids = new Set(items.map((i) => i.id));
  const itemsOfHook = new Map<string, string[]>();
  for (const i of items) for (const h of i.hooks) itemsOfHook.set(h, [...(itemsOfHook.get(h) ?? []), i.id]);
  const bridge = bridgeRules(bridgeCss);
  // ponytail: 같은 규칙을 파일·선택자로 묶는다. 같은 선택자가 다른 @media에 또 있으면 한 규칙으로 본다(삼각형 판정에만 쓴다)
  const rules = Map.groupBy(decls, (d) => `${d.file} ${d.selector}`);

  const out: Judged[] = [];
  for (const d of decls) {
    if (d.kind === "keyword" || d.kind === "keyframes") continue;
    const hook = (d.kind === "g" || d.kind === "s") && !offFamily(d);
    // hook 선언은 그 hook을 가진 명세 항목 모두에 넣는다. 그런 항목이 없거나 hook이 아니면 규칙 표로 항목 하나를 고른다
    const byHook = hook ? [...d.value.matchAll(/var\(\s*(--slds-[gs]-[\w-]+)/g)].flatMap(([, n]) => itemsOfHook.get(n) ?? []) : [];
    const byRule = ruleItem(d, rules.get(`${d.file} ${d.selector}`) ?? []);
    // 곡선이 든 transition·animation shorthand는 시간과 곡선 두 항목에 넣는다
    const ruled = byRule === "motion-speed" && /^(transition|animation)$/.test(d.prop) && EASING.test(d.value) ? [byRule, "motion-easing"] : byRule ? [byRule] : [];
    const targets = new Set(byHook.length ? byHook : ruled.filter((i) => ids.has(i)));
    for (const item of targets) {
      for (const mode of modesOf(d)) {
        const status = hook ? "reached" : mode === "now" && bridged(d, item, bridge) ? "bridge" : isFixed(d, mode, fixed) ? "fixed" : "gap";
        out.push({ d, item, mode, status });
      }
    }
  }
  return out;
}

export function buildReport(decls: Decl[], items: SpecItem[], bridgeCss: string, fixed: FixedItem[]): Report {
  const status = new Map<string, Map<string, Record<Mode, Status>>>();
  const gaps = new Map<string, Gap>();
  for (const { d, item, mode, status: s } of judge(decls, items, bridgeCss, fixed)) {
    const row = status.get(d.comp) ?? new Map<string, Record<Mode, Status>>();
    status.set(d.comp, row);
    const cur = row.get(item) ?? { now: "n/a", native: "n/a" };
    if (RANK.indexOf(s) > RANK.indexOf(cur[mode])) cur[mode] = s;
    row.set(item, cur);
    if (s === "gap") {
      const g: Gap = { comp: d.comp, item, selector: d.selector, prop: d.prop, value: d.value };
      gaps.set(JSON.stringify(g), g);
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
