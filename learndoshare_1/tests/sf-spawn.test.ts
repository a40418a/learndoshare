// sf 실행 방법(cli/context.ts sfSpawn). Windows는 sf.cmd라 cmd.exe를 거치고 인자를 인용한다(#42)
import { test } from "node:test";
import assert from "node:assert/strict";
import { sfSpawn } from "../cli/context.ts";

const args = ["project", "retrieve", "start", "--metadata", "BrandingSet:LEXTHEMINGSlack", "--target-org", "learndoshare_1", "--target-metadata-dir", "C:\\Users\\홍 길동\\AppData\\Local\\Temp\\milvus-abc", "--json"];

test("macOS·Linux는 셸 없이 인자를 그대로 넘긴다", () => {
  assert.deepEqual(sfSpawn(args, "darwin"), { args, shell: false });
  assert.deepEqual(sfSpawn(args, "linux"), { args, shell: false });
});

test("Windows는 셸을 거치고, 공백·한글이 든 인자만 큰따옴표로 감싼다", () => {
  const r = sfSpawn(args, "win32");
  assert.equal(r.shell, true);
  assert.equal(r.args[4], "BrandingSet:LEXTHEMINGSlack");
  assert.equal(r.args[6], "learndoshare_1");
  assert.equal(r.args[8], '"C:\\Users\\홍 길동\\AppData\\Local\\Temp\\milvus-abc"');
  assert.equal(r.args[9], "--json");
});

test("Windows에서 cmd.exe가 해석하는 큰따옴표·%·줄바꿈이 든 값은 거부한다", () => {
  for (const bad of ['a"&calc', "%PATH%", "a\nb"]) {
    assert.throws(() => sfSpawn(["org", "list", "limits", "--target-org", bad], "win32"), /Windows에서는/);
  }
  // 셸 메타문자 &·|는 큰따옴표 안에서 글자로 남는다
  assert.deepEqual(sfSpawn(["--target-org", "a&b|c"], "win32").args, ["--target-org", '"a&b|c"']);
});
