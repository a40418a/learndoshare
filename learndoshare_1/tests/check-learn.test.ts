import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkLearnHtml, isAllowedSource } from "../scripts/check-learn.ts";

const check = (name: string) => checkLearnHtml(readFileSync(new URL(`./fixtures/learn/${name}`, import.meta.url), "utf8"));
const root = fileURLToPath(new URL("..", import.meta.url));
const cli = (dir: string) =>
  spawnSync(process.execPath, ["scripts/check-learn.ts", dir], { cwd: root, encoding: "utf8" });

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

test("프로젝트 기록 링크(../docs/research/, ../docs/specs/, ../README.md)는 허용", () => {
  assert.deepEqual(check("clean/research-link.html"), []);
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
  assert.deepEqual(check("clean/root-in-legacy.html"), []);
});

test("작은따옴표·따옴표 없는 href도 검사한다", () => {
  const problems = check("quoted-href.html");
  assert.deepEqual(
    problems.map((p) => p.message),
    ["허용되지 않은 출처: https://medium.com/some-blog/a", "허용되지 않은 출처: https://dev.to/b"],
  );
});

test("주석 안의 p.sources는 없는 것으로 본다", () => {
  const problems = check("sources-in-comment.html");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].section, "commented");
  assert.equal(problems[0].line, 4);
  assert.match(problems[0].message, /p\.sources가 없다/);
});

test("p.sources는 절의 마지막 요소여야 한다", () => {
  const problems = check("sources-not-last.html");
  assert.equal(problems.length, 1);
  assert.equal(problems[0].section, "late");
  assert.match(problems[0].message, /마지막/);
});

test("출처 도메인은 경계까지 맞아야 한다", () => {
  for (const ok of [
    "https://developer.salesforce.com/docs/platform/lwc/guide",
    "https://github.com/salesforce-ux/design-system-2",
    "https://github.com/salesforce/lwc",
    "https://help.salesforce.com/s/articleView?id=xcloud.x.htm&amp;type=5",
    "https://github.com/forcedotcom/lwc-dev-server",
    "https://github.com/storybookjs/storybook/blob/next/MIGRATION.md",
    "https://github.com/pnpm/pnpm/releases/tag/v10.0.0",
    "https://lit.dev/docs/templates/expressions/",
    "https://typicode.github.io/husky/how-to.html",
    "https://github.com/DietrichGebert/ponytail",
    "https://github.com/lukethacoder/lwc-garden",
    "https://lwc.garden",
    "../docs/research/2026-10-08/summary.md",
    "../docs/specs/2026-10-08-milvus-package-design.md",
    "../README.md",
    "../README.md#3-현재까지-확인된-사실",
  ]) assert.ok(isAllowedSource(ok), ok);
  for (const bad of [
    "http://developer.salesforce.com/docs",
    "https://developer.salesforce.com.example.org/docs",
    "https://developer.salesforce.com@evil.example/docs",
    "https://github.com/salesforcefan/lwc",
    "https://github.com/someone/salesforce",
    "https://github.com/pnpmfan/x",
    "https://lwc.garden.evil.example",
    // 경로를 정규화하면 허용 범위 밖이거나, 원문과 실제 주소가 달라지는 링크
    "https://github.com/salesforce/../someone/blog",
    "https://github.com/salesforce/%2e%2e/someone",
    "https://github.com/salesforce\\..\\someone",
    "https://github.com/salesforce/&#46;&#46;/someone",
    "https://developer.salesforce.com/../../evil",
    " https://evil.example/root/docs/research/x.md",
    "//developer.salesforce.com/docs",
    // 상대 링크: 절대 경로, ..로 Learn 밖이나 허용 폴더 밖으로 나가는 것
    "/docs/research/2026-10-08/summary.md",
    "/root/docs/research/x.md",
    "../docs/research/../../secret.md",
    "../../root/docs/research/x.md",
    "../docs/research/%2e%2e/%2e%2e/secret.md",
    "../docs/research/.\t./.\t./secret.md",
    "../README.md.bak",
    "../docs/specsx/a.md",
    "../docs/x.md",
    "#refs",
  ]) assert.ok(!isAllowedSource(bad), bad);
});

test("CLI: 위반이 있는 폴더는 '파일:줄 절 내용'을 출력하고 1로 끝난다", () => {
  const r = cli("tests/fixtures/learn");
  assert.equal(r.status, 1);
  const lines = r.stdout.trim().split("\n");
  assert.ok(lines.includes("tests/fixtures/learn/no-sources.html:10 missing p.sources가 없다"), r.stdout);
  for (const l of lines.slice(0, -1)) assert.match(l, /^tests\/fixtures\/learn\/[\w-]+\.html:\d+ \S+ \S/);
  assert.match(lines.at(-1) ?? "", /^문제 \d+개 \(파일 \d+개\)$/);
});

test("CLI: 깨끗한 폴더는 0으로 끝난다", () => {
  const r = cli("tests/fixtures/learn/clean");
  assert.equal(r.status, 0, r.stdout);
  assert.equal(r.stdout.trim(), "통과 (파일 2개)");
});

test("CLI: .html이 없는 폴더는 통과로 보지 않는다", () => {
  const dir = mkdtempSync(join(tmpdir(), "check-learn-"));
  try {
    const r = cli(dir);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /검사할 \.html 파일이 없다/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
