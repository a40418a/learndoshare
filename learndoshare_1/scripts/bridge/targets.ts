// 브리지 대상 (설계 5.6 표).
// 선택자는 SLDS 2 CSS 규칙의 선택자 목록을 그대로 쓴다(부분마다 공백을 하나로 줄여 ", "로 잇는다).
// 선언이 많은 움직임(217선언)은 설치된 SLDS 2 CSS에서 모으고, 나머지는 손으로 적는다.
// 2026-10-14 사용자 결정으로 컨트롤 높이, Path 양 끝 반경, 컨트롤·정렬 아이콘 크기, 폼 요소 자간, 선택지 라벨 굵기, 비활성 커서, 링크 hover 밑줄,
// 팝오버 꼬리 그림자, 개체 아이콘 색은 잇지 않는다(lib/fixed-list.ts의 고정 항목). 줄인 움직임 규칙도 넣지 않는다(Salesforce 기본에 맡긴다)
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
 */
export type BridgeTarget = { id: string; selectors: string[]; property: string; varName: string; min?: string; token?: string };

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
  // lightning-combobox(선택형)는 slds-input 대신 slds-input_faux만 붙인다
  T("input-border-width", [".slds-input", ".slds-input_faux, .slds-input--faux", ".slds-textarea"], "border", { token: "1px" }),
  // 모달 너비(@media (min-width: 48em) 안). 너비와 최대 너비를 같은 변수로 잇는다(브랜드 값이 그대로 너비가 된다).
  // base는 크기 클래스가 없는 모달, medium은 lightning-modal 기본 크기
  T("modal-width-base", [".slds-modal__container"], "width"),
  T("modal-width-base", [".slds-modal__container"], "max-width"),
  T("modal-width-small", [modal("small")], "width"),
  T("modal-width-small", [modal("small")], "max-width"),
  T("modal-width-medium", [modal("medium")], "width"),
  T("modal-width-medium", [modal("medium")], "max-width"),
  T("modal-width-large", [modal("large")], "width"),
  T("modal-width-large", [modal("large")], "max-width"),
  // full은 90%만 바꾼다. 작은 화면(@media (max-width: 30em))의 100%·최소 0은 전체 화면이라 그대로 둔다. 최대 너비는 none이다
  T("modal-width-full", [modal("full")], "width", { token: "90%" }),
  T("modal-min-width", [".slds-modal__container"], "min-width"),
  T("modal-min-width", ["small", "medium", "large", "full"].map(modal), "min-width", { token: "40rem" }),
  // 대문자 제목은 넓은 자간(0.0625rem)이 있어 브랜드 자간과 따로 둔다
  T("caps-transform", [".slds-text-title_caps, .slds-text-title--caps", ".slds-section-title_divider, .slds-section-title--divider"], "text-transform"),
  T("caps-letter-spacing", [".slds-text-title_caps, .slds-text-title--caps", ".slds-section-title_divider, .slds-section-title--divider"], "letter-spacing"),
  // 세로 내비 선택 바탕(2026-10-12 결정). 원본 선택자 목록에 같은 부분이 두 번 있어 그대로 둔다
  T(
    "nav-selected-background",
    [
      [
        ".slds-navigation-list-vertical .slds-is-active .slds-navigation-list-vertical__action",
        ".slds-navigation-list--vertical .slds-is-active .slds-navigation-list-vertical__action",
        ".slds-navigation-list_vertical .slds-is-active .slds-navigation-list-vertical__action",
        ".slds-navigation-list--vertical .slds-is-active .slds-navigation-list-vertical__action",
        ".slds-navigation-list-vertical .slds-is-active .slds-navigation-list--vertical__action",
        ".slds-navigation-list--vertical .slds-is-active .slds-navigation-list--vertical__action",
        ".slds-navigation-list_vertical .slds-is-active .slds-navigation-list--vertical__action",
        ".slds-navigation-list--vertical .slds-is-active .slds-navigation-list--vertical__action",
      ].join(", "),
    ],
    "background-color",
  ),
];

// 바꾸지 않는 움직임: 스피너(점별 지연이 1000ms 기준), Agentforce 영역(고정 목록)
const MOTION_EXCLUDED = /spinner|subtheme-agentic/;

/** 설치된 SLDS 2 CSS에서 움직임 대상을 모은다. hook·키워드 값은 브랜드가 이미 바꾸거나 바꿀 것이 없어 뺀다 */
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
    }
  }
  return [...sel].map(([k, keys]) => {
    const { id, property, ...extra } = JSON.parse(k);
    return T(id, [...keys], property, extra);
  });
}

export const BRIDGE_TARGETS: BridgeTarget[] = [...LISTED, ...collect(readSlds2Css())];
