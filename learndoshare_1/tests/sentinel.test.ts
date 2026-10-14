import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXED_ITEMS } from "../lib/fixed-list.ts";
import { loadRuleContext } from "../lib/hooks-index.ts";
import {
  cellLabel,
  cellStatus,
  COMPUTED_FIXED_IDS,
  coversProp,
  exampleStyledHost,
  fixedOf,
  FOCUS_PROPS,
  hookItems,
  itemScore,
  judgeProbe,
  STATIC_PROPS,
  UNMATCHED_FIXED,
  type JudgeContext,
  type Probe,
} from "../lib/reflect.ts";
import { checkUtilCss, COLOR_S_WHITELIST } from "../lib/rules.ts";
import { buildSentinelUtilCss, sentinelPlan } from "../lib/sentinel.ts";
import { SPEC_ITEMS } from "../lib/spec-items.ts";
import { sentinelModule } from "../lib/storybook-plugin.ts";
import { classify } from "../scripts/audit/classify.ts";
import { judge as judgeStatic } from "../scripts/audit/report.ts";
import { readSources } from "../scripts/audit/run.ts";
import { fixedRulesOf } from "../scripts/generate-slds-catalog.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const ctx = loadRuleContext({ pkgRoot: root });
const plan = sentinelPlan(ctx, SPEC_ITEMS);
const temps: string[] = [];
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));

test("센티널 util.css는 규칙 검사를 통과한다", () => {
  assert.deepEqual(checkUtilCss(buildSentinelUtilCss(ctx, SPEC_ITEMS), "sentinel.css", ctx), []);
  // 명세 항목의 hook·브리지 변수는 모두 센티널에 들어가거나 이유와 함께 missing에 있다(조용히 빠지지 않는다)
  const covered = new Set([...plan.decls.map((d) => d.name), ...plan.missing.map((m) => m.name)]);
  assert.deepEqual(SPEC_ITEMS.flatMap((i) => [...i.hooks, ...i.bridgeVars]).filter((n) => !covered.has(n)), []);
  // 움직임 시간은 단위가 있고 0.01ms 이상이다(설계 5.6: 브리지의 max(var(…), 0.01ms))
  const durations = plan.decls.filter((d) => d.name.startsWith("--milvus-motion-duration-"));
  assert.equal(durations.length, 3);
  for (const d of durations) {
    const m = /^(\d*\.?\d+)(s|ms)$/.exec(d.value);
    assert.ok(m && Number(m[1]) * (m[2] === "s" ? 1000 : 1) >= 0.01, d.value);
  }
});

test("센티널 값은 모두 서로 다르다", () => {
  const decls = new Map(plan.decls.map((d) => [d.name, d.value]));
  // 같은 파일 안의 var()는 따라가 실제 값으로 견준다
  const resolve = (v: string): string => v.replace(/var\((--[\w-]+)\)/g, (all, n) => (decls.has(n) ? resolve(decls.get(n)!) : all));
  const aliases = new Set(plan.missing.map((m) => m.name));
  const values = plan.decls.filter((d) => !aliases.has(d.name)).map((d) => resolve(d.value));
  assert.ok(values.length > 250, String(values.length));
  assert.deepEqual(values.filter((v, i) => values.indexOf(v) !== i), []);
  // 예시 값(설계 9.6의 2): 반경 7·9·11px…, 시간 0.777s 계열
  assert.equal(decls.get("--slds-g-radius-border-1"), "9px");
  assert.equal(decls.get("--milvus-motion-duration-fast"), "0.777s");
});


test("센티널을 넣지 못한 hook은 목록으로 나온다", () => {
  // 센티널 없음은 정확히 이 7개다. 이름으로 종류를 못 정하는 hook이 늘면 여기서 드러난다
  assert.deepEqual(plan.missing.map((m) => m.name).sort(), ["--milvus-button-custom", ...COLOR_S_WHITELIST].sort());
  const missing = new Map(plan.missing.map((m) => [m.name, m.reason]));
  // 켜기 스위치는 넣지 않는다
  assert.match(missing.get("--milvus-button-custom")!, /스위치/);
  assert.ok(!plan.decls.some((d) => d.name === "--milvus-button-custom"));
  // 색 s hook은 규칙상 중립 g hook 하나를 참조해 그 hook과 값이 같다. 넣되 "센티널 없음"으로 알린다
  for (const name of COLOR_S_WHITELIST) assert.match(missing.get(name)!, /값이 같다/, name);
  // 이름에 color가 없는 색 hook도 색으로 넣는다
  const kinds = new Map(plan.decls.map((d) => [d.name, d.kind]));
  assert.equal(kinds.get("--slds-s-alert-close-button-hover"), "color");
  assert.equal(kinds.get("--slds-g-info-container-1"), "color");

  // 명세 항목에 읽는 곳 없는 이름이나 브리지가 읽지 않는 변수가 있으면 규칙 메시지와 함께 나온다
  const typo = { ...SPEC_ITEMS[2], id: "typo", hooks: ["--slds-g-radius-border-99"], bridgeVars: ["--milvus-nope"] };
  const more = new Map(sentinelPlan(ctx, [typo]).missing.map((m) => [m.name, m.reason]));
  assert.match(more.get("--slds-g-radius-border-99")!, /읽지 않는 이름/);
  assert.match(more.get("--milvus-nope")!, /읽는 밀버스 컴포넌트나 milvusBridge\.css가 없다/);
});

test("sentinelModule은 모드의 규칙 문맥으로 센티널과 브랜드 색 hook 이름을 만든다", async () => {
  const load = async (code: string) => import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const repo = await load(sentinelModule({ mode: "repo", repoDir: root }));
  assert.match(repo.sentinelCss, /--milvus-motion-duration-fast: 0\.777s;/);
  // 브랜드 색 계열 전체(accent만이 아니다). 흰 글자(on-accent)와 팔레트 단계(brand-base)도 org 테마가 원본이다
  for (const name of ["--slds-g-color-accent-1", "--slds-g-color-on-accent-1", "--slds-g-color-brand-base-50", "--slds-g-color-border-accent-1"]) {
    assert.ok(repo.brandColorHooks.includes(name), name);
  }

  // 프로젝트 모드는 프로젝트의 milvusBridge.css가 읽는 변수만 넣고, 명세의 나머지 브리지 변수는 missing에 적는다
  const dir = mkdtempSync(join(tmpdir(), "milvus 센티널 프로젝트-"));
  temps.push(dir);
  const bridge = join(dir, "force-app/main/default/staticresources/milvusBridge.css");
  mkdirSync(dirname(bridge), { recursive: true });
  writeFileSync(bridge, ".slds-button { transition-duration: max(var(--milvus-motion-duration-fast, 0.1s), 0.01ms); }\n");
  const project = await load(sentinelModule({ mode: "project", repoDir: root, projectDir: dir }));
  assert.match(project.sentinelCss, /--milvus-motion-duration-fast: 0\.777s;/);
  assert.doesNotMatch(project.sentinelCss, /--milvus-motion-easing/);
  assert.ok(project.missing.some((m: { name: string }) => m.name === "--milvus-motion-easing"));
});

// 정적 검사가 두 모드 고정으로 판정한 선언(페이지가 쓰는 stories/slds-catalog/fixed-rules.js와 같은 함수로 만든다)
const src = readSources();
const rules = fixedRulesOf(judgeStatic(classify(src), SPEC_ITEMS, src.bridgeCss, FIXED_ITEMS), FIXED_ITEMS);
/** 브라우저의 el.matches 대신 쓴다: 주어진 선택자 문자열과 똑같을 때만 맞는다 */
const only = (...selectors: string[]) => (sel: string) => selectors.includes(sel);

// 반영 검사 페이지가 브라우저에서 잰 계산값 한 쌍을 명세 항목으로 나누는 순수 함수(lib/reflect.ts)
const j: JudgeContext = {
  fingerprints: new Map([
    ["radius|23px", ["--slds-s-button-radius-border"]],
    ["radius|33px", ["--slds-s-container-radius-border"]],
    ["spacing|8.25px", ["--slds-g-spacing-4"]],
    ["size|22.75px", ["--slds-s-icon-sizing"]],
    ["color|rgb(240, 248, 231)", ["--slds-g-color-success-container-1"]],
    ["duration|0.777s", ["--milvus-motion-duration-fast"]],
  ]),
  hookItems: hookItems(SPEC_ITEMS),
  brandColors: new Set(["rgb(41, 118, 202)", "rgb(255, 255, 255)"]),
  fixed: FIXED_ITEMS,
  rules,
};
const probe = (o: Partial<Probe>): Probe => ({ comp: "기본/Button", selector: "button.slds-button", prop: "color", base: "", sentinel: "", state: "static", fontSize: ["13px", "17.5px"], el: {}, ...o });
const judge = (o: Partial<Probe>) => judgeProbe(probe(o), j).map((v) => `${v.item}:${v.status}`).sort();

test("계산값 변화를 명세 항목에 대응시킨다: 지문, 속성 묶음, 빈틈·고정", () => {
  // 버튼 반경: s hook 지문(컴포넌트별 조정)과 속성 묶음(모서리). s hook이 기본값인 g hook을 가려도 모서리로 센다
  assert.deepEqual(judge({ prop: "border-top-left-radius", base: "4px", sentinel: "23px" }), ["component:reached", "radius:reached"]);
  // 움직임: 브리지 변수 지문. 시간 변수는 속도와 줄인 움직임 두 항목에 있다
  assert.deepEqual(judge({ prop: "transition-duration", base: "0.1s", sentinel: "0.777s, 0.777s" }), ["motion-speed:reached", "reduced-motion:reached"]);
  // 색은 지문이 있으면 지문 항목만(피드백 배경을 바탕·면으로 세지 않는다). 지문이 없으면 속성 묶음
  assert.deepEqual(judge({ prop: "background-color", base: "rgb(1, 2, 3)", sentinel: "rgb(240, 248, 231)" }), ["feedback:reached"]);
  assert.deepEqual(judge({ prop: "background-color", base: "rgb(1, 2, 3)", sentinel: "rgb(9, 9, 9)" }), ["surface:reached"]);
  assert.deepEqual(judge({ prop: "background-color", state: "disabled", base: "rgb(1, 2, 3)", sentinel: "rgb(9, 9, 9)" }), ["disabled:reached"]);
  // 너비·높이는 크기 hook 지문으로만 센다
  assert.deepEqual(judge({ prop: "width", base: "32px", sentinel: "22.75px" }), ["icon-size:reached"]);
  assert.deepEqual(judge({ prop: "width", base: "32px", sentinel: "23px" }), []);

  // 바뀌지 않은 값: 모양이 있으면 빈틈, 0px·0s·부모 상속은 세지 않는다
  assert.deepEqual(judge({ prop: "border-top-left-radius", base: "4px", sentinel: "4px" }), ["radius:gap"]);
  assert.deepEqual(judge({ prop: "border-top-left-radius", base: "0px", sentinel: "0px" }), []);
  assert.deepEqual(judge({ prop: "transition-timing-function", base: "ease", sentinel: "ease", el: { "transition-duration": "0s" } }), []);
  assert.deepEqual(judge({ prop: "color", base: "rgb(0, 0, 0)", sentinel: "rgb(9, 9, 9)", parent: ["rgb(0, 0, 0)", "rgb(9, 9, 9)"] }), []);
  // 글자 크기를 따라 바뀐 길이: em 간격은 세지 않고, 줄 간격 배수는 hook이 닿지 않은 값(빈틈)이다
  assert.deepEqual(judge({ prop: "padding-top", base: "6.5px", sentinel: "8.75px" }), []);
  assert.deepEqual(judge({ prop: "line-height", base: "19.5px", sentinel: "26.25px" }), ["line-height:gap"]);
  // 정적 검사와 같은 기준으로 브랜드 항목이 아닌 값: 음수 간격(숨긴 글자), line-height 1, 숨긴 체크박스 input의 글자색,
  // 퍼센트 반경(원), 너비·높이 0인 가상 요소의 테두리(삼각형), 크기 0 그림자, 두께 0인 테두리의 색
  assert.deepEqual(judge({ prop: "margin-top", base: "-1px", sentinel: "-1px" }), []);
  assert.deepEqual(judge({ prop: "line-height", base: "13px", sentinel: "13px", el: { "font-size": "13px" } }), []);
  assert.deepEqual(judge({ selector: "input.slds-assistive-text[type='checkbox']", base: "rgb(0, 0, 0)", sentinel: "rgb(0, 0, 0)" }), []);
  assert.deepEqual(judge({ prop: "border-top-left-radius", base: "50%", sentinel: "50%" }), []);
  assert.deepEqual(judge({ selector: "div.x::before", prop: "border-bottom-width", base: "5px", sentinel: "5px", el: { width: "0px", height: "0px" } }), []);
  // select 화살표: border-box라 너비가 6px지만 투명한 변과 색이 있는 변이 함께 있다(실측 Calendar)
  const arrow = { width: "6px", height: "5px", "border-top-color": "rgb(46, 46, 46)", "border-left-color": "rgba(0, 0, 0, 0)", "border-right-color": "rgba(0, 0, 0, 0)", "border-bottom-color": "rgb(46, 46, 46)" };
  assert.deepEqual(judge({ selector: "div.slds-select_container::before", prop: "border-bottom-width", base: "5px", sentinel: "5px", el: arrow }), []);
  assert.deepEqual(judge({ selector: "div.slds-select_container", prop: "border-bottom-width", base: "5px", sentinel: "5px", el: arrow }), ["border-width:gap"]);
  assert.deepEqual(judge({ prop: "box-shadow", base: "rgb(41, 118, 202) 0px 0px 0px 0px inset", sentinel: "rgb(41, 118, 202) 0px 0px 0px 0px inset" }), []);
  assert.deepEqual(judge({ prop: "border-top-color", base: "rgb(1, 2, 3)", sentinel: "rgb(1, 2, 3)", el: { "border-top-width": "0px" } }), []);
  // 브랜드 색과 같은 값은 판정하지 않고 따로 센다(흰색도 on-accent와 같아 여기 온다)
  assert.deepEqual(judge({ prop: "color", base: "rgb(41, 118, 202)", sentinel: "rgb(41, 118, 202)" }), ["text-color:brand"]);
  assert.deepEqual(judge({ prop: "background-color", base: "rgb(255, 255, 255)", sentinel: "rgb(255, 255, 255)" }), ["surface:brand"]);
  // 고정(설계 9.4)은 브랜드 색보다 먼저 본다(흰 글자 고정 선언이 맞으면 고정이다)
  const whiteRule = { selector: ".x", pseudo: "", prop: "color", id: "destructive-success-text" };
  assert.equal(judgeProbe(probe({ base: "rgb(255, 255, 255)", sentinel: "rgb(255, 255, 255)", matches: only(".x") }), { ...j, rules: [whiteRule] })[0].status, "fixed");
  // LEX 컨트롤 높이: 정적 검사의 고정 선언 .slds-button { line-height: 1.875rem }
  const lex: Partial<Probe> = { selector: "button.slds-button.slds-button_neutral[part='button']", prop: "line-height", base: "30px", sentinel: "30px", fontSize: ["13px", "13px"] };
  assert.deepEqual(judge({ ...lex, matches: only(".slds-button") }), ["line-height:fixed"]);
  // 고정 선언의 선택자가 요소에 맞지 않으면 고정이 아니다
  assert.deepEqual(judge({ ...lex, matches: only() }), ["line-height:gap"]);
  // 선택자 없는 고정 매처(미세 간격 0.125rem 이하는 어디서나)는 계산값에 그대로 맞춘다. 브라우저 기본 스타일의 option padding 2px
  assert.deepEqual(judge({ selector: "option", prop: "padding-left", base: "2px", sentinel: "2px", fontSize: ["13px", "13px"] }), ["density:fixed"]);
  // 곡선 ease는 CSS 초기값(곡선을 적지 않은 shorthand)이라 빈틈이 아니다
  assert.deepEqual(judge({ prop: "animation-timing-function", base: "ease", sentinel: "ease", el: { "animation-duration": "1s" } }), []);
  assert.deepEqual(judge({ prop: "animation-timing-function", base: "linear", sentinel: "linear", el: { "animation-duration": "1s" } }), ["motion-easing:gap"]);
  assert.deepEqual(judge({ prop: "letter-spacing", base: "normal", sentinel: "normal", parent: ["normal", "1.375px"] }), ["letter-spacing:fixed"]);
  // focus 뒤에 바뀐 그림자는 포커스 링이다
  assert.deepEqual(judge({ prop: "box-shadow", state: "focus", base: "rgb(1, 2, 3) 0px 0px 0px 2px", sentinel: "rgb(1, 2, 3) 0px 0px 0px 5.5px" }), ["focus-ring:reached"]);

  // 칸과 판정: 정적 검사처럼 가장 나쁜 상태를 따른다(빈틈 > 고정 > 반영). 반영 수는 반영 칸만 센다
  const table = new Map([
    ["기본/Button", new Map([["radius", { reached: 2, gap: 0, fixed: 0 }]])],
    ["기본/Card", new Map([["radius", { reached: 1, gap: 1, fixed: 0 }]])],
    ["기본/Icon", new Map([["radius", { reached: 0, gap: 0, fixed: 3 }]])],
    ["기본/Input", new Map([["radius", { reached: 4, gap: 0, fixed: 1 }]])],
  ]);
  const statuses = ["기본/Button", "기본/Card", "기본/Icon", "기본/Input", "없음"].map((c) => cellStatus(table.get(c)?.get("radius")));
  assert.deepEqual(statuses, ["반영", "일부", "고정", "고정", ""]);
  // 칸 글자는 "원본과 hook" 보기처럼 개수를 함께 보인다. hook이 닿고 고정이 섞인 칸은 고정이 아니라 일부다
  const labels = ["기본/Button", "기본/Card", "기본/Icon", "기본/Input", "없음"].map((c) => cellLabel(table.get(c)?.get("radius")));
  assert.deepEqual(labels, ["반영 (hook 2)", "일부 (hook 1 · 빈틈 1)", "고정 (고정 3)", "일부 (hook 4 · 고정 1)", ""]);
  // 9.6의 4 판정(reached)은 hook이 닿고 빈틈이 없는 컴포넌트를 센다(고정은 합의된 예외). strict는 정적 검사와 같은 셈이다
  assert.deepEqual(itemScore(table, "radius"), { reached: 2, strict: 1, total: 4 });
});

test("센티널과 관계없는 변화는 반영으로 세지 않는다: 다른 무리의 지문, 레이아웃 값", () => {
  // Tree 4단 들여쓰기: calc(spacing-4 × 4) = 33px가 반경 hook(container-radius-border) 값과 같아도 컴포넌트별 조정으로 세지 않는다.
  // 간격 hook 지문이 아니라서 밀도로도 세지 않는다(calc로 곱한 간격은 반영 근거로 쓰지 않는다)
  assert.deepEqual(judge({ prop: "padding-left", base: "16px", sentinel: "33px" }), []);
  // 간격 hook 지문이 맞으면 밀도
  assert.deepEqual(judge({ prop: "padding-left", base: "12px", sentinel: "8.25px" }), ["density:reached"]);
  // auto 가운데 정렬 margin과 % padding은 센티널 너비를 따라 바뀌어도 세지 않는다
  assert.deepEqual(judge({ prop: "margin-left", base: "66.6094px", sentinel: "70.125px" }), []);
  assert.deepEqual(judge({ prop: "padding-top", base: "48px", sentinel: "51px", fontSize: ["13px", "13px"] }), []);
  // 글자가 정한 너비(0.25px 단위가 아닌 기본값)가 우연히 크기 hook 지문과 같아져도 세지 않는다
  assert.deepEqual(judge({ prop: "width", base: "31.4219px", sentinel: "22.75px" }), []);
});

// 설계 9.4 고정은 정적 검사(scripts/audit)와 같은 결론이어야 한다(설계 9.6의 4)
const kebab = (camel: string) => camel.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const MEASURED = [...STATIC_PROPS, ...FOCUS_PROPS];

test("정적 검사가 두 모드 고정으로 판정한 선언은 그 선택자가 맞는 요소에서 고정이다(모든 선언)", () => {
  let checked = 0;
  for (const r of rules) {
    const prop = MEASURED.find((m) => coversProp(r.prop, m));
    if (!prop) continue; // z-index·투명도·커서처럼 재지 않는 속성
    const p = probe({ host: r.comp && `lightning-${kebab(r.comp)}`, selector: `x${r.pseudo}`, prop, base: "1px", matches: only(r.selector) });
    const ids = rules.filter((x) => x.selector === r.selector && x.pseudo === r.pseudo).map((x) => x.id);
    assert.ok(ids.includes(fixedOf(p, FIXED_ITEMS, rules)?.id ?? ""), `${r.selector}${r.pseudo} ${r.prop}`);
    checked++;
  }
  assert.ok(checked > 300, String(checked));
});

test("두 모드 고정 항목마다 고정 선언, 계산값 매처, 맞출 수 없는 이유 중 하나가 있다", () => {
  for (const f of FIXED_ITEMS.filter((x) => x.mode === "both")) {
    assert.ok(rules.some((r) => r.id === f.id) || COMPUTED_FIXED_IDS.includes(f.id) || UNMATCHED_FIXED[f.id], f.id);
  }
  // 계산값 매처: 정적 검사에 선언이 들어오지 않는 항목(매처가 비었거나 SLDS 2 값이 키워드)
  const computed: Record<string, Partial<Probe>> = {
    "form-letter-spacing": { selector: "button.slds-button", prop: "letter-spacing", base: "normal" },
    "object-icon-background": { selector: "span.slds-icon_container.slds-icon-standard-account", prop: "background-color", base: "rgb(1, 2, 3)" },
    "choice-label-weight": { context: ["span.slds-radio", "label.slds-radio__label"], selector: "span.slds-form-element__label", prop: "font-weight", base: "400" },
  };
  assert.deepEqual(Object.keys(computed).sort(), [...COMPUTED_FIXED_IDS].sort());
  for (const [id, o] of Object.entries(computed)) assert.equal(fixedOf(probe(o), FIXED_ITEMS, rules)?.id, id, id);
});

test("고정은 정적 검사와 같은 범위다: 목록·후손 선언은 고정으로 잡고, 조상에만 클래스가 있거나 다른 컴포넌트면 빈틈이다", () => {
  const rule = (pred: (r: (typeof rules)[number]) => boolean) => {
    const r = rules.find(pred);
    assert.ok(r, "정적 검사가 이 선언을 고정으로 판정한다");
    return r!;
  };
  // 새던 것 1: Datatable 고정 머리글 padding 32px(spacing-fine, 원본 매처는 선택자 목록의 쉼표에 맞춘다)
  const header = rule((r) => r.selector === ".slds-table_header-fixed_container" && r.prop === "padding-block-start");
  const headerProbe = { comp: "기본/Datatable", selector: "div.slds-table_header-fixed_container.slds-scrollable_x", prop: "padding-top", base: "32px", sentinel: "32px", fontSize: ["13px", "13px"] as [string, string] };
  assert.deepEqual(judge({ ...headerProbe, matches: only(header.selector) }), ["density:fixed"]);
  // 새던 것 2: datepicker 안 .slds-day 줄 간격 2rem(line-height-special, 후손 선택자 선언)
  const day = rule((r) => /\.slds-datepicker .*\.slds-day$/.test(r.selector) && r.prop === "line-height");
  assert.deepEqual(judge({ comp: "기본/Calendar", selector: "span.slds-day", prop: "line-height", base: "32px", sentinel: "32px", fontSize: ["13px", "13px"], matches: only(day.selector) }), ["line-height:fixed"]);
  // 숨던 것 1: 꼬리 팝오버 본문 안 버튼 그림자. nubbin 고정 선언은 모두 꼬리 요소 자신(마지막 compound)에 걸려 조상만으로는 맞지 않는다
  const nubbins = rules.filter((r) => r.id === "nubbin-shadow");
  assert.deepEqual(nubbins.filter((r) => !/nubbin[^ >+~]*$/.test(r.selector)), []);
  const popoverButton = { comp: "기본/Popup", selector: "button.slds-button.slds-button_neutral", prop: "box-shadow", base: "rgb(1, 2, 3) 0px 2px 2px 0px", sentinel: "rgb(1, 2, 3) 0px 2px 2px 0px" };
  assert.deepEqual(judge({ ...popoverButton, matches: only(".slds-button", ".slds-button_neutral", ".slds-popover__body .slds-button") }), ["shadow:gap"]);
  // 숨던 것 2: 기본 컴포넌트 CSS의 고정 선언은 그 컴포넌트 안에서만 맞는다(lbc-internal은 합의한 8개 컴포넌트)
  const logo = rule((r) => r.id === "lbc-internal" && r.comp === "baseCombobox" && r.prop === "margin-top");
  const lbc = { selector: "div.x", prop: "margin-top", base: "4px", matches: only(logo.selector) };
  assert.equal(fixedOf(probe({ ...lbc, host: "lightning-base-combobox" }), FIXED_ITEMS, rules)?.id, "lbc-internal");
  assert.equal(fixedOf(probe({ ...lbc, host: "lightning-textarea" }), FIXED_ITEMS, rules), undefined);
  // Path 양 끝 반경은 :first-child·:last-child 선언이다. 가운데 항목(그 선택자에 맞지 않음)은 고정이 아니다
  const end = rule((r) => r.id === "path-end-radius");
  const path = { host: "lightning-progress-step", selector: "lightning-progress-step.slds-path__item", prop: "border-top-left-radius", base: "15px" };
  assert.equal(fixedOf(probe({ ...path, matches: only(end.selector) }), FIXED_ITEMS, rules)?.id, "path-end-radius");
  assert.equal(fixedOf(probe({ ...path, matches: only(".slds-path__item") }), FIXED_ITEMS, rules), undefined);
});

test("예제가 자기 클래스로 꾸민 호스트는 그 호스트 자신을 판정하지 않는다", () => {
  // Layout 예제: <lightning-layout-item padding="around-small" class="custom-box">, 예제 CSS .custom-box { padding: 1rem; … }
  assert.equal(exampleStyledHost(["custom-box", "slds-p-around_small", "slds-col"]), true);
  // 컴포넌트가 붙인 클래스(slds-·fix-)만 있으면 판정한다
  assert.equal(exampleStyledHost(["slds-badge"]), false);
  assert.equal(exampleStyledHost(["slds-path__item", "slds-is-complete"]), false);
  assert.equal(exampleStyledHost(["fix-slds-x", "slds-y"]), false);
  assert.equal(exampleStyledHost([]), false);
});
