// 동적 반영 검사(설계 9.6의 2)의 판정. Storybook "시작하기/반영 검사"(stories/start/reflect-check-page.ts)가 기본 브랜드와
// 센티널 브랜드(lib/sentinel.ts)로 같은 스토리를 그려 요소마다 잰 계산값 한 쌍(Probe)을 명세 항목의 반영·빈틈·고정으로 나눈다.
// 브라우저에서도 import하므로 Node 모듈을 쓰지 않는다
//
// 계산값 변화 → 명세 항목 (판단 근거)
// 1. 지문: 센티널은 hook마다 다른 값을 넣었다. 바뀐 계산값(또는 쉼표로 나눈 한 부분)이 어떤 hook의 계산값과 같으면 그 hook이 닿은 것이고,
//    그 hook을 가진 명세 항목(SPEC_ITEMS의 hooks·bridgeVars)에 넣는다. 정적 검사가 hook 선언을 "그 hook을 가진 항목 모두"에 넣는 것과 같다
// 2. 속성 묶음: 지문만으로는 모자라다. 계산값이 hook 여러 개를 거치거나(calc, 상속) 형식이 바뀌고(줄 간격 배수 → px),
//    s hook을 함께 정하면 그 s hook의 기본값인 g hook이 가려진다(버튼 반경은 s button-radius-border가 이기지만 실제 브랜드가 g만 바꿔도 닿는다).
//    그래서 모양·글자·움직임 속성은 정적 검사의 규칙 표(scripts/audit/report.ts ruleItem)처럼 속성 이름으로 항목 하나를 함께 고른다.
//    색은 항목이 잘게 나뉘어(바탕·글자·테두리·비활성·피드백…) 속성 이름만으로 고르면 틀리기 쉬워, 지문이 없을 때만 속성으로 고른다.
//    간격·너비·높이는 레이아웃(auto 가운데 정렬, %, 내용 크기)으로도 바뀌어, 같은 무리의 hook 지문이 맞을 때만 센다
// 3. 바뀌지 않은 값(빈틈 후보)은 속성 묶음으로만 항목을 고른다. 0px·none·투명처럼 아무 모양이 없는 값, 부모에게서 그대로 상속한 값은
//    빈틈으로 세지 않는다. 9.4 고정 목록(FIXED_ITEMS)에 맞으면 "고정"이다. 브랜드 색(org 테마가 원본)과 같은 값은 판정하지 않고 따로 센다
import type { FixedItem } from "./fixed-list.ts";
import type { Kind } from "./sentinel.ts";
import type { SpecItem } from "./spec-items.ts";

export type State = "static" | "disabled" | "focus";
export type Probe = {
  comp: string;
  /** 요소를 나타내는 선택자: 태그, 클래스, input의 type, readonly, part, 상태(:focus), 가상 요소(::before) */
  selector: string;
  /** 가까운 조상 몇 개의 선택자(먼 것부터). 정적 검사에 선언이 들어오지 않는 후손 선택자 고정(choice-label-weight)만 쓴다 */
  context?: string[];
  /** 이 요소의 스타일을 정하는 컴포넌트 태그(lightning-base-combobox). 기본 컴포넌트 CSS의 고정 선언은 그 폴더(baseCombobox) 안에서만 맞는다 */
  host?: string;
  /** 고정 선언의 선택자가 이 요소에 맞는가(페이지가 el.matches로 만든다). 없으면 고정 선언은 보지 않는다 */
  matches?: (selector: string) => boolean;
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
/** brand: 바뀌지 않았지만 브랜드 색(org 테마가 원본)과 같은 값이라 판정하지 않았다. 페이지가 수만 따로 보여 준다 */
export type Verdict = { item: string; status: "reached" | "gap" | "fixed" | "brand"; fixed?: string };
export type JudgeContext = {
  /** `${무리}|${계산값}` → hook 이름 (fingerprintKey) */
  fingerprints: Map<string, string[]>;
  hookItems: Map<string, string[]>;
  /** 기본 브랜드에서 잰 브랜드 색 계열 hook의 계산값(rgb(…)) */
  brandColors: Set<string>;
  fixed: FixedItem[];
  /** 정적 검사가 고정으로 판정한 선언(FixedRule). 없으면 계산값 매처만 본다 */
  rules?: FixedRule[];
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

/**
 * 지문 무리. hook 종류와 속성이 맞을 때만 지문을 쓴다: 반경 속성 ↔ 반경 hook, 간격 ↔ 간격 hook, 테두리 두께 ↔ 두께 hook, 너비·높이 ↔ 크기 hook.
 * 간격 hook을 calc로 곱한 값(Tree 4단 들여쓰기 = spacing-4 × 4 = 33px)이 우연히 반경 hook 값(33px)과 같아도 반경 hook으로 세지 않는다
 */
const KIND_GROUP: Record<Kind, string | null> = {
  color: "color",
  alias: "color",
  radius: "radius",
  border: "border-width",
  spacing: "spacing",
  size: "size",
  wide: "size",
  "font-size": "font-size",
  letter: "letter-spacing",
  weight: "font-weight",
  "line-height": null,
  time: "duration",
  easing: "timing",
  shadow: "box-shadow",
  "focus-shadow": "box-shadow",
  transform: "transform",
  align: "text-align",
  "font-style": "font-style",
  "text-transform": "text-transform",
};
function propGroup(prop: string): string {
  if (/radius$/.test(prop)) return "radius";
  if (/^border-\w+-width$/.test(prop)) return "border-width";
  if (/^(padding|margin)-|gap$/.test(prop)) return "spacing";
  if (prop === "width" || prop === "height") return "size";
  if (COLOR_PROP.test(prop)) return "color";
  if (/-duration$/.test(prop)) return "duration";
  if (/-timing-function$/.test(prop)) return "timing";
  return prop;
}
// 레이아웃으로도 바뀌는 무리. 같은 무리의 지문이 맞을 때만 반영으로 센다
const LAYOUT_GROUPS = new Set(["spacing", "size"]);

/** 센티널 hook의 계산값을 지문 지도에 넣을 키. 줄 간격처럼 잴 수 없는 종류는 undefined */
export const fingerprintKey = (kind: Kind, value: string) => (KIND_GROUP[kind] ? `${KIND_GROUP[kind]}|${value}` : undefined);

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
const TRANSPARENT = "rgba(0, 0, 0, 0)";
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
  if (/^border-/.test(prop) && /::(before|after)$/.test(selector)) {
    // 정적 검사 isTriangle과 같다: 너비·높이가 0이거나, 투명한 변과 색이 있는 변이 함께 있다(select 화살표처럼 border-box면 너비가 테두리 두께다)
    const colors = SIDES.map((s) => el[`border-${s}-color`]).filter(Boolean);
    if (el.width === "0px" || el.height === "0px" || (colors.includes(TRANSPARENT) && colors.some((c) => c !== TRANSPARENT))) return true;
  }
  const side = /^border-(\w+)-color$/.exec(prop)?.[1];
  if (side) return el[`border-${side}-width`] === "0px";
  if (prop === "outline-color") return el["outline-width"] === "0px";
  // 곡선: 시간이 0이면 곡선이 없다. ease는 CSS 초기값이다(animation: x 1s처럼 곡선을 적지 않은 shorthand). 정적 검사도 적은 곡선만 센다
  if (/-timing-function$/.test(prop)) return keyword(el[prop.replace("timing-function", "duration")] ?? "0s") || splitTop(value).every((v) => v === "ease");
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

/**
 * 9.4 고정 선언 하나. scripts/generate-slds-catalog.ts의 fixedRulesOf가 정적 검사 판정에서 만든다(stories/slds-catalog/fixed-rules.js).
 * 정적 검사가 지금 모드에서 두 모드 고정으로 판정한 선언의 선택자(목록을 하나씩 나눈 것, 가상 요소는 pseudo로 뗀다)와 속성이다.
 * comp는 기본 컴포넌트 CSS 선언의 폴더 이름이다(그 컴포넌트 안에서만 맞는다)
 */
export type FixedRule = { selector: string; pseudo: string; prop: string; id: string; comp?: string };

// 고정은 정적 검사와 같은 범위에서만 맞춘다(설계 9.6의 4: 범위를 넓히려면 합의가 필요하다).
// 정적 검사는 매처를 선언의 선택자에 맞추므로(쉼표 목록, 후손 선택자, :first-child 포함), 동적 검사는 그 선언의 선택자가 요소에 맞는지
// (브라우저 el.matches)와 속성으로 본다. 정규식을 계산값 선택자에 다시 맞추면 조상만 맞아도 고정이 되거나(넓음) 목록·후손 선언이 새어(좁음) 어긋난다.
// 아래는 정적 검사에 선언이 들어오지 않는 고정 항목만 계산값으로 맞춘다
const COMPUTED_FIXED: Record<string, (p: Probe) => boolean> = {
  // 브라우저 기본 스타일이 폼 요소의 letter-spacing을 normal로 다시 정한다(매처가 비어 있다)
  "form-letter-spacing": (p) => p.prop === "letter-spacing" && /^(button|input|select|textarea)(?![\w-])/.test(p.selector),
  // SLDS 2가 개체 아이콘 클래스마다 c hook으로 정한 배경색(매처가 비어 있다)
  "object-icon-background": (p) => p.prop === "background-color" && /\.slds-icon-(standard|custom|action|doctype)-/.test(p.selector),
  // SLDS 2 값이 키워드(normal)라 정적 검사에 들어오지 않는다(lib/fixed-list.ts). 원본은 `.slds-radio .slds-form-element__label` 꼴의 후손 선택자다
  "choice-label-weight": (p) =>
    p.prop === "font-weight" &&
    /\.slds-form-element__label(?![\w-])/.test(p.selector) &&
    (p.context ?? []).some((s) => /\.slds-(radio|checkbox|checkbox_toggle)(?![\w-])/.test(s)),
};
/** 정적 검사에 선언이 들어오지 않아 계산값으로 맞추는 고정 항목 id */
export const COMPUTED_FIXED_IDS = Object.keys(COMPUTED_FIXED);

/**
 * 동적 검사로 맞출 수 없는 두 모드 고정 항목과 이유. 페이지가 고정 목록 옆에 보여 준다.
 * tests/sentinel.test.ts가 두 모드 고정 항목마다 고정 선언·계산값 매처·여기 중 하나에 있는지 확인한다
 */
export const UNMATCHED_FIXED: Record<string, string> = {
  "icon-glyph": "채움색(fill)과 아이콘 너비·높이는 빈틈으로 세지 않는다",
  "z-index": "z-index는 재지 않는다",
  opacity: "투명도는 재지 않는다",
  "button-hover-shadow": "hover 상태는 재지 않는다",
  "breadcrumb-press": "눌림(:active) 상태와 transform은 재지 않는다",
  "fade-gradient": "그라데이션(background-image)은 재지 않는다",
  "control-sort-icon-size": "아이콘 너비·높이는 빈틈으로 세지 않는다",
  "disabled-cursor-link-underline": "커서와 밑줄(text-decoration)은 재지 않는다",
  "destructive-success-text":
    "정적 검사에 이 항목으로 고정된 선언이 없다(SLDS 2 선택자에 글자색 선언이 없고 c hook으로 정해진다). 흰 글자는 브랜드 흰색(on-accent)과 같아 판정하지 않고 따로 센다",
};

// 계산값은 물리 longhand다(border-top-width). 고정 선언은 shorthand와 논리 속성(padding-block, border-block-start-width)을 쓴다.
// Storybook은 가로쓰기 왼쪽→오른쪽이라 물리 방향과 논리 방향이 하나로 대응한다
const LOGICAL: Record<string, [string, string]> = { top: ["block", "start"], bottom: ["block", "end"], left: ["inline", "start"], right: ["inline", "end"] };
const CORNER: Record<string, string> = { "top-left": "start-start", "top-right": "start-end", "bottom-right": "end-end", "bottom-left": "end-start" };
/** 계산값 속성과 같은 값을 정하는 이름들: 자신, shorthand, 논리 속성. 예: padding-top → padding, padding-block, padding-block-start */
export function family(prop: string): string[] {
  const out = new Set([prop]);
  const corner = /^border-(top|bottom)-(left|right)-radius$/.exec(prop);
  if (corner) out.add("border-radius").add(`border-${CORNER[`${corner[1]}-${corner[2]}`]}-radius`);
  const side = /^(padding|margin|border)-(top|right|bottom|left)(-width|-color)?$/.exec(prop);
  if (side) {
    const [, base, dir, suffix = ""] = side;
    const [axis, end] = LOGICAL[dir];
    for (const name of [base, `${base}-${axis}`, `${base}-${axis}-${end}`]) out.add(name).add(name + suffix);
  }
  if (/^(row|column)-gap$/.test(prop)) out.add("gap");
  return [...out];
}

/** 컴포넌트 태그 → 기본 컴포넌트 폴더 이름: lightning-base-combobox → baseCombobox (정적 검사의 lbc 컴포넌트 이름) */
export const folderOf = (tag: string) => tag.replace(/^(lightning|c)-/, "").replace(/-(\w)/g, (_, c: string) => c.toUpperCase());

/** 고정 선언의 속성(shorthand·논리 속성)이 이 계산값 속성을 정하는가 */
export const coversProp = (ruleProp: string, prop: string) => family(prop).some((n) => n === ruleProp || n.startsWith(`${ruleProp}-`));

/**
 * 9.4 고정 목록 중 이 값에 맞는 항목. 동적 검사는 지금(synthetic)만 재므로 두 모드 고정만 본다.
 * 고정 선언(rules)은 선택자가 요소에 맞고(p.matches), 가상 요소와 속성이 같고, 기본 컴포넌트 선언이면 그 컴포넌트 안일 때 맞는다
 * ponytail: 같은 요소·속성에 맞는 선언 중 어느 것이 이겼는지(우선순위, @media)는 보지 않는다. 고정 선언이 하나라도 맞으면 고정이다
 */
export function fixedOf(p: Probe, fixed: FixedItem[], rules: FixedRule[] = []): FixedItem | undefined {
  const pseudo = /::(before|after)$/.exec(p.selector)?.[0] ?? "";
  const folder = p.host ? folderOf(p.host) : undefined;
  const rule = rules.find((r) => r.pseudo === pseudo && (!r.comp || r.comp === folder) && coversProp(r.prop, p.prop) && p.matches?.(r.selector));
  if (rule) return fixed.find((f) => f.id === rule.id);
  // 선택자 없는 매처(미세 간격 0.125rem 이하 "어디서나" 등)는 선택자에 묶이지 않으므로 계산값에 그대로 맞춘다(브라우저 기본 스타일의 2px 포함)
  const anywhere = (f: FixedItem) =>
    [f.match].flat().some((m) => !m.selector && m.source !== "js" && !!m.property && [m.property].flat().some((q) => coversProp(q, p.prop)) && (!m.value || m.value.test(p.base)));
  return fixed.find((f) => f.mode === "both" && (COMPUTED_FIXED[f.id]?.(p) || anywhere(f)));
}

/**
 * 예제가 꾸민 호스트인가. 공식 예제는 호스트에 자기 클래스(custom-box 등)를 붙이고 예제 CSS로 padding·테두리·바탕을 정한다.
 * 컴포넌트가 호스트에 붙이는 클래스는 slds-·fix-로 시작하므로, 그 밖의 클래스가 있으면 호스트 자신은 판정하지 않는다(그 shadow 안은 판정한다)
 */
export const exampleStyledHost = (classes: string[]) => classes.some((c) => !/^(slds-|fix-)/.test(c));

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
    const group = propGroup(p.prop);
    // 간격·크기는 레이아웃으로도 바뀐다(auto 가운데 정렬, %, 내용 크기). 같은 무리의 지문이 맞을 때만 센다.
    // 글자가 정하는 너비는 소수가 제멋대로라(1/64px) 기본값이 0.25px 단위가 아니면 크기 hook이 정한 값이 아니다. 우연히 지문과 같아져도 세지 않는다
    // ponytail: 0.25px 단위 기본값끼리 우연히 지문과 같아지는 경우는 남는다. 오탐이 보이면 크기 hook마다 너비·높이 둘 다 맞는지 본다
    if (group === "size" && !Number.isInteger(px(p.base) * 4)) return [];
    const hooks = matchHooks(p.prop, p.sentinel, ctx.fingerprints);
    if (!hooks.length && LAYOUT_GROUPS.has(group)) return [];
    const items = new Set(hooks.flatMap((h) => ctx.hookItems.get(h) ?? []));
    if (item && (!color || !items.size)) items.add(item);
    return [...items].map((i) => ({ item: i, status: "reached" }));
  }

  // 키워드 값이어도 부모는 바뀌었는데 이 요소가 상속을 끊고 그대로면(폼 요소의 자간 normal 등) 빈틈이다
  const parentChanged = p.parent !== undefined && p.parent[0] !== p.parent[1];
  if (!item || (keyword(p.base) ? !parentChanged : trivial(p.prop, p.base, p.el, p.selector))) return [];
  // 체크박스·라디오·range·파일 input은 숨기거나 브라우저가 그린다. 글자색과 포커스 윤곽은 보이는 faux 요소가 맡는다
  if (UA_INPUT.test(p.selector) && (color || p.prop.startsWith("outline"))) return [];
  const f = fixedOf(p, ctx.fixed, ctx.rules);
  if (f) return [{ item, status: "fixed", fixed: f.label }];
  // 브랜드 색과 같은 값은 org 테마가 원본이라 util.css 항목의 빈틈이 아니다. 하드코딩된 흰색도 on-accent(흰색)와 같아 여기로 온다
  return [{ item, status: color && ctx.brandColors.has(p.base) ? "brand" : "gap" }];
}

export type Cell = { reached: number; gap: number; fixed: number };
export type CellStatus = "반영" | "일부" | "빈틈" | "고정" | "";

/**
 * 정적 검사(scripts/audit/report.ts)와 같은 칸 상태: 가장 나쁜 상태를 따른다(빈틈 > 고정 > 반영).
 * 일부는 빈틈 중에서 바뀐 값도 함께 있는 칸이다. itemScore의 strict가 이 상태로 센다
 */
export function cellStatus(c: Cell | undefined): CellStatus {
  if (!c) return "";
  if (c.gap) return c.reached ? "일부" : "빈틈";
  if (c.fixed) return "고정";
  return c.reached ? "반영" : "";
}

/**
 * 칸에 보일 글자. "원본과 hook" 보기(stories/salesforce-source.js)와 같은 꼴이다: 상태 (hook n · 고정 m · 빈틈 k).
 * hook이 닿고 고정도 섞인 칸은 "일부 (hook·고정)"로 보인다. 고정만 있는 칸과 구별해 브랜드가 닿는 컴포넌트를 닿지 않는 것처럼 보이지 않게 한다
 */
export function cellLabel(c: Cell | undefined): string {
  if (!c || !(c.reached + c.gap + c.fixed)) return "";
  const label = !(c.fixed + c.gap) ? "반영" : !c.reached ? (c.gap ? "빈틈" : "고정") : "일부";
  const parts = [c.reached && `hook ${c.reached}`, c.fixed && `고정 ${c.fixed}`, c.gap && `빈틈 ${c.gap}`].filter(Boolean);
  return `${label} (${parts.join(" · ")})`;
}

/**
 * 설계 9.6의 4: 항목마다 반영된 컴포넌트 수 / 해당 컴포넌트 수
 * - reached: hook이 닿고 빈틈이 없는 컴포넌트. 9.4 고정은 "모든 컴포넌트" 요구의 합의된 예외라 섞여 있어도 반영으로 센다
 * - strict: 정적 검사의 byItem과 같은 셈(고정이 섞인 칸은 반영이 아니다). 두 검사를 나란히 견줄 때 쓴다
 */
export function itemScore(table: Map<string, Map<string, Cell>>, item: string): { reached: number; strict: number; total: number } {
  const cells = [...table.values()].map((row) => row.get(item)).filter((c): c is Cell => !!c && c.reached + c.gap + c.fixed > 0);
  return {
    reached: cells.filter((c) => c.reached && !c.gap).length,
    strict: cells.filter((c) => cellStatus(c) === "반영").length,
    total: cells.length,
  };
}
