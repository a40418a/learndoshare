import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  // 판정 R1: 개발자 PC 경로 검사는 dist/ 아래와 package.json만 한다 (카탈로그는 Task 5·13·23에서 잡는다)
  const checked = entries.filter((e) => e.startsWith("package/dist/") || e === "package/package.json");
  assert.deepEqual(checked.filter((e) => read(e).includes("/Users/")), []);
});

test("실행 파일 dist/cli/index.js는 shebang으로 시작하고, 빌드된 채로 --version에 버전을 출력한다", () => {
  assert.ok(read("package/dist/cli/index.js").startsWith("#!/usr/bin/env node\n"));
  const run = spawnSync(process.execPath, ["dist/cli/index.js", "--version"], { cwd: root, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), pkg.version);
});
