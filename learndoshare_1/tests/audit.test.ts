import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classify } from "../scripts/audit/classify.ts";
import { buildReport } from "../scripts/audit/report.ts";
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
  assert.deepEqual(byComponent.button["control-height"], { now: "gap", native: "n/a" });
  assert.deepEqual(byComponent.button["icon-size"], { now: "gap", native: "n/a" });
  assert.deepEqual(byComponent.spinner["motion-speed"], { now: "fixed", native: "n/a" });
  assert.deepEqual(byComponent.badge.fixed, { now: "fixed", native: "n/a" });
  assert.deepEqual(byComponent.modal, { radius: { now: "n/a", native: "fixed" } });
  // 스피너 고정은 모양 속성만이다. 글자 크기는 고정이 아니라 빈틈이다
  assert.deepEqual(byComponent.spinner.typography, { now: "gap", native: "n/a" });
  assert.deepEqual(gaps, [
    { comp: "button", item: "motion-easing", selector: ".slds-button", prop: "transition", value: "border 0.1s linear" },
    { comp: "button", item: "control-height", selector: ".slds-button", prop: "line-height", value: "1.875rem" },
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
  assert.match(result.message, /고정 목록에 없는 빈틈 4개/);
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

test("이미지 어둡게 처리 고정은 색·그라데이션 막에만 맞고, 같은 선택자의 아이콘 이미지는 빈틈이다", () => {
  const sldsCss = `.slds-image_overlay { background: rgb(24, 24, 24, 0.5); }
    .slds-image__title_scrim { background: linear-gradient(to bottom, transparent, rgb(24, 24, 24, 0.5)); }
    .slds-image .slds-file__figure:hover::after { background-image: url(data:image/svg+xml;base64,PHN2Zz4=); }`;
  const { gaps } = buildReport(classify({ sldsCss, lbcFiles: [] }), SPEC_ITEMS, "", FIXED_ITEMS);
  assert.deepEqual(gaps.map((g) => g.prop), ["background-image"]);
});

test("--check는 기준 대비 새 하드코딩, hook 변화, native 목록 변화, 브리지 선택자 소실에서 1", () => {
  const dir = join(tmp, "기준");
  // custom property만 정의하는 원본 규칙(개체 아이콘 색)을 덮는 브리지는 소실이 아니다
  const base: Sources = {
    sldsCss: `.slds-badge { z-index: 100; border-radius: var(--slds-g-radius-border-1); }
      .slds-icon-standard-account { --slds-c-icon-color-background: rgb(88, 103, 232); }`,
    lbcFiles: [],
    bridgeCss: `.slds-badge { transition-duration: var(--milvus-motion-duration-fast, 0s); }
      .slds-icon-standard-account {
        --slds-c-icon-color-background: var(--milvus-icon-standard-account, var(--milvus-icon-color-all, rgb(88, 103, 232)));
      }`,
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
