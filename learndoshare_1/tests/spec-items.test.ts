import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { hooksIndexFromSource } from "../lib/hooks-index.ts";
import { FEEDBACK_HOOKS, LBC_ONLY_G } from "../lib/rules.ts";
import { BRIDGE_VARS } from "../lib/bridge-vars.ts";
import { SPEC_ITEMS } from "../lib/spec-items.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

test("SPEC_ITEMS의 id는 겹치지 않는다", () => {
  const ids = SPEC_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("SPEC_ITEMS의 hooks는 모두 loadRuleContext(저장소)의 읽히는 이름이거나 LBC_ONLY_G다", () => {
  // loadRuleContext(저장소)와 같은 색인. dist/hooks-index.json은 pack.test가 같은 때에 다시 쓰므로 원본에서 계산한다
  const index = hooksIndexFromSource(root);
  const read = new Set([...index.readGHooks, ...index.readSHooks, ...LBC_ONLY_G]);
  const unread = SPEC_ITEMS.flatMap((i) => i.hooks.filter((h) => !read.has(h)).map((h) => `${i.id}: ${h}`));
  assert.deepEqual(unread, []);
});

test("피드백 색 항목의 hooks는 FEEDBACK_HOOKS(설계 5.3)와 같다", () => {
  const expected = Object.values(FEEDBACK_HOOKS)
    .flatMap((k) => [k.text, k.onContainer, k.container, k.border, ...k.hover])
    .filter((n) => n !== null);
  assert.deepEqual(new Set(SPEC_ITEMS.find((i) => i.id === "feedback")?.hooks), new Set(expected));
});

test("SPEC_ITEMS의 bridgeVars는 모두 BRIDGE_VARS의 값이다", () => {
  const vars = new Set(Object.values(BRIDGE_VARS));
  const unknown = SPEC_ITEMS.flatMap((i) => i.bridgeVars.filter((v) => !vars.has(v)).map((v) => `${i.id}: ${v}`));
  assert.deepEqual(unknown, []);
  // 거꾸로, 브리지 변수마다 그 변수를 고르는 명세 항목이 있다
  const used = new Set(SPEC_ITEMS.flatMap((i) => i.bridgeVars));
  assert.deepEqual([...vars].filter((v) => !used.has(v)), []);
});

test("브리지를 뺀 항목은 bridgeVars가 비고 한계에 'Salesforce 고정'을 적는다(2026-10-14 사용자 결정)", () => {
  const ids = ["control-height", "radius", "typography", "icon-size", "letter-spacing", "shadow", "cursor-underline", "object-icon-color"];
  for (const id of ids) {
    const item = SPEC_ITEMS.find((i) => i.id === id);
    assert.deepEqual(item?.bridgeVars, [], id);
    assert.equal(item?.nativeLoss, false, id);
    assert.match(item?.limits ?? "", /Salesforce 고정/, id);
  }
  assert.deepEqual(SPEC_ITEMS.find((i) => i.id === "control-height")?.hooks, ["--slds-s-button-spacing-block", "--slds-s-input-sizing-height"]);
  // 항목 전체가 고정인 것은 입력 없이 표시만 한다
  for (const id of ["cursor-underline", "object-icon-color"]) {
    const item = SPEC_ITEMS.find((i) => i.id === id);
    assert.deepEqual([item?.group, item?.input, item?.hooks], ["표시만", "none", []], id);
  }
});

test("움직임 묶음 항목은 hooks가 비고 bridgeVars가 있으며 nativeLoss가 참이다", () => {
  const motion = SPEC_ITEMS.filter((i) => i.group === "움직임");
  assert.equal(motion.length, 3);
  for (const i of motion) {
    assert.deepEqual(i.hooks, [], i.id);
    assert.ok(i.bridgeVars.length > 0, i.id);
    assert.equal(i.nativeLoss, true, i.id);
  }
});

test("바꿀 수 없는 항목(group 표시만, 명세 페이지의 '바꿀 수 없는 것')은 글꼴·커서·링크 밑줄·개체 아이콘 색·Salesforce 고정이고 hook·브리지가 없다", () => {
  const fixed = SPEC_ITEMS.filter((i) => i.group === "표시만");
  assert.deepEqual(fixed.map((i) => i.id), ["font", "cursor-underline", "object-icon-color", "fixed"]);
  for (const i of fixed) assert.deepEqual([i.input, i.hooks, i.bridgeVars], ["none", [], []], i.id);
});
