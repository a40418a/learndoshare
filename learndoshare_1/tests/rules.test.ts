import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brandPalette } from "../lib/palette.ts";
import { contrastRatio, darkerStep, suggestPassingText } from "../lib/contrast.ts";
import { buildHooksIndex, hooksIndexFromSource, loadRuleContext, type RuleContext } from "../lib/hooks-index.ts";
import { checkOverrideCss, checkUtilCss, COLOR_S_WHITELIST, LBC_ONLY_G } from "../lib/rules.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = (name: string) => readFileSync(new URL(`./fixtures/rules/${name}`, import.meta.url), "utf8");

// 실제 SLDS 2 CSS와 기본 컴포넌트 CSS에서 만든 색인. 이름이 읽히는지는 원본이 판정한다
const index = hooksIndexFromSource(root);
const ctx: RuleContext = {
  readSHooks: new Set(index.readSHooks),
  readGHooks: new Set(index.readGHooks),
  milvusVars: new Set(["--milvus-button-font-weight"]),
};
const check = (css: string) => checkUtilCss(css, "util.css", ctx);
const rulesOf = (body: string) => check(`:root {\n${body}\n}`).map((i) => i.rule);

test("허용 규칙을 모두 쓴 util.css(주석·줄바꿈·light-dark·var 체인)는 통과한다", () => {
  assert.deepEqual(check(fixture("valid-util.css")), []);
});

test("클래스 규칙, @font-face를 거부한다", () => {
  assert.deepEqual(
    check(":root { --slds-g-radius-border-2: 0.25rem; }\n.slds-button { border-radius: 0; }").map((i) => i.rule),
    ["root-only"],
  );
  assert.deepEqual(
    check("@font-face { font-family: Brand; src: url(brand.woff2); }").map((i) => i.rule),
    ["font-face"],
  );
});

test("브랜드 색 계열(accent·on-accent·border-accent·brand-base·--slds-r-color-brand-*)을 거부한다", () => {
  for (const name of [
    "--slds-g-color-accent-1",
    "--slds-g-color-on-accent-1",
    "--slds-g-color-border-accent-1",
    "--slds-g-color-brand-base-50",
    "--slds-r-color-brand-50",
  ]) {
    assert.deepEqual(rulesOf(`${name}: #2e7d32;`), ["brand-color"], name);
  }
});

test("--slds-c-button-x, --sds-c-x를 거부한다", () => {
  assert.deepEqual(rulesOf("--slds-c-button-x: 0;"), ["c-hook"]);
  assert.deepEqual(rulesOf("--sds-c-x: 0;"), ["c-hook"]);
});

test("--slds-g-font-family-base를 거부한다", () => {
  assert.deepEqual(rulesOf("--slds-g-font-family-base: Pretendard, sans-serif;"), ["font-family"]);
});

test("포커스 그림자: 값에 hex가 있으면 거부, var(--slds-g-color-brand-base-15)만이면 허용", () => {
  assert.deepEqual(rulesOf("--slds-g-shadow-outline-focus-1: 0 0 0 3px var(--slds-g-color-brand-base-15);"), []);
  assert.deepEqual(rulesOf("--slds-g-shadow-inset-focus-1: 0px 0px 0px 2px var(--slds-g-color-brand-base-15) inset;"), []);
  for (const value of [
    "0 0 0 3px #0176d3",
    "0 0 0 3px rgb(1 118 211)",
    "0 0 0 3px red",
    "0 0 0 3px var(--slds-g-color-accent-1)",
    "0 0 0 3px var(--slds-g-color-brand-base-15, #0176d3)",
  ]) {
    assert.deepEqual(rulesOf(`--slds-g-shadow-outline-focus-1: ${value};`), ["focus-shadow"], value);
  }
});

test("그림자 -4를 바꾸면 포커스에 쓰이는 -5·-6을 따로 적어야 한다", () => {
  assert.deepEqual(rulesOf("--slds-g-shadow-4: none;"), ["shadow-focus-keep"]);
  assert.deepEqual(rulesOf("--slds-g-shadow-4: none; --slds-g-shadow-5: 0 2px 4px #0000001f; --slds-g-shadow-6: 0 2px 4px #0000001f;"), []);
});

test("중립 색: light-dark()이면 허용, 일반 값이면 거부", () => {
  assert.deepEqual(rulesOf("--slds-g-color-surface-2: light-dark(#f5f3ef, #181818);"), []);
  assert.deepEqual(rulesOf("--slds-g-color-palette-yellow-90: light-dark(#ffe0c2, #5a3a00);"), []);
  assert.deepEqual(rulesOf("--slds-g-color-surface-2: #f5f3ef;"), ["neutral-light-dark"]);
  assert.deepEqual(rulesOf("--slds-g-color-surface-2: var(--slds-g-color-neutral-base-95);"), ["neutral-light-dark"]);
});

test("on-surface-3과 surface-2 쌍이 4.5 미만이면 거부", () => {
  const issues = check(`:root {
    --slds-g-color-on-surface-3: light-dark(#999999, #e5e5e5);
    --slds-g-color-surface-2: light-dark(#f3f3f3, #181818);
  }`);
  assert.deepEqual(issues.map((i) => i.rule), ["contrast"]);
  assert.match(issues[0].message, /--slds-g-color-on-surface-3/);
  assert.match(issues[0].message, /2\.57:1/);
  assert.ok(contrastRatio(issues[0].fix!, "#f3f3f3") >= 4.5, issues[0].fix);
  assert.deepEqual(rulesOf("--slds-g-color-on-surface-3: light-dark(#03234d, #d8e6fe); --slds-g-color-surface-2: light-dark(#f3f3f3, #181818);"), []);
});

test("LBC 전용 g 이름 --slds-g-color-border-base-1은 허용", () => {
  assert.equal(LBC_ONLY_G.length, 5);
  for (const name of LBC_ONLY_G) assert.deepEqual(rulesOf(`${name}: light-dark(#dddddd, #444444);`), [], name);
});

test("색 s hook은 화이트리스트 6개만, 값이 중립 g hook만 참조할 때 허용", () => {
  assert.equal(COLOR_S_WHITELIST.length, 6);
  for (const name of COLOR_S_WHITELIST) {
    assert.deepEqual(rulesOf(`${name}: var(--slds-g-color-surface-container-2);`), [], name);
  }
  for (const value of ["#eeeeee", "var(--slds-g-color-brand-base-90)", "var(--slds-g-color-surface-container-2, #eee)"]) {
    assert.deepEqual(rulesOf(`--slds-s-pill-color-background-hover: ${value};`), ["color-s-hook"], value);
  }
  // 읽히는 이름이지만 화이트리스트 밖
  assert.ok(ctx.readSHooks.has("--slds-s-button-color-border"));
  assert.deepEqual(rulesOf("--slds-s-button-color-border: var(--slds-g-color-border-2);"), ["color-s-hook"]);
});

test("--slds-s-label-spacing은 기본 컴포넌트가 읽으므로 허용, 아무도 읽지 않는 이름은 거부", () => {
  assert.deepEqual(rulesOf("--slds-s-label-spacing: 0.25rem;"), []);
  assert.deepEqual(rulesOf("--slds-s-label-spacingg: 0.25rem;"), ["unread"]);
});

test("--slds-g-color-border-info-1은 거부(없는 이름)", () => {
  assert.deepEqual(rulesOf("--slds-g-color-border-info-1: #0176d3;"), ["unread"]);
  // 정의는 있지만 읽는 곳이 없는 피드백 이름(설계 5.3)
  assert.deepEqual(rulesOf("--slds-g-color-info-1: #0176d3;"), ["unread"]);
  assert.deepEqual(rulesOf("--slds-g-color-border-warning-1: #8c4b02;"), ["unread"]);
});

test("성공 글자색이 배경 위 또는 흰색 위에서 4.5 미만이면 거부하고 fix에 40단계 색", () => {
  // 흰색 위 2.09:1
  const onWhite = check(":root { --slds-g-color-success-1: #4bca81; --slds-g-color-success-container-1: #e6f7ec; }");
  assert.deepEqual(onWhite.map((i) => i.rule), ["contrast"]);
  assert.equal(onWhite[0].fix, brandPalette("#4bca81")[40]);
  // 흰색 위 5.13:1이지만 배경 위 3.81:1
  const onBg = check(":root { --slds-g-color-on-success-1: #2e7d32; --slds-g-color-success-container-1: #c8e6c9; }");
  assert.deepEqual(onBg.map((i) => i.rule), ["contrast"]);
  assert.match(onBg[0].message, /3\.81:1/);
  assert.equal(onBg[0].fix, brandPalette("#2e7d32")[40]);
  // SLDS 기본값(40단계 글자, 90단계 배경)은 통과
  assert.deepEqual(rulesOf("--slds-g-color-success-1: #056764; --slds-g-color-success-container-1: #acf3e4;"), []);
});

test("light-dark(#111, #eee)의 대비는 #111로 잰다", () => {
  assert.deepEqual(
    rulesOf("--slds-g-color-on-surface-3: light-dark(#111, #eee); --slds-g-color-surface-2: light-dark(#f3f3f3, #181818);"),
    [],
  );
  // var() 체인도 따라간다: 라이트 값은 neutral-base-10의 #ccc
  assert.deepEqual(
    rulesOf(`--slds-g-color-neutral-base-10: light-dark(#ccc, #111);
      --slds-g-color-on-surface-3: light-dark(var(--slds-g-color-neutral-base-10), #eee);
      --slds-g-color-surface-2: light-dark(#f3f3f3, #181818);`),
    ["contrast"],
  );
});

test("주석 안의 선언은 무시한다", () => {
  assert.deepEqual(
    check(`/* .slds-button { color: red } */
:root {
  /* --slds-c-button-x: red; */
  --slds-g-radius-border-2: /* 입력창 */ 0.25rem;
}`),
    [],
  );
});

test("값에 공백 없이 붙은 주석도 무시한다(대비 검사, 포커스 그림자)", () => {
  // postcss는 공백 없이 붙은 주석을 decl.value에 남긴다. 주석 때문에 2.57:1을 놓치면 안 된다
  assert.deepEqual(
    rulesOf("--slds-g-color-on-surface-3: light-dark(#999999/*라이트*/, #e5e5e5); --slds-g-color-surface-2: light-dark(/*x*/#f3f3f3, #181818);"),
    ["contrast"],
  );
  // 주석 안의 #fff는 리터럴 색이 아니다(값 끝의 주석은 postcss가 지우므로 가운데에 둔다)
  assert.deepEqual(rulesOf("--slds-g-shadow-outline-focus-1: 0 0 0 3px/*#fff*/var(--slds-g-color-brand-base-15);"), []);
});

test("letter-spacing은 허용, color 같은 다른 일반 속성은 거부", () => {
  assert.deepEqual(rulesOf("letter-spacing: -0.02em;"), []);
  assert.deepEqual(rulesOf("color: #333333;"), ["plain-prop"]);
});

test("--milvus-*는 milvusVars에 있을 때만 허용", () => {
  assert.deepEqual(rulesOf("--milvus-button-font-weight: 700;"), []);
  assert.deepEqual(rulesOf("--milvus-button-font-wieght: 700;"), ["milvus-var"]);
});

test("CSS 문법 오류는 던지지 않고 issue로 돌려준다", () => {
  assert.deepEqual(check(":root { --slds-g-radius-border-2: 0.25rem;").map((i) => i.rule), ["syntax"]);
  assert.deepEqual(checkOverrideCss(".slds-button {", "o.css").errors.map((i) => i.rule), ["syntax"]);
});

test("override: .slds-button{border-radius:0}은 경고·오류 없음", () => {
  assert.deepEqual(checkOverrideCss(".slds-button { border-radius: 0; }", "o.css"), { warnings: [], errors: [] });
});

test("override: hex 색, !important, .my-class 선택자, --slds-g-color-accent-1 재정의는 경고", () => {
  const { warnings, errors } = checkOverrideCss(fixture("override-warn.css"), "o.css");
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.map((w) => w.rule).sort(), ["brand-color", "hex", "important", "selector"]);
  assert.ok(warnings.every((w) => w.file === "o.css"));
});

test("override: @font-face와 @import는 오류", () => {
  const { errors } = checkOverrideCss('@import url("x.css");\n@font-face { font-family: Brand; src: url(brand.woff2); }', "o.css");
  assert.deepEqual(errors.map((e) => e.rule), ["import", "font-face"]);
});

test("suggestPassingText는 40, 30, 20단계 중 배경과 흰색 위에서 처음 통과하는 색", () => {
  const p = brandPalette("#4bca81");
  assert.equal(suggestPassingText("#4bca81", "#ffffff"), p[40]);
  // 40단계가 배경 위에서 못 넘으면 30단계
  const bg = "#7fbf94";
  assert.ok(contrastRatio(p[40], bg) < 4.5 && contrastRatio(p[30], bg) >= 4.5);
  assert.equal(suggestPassingText("#4bca81", bg), p[30]);
});

test("darkerStep은 가장 가까운 단계의 다음 진한 단계 (90→80, 50→40)", () => {
  assert.equal(darkerStep("#acf3e4"), brandPalette("#acf3e4")[80]);
  assert.equal(darkerStep("#0176D3"), brandPalette("#0176D3")[40]);
});

test("buildHooksIndex는 var()로 읽히는 이름만 모은다(정의만 있는 이름, 주석 안의 이름 제외)", () => {
  const built = buildHooksIndex({
    sldsCss: ".a { color: var(--slds-g-color-x, var(--slds-g-color-y)); --slds-s-defined-only: 1px; } /* var(--slds-s-comment) */",
    lbcCss: [":host { padding: var(\n  --slds-s-label-spacing\n); }"],
  });
  assert.deepEqual(built, { readSHooks: ["--slds-s-label-spacing"], readGHooks: ["--slds-g-color-x", "--slds-g-color-y"] });
});

test("loadRuleContext: dist/hooks-index.json을 읽고, milvusVars는 저장소의 lwc/milvus*와 templates의 milvusBridge.css에서 모은다", () => {
  const pkg = mkdtempSync(join(tmpdir(), "milvus 규칙 "));
  const write = (rel: string, text: string) => {
    mkdirSync(dirname(join(pkg, rel)), { recursive: true });
    writeFileSync(join(pkg, rel), text);
  };
  try {
    write("dist/hooks-index.json", JSON.stringify({ readSHooks: ["--slds-s-a"], readGHooks: ["--slds-g-b"] }));
    write("force-app/main/default/lwc/milvusFoo/milvusFoo.css", ".x { width: var(\n  --milvus-foo-width, 1px); }");
    write("force-app/main/default/lwc/milvusFoo/milvusFoo.ts", 'getComputedStyle(h).getPropertyValue("--milvus-foo-on"); /* "--milvus-commented" */');
    write("force-app/main/default/lwc/milvusFoo/__tests__/milvusFoo.test.ts", '"--milvus-test-only"');
    write("force-app/main/default/lwc/other/other.css", ".x { width: var(--milvus-other); }");
    write("templates/force-app/main/default/staticresources/milvusBridge.css", ".slds-button { transition-duration: var(--milvus-motion-duration-fast, 0.1s); }");
    const repo = loadRuleContext({ pkgRoot: pkg });
    assert.deepEqual([...repo.readSHooks], ["--slds-s-a"]);
    assert.deepEqual([...repo.readGHooks], ["--slds-g-b"]);
    assert.deepEqual([...repo.milvusVars].sort(), ["--milvus-foo-on", "--milvus-foo-width", "--milvus-motion-duration-fast"]);

    // 프로젝트: 프로젝트의 lwc/milvus*와 staticresources/milvusBridge.css만 본다
    write("project/force-app/main/default/lwc/milvusBar/milvusBar.css", ".x { color: var(--milvus-bar-color); }");
    write("project/force-app/main/default/staticresources/milvusBridge.css", ".slds-modal { transition-timing-function: var(--milvus-motion-easing, ease); }");
    const project = loadRuleContext({ pkgRoot: pkg, projectRoot: join(pkg, "project") });
    assert.deepEqual([...project.milvusVars].sort(), ["--milvus-bar-color", "--milvus-motion-easing"]);
  } finally {
    rmSync(pkg, { recursive: true, force: true });
  }
});
