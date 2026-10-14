import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, type AtRule, type Container, type Declaration, type Rule } from "postcss";
import { BRIDGE_TARGETS, readSlds2Css, type BridgeTarget } from "../scripts/bridge/targets.ts";
import { generateBridge } from "../scripts/bridge/generate.ts";
import { BRIDGE_VARS } from "../lib/bridge-vars.ts";
import { SPEC_ITEMS } from "../lib/spec-items.ts";
import { loadRuleContext } from "../lib/hooks-index.ts";
import { declProblem } from "../lib/rules.ts";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const sldsCss = readSlds2Css();
const bridgeCss = generateBridge(sldsCss, BRIDGE_TARGETS);
const REDUCED = "@media (prefers-reduced-motion: reduce)";

const tmp = mkdtempSync(join(tmpdir(), "milvus 브리지-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

// 규칙의 맥락(@media·@supports)과 선택자 목록. 선택자는 부분마다 공백을 하나로 줄여 ", "로 잇는다
const contextOf = (node: Container) => {
  const chain: string[] = [];
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) if (p.type === "atrule") chain.unshift(`@${(p as AtRule).name} ${(p as AtRule).params}`);
  return chain.join(" > ");
};
const keyOf = (r: Rule) => `${contextOf(r)} | ${r.selectors.map((s) => s.replace(/\s+/g, " ").trim()).join(", ")}`;
function declsByRule(css: string): Map<string, Declaration[]> {
  const out = new Map<string, Declaration[]>();
  parse(css).walkRules((r) => {
    if (/keyframes$/.test((r.parent as AtRule).name ?? "")) return;
    out.set(keyOf(r), [...(out.get(keyOf(r)) ?? []), ...(r.nodes.filter((n) => n.type === "decl") as Declaration[])]);
  });
  return out;
}
// var(--milvus-x, 기본값)과 max(…, 0.01ms)를 벗겨 브랜드가 변수를 정하지 않았을 때의 값을 얻는다
function unbridged(value: string): string {
  let v = value;
  for (let before = ""; before !== v; ) {
    before = v;
    v = v.replace(/max\((var\(--milvus-[\w-]+, [^()]*(?:\([^()]*\))*[^()]*\)), 0\.01ms\)/g, "$1");
    v = v.replace(/var\(--milvus-[\w-]+, ((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g, "$1");
  }
  return v;
}
// transition·animation shorthand의 항목별 시간(첫 시간 값)과 곡선. 없으면 초기값 0s·ease
const TIME = /^(-?(\d*\.)?\d+m?s|calc\()/;
const EASING = /^(ease|ease-in|ease-out|ease-in-out|linear|step-start|step-end)$|^(cubic-bezier|steps|linear)\(/;
const longhandOf = (shorthand: string, part: "duration" | "timing-function") =>
  shorthand
    .split(/,(?![^(]*\))/)
    .map((item) => item.trim().split(/\s+(?![^(]*\))/).find((t) => (part === "duration" ? TIME : EASING).test(t)) ?? (part === "duration" ? "0s" : "ease"))
    .join(", ");
// 원본 규칙에서 이 속성이 가질 수 있는 값: 같은 속성, shorthand에서 꺼낸 값, font: inherit
function originalValues(original: Declaration[], prop: string): string[] {
  const base = prop.replace(/-(duration|timing-function)$/, "");
  return original.flatMap((o) =>
    o.prop === prop
      ? [o.value]
      : o.prop === base && base !== prop
        ? [longhandOf(o.value, prop.endsWith("duration") ? "duration" : "timing-function")]
        : o.prop === "font" && /^(line-height|font-weight)$/.test(prop)
          ? [o.value]
          : [],
  );
}

test("모든 규칙의 var() 기본값은 SLDS 2 원래 값과 같고, 함께 다시 넣은 선언은 원본 값 그대로다", () => {
  const source = declsByRule(sldsCss);
  let bridged = 0;
  parse(bridgeCss).walkDecls((d) => {
    const rule = d.parent as Rule;
    if (contextOf(rule).startsWith(REDUCED)) return;
    const original = source.get(keyOf(rule));
    assert.ok(original, `원본에 없는 규칙: ${keyOf(rule)}`);
    const values = originalValues(original, d.prop);
    if (/var\(--milvus-/.test(d.value)) {
      bridged++;
      // 원본에 선언이 없으면 브라우저 기본값(initial)이다
      const initial = BRIDGE_TARGETS.find((t) => t.property === d.prop && t.initial !== undefined)?.initial;
      assert.ok((values.length ? values : [initial]).includes(unbridged(d.value)), `${keyOf(rule)} { ${d.prop}: ${d.value} }`);
    } else {
      assert.ok(values.includes(d.value), `원본과 다른 선언: ${keyOf(rule)} { ${d.prop}: ${d.value} }`);
    }
  });
  assert.ok(bridged > 150, `브리지 선언 ${bridged}개`);
});

test("모달·토스트 시간은 max(..., 0.01ms)로 감싼다", () => {
  const durations = [...bridgeCss.matchAll(/(max\()?var\(--milvus-motion-duration-[\w-]+, [^)]+\)(, 0\.01ms\))?/g)];
  assert.ok(durations.length > 0);
  // 모달·배경막·토스트를 고르지 않고 시간 변수를 모두 감싼다. 0과 0.01ms는 눈으로 같다
  for (const [m, max, min] of durations) assert.ok(max && min, m);
  // SLDS 2 CSS에는 토스트 움직임이 없어 알림(.slds-notification)을 본다. lightning 토스트의 0.4s는 기본 컴포넌트
  // 합성 CSS(toast.lbc.synthetic.css)에 있고 생성기 입력(SLDS 2 CSS) 밖이다
  for (const selector of [".slds-modal", ".slds-backdrop_open, .slds-backdrop--open", ".slds-notification"]) {
    const rule = parse(bridgeCss).nodes.find((n): n is Rule => n.type === "rule" && n.selectors.join(", ") === selector);
    assert.match(rule?.toString() ?? "", /transition-duration: max\(var\(--milvus-motion-duration-(fast|slow), [\d.]+s\), 0\.01ms\)/, selector);
  }
});

test("스피너 선택자는 시간 규칙에서 빠지고 줄인 움직임 규칙에만 있다", () => {
  const reduced = parse(bridgeCss).nodes.find((n): n is AtRule => n.type === "atrule" && `@${n.name} ${n.params}` === REDUCED);
  assert.ok(reduced, "줄인 움직임 규칙이 없다");
  const spinner = (r: Rule) => /spinner/.test(r.selector);
  const inReduced: Rule[] = [];
  reduced.walkRules((r) => void inReduced.push(r));
  assert.ok(inReduced.some(spinner));
  for (const r of inReduced) {
    assert.deepEqual(
      r.nodes.map((n) => n.toString()),
      ["transition-duration: 0.01ms", "animation-duration: 0.01ms", "animation-iteration-count: 1"],
    );
  }
  parse(bridgeCss).walkDecls(/^(transition|animation)/, (d) => {
    if (spinner(d.parent as Rule)) assert.doesNotMatch(d.value, /--milvus-/, (d.parent as Rule).selector);
  });
});

test("SPEC_ITEMS의 모든 bridgeVars가 생성된 CSS에서 읽힌다", () => {
  // 개체 아이콘 하나의 변수(--milvus-icon-<종류>-<이름>)는 BRIDGE_VARS에 없고 id에서 이름을 만든다
  for (const t of BRIDGE_TARGETS) assert.equal(t.varName, BRIDGE_VARS[t.id] ?? `--milvus-${t.id}`, t.id);
  const wanted = new Set(SPEC_ITEMS.flatMap((i) => i.bridgeVars));
  const read = new Set([...bridgeCss.matchAll(/var\((--milvus-[\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...wanted].filter((v) => !read.has(v)), []);

  // 리뷰·사용자 결정으로 더한 대상(2026-10-12): 선택자·맥락·속성마다 이 변수를 읽는다
  const byRule = declsByRule(bridgeCss);
  const reads = (key: string, prop: string, varName: string) => (byRule.get(key) ?? []).some((d) => d.prop === prop && d.value.includes(`var(${varName},`));
  const MODAL = (size: string) => `@media (min-width: 48em) | .slds-modal_${size} .slds-modal__container, .slds-modal--${size} .slds-modal__container`;
  const expected: [string, string, string][] = [
    // lightning-combobox는 slds-input 대신 slds-input_faux만 붙인다
    [" | .slds-input_faux, .slds-input--faux", "border", BRIDGE_VARS["input-border-width"]],
    [" | .slds-checkbox_toggle .slds-form-element__label, .slds-checkbox--toggle .slds-form-element__label", "font-weight", BRIDGE_VARS["choice-label-weight"]],
    ["@media (min-width: 48em) | .slds-modal__container", "width", BRIDGE_VARS["modal-width-base"]],
    ["@media (min-width: 48em) | .slds-modal__container", "max-width", BRIDGE_VARS["modal-width-base"]],
    ["@media (min-width: 48em) | .slds-modal__container", "min-width", BRIDGE_VARS["modal-min-width"]],
    [MODAL("small"), "width", BRIDGE_VARS["modal-width-small"]],
    [MODAL("small"), "max-width", BRIDGE_VARS["modal-width-small"]],
    [MODAL("full"), "width", BRIDGE_VARS["modal-width-full"]],
    ...["small", "medium", "large", "full"].map((size): [string, string, string] => [MODAL(size), "min-width", BRIDGE_VARS["modal-min-width"]]),
    [" | .slds-text-title_caps, .slds-text-title--caps", "letter-spacing", BRIDGE_VARS["caps-letter-spacing"]],
    [" | .slds-section-title_divider, .slds-section-title--divider", "letter-spacing", BRIDGE_VARS["caps-letter-spacing"]],
    [" | .slds-is-sortable__icon", "width", BRIDGE_VARS["sort-icon-size"]],
    [" | .slds-is-sortable__icon", "height", BRIDGE_VARS["sort-icon-size"]],
    // 세로 내비 선택 바탕(2026-10-12 결정). 원본 선택자 목록 그대로(같은 부분이 두 번 나온다)
    [
      ` | ${[
        ".slds-navigation-list-vertical .slds-is-active .slds-navigation-list-vertical__action",
        ".slds-navigation-list--vertical .slds-is-active .slds-navigation-list-vertical__action",
        ".slds-navigation-list_vertical .slds-is-active .slds-navigation-list-vertical__action",
        ".slds-navigation-list--vertical .slds-is-active .slds-navigation-list-vertical__action",
        ".slds-navigation-list-vertical .slds-is-active .slds-navigation-list--vertical__action",
        ".slds-navigation-list--vertical .slds-is-active .slds-navigation-list--vertical__action",
        ".slds-navigation-list_vertical .slds-is-active .slds-navigation-list--vertical__action",
        ".slds-navigation-list--vertical .slds-is-active .slds-navigation-list--vertical__action",
      ].join(", ")}`,
      "background-color",
      BRIDGE_VARS["nav-selected-background"],
    ],
  ];
  assert.deepEqual(expected.filter(([key, prop, v]) => !reads(key, prop, v)), []);
  // 작은 화면의 full 모달(100%·최소 0)은 전체 화면이라 바꾸지 않는다
  const mobileFull = byRule.get("@media (max-width: 30em) | .slds-modal_full .slds-modal__container, .slds-modal--full .slds-modal__container") ?? [];
  assert.deepEqual(mobileFull.filter((d) => /--milvus-/.test(d.value)), []);
});

// SLDS 2가 개체 아이콘 클래스마다 정한 배경 hook 규칙(설계 5.6: 973곳). 별칭 클래스가 함께 있는 규칙도 있다(.slds-icon-custom-custom110, .slds-icon-custom-110)
const OBJECT_ICON = /^\.slds-icon-(standard|custom|action)-[\w-]+$/;
const ICON_BG = "--slds-c-icon-color-background";
const iconRules = (css: string) => {
  const out: Rule[] = [];
  parse(css).walkRules((r) => {
    if (r.selectors.every((s) => OBJECT_ICON.test(s)) && r.some((d) => d.type === "decl" && d.prop === ICON_BG)) out.push(r);
  });
  return out;
};
// 변수 이름은 규칙의 첫 클래스(lightning-icon이 붙이는 이름)에서 온다
const iconVar = (r: Rule) => r.selectors[0].replace(".slds-icon-", "--milvus-icon-");

test("973개 클래스 모두 규칙이 있고 기본값은 원래 색과 같다", () => {
  const source = iconRules(sldsCss);
  assert.equal(source.length, 973);
  const bridge = declsByRule(bridgeCss);
  const wrong = source.filter((r) => {
    const original = r.nodes.find((d): d is Declaration => d.type === "decl" && d.prop === ICON_BG)!.value;
    const got = (bridge.get(keyOf(r)) ?? []).map((d) => `${d.prop}: ${d.value}`);
    return got.join() !== `${ICON_BG}: var(${iconVar(r)}, var(--milvus-icon-color-all, ${original}))`;
  });
  assert.equal(wrong.length, 0, `규칙이 없거나 다른 클래스 ${wrong.length}개: ${wrong.slice(0, 3).map(keyOf).join(" / ")}`);
  // 뒤에서 같은 우선순위로 이 hook을 다시 정하는 .slds-avatar는 원래대로 이기도록 개체 아이콘 규칙 뒤에 다시 넣는다
  const order = parse(bridgeCss).nodes.filter((n): n is Rule => n.type === "rule");
  const avatar = order.findIndex((r) => r.selector === ".slds-avatar" && r.some((d) => d.type === "decl" && d.prop === ICON_BG && d.value === "var(--_slds-c-avatar-color-background)"));
  const lastIcon = order.findLastIndex((r) => r.selectors.every((s) => OBJECT_ICON.test(s)));
  assert.ok(avatar > lastIcon && lastIcon >= 0, `.slds-avatar ${avatar}, 마지막 개체 아이콘 ${lastIcon}`);
});

test("--milvus-icon-color-all을 정하면 모든 개체 아이콘이 그 값을 쓴다", () => {
  // 브랜드가 정한 변수로 var(--milvus-*)를 안쪽부터 푼다
  const resolve = (value: string, defined: Record<string, string>) => {
    let v = value;
    for (let before = ""; before !== v; ) {
      before = v;
      v = v.replace(/var\((--milvus-[\w-]+), ((?:[^()]|\([^()]*\))*)\)/g, (_, name: string, fallback: string) => defined[name] ?? fallback);
    }
    return v;
  };
  const icons = iconRules(bridgeCss);
  assert.equal(icons.length, 973);
  const valueOf = (r: Rule) => r.nodes.find((d): d is Declaration => d.type === "decl" && d.prop === ICON_BG)!.value;
  const all = { "--milvus-icon-color-all": "rgb(1, 2, 3)" };
  assert.deepEqual(icons.filter((r) => resolve(valueOf(r), all) !== "rgb(1, 2, 3)").map((r) => r.selector), []);
  // 개체 하나의 변수가 전체 값보다 앞선다
  const account = { ...all, "--milvus-icon-standard-account": "rgb(4, 5, 6)" };
  const changed = icons.filter((r) => resolve(valueOf(r), account) === "rgb(4, 5, 6)").map((r) => r.selector);
  assert.deepEqual(changed, [".slds-icon-standard-account"]);
});

test("생성된 --milvus-* 이름이 loadRuleContext의 milvusVars에 잡힌다", () => {
  // 저장소의 milvusBridge.css가 지금 생성 결과와 같아야 한다(pnpm bridge:generate를 잊지 않았는지)
  const committed = readFileSync(join(pkgRoot, "templates/force-app/main/default/staticresources/milvusBridge.css"), "utf8");
  assert.equal(committed, bridgeCss);
  const { milvusVars } = loadRuleContext({ pkgRoot });
  const names = new Set([...bridgeCss.matchAll(/var\((--milvus-[\w-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...names].filter((n) => !milvusVars.has(n)), []);
  // 프로젝트 사본도 같다
  const project = join(tmp, "고객 프로젝트");
  mkdirSync(join(project, "force-app/main/default/staticresources"), { recursive: true });
  writeFileSync(join(project, "force-app/main/default/staticresources/milvusBridge.css"), bridgeCss);
  const fromProject = loadRuleContext({ pkgRoot, projectRoot: project }).milvusVars;
  assert.deepEqual([...names].filter((n) => !fromProject.has(n)), []);
});

// 2026-10-14 사용자 결정: LEX 목록·헤더 툴바는 32px 아이콘 버튼과 텍스트 버튼을 섞어 두어 브리지로 높이를 바꾸면 어긋난다
test("컨트롤 높이는 브리지로 잇지 않는다. 브랜드가 --milvus-control-height를 쓰면 check가 '읽는 곳 없음'으로 막는다", () => {
  assert.equal(BRIDGE_VARS["control-height"], undefined);
  assert.deepEqual(BRIDGE_TARGETS.filter((t) => t.id === "control-height"), []);
  assert.doesNotMatch(bridgeCss, /--milvus-control-height/);
  const ctx = loadRuleContext({ pkgRoot });
  assert.equal(ctx.milvusVars.has("--milvus-control-height"), false);
  assert.equal(declProblem("--milvus-control-height", "2.375rem", ctx)?.[0], "milvus-var");
});

test("shorthand는 longhand로 잇고 묶음 밖 시간·곡선은 원래 값, 원본 맥락(@media·@supports)을 지킨다", () => {
  const css = `.slds-a { transition: opacity 0.1s linear, transform 0.2s ease-in, color 0.12s; }
    @media (min-width: 48em) { @supports (display: grid) { .slds-b { animation: spin 0.3s steps(4) 2s, pulse 0.4s ease-out; } } }`;
  const T = (id: string, selector: string, property: string): BridgeTarget => ({
    id,
    selectors: [selector],
    property,
    varName: BRIDGE_VARS[id],
    ...(id.startsWith("motion-duration") ? { min: "0.01ms" } : {}),
  });
  const out = generateBridge(css, [
    T("motion-duration-fast", ".slds-a", "transition-duration"),
    T("motion-duration-medium", ".slds-a", "transition-duration"),
    T("motion-easing", ".slds-a", "transition-timing-function"),
    T("motion-duration-slow", ".slds-b", "animation-duration"),
    T("motion-easing", ".slds-b", "animation-timing-function"),
  ]);
  const rules = declsByRule(out);
  // 원본 shorthand는 그대로 두고 브리지는 longhand만 정한다(속성 목록·지연은 원본 것이 남는다).
  // 곡선을 적지 않은 항목은 초기값 ease이고 이것도 브랜드 곡선을 따른다
  assert.deepEqual(
    rules.get(" | .slds-a")?.map((d) => `${d.prop}: ${d.value}`),
    [
      "transition-duration: max(var(--milvus-motion-duration-fast, 0.1s), 0.01ms), max(var(--milvus-motion-duration-medium, 0.2s), 0.01ms), 0.12s",
      "transition-timing-function: var(--milvus-motion-easing, linear), var(--milvus-motion-easing, ease-in), var(--milvus-motion-easing, ease)",
    ],
  );
  // steps()는 프레임 애니메이션이라 곡선을 바꾸지 않는다. 2s는 지연이다
  assert.deepEqual(
    rules.get("@media (min-width: 48em) > @supports (display: grid) | .slds-b")?.map((d) => `${d.prop}: ${d.value}`),
    [
      "animation-duration: max(var(--milvus-motion-duration-slow, 0.3s), 0.01ms), max(var(--milvus-motion-duration-slow, 0.4s), 0.01ms)",
      "animation-timing-function: steps(4), var(--milvus-motion-easing, ease-out)",
    ],
  );
});

test("같은 우선순위로 뒤에 오는 원본 선언은 그대로 다시 넣어 원래 이기던 규칙이 계속 이긴다", () => {
  const css = `.slds-button { line-height: 1.875rem; color: red; }
    .x .slds-button_icon { line-height: 2; }
    .slds-button_icon { line-height: 1; }
    .slds-button_icon-more { font: inherit; }
    .slds-badge:hover { line-height: 3; }
    .slds-badge { line-height: 3; }
    div { line-height: 4; }`;
  const out = generateBridge(css, [{ id: "x", selectors: [".slds-button"], property: "line-height", varName: "--milvus-x" }]);
  // 우선순위가 다른 규칙(.x .slds-button_icon, .slds-badge:hover, div)은 원래대로 이기거나 지므로 다시 넣지 않는다.
  // 같은 우선순위는 같은 요소에 맞는지 알 수 없어 모두 다시 넣는다(.slds-badge).
  // font shorthand는 line-height도 정하므로 그 값만 꺼내 넣는다(다른 글꼴 속성은 건드리지 않는다)
  assert.deepEqual(
    [...declsByRule(out)].map(([k, ds]) => `${k.slice(3)} { ${ds.map((d) => `${d.prop}: ${d.value}`).join("; ")} }`),
    [
      ".slds-button { line-height: var(--milvus-x, 1.875rem) }",
      ".slds-button_icon { line-height: 1 }",
      ".slds-button_icon-more { line-height: inherit }",
      ".slds-badge { line-height: 3 }",
    ],
  );
});

test("원본에서 대상 선택자나 속성을 찾지 못하면 실패한다(Salesforce 구조 변경)", () => {
  const target: BridgeTarget = { id: "caps-transform", selectors: [".slds-gone"], property: "text-transform", varName: BRIDGE_VARS["caps-transform"] };
  assert.throws(() => generateBridge(".slds-text-title_caps { text-transform: uppercase; }", [target]), /\.slds-gone/);
  // 원본에 선언이 없는 속성은 initial(브라우저 기본값)이 있을 때만 새로 넣는다
  const letter: BridgeTarget = { id: "letter-spacing", selectors: ["button, input"], property: "letter-spacing", varName: BRIDGE_VARS["letter-spacing"], initial: "normal" };
  assert.match(generateBridge("button, input { font: inherit; }", [letter]), /button, input \{\n {2}letter-spacing: var\(--milvus-letter-spacing, normal\);\n\}/);
  assert.throws(() => generateBridge("button, input { font: inherit; }", [{ ...letter, initial: undefined }]), /letter-spacing/);
  // 선언은 있어도 바꿀 값(token, 묶음 안 시간 등)이 사라졌으면 실패한다. 조용히 넘어가면 그 컨트롤에서만 브랜드 값이 빠진다
  const height: BridgeTarget = { id: "x", selectors: [".slds-select"], property: "height", varName: "--milvus-x", token: "1.875rem" };
  assert.match(generateBridge(".slds-select { height: calc(1.875rem + 2px); }", [height]), /calc\(var\(--milvus-x, 1\.875rem\) \+ 2px\)/);
  assert.throws(() => generateBridge(".slds-select { height: calc(2rem + 2px); }", [height]), /1\.875rem/);
  const border: BridgeTarget = { id: "input-border-width", selectors: [".slds-input"], property: "border", varName: BRIDGE_VARS["input-border-width"], token: "1px" };
  assert.throws(() => generateBridge(".slds-input { border: var(--slds-g-sizing-border-1) solid red; }", [border]), /1px/);
});
