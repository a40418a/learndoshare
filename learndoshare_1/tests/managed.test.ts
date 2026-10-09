import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hooksIndexFromSource } from "../lib/hooks-index.ts";
import { checkOverrideCss, checkUtilCss } from "../lib/rules.ts";
import { managedFiles } from "../lib/managed.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const template = (path: string) => readFileSync(join(root, "templates", path), "utf8");

// 설계 7.2의 Edit deny 규칙. 경로 앞의 /는 프로젝트 루트, *는 / 안에서, **는 하위 전체
const settings = JSON.parse(template("claude/settings.json")) as { permissions: { deny: string[] } };
const denyEdits = settings.permissions.deny
  .filter((r) => r.startsWith("Edit(/"))
  .map((r) => {
    const glob = r.slice("Edit(/".length, -1);
    const body = glob
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "\0")
      .replace(/\*/g, "[^/]*")
      .replace(/\0/g, ".*");
    return { glob, re: new RegExp(`^${body}$`) };
  });

test("managedFiles의 managed+generated 대상은 설계 7.2 deny 경로와 하나씩 대응한다", () => {
  const files = managedFiles(root, { vf: true });
  const locked = files.filter((f) => f.kind !== "owned");

  for (const f of locked) {
    assert.equal(denyEdits.filter((d) => d.re.test(f.dest)).length, 1, `deny 규칙 하나에만 맞아야 한다: ${f.dest}`);
  }
  // Apex 폴더(classes/utils/design)는 생기면 들어간다
  const hasApex = existsSync(join(root, "force-app/main/default/classes/utils/design"));
  for (const d of denyEdits) {
    if (d.glob.includes("classes/utils/design") && !hasApex) continue;
    assert.ok(locked.some((f) => d.re.test(f.dest)), `이 deny 규칙에 맞는 관리 파일이 없다: ${d.glob}`);
  }
  // 프로젝트 소유 파일(milvusBrand.css, milvusOverride.css)은 skill과 사람이 고치므로 막지 않는다
  for (const f of files.filter((f) => f.kind === "owned")) {
    assert.ok(!denyEdits.some((d) => d.re.test(f.dest)), `소유 파일이 막혀 있다: ${f.dest}`);
  }
});

test("generated가 아니면 src가 있고 패키지에 그 파일이 있다. LWC 테스트 폴더는 넣지 않는다", () => {
  for (const f of managedFiles(root, { vf: true })) {
    if (f.kind !== "generated") assert.ok(f.src && existsSync(f.src), f.dest);
    assert.ok(!f.dest.includes("__tests__"), f.dest);
  }
  const dests = managedFiles(root, { vf: true }).map((f) => f.dest);
  assert.ok(dests.includes("force-app/main/default/lwc/milvusScript/milvusScript.ts"));
  assert.ok(dests.includes("force-app/main/default/staticresources/milvusOverride.css"));
});

test("vf:false면 milvusHead와 milvusVf가 목록에 없다", () => {
  const dests = (vf: boolean) => managedFiles(root, { vf }).map((f) => f.dest);
  assert.deepEqual(dests(false).filter((d) => /milvusHead|milvusVf/.test(d)), []);
  assert.equal(dests(true).filter((d) => /milvusHead|milvusVf/.test(d)).length, 4);
});

test("템플릿 milvusBrand.css는 util.css 규칙을, milvusOverride.css는 경고 없이 override 규칙을 통과한다", () => {
  const index = hooksIndexFromSource(root);
  const ctx = { readGHooks: new Set(index.readGHooks), readSHooks: new Set(index.readSHooks), milvusVars: new Set<string>() };
  const dir = "force-app/main/default/staticresources";
  assert.deepEqual(checkUtilCss(template(`${dir}/milvusBrand.css`), "milvusBrand.css", ctx), []);
  assert.deepEqual(checkOverrideCss(template(`${dir}/milvusOverride.css`), "milvusOverride.css"), { warnings: [], errors: [] });
});
