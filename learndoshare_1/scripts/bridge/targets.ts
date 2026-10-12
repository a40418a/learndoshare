// 브리지 대상 (설계 5.6 표에서 개체 아이콘을 뺀 것. 개체 아이콘은 Task 16).
// 선택자는 SLDS 2 CSS 규칙의 선택자 목록을 그대로 쓴다(부분마다 공백을 하나로 줄여 ", "로 잇는다).
// 선언이 많은 항목(움직임 217선언, 비활성 커서, 링크 hover 밑줄, 팝오버 꼬리 그림자)은 설치된 SLDS 2 CSS에서 모으고, 나머지는 손으로 적는다
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { list } from "postcss";
import { BRIDGE_VARS } from "../../lib/bridge-vars.ts";
import { classify } from "../audit/classify.ts";

/**
 * - selectors: 원본 규칙의 선택자 목록. 같은 선택자 규칙이 여러 맥락(@media 등)에 있으면 모두 잇는다
 * - property: 브리지가 정하는 속성. 움직임 longhand는 원본 shorthand에서 값을 꺼낸다
 * - min: 값을 max(var(…), min)으로 감싼다
 * - token: 값 전체가 아니라 이 값만 변수로 바꾼다(calc 안, border shorthand 안)
 * - initial: 원본에 선언이 없을 때 쓰는 브라우저 기본값. 이것이 있을 때만 새 선언을 넣는다
 */
export type BridgeTarget = { id: string; selectors: string[]; property: string; varName: string; min?: string; token?: string; initial?: string };

/** 선택자 목록을 비교용 문자열로 바꾼다 */
export const selectorKey = (selector: string) => list.comma(selector).map((s) => s.replace(/\s+/g, " ").trim()).join(", ");

const root = fileURLToPath(new URL("../..", import.meta.url));
export function readSlds2Css(): string {
  const dir = dirname(createRequire(join(root, "package.json")).resolve("@salesforce-ux/design-system-2/package.json"));
  return readFileSync(join(dir, "dist/css/bundled/slds2.cosmos.css"), "utf8");
}

// 움직임 시간 묶음(전역 제약). 묶음 밖 값(0.12s, 0.4s 초과)은 바꾸지 않는다
const MOTION_BUCKETS: [string, number, number][] = [
  [BRIDGE_VARS["motion-duration-fast"], 0, 0.1],
  [BRIDGE_VARS["motion-duration-medium"], 0.15, 0.2],
  [BRIDGE_VARS["motion-duration-slow"], 0.25, 0.4],
];
/** 시간 값이 든 묶음의 변수 이름. 묶음 밖이거나 시간 값이 아니면 undefined */
export function bucketOf(time: string): string | undefined {
  const m = /^(\d*\.?\d+)(ms|s)$/.exec(time);
  if (!m) return undefined;
  const sec = Number(m[1]) / (m[2] === "ms" ? 1000 : 1);
  return MOTION_BUCKETS.find(([, lo, hi]) => sec > lo - 1e-9 && sec <= hi + 1e-9 && sec > 0)?.[0];
}

const EASING = /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$|^(cubic-bezier|steps|linear)\(/;
// 계단 곡선은 프레임 애니메이션이라 바꾸지 않는다
export const isSmoothEasing = (t: string) => EASING.test(t) && !/^step/.test(t);

/**
 * transition·animation shorthand 항목마다 longhand 값을 꺼낸다(설계 5.6 브리지 판정 계약: 시간은 -duration, 곡선은 -timing-function).
 * 시간은 항목의 첫 시간 값(calc() 포함), 곡선은 곡선 값. 없으면 초기값 0s·ease(이 ease도 브랜드 곡선을 따른다).
 * var()가 있으면 알 수 없어 실패한다
 */
export function motionLonghand(shorthand: string, part: "duration" | "timing-function"): string[] {
  return list.comma(shorthand).map((item) => {
    const tokens = list.space(item);
    if (tokens.some((t) => /var\(/.test(t))) throw new Error(`var()가 든 움직임 shorthand는 나눌 수 없다: ${shorthand}`);
    const found = tokens.find((t) => (part === "duration" ? /^(\d*\.?\d+m?s|calc\()/.test(t) : EASING.test(t)));
    return found ?? (part === "duration" ? "0s" : "ease");
  });
}

const T = (id: string, selectors: string[], property: string, extra: Partial<BridgeTarget> = {}): BridgeTarget => ({
  id,
  selectors,
  property,
  varName: BRIDGE_VARS[id],
  ...extra,
});
const modal = (size: string) => `.slds-modal_${size} .slds-modal__container, .slds-modal--${size} .slds-modal__container`;

// 손으로 적는 대상(설계 5.6 표의 "대상")
const LISTED: BridgeTarget[] = [
  // 버튼(드롭다운 아이콘 버튼 포함)·입력·선택·버튼형 라디오·체크박스의 1.875rem. 선택은 높이 calc 안의 값만 바꿔 다른 컨트롤과 같이 움직인다
  T(
    "control-height",
    [
      ".slds-button",
      ".slds-button_icon-more, .slds-button--icon-more",
      ".slds-button_icon-container-more, .slds-button--icon-container-more",
      ".slds-input",
      ".slds-input_faux, .slds-input--faux",
      ".slds-radio_button, .slds-radio--button",
      ".slds-checkbox_button, .slds-checkbox--button",
    ],
    "line-height",
  ),
  T("control-height", [".slds-select"], "height", { token: "1.875rem" }),
  T("control-height", [".slds-select[size], .slds-select[multiple]"], "min-height", { token: "1.875rem" }),
  T("input-border-width", [".slds-input", ".slds-textarea"], "border", { token: "1px" }),
  T("path-end-radius", [".slds-path__item:first-child"], "border-start-start-radius"),
  T("path-end-radius", [".slds-path__item:first-child"], "border-end-start-radius"),
  T("path-end-radius", [".slds-path__item:last-child"], "border-start-end-radius"),
  T("path-end-radius", [".slds-path__item:last-child"], "border-end-end-radius"),
  T("control-icon-size", [".slds-button__icon, .slds-button__icon_stateful, .slds-button__icon--stateful", ".slds-input-has-icon .slds-input__icon"], "width"),
  T("control-icon-size", [".slds-button__icon, .slds-button__icon_stateful, .slds-button__icon--stateful", ".slds-input-has-icon .slds-input__icon"], "height"),
  // lightning-modal의 size medium(기본)·large. 너비와 최대 너비를 같은 변수로 잇는다(브랜드 값이 그대로 너비가 된다)
  T("modal-width-medium", [modal("medium")], "width"),
  T("modal-width-medium", [modal("medium")], "max-width"),
  T("modal-width-large", [modal("large")], "width"),
  T("modal-width-large", [modal("large")], "max-width"),
  // 폼 컨트롤은 브라우저 기본 스타일이 letter-spacing을 normal로 다시 정해 :root의 자간이 상속되지 않는다(SLDS 2에는 선언이 없다)
  T("letter-spacing", ["button, input, optgroup, select, textarea"], "letter-spacing", { initial: "normal" }),
  T("caps-transform", [".slds-text-title_caps, .slds-text-title--caps", ".slds-section-title_divider, .slds-section-title--divider"], "text-transform"),
  T("choice-label-weight", [".slds-radio .slds-form-element__label", ".slds-checkbox .slds-checkbox__label .slds-form-element__label"], "font-weight"),
];

// 바꾸지 않는 움직임: 스피너(점별 지연이 1000ms 기준), Agentforce 영역(고정 목록)
const MOTION_EXCLUDED = /spinner|subtheme-agentic/;
// 비활성 조건이 :not() 밖에 있는 선택자. :not(:disabled)·:not(.slds-disabled-text)는 활성 상태다
const DISABLED = (selector: string) => list.comma(selector).some((p) => /disabled/i.test(p.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, "")));

/** 설치된 SLDS 2 CSS에서 선언이 많은 항목의 대상을 모은다. hook·키워드 값은 브랜드가 이미 바꾸거나 바꿀 것이 없어 뺀다 */
function collect(sldsCss: string): BridgeTarget[] {
  const sel = new Map<string, Set<string>>();
  const add = (id: string, property: string, key: string, extra: Partial<BridgeTarget> = {}) => {
    const k = JSON.stringify({ id, property, ...extra });
    sel.set(k, (sel.get(k) ?? new Set()).add(key));
  };
  for (const d of classify({ sldsCss, lbcFiles: [] })) {
    if (d.kind === "g" || d.kind === "s" || d.kind === "keyword" || d.kind === "keyframes") continue;
    const key = selectorKey(d.selector);
    const base = /^(transition|animation)/.exec(d.prop)?.[1];
    if (base && !MOTION_EXCLUDED.test(d.selector) && /^(transition|animation)(-duration|-timing-function)?$/.test(d.prop)) {
      const longhand = (part: "duration" | "timing-function") => (d.prop === base ? motionLonghand(d.value, part) : d.prop === `${base}-${part}` ? list.comma(d.value) : []);
      for (const varName of new Set(longhand("duration").map(bucketOf))) {
        const id = Object.keys(BRIDGE_VARS).find((k) => BRIDGE_VARS[k] === varName);
        if (id) add(id, `${base}-duration`, key, { min: "0.01ms" });
      }
      if (longhand("timing-function").some(isSmoothEasing)) add("motion-easing", `${base}-timing-function`, key);
    } else if (d.prop === "cursor" && DISABLED(d.selector)) {
      add("cursor-disabled", "cursor", key);
    } else if (/^text-decoration(-line)?$/.test(d.prop) && /:hover/.test(d.selector) && /underline/.test(d.value)) {
      add("link-decoration-hover", d.prop, key);
    } else if (d.prop === "box-shadow" && /nubbin/.test(d.selector)) {
      add("nubbin-shadow", "box-shadow", key);
    }
  }
  return [...sel].map(([k, keys]) => {
    const { id, property, ...extra } = JSON.parse(k);
    return T(id, [...keys], property, extra);
  });
}

export const BRIDGE_TARGETS: BridgeTarget[] = [...LISTED, ...collect(readSlds2Css())];
