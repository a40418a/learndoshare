import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dir = mkdtempSync(join(tmpdir(), "milvus-pack-"));
let entries: string[] = [];

// 임시 폴더로 pnpm pack 한 번. dist/cli를 지우고 시작해 prepack이 빌드하는지도 확인한다
before(() => {
  rmSync(join(root, "dist/cli"), { recursive: true, force: true });
  const pack = spawnSync("pnpm", ["pack", "--pack-destination", dir], { cwd: root, encoding: "utf8" });
  assert.equal(pack.status, 0, pack.stderr || pack.stdout);
  const tgz = join(dir, readdirSync(dir).find((f) => f.endsWith(".tgz"))!);
  entries = spawnSync("tar", ["-tzf", tgz], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  assert.equal(spawnSync("tar", ["-xzf", tgz, "-C", dir]).status, 0);
});
after(() => rmSync(dir, { recursive: true, force: true }));

const read = (entry: string) => readFileSync(join(dir, entry), "utf8");

test("pack 결과에 dist/cli/index.js가 있고 __tests__가 없으며, 텍스트 파일에 '/Users/'가 없다", () => {
  assert.ok(entries.includes("package/dist/cli/index.js"), entries.join("\n"));
  assert.deepEqual(entries.filter((e) => e.includes("__tests__")), []);
  // 판정 R1: 개발자 PC 경로 검사는 dist/, prepack이 만든 카탈로그, package.json만 한다
  assert.ok(entries.includes("package/stories/slds-catalog/examples.json"), entries.join("\n"));
  const checked = entries.filter((e) => e.startsWith("package/dist/") || e.startsWith("package/stories/slds-catalog/") || e === "package/package.json");
  assert.deepEqual(checked.filter((e) => read(e).includes("/Users/")), []);
});

test("pack 결과에 tsconfig.lwc.base.json·lwc-platform.d.ts와 force-app 아래 .ts가 없고 milvusBrandLoader.js가 있다", () => {
  assert.ok(!entries.includes("package/tsconfig.lwc.base.json"));
  assert.ok(!entries.includes("package/lwc-platform.d.ts"));
  assert.deepEqual(entries.filter((e) => e.startsWith("package/force-app/") && e.endsWith(".ts")), []);
  assert.ok(entries.includes("package/force-app/main/default/lwc/milvusBrandLoader/milvusBrandLoader.js"), entries.join("\n"));
});

// .storybook은 원본 .ts로 발행한다(Task 3). files에 고른 lib·cli 원본이 빠지면 프로젝트 모드 Storybook이 import에서 멈춘다.
// 시작점은 발행된 .storybook·stories의 모든 스크립트와 MDX다. 새 스토리가 발행 안 된 lib을 import하면 여기서 잡힌다
test("pack 결과에 .storybook·stories와 그것이 상대 경로로 import하는 파일이 모두 있다", () => {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    assert.ok(entries.includes(`package/${file}`), `${file}이 pack에 없다`);
    for (const [, spec] of read(`package/${file}`).matchAll(/(?:from|import)\s+["'](\.\.?\/[^"']+)["']/g)) {
      visit(posix.join(posix.dirname(file), spec));
    }
  };
  const starts = entries.filter((e) => /^package\/(\.storybook|stories)\/.*\.(js|ts|mdx)$/.test(e)).map((e) => e.slice("package/".length));
  assert.ok(starts.includes(".storybook/main.ts") && starts.includes("stories/Welcome.mdx"), starts.join("\n"));
  starts.forEach(visit);
  assert.ok(seen.has("lib/storybook-plugin.ts") && seen.has("cli/context.ts"), [...seen].join("\n"));
});

test("실행 파일 dist/cli/index.js는 shebang으로 시작하고, 빌드된 채로 --version에 버전을 출력한다", () => {
  assert.ok(read("package/dist/cli/index.js").startsWith("#!/usr/bin/env node\n"));
  const run = spawnSync(process.execPath, ["dist/cli/index.js", "--version"], { cwd: root, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), pkg.version);
});
