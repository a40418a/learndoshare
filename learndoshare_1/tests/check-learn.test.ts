import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkLearnHtml, isAllowedSource } from "../scripts/check-learn.ts";

const check = (name: string) => checkLearnHtml(readFileSync(new URL(`./fixtures/learn/${name}`, import.meta.url), "utf8"));

test("출처 없는 절은 1", () => {
  const problems = check("no-sources.html");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].section, "missing");
  assert.equal(problems[0].line, 10);
});

test("블로그 도메인 출처는 1", () => {
  const problems = check("blog-source.html");
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /medium\.com/);
});

test("../docs/research/ 링크는 허용", () => {
  assert.deepEqual(check("research-link.html"), []);
});

test("legacy 밖의 root.css는 1", () => {
  const problems = check("root-outside-legacy.html");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].section, "old");
  assert.match(problems[0].message, /root\.css/);
});

test("확인 날짜가 없는 p.sources는 1", () => {
  const problems = check("no-date.html");
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /확인 YYYY-MM-DD/);
});

test("aside.legacy 안의 root.css는 허용", () => {
  assert.deepEqual(check("root-in-legacy.html"), []);
});

test("출처 도메인은 경계까지 맞아야 한다", () => {
  for (const ok of [
    "https://developer.salesforce.com/docs/platform/lwc/guide",
    "https://github.com/salesforce-ux/design-system-2",
    "https://github.com/salesforce/lwc",
    "../docs/research/2026-10-08/summary.md",
  ]) assert.ok(isAllowedSource(ok), ok);
  for (const bad of [
    "http://developer.salesforce.com/docs",
    "https://developer.salesforce.com.example.org/docs",
    "https://github.com/salesforcefan/lwc",
    "https://github.com/someone/salesforce",
    "/docs/research/2026-10-08/summary.md",
    "../docs/research/../../secret.md",
    "#refs",
  ]) assert.ok(!isAllowedSource(bad), bad);
});
