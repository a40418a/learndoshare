import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { STEPS } from "../lib/palette.ts";
import { buildMilvusVfCss } from "../lib/vf.ts";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const component = readFileSync(join(pkgRoot, "templates/force-app/main/default/components/milvusHead.component"), "utf8");

test("#2E7D32이면 --slds-r-color-brand-50:#468244가 있다", () => {
  assert.match(buildMilvusVfCss("#2E7D32"), /--slds-r-color-brand-50:\s*#468244;/);
});

test("결과 크기가 1KB 미만이고 :root의 팔레트 17단계만 있다 (SLDS 2 CSS 사본 없음)", () => {
  const css = buildMilvusVfCss("#0176D3");
  assert.ok(Buffer.byteLength(css) < 1024, `${Buffer.byteLength(css)}바이트`);
  assert.equal(STEPS.length, 17);
  // :root 규칙 하나, 선언은 --slds-r-color-brand-<단계>: #rrggbb; 뿐
  assert.match(css, /^:root\s*\{[^{}]*\}\s*$/);
  const decls = [...css.matchAll(/(--[\w-]+):\s*([^;}]+);/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(decls.map(([name]) => name), STEPS.map((s) => `--slds-r-color-brand-${s}`));
  for (const [, value] of decls) assert.match(value, /^#[0-9a-f]{6}$/);
});

test("milvusHead.component는 <apex:slds/> 뒤에 milvusVf, milvusBridge, milvusBrand, milvusOverride 순서로 stylesheet를 둔다", () => {
  const tags = [...component.replace(/<!--[\s\S]*?-->/g, "").matchAll(/<apex:(\w+)\b[^>]*>/g)].map((m) => m[0]);
  assert.match(tags[0], /^<apex:component\b/);
  assert.match(tags[1], /^<apex:slds\s*\/>$/);
  const sheets = tags.slice(2).map((t) => /^<apex:stylesheet\s+value="\{!\$Resource\.(\w+)\}"\s*\/>$/.exec(t)?.[1]);
  assert.deepEqual(sheets, ["milvusVf", "milvusBridge", "milvusBrand", "milvusOverride"]);
});
