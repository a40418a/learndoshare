import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classify } from "../scripts/audit/classify.ts";
import { buildReport, fixedItemsOf } from "../scripts/audit/report.ts";
import { runAudit, type Sources } from "../scripts/audit/run.ts";
import { SPEC_ITEMS } from "../lib/spec-items.ts";
import { FIXED_ITEMS } from "../lib/fixed-list.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/audit/${name}`, import.meta.url), "utf8");
const sources = (): Sources => ({
  sldsCss: fixture("slds2.css"),
  lbcFiles: [
    { comp: "button", file: "lightning-base-components/src/lightning/button/button.slds.css", css: fixture("button.slds.css") },
    // *.lbc.synthetic.css는 지금(synthetic)만 쓰인다
    { comp: "button", file: "lightning-base-components/src/lightning/button/button.lbc.synthetic.css", css: ".slds-button__icon { width: 0.875rem; }" },
    // 반경 자리에서 간격 hook을 읽으면 모서리 설정이 닿지 않는다. native 모달 반경은 고정 목록에 있다
    {
      comp: "modal",
      file: "lightning-base-components/src/lightning/modal/modal.slds.css",
      css: `:host([data-render-mode="shadow"]) .slds-modal__container { border-radius: var(--slds-g-spacing-1); }`,
    },
  ],
  bridgeCss: fixture("bridge.css"),
  nativeList: ["lightning-button"],
});
const kinds = (css: string) => classify({ sldsCss: css, lbcFiles: [] }).map((d) => d.kind);
const report = () => {
  const s = sources();
  return buildReport(classify(s), SPEC_ITEMS, s.bridgeCss, FIXED_ITEMS);
};

// 기준 파일은 임시 폴더에 쓴다(공백·한글 경로). 저장소 audit/는 건드리지 않는다
const tmp = mkdtempSync(join(tmpdir(), "milvus 감사-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

test("var(--slds-g-radius-border-2)는 g, 0.1s 리터럴 transition은 literal(motion)", () => {
  const [radius, transition] = classify({
    sldsCss: ".slds-button_brand {\n  border-radius: var(--slds-g-radius-border-2);\n  transition: border 0.1s linear;\n}",
    lbcFiles: [],
  });
  assert.deepEqual(
    { src: radius.src, comp: radius.comp, cat: radius.cat, kind: radius.kind, line: radius.line },
    { src: "slds2", comp: "button", cat: "radius", kind: "g", line: 2 },
  );
  assert.deepEqual(
    { cat: transition.cat, kind: transition.kind, prop: transition.prop, value: transition.value, selector: transition.selector },
    { cat: "motion", kind: "literal", prop: "transition", value: "border 0.1s linear", selector: ".slds-button_brand" },
  );
  assert.equal(transition.file, "@salesforce-ux/design-system-2/dist/css/bundled/slds2.cosmos.css");
});

test("var(--slds-s-x)가 :where(html)의 --slds-s-x:var(--slds-g-y)를 거치면 g로 풀린다", () => {
  const css = `@layer shared { :where(html) { --slds-s-x: var(--slds-g-y); --slds-s-lit: 2px; } }
    .slds-card { padding: var(--slds-s-x); margin: var(--slds-s-lit); }`;
  assert.deepEqual(kinds(css), ["g", "s"]);
});

test("나머지 kind: c·otherVar·keyword·keyframes. 정의를 따라가 키워드만 남으면 keyword, 값은 자르지 않는다", () => {
  const long = `linear-gradient(90deg, ${Array(20).fill("#ff1500").join(", ")})`;
  const css = `.slds-a { --_slds-c-a-shadow: 0 0 2px #000; --_slds-c-a-radius: var(--slds-g-radius-border-2); }
    .slds-a {
      border-radius: var(--slds-c-badge-radius-border, 15rem);
      border-top-left-radius: var(--_slds-c-a-radius);
      box-shadow: var(--_slds-c-a-shadow);
      background-color: var(--slds-c-a-color-background, transparent);
      z-index: var(--lwc-zIndexModal);
      opacity: 1;
      background: ${long};
    }
    @keyframes slds-pop { from { transform: scale(0); visibility: hidden; } }`;
  const decls = classify({ sldsCss: css, lbcFiles: [] });
  // private 변수(--_slds-*)를 거쳐 g hook에 닿으면 g다
  assert.deepEqual(decls.map((d) => d.kind), ["c", "g", "otherVar", "keyword", "keyword", "keyword", "literal", "keyframes", "keyframes"]);
  assert.equal(decls[6].value, long);
  assert.equal(decls[7].cat, "motion");
});

test("브리지가 덮는 리터럴은 bridge, FIXED_ITEMS에 맞으면 fixed, 나머지는 gap", () => {
  const { byComponent, gaps } = report();
  assert.deepEqual(byComponent.button["motion-speed"], { now: "bridge", native: "fixed" });
  // transition shorthand의 linear는 곡선 항목이다. 시간만 잇는 브리지는 곡선을 덮지 않는다
  assert.deepEqual(byComponent.button["motion-easing"], { now: "gap", native: "fixed" });
  assert.deepEqual(byComponent.spinner["motion-easing"], { now: "fixed", native: "n/a" });
  assert.deepEqual(byComponent.button.radius, { now: "reached", native: "reached" });
  assert.deepEqual(byComponent.button.density, { now: "reached", native: "n/a" });
  // .slds-button의 1.875rem은 LEX 컨트롤 높이 고정이다(2026-10-14 합의)
  assert.deepEqual(byComponent.button["control-height"], { now: "fixed", native: "n/a" });
  assert.deepEqual(byComponent.button["icon-size"], { now: "gap", native: "n/a" });
  assert.deepEqual(byComponent.spinner["motion-speed"], { now: "fixed", native: "n/a" });
  assert.deepEqual(byComponent.badge.fixed, { now: "fixed", native: "n/a" });
  assert.deepEqual(byComponent.modal, { radius: { now: "n/a", native: "fixed" } });
  // 스피너 고정은 모양 속성만이다. 글자 크기는 고정이 아니라 빈틈이다
  assert.deepEqual(byComponent.spinner.typography, { now: "gap", native: "n/a" });
  assert.deepEqual(gaps, [
    { comp: "button", item: "motion-easing", selector: ".slds-button", prop: "transition", value: "border 0.1s linear" },
    { comp: "spinner", item: "typography", selector: ".slds-spinner", prop: "font-size", value: "2rem" },
    { comp: "button", item: "icon-size", selector: ".slds-button__icon", prop: "width", value: "0.875rem" },
  ]);
});

test("byItem은 항목마다 now·native의 reached/total을 낸다", () => {
  const { byItem } = report();
  assert.deepEqual(Object.keys(byItem), SPEC_ITEMS.map((i) => i.id));
  // 고정(native 모달 반경)은 해당 컴포넌트로 세지만 반영으로 세지 않는다. 브리지는 지금만 닿는다
  assert.deepEqual(byItem.radius, { now: { reached: 1, total: 1 }, native: { reached: 1, total: 2 } });
  assert.deepEqual(byItem["motion-speed"], { now: { reached: 1, total: 2 }, native: { reached: 0, total: 1 } });
  assert.deepEqual(byItem["motion-easing"], { now: { reached: 0, total: 2 }, native: { reached: 0, total: 1 } });
  assert.deepEqual(byItem.logo, { now: { reached: 0, total: 0 }, native: { reached: 0, total: 0 } });
});

test("고정 목록에 없는 gap이 있으면 --check가 1", () => {
  const dir = join(tmp, "빈틈");
  assert.equal(runAudit(["--write"], sources(), dir).code, 0);
  const result = runAudit(["--check"], sources(), dir);
  assert.equal(result.code, 1);
  assert.match(result.message, /고정 목록에 없는 빈틈 3개/);
});

test("브리지는 항목에 맞는 longhand만 덮는다. 선택자 목록의 일부만 덮으면 bridge가 아니다", () => {
  const sldsCss = ".slds-a { transition: color 0.1s linear; } .slds-b, .slds-c { transition-duration: 0.2s; }";
  const motion = (bridgeCss: string) => {
    const { a, b } = buildReport(classify({ sldsCss, lbcFiles: [] }), SPEC_ITEMS, bridgeCss, FIXED_ITEMS).byComponent;
    return { speed: a["motion-speed"]?.now, easing: a["motion-easing"]?.now, b: b["motion-speed"]?.now };
  };
  const bridge = (selector: string, prop: string) => `${selector} { ${prop}: var(--milvus-motion-x, 0.1s); }`;
  assert.deepEqual(motion(bridge(".slds-a", "transition-duration")), { speed: "bridge", easing: "gap", b: "gap" });
  assert.deepEqual(motion(bridge(".slds-a", "transition-timing-function")), { speed: "gap", easing: "bridge", b: "gap" });
  assert.deepEqual(motion(bridge(".slds-a", "transition")), { speed: "bridge", easing: "bridge", b: "gap" });
  assert.deepEqual(motion(bridge(".slds-b", "transition-duration")), { speed: "gap", easing: "gap", b: "gap" });
  assert.deepEqual(motion(bridge(".slds-b, .slds-c", "transition-duration")), { speed: "gap", easing: "gap", b: "bridge" });
});

test("이미지 어둡게 처리 고정은 rgb·그라데이션 막에만 맞는다. 같은 선택자의 아이콘 이미지는 색 항목이 아니다(⑮)", () => {
  const sldsCss = `.slds-image_overlay { background: rgb(24, 24, 24, 0.5); }
    .slds-image__title_scrim { background: linear-gradient(to bottom, transparent, rgb(24, 24, 24, 0.5)); }
    .slds-image .slds-file__figure:hover::after { background-image: url(data:image/svg+xml;base64,PHN2Zz4=); }
    .slds-image .slds-file__figure:hover::after { background-color: #123456; }`;
  const { gaps } = buildReport(classify({ sldsCss, lbcFiles: [] }), SPEC_ITEMS, "", FIXED_ITEMS);
  assert.deepEqual(gaps.map((g) => `${g.prop}: ${g.value}`), ["background-color: #123456"]);
});

// 남은 빈틈 판정 규칙 (2026-10-12 사용자 결정, m4-gap-decisions.md "규칙" 열). 고정 목록 없이 돌려 규칙만 본다.
// 각 CSS에는 빠져야 하는 선언과 비슷하지만 남아야 하는 선언이 같이 있다. 남는 것만 "선택자 속성 항목"으로 적는다
const NOT_BRAND: [string, string, string[]][] = [
  [
    "② 지연(*-delay)은 움직임 속도가 아니다",
    `.slds-a { transition-delay: 200ms; animation-delay: 1s; } .slds-b { animation-duration: 0.65s; }`,
    [".slds-b animation-duration motion-speed"],
  ],
  [
    "④ em만 쓴 들여쓰기, 0과 auto만 쓴 margin(정렬), revert 기본값은 밀도가 아니다",
    `.slds-a { margin: 0 auto; } .slds-b { margin: 0 0 0 auto; } .slds-c { padding-inline-start: 4.5em; }
     .slds-d { margin-inline-end: var(--slds-c-d-spacing, revert); }
     .slds-e { margin: 0.5rem; } .slds-f { padding-inline-start: 1.5rem; } .slds-g { padding: 1em 0.5rem; } .slds-h { margin: 0.5rem auto; }`,
    [".slds-e margin density", ".slds-f padding-inline-start density", ".slds-g padding density", ".slds-h margin density"],
  ],
  [
    "⑥ 숨긴 입력(1px)과 트리 표 버튼은 컨트롤 높이가 아니다(표가 아닌 트리 버튼은 남는다)",
    `.slds-checkbox_button [type='checkbox'] { height: 1px; } .slds-table_tree .slds-tree__item > .slds-button { height: 1.5rem; }
     .slds-checkbox_button { height: 2rem; } .slds-button { height: 1.5rem; } .slds-tree .slds-tree__item > .slds-button { height: 2rem; }`,
    [".slds-checkbox_button height control-height", ".slds-button height control-height", ".slds-tree .slds-tree__item > .slds-button height control-height"],
  ],
  [
    "⑨ 크기 hook으로 만든 원은 모서리가 아니다(두께 hook은 남는다)",
    `.slds-progress-ring { border-radius: var(--slds-g-sizing-7); } .slds-a { border-radius: var(--slds-g-sizing-border-2); } .slds-b { border-radius: 6px; }`,
    [".slds-a border-radius radius", ".slds-b border-radius radius"],
  ],
  [
    "⑩ hover의 뒤집기·가운데 맞춤·확대 transform은 hover·눌림 효과가 아니다(떠오름이 섞인 값과 :active 눌림은 남는다)",
    `.slds-path__nav .slds-is-complete:hover .slds-path__stage { transform: translate(-50%, -50%) rotateX(-180deg); }
     .slds-image:hover::after { transform: translate(-50%, -50%); } .slds-d:hover { transform: scale(1.1, 1.1); }
     .slds-a:active { transform: scale(0.95); } .slds-b:hover { transform: translateY(-2px); } .slds-c:hover { transform: translateY(-2px) scale(1.02); }`,
    [".slds-a:active transform hover-press", ".slds-b:hover transform hover-press", ".slds-c:hover transform hover-press"],
  ],
  [
    "⑪ outline-offset은 포커스 링 모양이 아니다",
    `.slds-a:focus-visible { outline-offset: -2px; } .slds-b:focus-visible { outline-width: 3px; }`,
    [".slds-b:focus-visible outline-width focus-ring"],
  ],
  [
    "⑫ :not() 안의 disabled는 비활성이 아니다",
    `.slds-a:not(:disabled):hover { cursor: pointer; } .slds-datepicker td:hover:not(.slds-disabled-text) > .slds-day { cursor: pointer; }
     .slds-b:disabled { cursor: default; } .slds-c a:not(.slds-button_neutral)[disabled] { color: rgb(255, 255, 255, 0.15); }
     .slds-d:not(:disabled):hover { color: rgb(1, 2, 3); }`,
    [".slds-b:disabled cursor cursor-underline", ".slds-c a:not(.slds-button_neutral)[disabled] color disabled", ".slds-d:not(:disabled):hover color hover-selected"],
  ],
  [
    "⑬ 상대 크기(em·%) 글자 크기는 글자 항목이 아니다",
    `h1, h2 { font-size: 1em; } sup { font-size: 75%; } .slds-a { font-size: var(--slds-c-a-font-size, 1em); }
     .slds-b { font-size: 1.25rem; } .slds-c { font-size: var(--slds-c-c-font-size, 1.25rem); }`,
    [".slds-b font-size typography", ".slds-c font-size typography"],
  ],
  [
    "⑭ border로 그린 삼각형은 테두리 두께가 아니다",
    `.slds-visual-picker__text::after { border-color: transparent; border-width: 1rem; border-inline-end-color: var(--slds-g-color-accent-1); }
     .slds-b::before { width: 0; border-width: 0.5rem; }
     .slds-popover_brand-top { border-block-start-width: 0.25rem; } .slds-a::after { border-width: 2px; }
     .slds-c::after { width: 100%; border-color: transparent; border-width: 3px; }`,
    // .slds-c는 투명 테두리 위 그라데이션 테두리(Agentforce 입력창 모양)라 삼각형이 아니다
    [".slds-popover_brand-top border-block-start-width border-width", ".slds-a::after border-width border-width", ".slds-c::after border-width border-width"],
  ],
  [
    "⑮ 이미지·transparent·currentColor·시스템 색·0 0은 색 항목이 아니다",
    `::selection { background-color: Highlight; color: HighlightText; } .slds-a { background-image: url('x.svg'); }
     .slds-b { background: var(--_slds-c-b-image) top left / cover no-repeat; } .slds-c { border: 2px solid transparent; }
     .slds-d { color: color-mix(in oklab, currentColor, transparent 90%); } .slds-e { background: 0 0; }
     .slds-f::before { border-block-end: 5px solid currentColor; } .slds-g { color: var(--slds-c-g-color, color-mix(in oklab, currentColor, transparent 50%)); }
     .slds-h { background: rgb(72, 195, 204); } .slds-i { background: linear-gradient(to right, rgb(250, 250, 249, 0) 0%, rgb(250, 250, 249, 1) 69%); }
     .slds-j { color: grey; } .slds-k { border: 1px solid #dddbda; }
     .slds-l { border-block-end: 1px dotted; } .slds-m { border-block-end: 1px dotted #cccccc; }`,
    // 색을 적지 않은 border(.slds-l)는 CSS 초기값 currentColor라 빠진다
    [".slds-h background surface", ".slds-i background surface", ".slds-j color text-color", ".slds-k border border-color", ".slds-m border-block-end border-color"],
  ],
];
for (const [name, sldsCss, kept] of NOT_BRAND) {
  test(name, () => {
    const { gaps } = buildReport(classify({ sldsCss, lbcFiles: [] }), SPEC_ITEMS, "", []);
    assert.deepEqual(gaps.map((g) => `${g.selector} ${g.prop} ${g.item}`), kept);
  });
}

test("2026-10-12 합의 고정 항목은 그 묶음만 흡수하고 비슷한 다른 값은 빈틈으로 남긴다", () => {
  const sldsCss = `
    .slds-icon-eq.slds-is-animated .slds-icon-eq__bar:nth-of-type(2) { animation-duration: 0.65s; }
    .slds-icon-trend__arrow { animation: arrow 0.8s 0.4s both; }
    .slds-context-bar__item.slds-is-active { animation: bk 0.135s both; }
    .slds-global-actions__item-action:active .slds-icon { animation: click 120ms both; }
    .slds-icon-ellie svg { animation: e 1.2s steps(20) 2.3s 2 alternate; }
    .slds-icon-eq__bar { animation-duration: 0.2s; }
    .slds-icon-trend__circle { animation: c 0.2s 0.8s both; }
    .slds-card { animation-duration: 0.65s; }
    .slds-icon-waffle { width: 1.3125rem; }
    .slds-icon { width: 1rem; }
    .slds-input-has-icon .slds-input__icon { width: 0.75rem; }
    .slds-listbox_inline { margin-inline-start: 0.125rem; margin-inline-end: 0.25rem; }
    .slds-tree__item .slds-button { margin-block-start: 2px; }
    .slds-markdown blockquote { margin-inline-start: 1.25rem; }
    .slds-card__body { padding: 0.75rem; }
    [kx-scope='breadcrumbs-item'][kx-type='underline'] > a:active { transform: scale(0.95); }
    .slds-pill:active { transform: scale(0.95); }
    .slds-path__item { margin-inline-start: 0.375rem; }
    .slds-path__title { padding: 0.5rem; }
    .slds-markdown p { margin-block: 1rem; }`;
  const lbcFiles = [
    {
      comp: "toast",
      file: "lightning-base-components/src/lightning/toast/toast.lbc.synthetic.css",
      css: ".fix-notify_toast_animation { animation-duration: 0.4s; }",
    },
    {
      comp: "baseCombobox",
      file: "lightning-base-components/src/lightning/baseCombobox/input-text.slds.css",
      css: `:host([data-render-mode="shadow"]) .slds-input-has-icon .slds-input__icon { width: 0.875rem; }`,
    },
    { comp: "modalBase", file: "lightning-base-components/src/lightning/modalBase/modalBase.css", css: ".slds-modal__container__reflow_resize { margin-left: 0.1rem; }" },
    { comp: "button", file: "lightning-base-components/src/lightning/button/button.css", css: ".fix-slds-button { margin: 1rem; }" },
    // native 라벨 넓힘(2026-10-12 결정): 모달 제목 크기, 툴팁·진행 링 리터럴 반경, 진행 링 안 아이콘
    {
      comp: "modalHeader",
      file: "lightning-base-components/src/lightning/modalHeader/modal-header.slds.css",
      css: `:host([data-render-mode="shadow"]) .slds-modal__title { font-size: var(--slds-c-modalheader-heading-font-size, 1.25rem); }`,
    },
    {
      comp: "primitiveBubble",
      file: "lightning-base-components/src/lightning/primitiveBubble/tooltip.slds.css",
      css: `:host([data-render-mode="shadow"]) [part~='overlay'] { border-radius: 0.25rem; }
        :host([data-render-mode="shadow"]) .slds-nubbin_top-left-corner { border-radius: 0.125rem 0.25rem 0.25rem 0.25rem; }`,
    },
    {
      comp: "progressRing",
      file: "lightning-base-components/src/lightning/progressRing/progress-ring.slds.css",
      css: `:host([data-render-mode="shadow"]) .slds-progress-ring { border-radius: 1.5rem; }
        :host([data-render-mode="shadow"]) .slds-progress-ring__content .slds-icon { width: 0.75rem; }`,
    },
    // 툴팁·진행 링이 아닌 native 리터럴 반경, 값 조건 밖의 native 커서(pointer)·색(hsl)은 빈틈으로 남는다
    {
      comp: "card",
      file: "lightning-base-components/src/lightning/card/card.slds.css",
      css: `:host([data-render-mode="shadow"]) .slds-card { border-radius: 0.5rem; }
        :host([data-render-mode="shadow"]) [part~='button']:disabled { cursor: pointer; }
        :host([data-render-mode="shadow"]) .slds-card__header { color: hsl(0, 0%, 50%); }`,
    },
  ];
  const { byComponent, gaps } = buildReport(classify({ sldsCss, lbcFiles }), SPEC_ITEMS, "", FIXED_ITEMS);
  assert.deepEqual(gaps.map((g) => `${g.selector} { ${g.prop}: ${g.value} } ${g.item}`), [
    // 시간 묶음 안이거나 지연만 묶음 밖이거나, 아이콘·알림 애니메이션이 아니다
    ".slds-icon-eq__bar { animation-duration: 0.2s } motion-speed",
    ".slds-icon-trend__circle { animation: c 0.2s 0.8s both } motion-speed",
    ".slds-card { animation-duration: 0.65s } motion-speed",
    // 애니메이션 아이콘이 아닌 아이콘 크기, 지금 모드의 입력 안 아이콘(native 항목은 native에서만)
    ".slds-icon { width: 1rem } icon-size",
    ".slds-input-has-icon .slds-input__icon { width: 0.75rem } icon-size",
    // 0.125rem보다 큰 간격, 특수 영역이 아닌 간격
    ".slds-listbox_inline { margin-inline-end: 0.25rem } density",
    ".slds-card__body { padding: 0.75rem } density",
    // kx 브레드크럼이 아닌 눌림 축소
    ".slds-pill:active { transform: scale(0.95) } hover-press",
    // 특수 영역 블루프린트(Path·markdown)라도 흡수한 선택자·속성이 아니면 남는다
    ".slds-path__title { padding: 0.5rem } density",
    ".slds-markdown p { margin-block: 1rem } density",
    // 목록에 없는 기본 컴포넌트
    ".fix-slds-button { margin: 1rem } density",
    ':host([data-render-mode="shadow"]) .slds-card { border-radius: 0.5rem } radius',
    `:host([data-render-mode="shadow"]) [part~='button']:disabled { cursor: pointer } cursor-underline`,
    ':host([data-render-mode="shadow"]) .slds-card__header { color: hsl(0, 0%, 50%) } text-color',
  ]);
  assert.deepEqual(byComponent["(global)"]["hover-press"], { now: "fixed", native: "n/a" });
  assert.deepEqual(byComponent.baseCombobox["icon-size"], { now: "n/a", native: "fixed" });
  assert.deepEqual(byComponent.modalHeader.typography, { now: "n/a", native: "fixed" });
  assert.deepEqual(byComponent.primitiveBubble.radius, { now: "n/a", native: "fixed" });
  assert.deepEqual(byComponent.progressRing, { radius: { now: "n/a", native: "fixed" }, "icon-size": { now: "n/a", native: "fixed" } });
  assert.deepEqual(byComponent.modalBase.density, { now: "fixed", native: "fixed" });
  assert.deepEqual(byComponent.toast["motion-speed"], { now: "fixed", native: "n/a" });
});

// 2026-10-14 사용자 합의: 컨트롤 높이 브리지를 빼면서 다시 빈틈이 된 SLDS 2 선언(브리지가 잇던 선택자 목록 그대로)만 고정이다
test("LEX 컨트롤 높이 고정은 브리지가 잇던 1.875rem 선언만 흡수하고 비슷한 다른 선언은 빈틈으로 남긴다", () => {
  const sldsCss = `
    .slds-button { line-height: 1.875rem; }
    .slds-button_icon-more, .slds-button--icon-more { line-height: 1.875rem; }
    .slds-button_icon-container-more,.slds-button--icon-container-more { line-height: 1.875rem; }
    .slds-input { line-height: 1.875rem; }
    .slds-input_faux,.slds-input--faux { line-height: 1.875rem; }
    .slds-radio_button,.slds-radio--button { line-height: 1.875rem; }
    .slds-checkbox_button,.slds-checkbox--button { line-height: 1.875rem; }
    .slds-select { height: calc(1.875rem + (1px * 2)); }
    .slds-select[size], .slds-select[multiple] { min-height: calc(1.875rem + (1px * 2)); }
    .slds-button_icon { line-height: 1.875rem; }
    .slds-form .slds-button { line-height: 1.875rem; }
    .slds-button { line-height: 2rem; }
    .slds-input { min-height: calc(1.875rem + (1px * 2)); }
    .slds-select { line-height: 1.875rem; }`;
  const { gaps } = buildReport(classify({ sldsCss, lbcFiles: [] }), SPEC_ITEMS, "", FIXED_ITEMS);
  assert.deepEqual(gaps.map((g) => `${g.selector} { ${g.prop}: ${g.value} } ${g.item}`), [
    ".slds-button_icon { line-height: 1.875rem } line-height",
    ".slds-form .slds-button { line-height: 1.875rem } control-height",
    ".slds-button { line-height: 2rem } control-height",
    ".slds-input { min-height: calc(1.875rem + (1px * 2)) } control-height",
    ".slds-select { line-height: 1.875rem } control-height",
  ]);
  // native 버튼 1.875rem은 기존 native 항목(combobox-height)만 맞는다
  const [native] = classify({
    sldsCss: "",
    lbcFiles: [{ comp: "calendar", file: "lightning-base-components/src/lightning/calendar/calendar.slds.css", css: `:host([data-render-mode="shadow"]) .slds-button { line-height: 1.875rem; }` }],
  });
  assert.deepEqual(fixedItemsOf(native, FIXED_ITEMS).map((f) => f.id), ["combobox-height"]);
});

// 2026-10-14 사용자 합의: 브리지 10종을 빼면서 다시 빈틈이 된 선언(아래 위쪽)만 고정이다. 아래쪽은 비슷하지만 남아야 하는 선언이다
test("브리지를 뺀 고정 항목은 그 선언만 흡수하고 비슷한 다른 선언은 빈틈으로 남긴다", () => {
  const sldsCss = `
    .slds-path__item:first-child { border-start-start-radius: 2rem; border-end-start-radius: 2rem; }
    .slds-path__item:last-child { border-start-end-radius: 2rem; border-end-end-radius: 2rem; }
    .slds-button__icon, .slds-button__icon_stateful, .slds-button__icon--stateful { width: 0.875rem; height: 0.875rem; }
    .slds-input-has-icon .slds-input__icon { width: 0.875rem; }
    .slds-is-sortable__icon { width: 0.75rem; height: 0.75rem; }
    .slds-radio .slds-form-element__label { font-weight: 700; }
    .slds-button[disabled], .slds-button:disabled { cursor: default; }
    .slds-select[disabled], .slds-select.slds-is-disabled { cursor: not-allowed; }
    a:hover, a:focus-visible { text-decoration: underline; }
    .slds-context-bar__label-action:focus-visible, .slds-context-bar__label-action:focus-visible:hover { text-decoration: var(--_slds-c-globalnavigation-font-decoration-focus, underline); }
    .slds-nubbin_top::after,.slds-nubbin--top::after { box-shadow: var(--_slds-c-popover-top-nubbin-shadow); }

    .slds-path__item { border-radius: 2rem; }
    .slds-button__icon_large { width: 1.5rem; }
    .slds-input-has-icon .slds-input__icon { height: 0.75rem; }
    .slds-form-element__label { font-weight: 700; }
    .slds-b:disabled { cursor: pointer; }
    .slds-c:hover { text-decoration: line-through; }
    .slds-popover { box-shadow: 0 2px 3px red; }`;
  const { gaps } = buildReport(classify({ sldsCss, lbcFiles: [] }), SPEC_ITEMS, "", FIXED_ITEMS);
  assert.deepEqual(gaps.map((g) => `${g.selector} { ${g.prop}: ${g.value} } ${g.item}`), [
    ".slds-path__item { border-radius: 2rem } radius",
    ".slds-button__icon_large { width: 1.5rem } icon-size",
    ".slds-input-has-icon .slds-input__icon { height: 0.75rem } icon-size",
    ".slds-form-element__label { font-weight: 700 } typography",
    ".slds-b:disabled { cursor: pointer } cursor-underline",
    ".slds-c:hover { text-decoration: line-through } cursor-underline",
    ".slds-popover { box-shadow: 0 2px 3px red } shadow",
  ]);
  // native 꼬리 그림자는 새 항목이 맡고 드롭다운·팝오버·툴팁 그림자(popup-shadow)에서는 뺐다
  const [nubbin] = classify({
    sldsCss: "",
    lbcFiles: [{ comp: "helptext", file: "lightning-base-components/src/lightning/helptext/helptext.slds.css", css: `:host([data-render-mode="shadow"]) .slds-nubbin_top::after { box-shadow: 0 0 1px red; }` }],
  });
  assert.deepEqual(fixedItemsOf(nubbin, FIXED_ITEMS).map((f) => f.id), ["nubbin-shadow", "native-shadow"]);
});

test("--check는 기준 대비 새 하드코딩, hook 변화, native 목록 변화, 브리지 선택자 소실에서 1", () => {
  const dir = join(tmp, "기준");
  // custom property만 정의하는 원본 규칙을 덮는 브리지는 소실이 아니다(합성 예)
  const base: Sources = {
    sldsCss: `.slds-badge { z-index: 100; border-radius: var(--slds-g-radius-border-1); }
      .slds-a { --slds-c-a-color-background: rgb(88, 103, 232); }`,
    lbcFiles: [],
    bridgeCss: `.slds-badge { transition-duration: var(--milvus-motion-duration-fast, 0s); }
      .slds-a { --slds-c-a-color-background: var(--milvus-x, rgb(88, 103, 232)); }`,
    nativeList: ["lightning-badge"],
  };
  assert.equal(runAudit(["--write"], base, dir).code, 0);
  assert.deepEqual(runAudit(["--check"], base, dir), { code: 0, message: "✓ 정적 반영 검사: 빈틈 0개, 기준과 같음" });

  const changed: [Partial<Sources>, RegExp][] = [
    [{ sldsCss: `${base.sldsCss} .slds-pill { z-index: 7000; }` }, /새 하드코딩: slds2 pill z-index: 7000/],
    [{ sldsCss: base.sldsCss.replace("border-1", "border-2") }, /hook 변화: 생김 --slds-g-radius-border-2, 사라짐 --slds-g-radius-border-1/],
    [{ nativeList: [] }, /native 지원 목록 변화: 사라짐 lightning-badge/],
    [{ bridgeCss: ".slds-gone { transition-duration: var(--milvus-motion-duration-fast, 0s); }" }, /브리지 선택자 소실: \.slds-gone/],
  ];
  for (const [patch, message] of changed) {
    const result = runAudit(["--check"], { ...base, ...patch }, dir);
    assert.equal(result.code, 1, String(message));
    assert.match(result.message, message);
  }
});

test("--check의 새 하드코딩 줄에 그 선언을 흡수하는 고정 항목 라벨을 붙인다(--write 전에 합의 없이 고정되는 것을 보이게)", () => {
  const dir = join(tmp, "흡수");
  const base: Sources = { sldsCss: ".slds-badge { border-radius: var(--slds-g-radius-border-1); }", lbcFiles: [], bridgeCss: "", nativeList: [] };
  assert.equal(runAudit(["--write"], base, dir).code, 0);
  const pill = { comp: "pill", file: "lightning-base-components/src/lightning/pill/pill.slds.css", css: `:host([data-render-mode="shadow"]) .slds-pill { padding: 0.3rem; }` };
  const { message } = runAudit(["--check"], { ...base, sldsCss: `${base.sldsCss} .slds-card { padding: 0.3rem; }`, lbcFiles: [pill] }, dir);
  assert.match(message, /^새 하드코딩: lbc pill padding: 0\.3rem \(고정: native 간격\)$/m);
  assert.match(message, /^새 하드코딩: slds2 card padding: 0\.3rem$/m);
});
