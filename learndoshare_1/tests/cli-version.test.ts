import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { main } from "../cli/index.ts";

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
