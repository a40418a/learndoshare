// sf 실행 방법(cli/context.ts sfSpawn, removeTemp). Windows는 sf.cmd라 cmd.exe를 거치고 인자를 인용한다(#42, #49)
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTemp, sfSpawn } from "../cli/context.ts";

const args = ["project", "retrieve", "start", "--metadata", "BrandingSet:LEXTHEMINGSlack", "--target-org", "learndoshare_1", "--target-metadata-dir", "C:\\Users\\홍 길동\\AppData\\Local\\Temp\\milvus-abc", "--json"];

test("macOS·Linux는 셸 없이 인자 배열을 그대로 넘긴다", () => {
  assert.deepEqual(sfSpawn(args, "darwin"), { command: "sf", args, shell: false });
  assert.deepEqual(sfSpawn(args, "linux"), { command: "sf", args, shell: false });
});

test("Windows는 셸을 거치고, 인자 배열 대신 명령 한 줄로 넘긴다(DEP0190 회피). 공백·한글이 든 인자만 큰따옴표로 감싼다", () => {
  const r = sfSpawn(args, "win32");
  assert.equal(r.shell, true);
  assert.deepEqual(r.args, []);
  assert.equal(
    r.command,
    'sf project retrieve start --metadata BrandingSet:LEXTHEMINGSlack --target-org learndoshare_1 --target-metadata-dir "C:\\Users\\홍 길동\\AppData\\Local\\Temp\\milvus-abc" --json',
  );
});

test("Windows에서 cmd.exe가 해석하는 큰따옴표·%·줄바꿈이 든 값은 거부한다", () => {
  for (const bad of ['a"&calc', "%PATH%", "a\nb"]) {
    assert.throws(() => sfSpawn(["org", "list", "limits", "--target-org", bad], "win32"), /Windows에서는/);
  }
  // 셸 메타문자 &·|는 큰따옴표 안에서 글자로 남는다
  assert.equal(sfSpawn(["--target-org", "a&b|c"], "win32").command, 'sf --target-org "a&b|c"');
});

test("removeTemp는 폴더를 지우고, 없는 폴더나 지울 수 없는 경우에도 예외를 내지 않는다", () => {
  const dir = mkdtempSync(join(tmpdir(), "milvus-test-"));
  mkdirSync(join(dir, "unpackaged"));
  writeFileSync(join(dir, "unpackaged", "a.txt"), "x");
  removeTemp(dir);
  assert.equal(existsSync(dir), false);
  assert.doesNotThrow(() => removeTemp(dir));
});
