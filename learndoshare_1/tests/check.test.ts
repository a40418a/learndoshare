import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runCheck } from "../cli/check.ts";
import { runInit } from "../cli/init.ts";
import { suggestPassingText } from "../lib/contrast.ts";
import { hooksIndexFromSource } from "../lib/hooks-index.ts";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const FA = "force-app/main/default";
const RES = `${FA}/staticresources`;
const fixture = (name: string) => join(pkgRoot, "tests/fixtures/rules", name);

// fn이 쓰는 stdout·stderr를 모은다. 바꿔 둔 write는 끝나면 되돌린다
async function capture<T>(fn: () => Promise<T>) {
  const out = { stdout: "", stderr: "" };
  const { stdout, stderr } = process;
  const originals = [stdout.write, stderr.write] as const;
  stdout.write = ((chunk: string | Uint8Array) => ((out.stdout += String(chunk)), true)) as typeof stdout.write;
  stderr.write = ((chunk: string | Uint8Array) => ((out.stderr += String(chunk)), true)) as typeof stderr.write;
  try {
    const result = await fn();
    return { result, ...out };
  } finally {
    [stdout.write, stderr.write] = originals;
  }
}

// init으로 만든 임시 프로젝트에서 fn을 실행하고 지운다. 폴더 이름에 공백과 한글을 넣는다(리뷰 중점 5)
async function withProject(fn: (root: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), "밀버스 check 테스트-"));
  const before = process.cwd();
  try {
    writeFileSync(join(root, "sfdx-project.json"), JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }] }));
    process.chdir(root);
    const sf = async () => ({ code: 0, stdout: "{}", stderr: "" }); // 로그인 확인만 부른다
    const init = await capture(() => runInit(["--target-org", "dev", "--brand", "Acme"], { sf, nodeVersion: "22.18.0" }));
    process.chdir(before);
    assert.equal(init.result, 0, init.stderr);
    await fn(root);
  } finally {
    process.chdir(before);
    rmSync(root, { recursive: true, force: true });
  }
}

const write = (root: string, rel: string, text: string) => writeFileSync(join(root, rel), text);
const check = (root: string, style: boolean, pkg?: string) => capture(() => runCheck({ root, style, pkgRoot: pkg }));

test("--style은 규칙 위반에서 2와 stderr의 고칠 값", async () => {
  await withProject(async (root) => {
    // 흰색 위 대비가 4.5:1보다 낮은 성공 글자색. 고칠 값은 같은 색조에서 기준을 넘는 색이다(설계 5.3)
    write(root, `${RES}/milvusBrand.css`, ":root {\n  --slds-g-color-success-1: #7FBF7F;\n}\n");
    const fix = suggestPassingText("#7fbf7f", "#ffffff");
    const r = await check(root, true);
    assert.equal(r.result.code, 2);
    assert.deepEqual(r.result.issues.map((i) => [i.rule, i.fix]), [["contrast", fix]]);
    assert.ok(r.stderr.includes(`고칠 값: ${fix}`), r.stderr);

    // hook이 실행하는 CLI 그대로: 하위 폴더에서 실행해도 프로젝트를 찾고, 종료 코드 2와 stderr를 낸다
    const cli = spawnSync(process.execPath, [join(pkgRoot, "cli/index.ts"), "check", "--style"], { cwd: join(root, RES), encoding: "utf8" });
    assert.equal(cli.status, 2, cli.stderr);
    assert.ok(cli.stderr.includes(`고칠 값: ${fix}`), cli.stderr);

    // override의 @import·@font-face는 경고가 아니라 오류다(설계 5.1)
    write(root, `${RES}/milvusBrand.css`, ":root {\n}\n");
    write(root, `${RES}/milvusOverride.css`, '@import url("https://example.com/x.css");\n');
    const o = await check(root, true);
    assert.equal(o.result.code, 2);
    assert.deepEqual(o.result.issues.map((i) => i.rule), ["import"]);
  });
});

test("--style은 override 경고만 있으면 0이고 stderr에 '공식 권고 밖' 경고", async () => {
  await withProject(async (root) => {
    copyFileSync(fixture("override-warn.css"), join(root, `${RES}/milvusOverride.css`));
    const r = await check(root, true);
    assert.equal(r.result.code, 0, r.stderr);
    assert.deepEqual(r.result.issues, []);
    assert.match(r.stderr, /공식 권고 밖/);
    for (const warning of ["#ff0000", "!important", ".my-class", "--slds-g-color-accent-1"]) assert.ok(r.stderr.includes(warning), warning);
  });
});

test("--style은 200ms 안에 끝난다 (hooks-index.json 사용)", async () => {
  // dist/hooks-index.json만 있고 node_modules가 없는 패키지 폴더. SLDS·기본 컴포넌트 원본 CSS를 읽으려 하면 실패한다
  const pkg = mkdtempSync(join(tmpdir(), "밀버스 패키지-"));
  try {
    mkdirSync(join(pkg, "dist"));
    writeFileSync(join(pkg, "dist/hooks-index.json"), JSON.stringify(hooksIndexFromSource(pkgRoot)));
    await withProject(async (root) => {
      copyFileSync(fixture("valid-util.css"), join(root, `${RES}/milvusBrand.css`));
      const start = performance.now();
      const r = await check(root, true, pkg);
      const ms = performance.now() - start;
      assert.equal(r.result.code, 0, r.stderr);
      assert.ok(ms < 200, `${ms.toFixed(0)}ms`);
    });
  } finally {
    rmSync(pkg, { recursive: true, force: true });
  }
});

test("밀버스 관리 파일을 고치면 전체 check가 1이고 'pnpm milvus update --force'를 안내한다", async () => {
  await withProject(async (root) => {
    // init 직후는 전체 check를 통과하고 아무 경고도 없다
    const clean = await check(root, false);
    assert.equal(clean.result.code, 0, clean.stderr);
    assert.equal(clean.stderr, "");
    assert.deepEqual(clean.result.regenerated, []);

    const file = `${FA}/lwc/milvusScript/milvusScript.js`;
    appendFileSync(join(root, file), "\n// 직접 고침\n");
    const r = await check(root, false);
    assert.equal(r.result.code, 1);
    assert.deepEqual(r.result.issues.map((i) => [i.file, i.rule]), [[file, "managed"]]);
    assert.match(r.stderr, /pnpm milvus update --force/);
    // --style(hook)은 관리 파일을 보지 않는다
    assert.equal((await check(root, true)).result.code, 0);

    // 전체 check에서는 util.css 위반도 1이다(2는 --style만)
    write(root, `${RES}/milvusBrand.css`, ".slds-button { color: red; }\n");
    assert.equal((await check(root, false)).result.code, 1);

    // milvus.config.json이 없으면 init을 안내한다
    rmSync(join(root, "milvus.config.json"));
    const noConfig = await check(root, false);
    assert.equal(noConfig.result.code, 1);
    assert.match(noConfig.stderr, /pnpm milvus init/);
  });
});

test("hook은 다른 파일 수정에는 check를 실행하지 않는다", async () => {
  // 가짜 pnpm: 실행 폴더와 인자를 기록하고, check --style 실패처럼 stderr와 2를 낸다
  const bin = mkdtempSync(join(tmpdir(), "가짜 pnpm-"));
  const log = join(bin, "calls.log");
  writeFileSync(join(bin, "pnpm"), `#!/bin/sh\necho "$(pwd -P)|$*" >> "${log}"\necho "고칠 값: #123456" >&2\nexit 2\n`, { mode: 0o755 });
  const hook = join(pkgRoot, "templates/claude/hooks/milvus-check.mjs");
  const run = (file_path: string) =>
    spawnSync(process.execPath, [hook], {
      input: JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "Edit", tool_input: { file_path } }),
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
    });
  try {
    await withProject(async (root) => {
      const others = [`${FA}/lwc/myCard/myCard.css`, `${RES}/milvusBrand.resource-meta.xml`, `${RES}/milvusBridge.css`, "brands/acme/milvusBrand.css", "README.md"];
      for (const rel of others) {
        const r = run(join(root, rel));
        assert.equal(r.status, 0, rel);
        assert.equal(r.stderr, "", rel);
      }
      assert.ok(!existsSync(log), "다른 파일에서 pnpm이 실행되었다");

      const targets = [`${RES}/milvusBrand.css`, `${RES}/milvusOverride.css`, `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`];
      for (const rel of targets) {
        const r = run(join(root, rel));
        assert.equal(r.status, 2, rel); // 종료 코드와 stderr를 그대로 넘긴다
        assert.equal(r.stderr, "고칠 값: #123456\n", rel);
      }
      const calls = readFileSync(log, "utf8").trim().split("\n");
      assert.equal(calls.length, targets.length);
      for (const c of calls) {
        const [cwd, args] = c.split("|");
        assert.equal(args, "milvus check --style");
        assert.ok(cwd.startsWith(realpathSync(root)), cwd); // 고친 파일이 있는 프로젝트 안에서 실행한다
      }
    });
  } finally {
    rmSync(bin, { recursive: true, force: true });
  }
});
