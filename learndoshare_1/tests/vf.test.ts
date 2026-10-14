import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SfRunner } from "../cli/context.ts";
import { runDeploy } from "../cli/deploy.ts";
import { runInit } from "../cli/init.ts";
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

// fn이 쓰는 stdout·stderr를 모은다. 바꿔 둔 write는 끝나면 되돌린다
async function capture<T>(fn: () => Promise<T>) {
  const out = { stdout: "", stderr: "" };
  const { stdout, stderr } = process;
  const originals = [stdout.write, stderr.write] as const;
  stdout.write = ((chunk: string | Uint8Array) => ((out.stdout += String(chunk)), true)) as typeof stdout.write;
  stderr.write = ((chunk: string | Uint8Array) => ((out.stderr += String(chunk)), true)) as typeof stderr.write;
  try {
    return { result: await fn(), ...out };
  } finally {
    [stdout.write, stderr.write] = originals;
  }
}

test("BRAND_COLOR를 바꾼 뒤 deploy가 check를 통과해 계획을 출력한다", async () => {
  const FA = "force-app/main/default";
  const vf = `${FA}/staticresources/milvusVf.css`;
  const root = mkdtempSync(join(tmpdir(), "밀버스 vf deploy 테스트-")); // 폴더 이름에 공백과 한글
  const before = process.cwd();
  // 가짜 sf: 활성 테마 조회(retrieve)에는 설정 파일을 써 주고, 나머지는 성공으로 답한다. 호출을 모은다
  const calls: string[][] = [];
  const sf: SfRunner = async (args) => {
    calls.push(args);
    if (args[1] === "retrieve") {
      const dir = join(args[args.indexOf("--target-metadata-dir") + 1], "unpackaged/settings");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "LightningExperience.settings"), "<activeThemeName>Old_Theme</activeThemeName>\n");
    }
    return { code: 0, stdout: JSON.stringify({ status: 0, result: {} }), stderr: "" };
  };
  try {
    writeFileSync(join(root, "sfdx-project.json"), JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }] }));
    process.chdir(root);
    const init = await capture(() => runInit(["--target-org", "dev", "--brand", "Acme"], { sf, nodeVersion: "22.18.0" }));
    assert.equal(init.result, 0, init.stderr);
    assert.equal(readFileSync(vf, "utf8"), buildMilvusVfCss("#0176D3")); // init이 기본색 팔레트를 만들었다

    // BRAND_COLOR를 바꾼다. milvusVf.css는 아직 옛 팔레트다
    const set = `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`;
    writeFileSync(set, readFileSync(set, "utf8").replace("#0176D3", "#2E7D32"));
    assert.notEqual(readFileSync(vf, "utf8"), buildMilvusVfCss("#2E7D32"));

    calls.length = 0;
    const r = await capture(() => runDeploy([], { sf, isTTY: false })); // --yes 없음: 계획만 출력한다
    assert.equal(r.result, 0, r.stderr);
    assert.equal(r.stderr, "");
    // deploy 전 check가 milvusVf.css를 새 색으로 다시 만들었고, 그 파일과 milvusHead가 배포 목록에 있다
    assert.equal(readFileSync(vf, "utf8"), buildMilvusVfCss("#2E7D32"));
    assert.match(r.stdout, /milvus deploy 계획/);
    for (const want of [vf, `${FA}/components/milvusHead.component`]) assert.ok(r.stdout.includes(`    - ${want}\n`), want);
    assert.deepEqual(calls.filter((args) => args[1] === "deploy"), []); // 계획만, 배포하지 않았다
  } finally {
    process.chdir(before);
    rmSync(root, { recursive: true, force: true });
  }
});
