import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isEntryPoint, main } from "../cli/index.ts";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

// main이 쓰는 stdout·stderr를 모은다. 바꿔 둔 write는 main이 끝나면 바로 되돌린다
async function capture(run: () => Promise<number>) {
  const out = { code: -1, stdout: "", stderr: "" };
  const { stdout, stderr } = process;
  const originals = [stdout.write, stderr.write] as const;
  stdout.write = ((chunk: string | Uint8Array) => ((out.stdout += String(chunk)), true)) as typeof stdout.write;
  stderr.write = ((chunk: string | Uint8Array) => ((out.stderr += String(chunk)), true)) as typeof stderr.write;
  try {
    out.code = await run();
  } finally {
    [stdout.write, stderr.write] = originals;
  }
  return out;
}

test("--version은 package.json 버전을 출력하고 0을 돌려준다", async () => {
  const out = await capture(() => main(["--version"]));
  assert.equal(out.code, 0);
  assert.equal(out.stdout.trim(), pkg.version);
});

test("알 수 없는 명령은 stderr에 '알 수 없는 명령'과 1", async () => {
  const out = await capture(() => main(["nope"]));
  assert.equal(out.code, 1);
  assert.match(out.stderr, /알 수 없는 명령/);
  assert.equal(out.stdout, "");
});

// import.meta.main이 없는 Node(23.6~24.1)를 main: undefined로 흉내 낸다
test("import.meta.main이 없으면 실행 경로(심볼릭 링크 포함)로 진입을 판정한다", () => {
  const url = new URL("../cli/index.ts", import.meta.url).href;
  const dir = mkdtempSync(join(tmpdir(), "밀버스 진입-"));
  try {
    const link = join(dir, "milvus");
    symlinkSync(fileURLToPath(url), link); // npm 전역 설치의 bin 링크와 같은 배치
    assert.equal(isEntryPoint({ url }, link), true);
    assert.equal(isEntryPoint({ url }, fileURLToPath(url)), true);
    assert.equal(isEntryPoint({ url }, fileURLToPath(import.meta.url)), false);
    assert.equal(isEntryPoint({ url }, join(dir, "없는 파일")), false);
    assert.equal(isEntryPoint({ url }, undefined), false);
    assert.equal(isEntryPoint({ main: false, url }, link), false); // import.meta.main이 있으면 그 값을 쓴다
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
