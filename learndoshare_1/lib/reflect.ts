// 동적 반영 검사(설계 9.6의 2)의 판정. Storybook "시작하기/반영 검사"(stories/start/reflect-check-page.ts)가 기본 브랜드와
// 센티널 브랜드(lib/sentinel.ts)로 같은 스토리를 그려 요소마다 잰 계산값 한 쌍(Probe)을 명세 항목의 반영·빈틈·고정으로 나눈다.
// 브라우저에서도 import하므로 Node 모듈을 쓰지 않는다
//
// 계산값 변화 → 명세 항목 (판단 근거)
// 1. 지문: 센티널은 hook마다 다른 값을 넣었다. 바뀐 계산값(또는 쉼표로 나눈 한 부분)이 어떤 hook의 계산값과 같으면 그 hook이 닿은 것이고,
//    그 hook을 가진 명세 항목(SPEC_ITEMS의 hooks·bridgeVars)에 넣는다. 정적 검사가 hook 선언을 "그 hook을 가진 항목 모두"에 넣는 것과 같다
// 2. 속성 묶음: 지문만으로는 모자라다. 계산값이 hook 여러 개를 거치거나(calc, 상속) 형식이 바뀌고(줄 간격 배수 → px),
//    s hook을 함께 정하면 그 s hook의 기본값인 g hook이 가려진다(버튼 반경은 s button-radius-border가 이기지만 실제 브랜드가 g만 바꿔도 닿는다).
//    그래서 모양·글자·간격·움직임 속성은 정적 검사의 규칙 표(scripts/audit/report.ts ruleItem)처럼 속성 이름으로 항목 하나를 함께 고른다.
//    색은 항목이 잘게 나뉘어(바탕·글자·테두리·비활성·피드백…) 속성 이름만으로 고르면 틀리기 쉬워, 지문이 없을 때만 속성으로 고른다
// 3. 바뀌지 않은 값(빈틈 후보)은 속성 묶음으로만 항목을 고른다. 0px·none·투명처럼 아무 모양이 없는 값, 부모에게서 그대로 상속한 값,
//    브랜드 색(org 테마가 원본, util.css 항목이 아님)은 빈틈으로 세지 않는다. 9.4 고정 목록(FIXED_ITEMS)에 맞으면 "고정"이다
import type { FixedItem } from "./fixed-list.ts";
import type { Kind } from "./sentinel.ts";
import type { SpecItem } from "./spec-items.ts";

export type State = "static" | "disabled" | "focus";
export type Probe = {
  comp: string;
  /** 요소를 나타내는 선택자: 태그, 클래스, input의 type, part, 상태(:focus), 가상 요소(::before) */
  selector: string;
  prop: string;
  base: string;
  sentinel: string;
  state: State;
  /** 상속 속성일 때 부모 요소의 같은 속성(기본, 센티널) */
  parent?: [string, string];
  /** 요소의 글자 크기(기본, 센티널). em·줄 간격 배수처럼 글자 크기를 따라 바뀐 길이를 가린다 */
  fontSize: [string, string];
  /** 같은 요소의 기본 계산값. 테두리 색은 두께가, 곡선은 시간이 0이 아닐 때만 본다 */
  el: Record<string, string>;
};
export type Verdict = { item: string; status: "reached" | "gap" | "fixed"; fixed?: string };
export type JudgeContext = {
  /** `${무리}|${계산값}` → hook 이름 (fingerprintKey) */
  fingerprints: Map<string, string[]>;
  hookItems: Map<string, string[]>;
  /** 기본 브랜드에서 잰 브랜드 색 계열 hook의 계산값(rgb(…)) */
  brandColors: Set<string>;
  fixed: FixedItem[];
};

const SIDES = ["top", "right", "bottom", "left"];
/** 스토리를 그린 뒤 요소마다 재는 속성(계산값은 longhand로 읽는다) */
export const STATIC_PROPS = [
  ...["top-left", "top-right", "bottom-right", "bottom-left"].map((c) => `border-${c}-radius`),
  ...SIDES.map((s) => `border-${s}-width`),
  ...SIDES.map((s) => `border-${s}-color`),
  ...SIDES.map((s) => `padding-${s}`),
  ...SIDES.map((s) => `margin-${s}`),
  "row-gap",
  "column-gap",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-align",
  "font-style",
  "color",
  "background-color",
  "fill",
  "box-shadow",
  "transform",
  "transition-duration",
  "transition-timing-function",
  "animation-duration",
  "animation-timing-function",
  "width",
  "height",
];
/** focus() 뒤에 재는 속성. 포커스로 값이 바뀐 것만 본다 */
export const FOCUS_PROPS = ["box-shadow", "outline-width", "outline-color"];
/** 상속되는 속성. 부모 값 그대로면 부모에서 판정한다 */
export const INHERITED = new Set(["color", "fill", "font-size", "font-weight", "line-height", "letter-spacing", "text-transform", "text-align", "font-style"]);

/**
 * 센티널 값 종류 → 계산값을 잴 속성. 요소에서 잰 값과 형식(rgb(), px, 0.777s)이 같아지도록 같은 종류의 속성으로 잰다.
 * 줄 간격 배수는 계산값이 px(배수 × 글자 크기)라 지문을 만들 수 없다
 */
export const PROBE_PROP: Record<Kind, string | null> = {
  color: "color",
  alias: "color",
  radius: "width",
  border: "width",
  spacing: "width",
  size: "width",
  "font-size": "width",
  wide: "width",
  letter: "width",
  weight: "font-weight",
  "line-height": null,
  time: "transition-duration",
  easing: "transition-timing-function",
  shadow: "box-shadow",
  "focus-shadow": "box-shadow",
  transform: "transform",
  align: "text-align",
  "font-style": "font-style",
  "text-transform": "text-transform",
};

const COLOR_PROP = /color$|^fill$/;
const UA_INPUT = /^input[^[]*\[type='(checkbox|radio|range|file)'\]/;
const LENGTH_PROP = /radius$|-width$|^(padding|margin)-|gap$|^font-size$|^letter-spacing$|^line-height$/;

// 지문 무리. 같은 무리끼리만 맞춘다. 너비·높이는 크기 hook(sizing, 모달 너비)하고만 맞춰,
// 레이아웃으로 정해진 너비가 우연히 반경 값(7px 등)과 같아도 반경으로 세지 않는다
function propGroup(prop: string): string {
  if (prop === "width" || prop === "height") return "size";
  if (COLOR_PROP.test(prop)) return "color";
  if (LENGTH_PROP.test(prop)) return "length";
  if (/-duration$/.test(prop)) return "transition-duration";
  if (/-timing-function$/.test(prop)) return "transition-timing-function";
  return prop;
}
const kindGroup = (kind: Kind) => (kind === "size" || kind === "wide" ? "size" : PROBE_PROP[kind] === "width" ? "length" : PROBE_PROP[kind]);

/** 센티널 hook의 계산값을 지문 지도에 넣을 키. 줄 간격처럼 잴 수 없는 종류는 undefined */
export const fingerprintKey = (kind: Kind, value: string) => (PROBE_PROP[kind] ? `${kindGroup(kind)}|${value}` : undefined);

/** 최상위 쉼표로 나눈다. rgb(…)·cubic-bezier(…) 안의 쉼표는 건너뛴다 */
export function splitTop(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")") depth--;
    else if (value[i] === "," && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

/** 계산값 전체나 쉼표로 나눈 한 부분이 어느 hook의 계산값과 같은가 */
export function matchHooks(prop: string, value: string, fingerprints: Map<string, string[]>): string[] {
  const group = propGroup(prop);
  return [...new Set([value, ...splitTop(value)].flatMap((v) => fingerprints.get(`${group}|${v}`) ?? []))];
}

/** hook·브리지 변수 → 그것을 가진 명세 항목 id */
export function hookItems(items: SpecItem[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const i of items) for (const h of [...i.hooks, ...i.bridgeVars]) map.set(h, [...(map.get(h) ?? []), i.id]);
  return map;
}

/**
 * 속성 묶음 → 명세 항목. 정적 검사의 규칙 표(scripts/audit/report.ts ruleItem)를 계산값 이름으로 옮겼다.
 * 채움색·변형·정렬·기울임·너비·높이는 항목이 갈리지 않아 지문으로만 고른다(null)
 */
export function categoryItem(prop: string, state: State): string | null {
  if (/radius$/.test(prop)) return "radius";
  if (/^border-\w+-width$/.test(prop)) return "border-width";
  if (/^(padding|margin)-|gap$/.test(prop)) return "density";
  if (prop === "font-size" || prop === "font-weight") return "typography";
  if (prop === "line-height") return "line-height";
  if (prop === "letter-spacing") return "letter-spacing";
  if (prop === "text-transform") return "text-case";
  if (/-duration$/.test(prop)) return "motion-speed";
  if (/-timing-function$/.test(prop)) return "motion-easing";
  if (prop === "box-shadow") return state === "focus" ? "focus-ring" : "shadow";
  if (prop.startsWith("outline-")) return "focus-ring";
  if (prop === "fill" || !COLOR_PROP.test(prop)) return null;
  if (state === "disabled") return "disabled";
  return prop === "color" ? "text-color" : prop === "background-color" ? "surface" : "border-color";
}

const px = (v: string | undefined) => (v && /^-?[\d.]+px$/.test(v) ? parseFloat(v) : NaN);
const TRIVIAL = /^(0px|none|normal|0s|auto|rgba\(0, 0, 0, 0\)|start|matrix\(1, 0, 0, 1, 0, 0\))$/;
const COLORS = /(rgba?|color)\([^)]*\)/g;
/** 기본값 키워드(0px, none, normal, 투명 …). 모양이 없다 */
const keyword = (value: string) => splitTop(value).every((v) => TRIVIAL.test(v));
/**
 * 키워드는 아니지만 브랜드 항목이 아닌 값. 바뀌지 않아도 빈틈이 아니다. 정적 검사(scripts/audit/report.ts)와 같은 기준이다
 * - 음수·1px 간격은 배치값(GEOMETRY). 소수 셋째 자리까지 있는 간격은 auto·%를 브라우저가 계산한 값이다
 * - line-height가 글자 크기와 같으면 line-height: 1(KEYWORD)
 * - 크기가 0인 그림자는 보이지 않는다. 퍼센트 반경은 원·타원 모양이다
 * - 너비나 높이가 0인 ::before·::after의 테두리는 삼각형 그림이다(isTriangle)
 */
function trivial(prop: string, value: string, el: Record<string, string>, selector: string): boolean {
  if (/radius$/.test(prop) && value.endsWith("%")) return true;
  if (/^(padding|margin)-|gap$/.test(prop) && (value.startsWith("-") || value === "1px" || /\.\d{3,}px$/.test(value))) return true;
  if (prop === "line-height" && px(value) === px(el["font-size"])) return true;
  if (prop === "box-shadow" && splitTop(value).every((v) => /^(inset|0px|\s)*$/.test(v.replace(COLORS, "").trim()))) return true;
  if (/^border-/.test(prop) && /::(before|after)$/.test(selector) && (el.width === "0px" || el.height === "0px")) return true;
  const side = /^border-(\w+)-color$/.exec(prop)?.[1];
  if (side) return el[`border-${side}-width`] === "0px";
  if (prop === "outline-color") return el["outline-width"] === "0px";
  if (/-timing-function$/.test(prop)) return keyword(el[prop.replace("timing-function", "duration")] ?? "0s");
  return false;
}

/**
 * 글자 크기를 따라 바뀐 길이인가. em 단위나 줄 간격 배수는 글자 크기가 바뀌면 계산값(px)도 바뀌지만 그 속성의 hook이 닿은 것이 아니다.
 * 글자 크기 자신은 부모의 글자 크기와 견준다(상대 크기 1em·%)
 */
function followsFont(p: Probe): boolean {
  const [fb, fs] = (p.prop === "font-size" ? (p.parent ?? ["", ""]) : p.fontSize).map(px);
  const [b, s] = [px(p.base), px(p.sentinel)];
  if (!fb || !fs || fb === fs || !b || isNaN(s)) return false;
  return Math.abs(b / fb - s / fs) <= 0.005 * Math.abs(b / fb);
}

// 고정 목록의 매처는 정적 검사의 원본 선언(선택자 전체, rem 값)에 맞춘 것이라 계산값과 맞지 않는 항목이 있다. 그 항목의 계산값 매처다.
// 매처가 빈 항목(form-letter-spacing, object-icon-background)은 정적 검사에 들어오는 선언이 없지만 계산값으로는 드러난다
const CONTROL = /\.slds-(button|input|input_faux|select|radio_button|checkbox_button)(?![\w-])/;
const COMPUTED_FIXED: Record<string, (p: Probe) => boolean> = {
  // 텍스트 컨트롤의 line-height 1.875rem(30px)
  "lex-control-height": (p) => p.prop === "line-height" && p.base === "30px" && CONTROL.test(p.selector),
  // 브라우저 기본 스타일이 폼 요소의 letter-spacing을 normal로 다시 정한다
  "form-letter-spacing": (p) => p.prop === "letter-spacing" && /^(button|input|select|textarea)(?![\w-])/.test(p.selector),
  // SLDS 2가 개체 아이콘 클래스마다 c hook으로 정한 배경색
  "object-icon-background": (p) => p.prop === "background-color" && /\.slds-icon-(standard|custom|action|doctype)-/.test(p.selector),
};

// 계산값은 longhand다. 고정 목록의 속성(shorthand)과 맞추려고 방향을 뺀 이름도 본다: border-top-left-radius → border-radius
const family = (prop: string) => [prop, prop.replace(/-(top|right|bottom|left)(?=-|$)/g, "").replace(/^(row|column)-gap$/, "gap")];

/** 9.4 고정 목록 중 이 값에 맞는 항목. 동적 검사는 지금(synthetic)만 재므로 두 모드 모두 고정인 항목만 본다 */
export function fixedOf(p: Probe, fixed: FixedItem[]): FixedItem | undefined {
  const names = family(p.prop);
  const target = `${p.comp} ${p.selector}`;
  return fixed.find(
    (f) =>
      f.mode === "both" &&
      (COMPUTED_FIXED[f.id]?.(p) ||
        [f.match].flat().some(
          (m) =>
            m.source !== "js" &&
            (!m.selector || m.selector.test(target)) &&
            (!m.property || [m.property].flat().some((q) => names.some((n) => n === q || n.startsWith(`${q}-`)))) &&
            (!m.value || m.value.test(p.base)),
        )),
  );
}

/** 계산값 한 쌍 → 명세 항목별 판정. 판정할 것이 없으면 빈 배열 */
export function judgeProbe(p: Probe, ctx: JudgeContext): Verdict[] {
  // 부모 값을 그대로 상속했으면 부모에서 이미 판정했다
  if (p.parent && INHERITED.has(p.prop) && p.parent[0] === p.base && p.parent[1] === p.sentinel) return [];
  const fontRelative = followsFont(p);
  // em·상대 글자 크기는 브랜드 값이 아니다(정적 검사도 뺀다). 줄 간격 배수는 hook이 닿지 않은 값이라 바뀌지 않은 것으로 본다
  if (fontRelative && p.prop !== "line-height") return [];
  const color = COLOR_PROP.test(p.prop);
  const item = categoryItem(p.prop, p.state);

  if (p.base !== p.sentinel && !fontRelative) {
    const items = new Set(matchHooks(p.prop, p.sentinel, ctx.fingerprints).flatMap((h) => ctx.hookItems.get(h) ?? []));
    if (item && (!color || !items.size)) items.add(item);
    return [...items].map((i) => ({ item: i, status: "reached" }));
  }

  // 키워드 값이어도 부모는 바뀌었는데 이 요소가 상속을 끊고 그대로면(폼 요소의 자간 normal 등) 빈틈이다
  const parentChanged = p.parent !== undefined && p.parent[0] !== p.parent[1];
  if (!item || (keyword(p.base) ? !parentChanged : trivial(p.prop, p.base, p.el, p.selector))) return [];
  // 체크박스·라디오·range·파일 input은 숨기거나 브라우저가 그린다. 글자색과 포커스 윤곽은 보이는 faux 요소가 맡는다
  if (UA_INPUT.test(p.selector) && (color || p.prop.startsWith("outline"))) return [];
  if (color && ctx.brandColors.has(p.base)) return [];
  const f = fixedOf(p, ctx.fixed);
  return [f ? { item, status: "fixed", fixed: f.label } : { item, status: "gap" }];
}

export type Cell = { reached: number; gap: number; fixed: number };
export type CellStatus = "반영" | "일부" | "빈틈" | "고정" | "";

/** 컴포넌트 × 항목 칸의 상태. 일부는 같은 컴포넌트에서 바뀐 값과 바뀌지 않은 값이 함께 있는 것이다 */
export function cellStatus(c: Cell | undefined): CellStatus {
  if (!c) return "";
  if (c.reached) return c.gap ? "일부" : "반영";
  if (c.gap) return "빈틈";
  return c.fixed ? "고정" : "";
}

/** 설계 9.6의 4: 항목마다 반영된 컴포넌트 수 / 해당 컴포넌트 수. 반영은 빈틈이 하나도 없는 칸만 센다(정적 검사가 가장 나쁜 선언을 따르는 것과 같다) */
export function itemScore(table: Map<string, Map<string, Cell>>, item: string): { reached: number; total: number } {
  const statuses = [...table.values()].map((row) => cellStatus(row.get(item))).filter((s) => s !== "");
  return { reached: statuses.filter((s) => s === "반영").length, total: statuses.length };
}
