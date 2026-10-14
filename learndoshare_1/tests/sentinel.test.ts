import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXED_ITEMS } from "../lib/fixed-list.ts";
import { loadRuleContext } from "../lib/hooks-index.ts";
import { cellStatus, hookItems, itemScore, judgeProbe, type JudgeContext, type Probe } from "../lib/reflect.ts";
import { checkUtilCss, COLOR_S_WHITELIST } from "../lib/rules.ts";
import { buildSentinelUtilCss, sentinelPlan } from "../lib/sentinel.ts";
import { SPEC_ITEMS } from "../lib/spec-items.ts";
import { sentinelModule } from "../lib/storybook-plugin.ts";

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
  const missing = new Map(plan.missing.map((m) => [m.name, m.reason]));
  // 켜기 스위치는 넣지 않는다
  assert.match(missing.get("--milvus-button-custom")!, /스위치/);
  assert.ok(!plan.decls.some((d) => d.name === "--milvus-button-custom"));
  // 색 s hook은 규칙상 중립 g hook 하나를 참조해 그 hook과 값이 같다. 넣되 "센티널 없음"으로 알린다
  for (const name of COLOR_S_WHITELIST) assert.match(missing.get(name)!, /값이 같다/, name);

  // 명세 항목에 읽는 곳 없는 이름이나 브리지가 읽지 않는 변수가 있으면 규칙 메시지와 함께 나온다
  const typo = { ...SPEC_ITEMS[2], id: "typo", hooks: ["--slds-g-radius-border-99"], bridgeVars: ["--milvus-nope"] };
  const more = new Map(sentinelPlan(ctx, [typo]).missing.map((m) => [m.name, m.reason]));
  assert.match(more.get("--slds-g-radius-border-99")!, /읽지 않는 이름/);
  assert.match(more.get("--milvus-nope")!, /읽는 밀버스 컴포넌트나 milvusBridge\.css가 없다/);
});

test("virtual:milvus-sentinel은 저장소 모드와 프로젝트 모드에서 센티널을 내보낸다", async () => {
  const load = async (code: string) => import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const repo = await load(sentinelModule({ mode: "repo", repoDir: root }));
  assert.match(repo.sentinelCss, /--milvus-motion-duration-fast: 0\.777s;/);
  assert.ok(repo.brandColorHooks.includes("--slds-g-color-accent-1"));

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

// 반영 검사 페이지가 브라우저에서 잰 계산값 한 쌍을 명세 항목으로 나누는 순수 함수(lib/reflect.ts)
test("계산값 변화를 명세 항목에 대응시킨다: 지문, 속성 묶음, 빈틈·고정", () => {
  const j: JudgeContext = {
    fingerprints: new Map([
      ["length|23px", ["--slds-s-button-radius-border"]],
      ["color|rgb(240, 248, 231)", ["--slds-g-color-success-container-1"]],
      ["transition-duration|0.777s", ["--milvus-motion-duration-fast"]],
    ]),
    hookItems: hookItems(SPEC_ITEMS),
    brandColors: new Set(["rgb(41, 118, 202)"]),
    fixed: FIXED_ITEMS,
  };
  const probe = (o: Partial<Probe>): Probe => ({ comp: "기본/Button", selector: "button.slds-button", prop: "color", base: "", sentinel: "", state: "static", fontSize: ["13px", "17.5px"], el: {}, ...o });
  const judge = (o: Partial<Probe>) => judgeProbe(probe(o), j).map((v) => `${v.item}:${v.status}`).sort();

  // 버튼 반경: s hook 지문(컴포넌트별 조정)과 속성 묶음(모서리). s hook이 기본값인 g hook을 가려도 모서리로 센다
  assert.deepEqual(judge({ prop: "border-top-left-radius", base: "4px", sentinel: "23px" }), ["component:reached", "radius:reached"]);
  // 움직임: 브리지 변수 지문. 시간 변수는 속도와 줄인 움직임 두 항목에 있다
  assert.deepEqual(judge({ prop: "transition-duration", base: "0.1s", sentinel: "0.777s, 0.777s" }), ["motion-speed:reached", "reduced-motion:reached"]);
  // 색은 지문이 있으면 지문 항목만(피드백 배경을 바탕·면으로 세지 않는다). 지문이 없으면 속성 묶음
  assert.deepEqual(judge({ prop: "background-color", base: "rgb(1, 2, 3)", sentinel: "rgb(240, 248, 231)" }), ["feedback:reached"]);
  assert.deepEqual(judge({ prop: "background-color", base: "rgb(1, 2, 3)", sentinel: "rgb(9, 9, 9)" }), ["surface:reached"]);
  assert.deepEqual(judge({ prop: "background-color", state: "disabled", base: "rgb(1, 2, 3)", sentinel: "rgb(9, 9, 9)" }), ["disabled:reached"]);

  // 바뀌지 않은 값: 모양이 있으면 빈틈, 0px·0s·투명·브랜드 색·부모 상속은 세지 않는다
  assert.deepEqual(judge({ prop: "border-top-left-radius", base: "4px", sentinel: "4px" }), ["radius:gap"]);
  assert.deepEqual(judge({ prop: "border-top-left-radius", base: "0px", sentinel: "0px" }), []);
  assert.deepEqual(judge({ prop: "transition-timing-function", base: "ease", sentinel: "ease", el: { "transition-duration": "0s" } }), []);
  assert.deepEqual(judge({ prop: "color", base: "rgb(41, 118, 202)", sentinel: "rgb(41, 118, 202)" }), []);
  assert.deepEqual(judge({ prop: "color", base: "rgb(0, 0, 0)", sentinel: "rgb(9, 9, 9)", parent: ["rgb(0, 0, 0)", "rgb(9, 9, 9)"] }), []);
  // 글자 크기를 따라 바뀐 길이: em 간격은 세지 않고, 줄 간격 배수는 hook이 닿지 않은 값(빈틈)이다
  assert.deepEqual(judge({ prop: "padding-top", base: "6.5px", sentinel: "8.75px" }), []);
  assert.deepEqual(judge({ prop: "line-height", base: "19.5px", sentinel: "26.25px" }), ["line-height:gap"]);
  // 정적 검사와 같은 기준으로 브랜드 항목이 아닌 값: 음수 간격(숨긴 글자), line-height 1, 숨긴 체크박스 input의 글자색
  assert.deepEqual(judge({ prop: "margin-top", base: "-1px", sentinel: "-1px" }), []);
  assert.deepEqual(judge({ prop: "line-height", base: "13px", sentinel: "13px", el: { "font-size": "13px" } }), []);
  assert.deepEqual(judge({ selector: "input.slds-assistive-text[type='checkbox']", base: "rgb(0, 0, 0)", sentinel: "rgb(0, 0, 0)" }), []);
  // 고정(설계 9.4): LEX 컨트롤 높이(line-height 1.875rem), 파괴 버튼의 흰 글자, 부모 자간을 끊는 폼 요소
  assert.deepEqual(judge({ selector: "button.slds-button.slds-button_neutral[part='button']", prop: "line-height", base: "30px", sentinel: "30px", fontSize: ["13px", "13px"] }), ["line-height:fixed"]);
  assert.deepEqual(judge({ selector: "button.slds-button.slds-button_destructive", base: "rgb(255, 255, 255)", sentinel: "rgb(255, 255, 255)" }), ["text-color:fixed"]);
  assert.deepEqual(judge({ prop: "letter-spacing", base: "normal", sentinel: "normal", parent: ["normal", "1.375px"] }), ["letter-spacing:fixed"]);
  // focus 뒤에 바뀐 그림자는 포커스 링이다
  assert.deepEqual(judge({ prop: "box-shadow", state: "focus", base: "rgb(1, 2, 3) 0px 0px 0px 2px", sentinel: "rgb(1, 2, 3) 0px 0px 0px 5.5px" }), ["focus-ring:reached"]);

  // 칸과 판정: 빈틈이 하나라도 있으면 일부, 반영 수는 빈틈 없는 칸만 센다
  const table = new Map([
    ["기본/Button", new Map([["radius", { reached: 2, gap: 0, fixed: 0 }]])],
    ["기본/Card", new Map([["radius", { reached: 1, gap: 1, fixed: 0 }]])],
    ["기본/Icon", new Map([["radius", { reached: 0, gap: 0, fixed: 3 }]])],
  ]);
  assert.deepEqual(["기본/Button", "기본/Card", "기본/Icon", "없음"].map((c) => cellStatus(table.get(c)?.get("radius"))), ["반영", "일부", "고정", ""]);
  assert.deepEqual(itemScore(table, "radius"), { reached: 1, total: 3 });
});
