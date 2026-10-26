import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkCommand, runCheck } from "../cli/check.ts";
import { runInit } from "../cli/init.ts";
import { suggestPassingText } from "../lib/contrast.ts";
import { hooksIndexFromSource } from "../lib/hooks-index.ts";
import { buildMilvusVfCss } from "../lib/vf.ts";

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

test("모달 규칙을 어긴 프로젝트 LWC는 --style에서 2, 전체 check에서 1이다(밀버스 관리 컴포넌트는 보지 않는다)", async () => {
  await withProject(async (root) => {
    // init이 놓은 lwc/milvusModal은 lightning-modal-*를 쓰지만 건너뛴다
    assert.equal((await check(root, true)).result.code, 0);

    const lwc = (name: string, files: Record<string, string>) => {
      mkdirSync(join(root, `${FA}/lwc/${name}/__tests__`), { recursive: true });
      for (const [file, text] of Object.entries(files)) write(root, `${FA}/lwc/${name}/${file}`, text);
    };
    lwc("accountPanel", { "accountPanel.html": `<template><lightning-modal-body>x</lightning-modal-body></template>` });
    lwc("modal_accountEdit", { "modal_accountEdit.js": `import { LightningElement } from "lwc";\nexport default class M extends LightningElement {}\n` });
    // __tests__ 안은 보지 않는다
    write(root, `${FA}/lwc/accountPanel/__tests__/accountPanel.test.js`, `jest.mock("lightning/modal");\n`);

    const r = await check(root, true);
    assert.equal(r.result.code, 2);
    assert.deepEqual(r.result.issues.map((i) => [i.file, i.rule]), [
      [`${FA}/lwc/accountPanel/accountPanel.html`, "modal-separate"],
      [`${FA}/lwc/modal_accountEdit/modal_accountEdit.js`, "modal-base"],
      [`${FA}/lwc/modal_accountEdit/modal_accountEdit.html`, "modal-frame"],
    ]);
    assert.match(r.stderr, /modal_<이름> 컴포넌트로 분리/);
    assert.equal((await check(root, false)).result.code, 1);
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
    // init 직후는 전체 check를 통과하고 아무 경고도 없다. init이 milvusVf.css를 팔레트로 이미 만들어 다시 만들 것이 없다
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

test("BRAND_COLOR를 바꾼 뒤 전체 check는 milvusVf.css를 갱신하고 0", async () => {
  await withProject(async (root) => {
    const vf = `${RES}/milvusVf.css`;
    const set = `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`;
    const original = readFileSync(join(root, set), "utf8");
    write(root, set, original.replace("#0176D3", "#2E7D32"));
    const r = await check(root, false);
    assert.equal(r.result.code, 0, r.stderr);
    assert.deepEqual(r.result.regenerated, [vf]);
    assert.equal(readFileSync(join(root, vf), "utf8"), buildMilvusVfCss("#2E7D32"));
    // milvusVf는 [생성]이라 sha256 기록 대상이 아니다. 다시 실행해도 관리 파일 검사에 걸리지 않고 바뀔 것도 없다
    const again = await check(root, false);
    assert.equal(again.result.code, 0, again.stderr);
    assert.deepEqual(again.result.regenerated, []);

    // --style(hook)은 파일을 쓰지 않는다
    write(root, vf, "/* 직접 */\n");
    assert.deepEqual((await check(root, true)).result.regenerated, []);
    assert.equal(readFileSync(join(root, vf), "utf8"), "/* 직접 */\n");

    // BRAND_COLOR를 읽을 수 없으면 실패하고 파일은 그대로다
    write(root, set, original.replace("#0176D3", "#abc"));
    const bad = await check(root, false);
    assert.equal(bad.result.code, 1);
    assert.deepEqual(bad.result.regenerated, []);
    assert.equal(readFileSync(join(root, vf), "utf8"), "/* 직접 */\n");

    // config.vf가 거짓이면 다시 만들지 않는다
    write(root, set, original);
    const file = join(root, "milvus.config.json");
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), vf: false }));
    const off = await check(root, false);
    assert.equal(off.result.code, 0, off.stderr);
    assert.deepEqual(off.result.regenerated, []);
    assert.equal(readFileSync(join(root, vf), "utf8"), "/* 직접 */\n");
  });
});

test("--style은 config 브랜드의 BrandingSet BRAND_COLOR가 #RRGGBB가 아니면 2와 고칠 값", async () => {
  await withProject(async (root) => {
    const file = `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`;
    const original = readFileSync(join(root, file), "utf8");
    assert.equal((await check(root, true)).result.code, 0); // init이 만든 BrandingSet(#0176D3)은 통과
    write(root, file, original.replace("#0176D3", "#abc"));
    const r = await check(root, true);
    assert.equal(r.result.code, 2, r.stderr);
    assert.deepEqual(r.result.issues.map((i) => [i.file, i.rule]), [[file, "brand-color"]]);
    assert.ok(r.stderr.includes("#abc") && r.stderr.includes("고칠 값: #RRGGBB"), r.stderr);

    // BRAND_COLOR가 아예 없어도 실패다
    write(root, file, original.replace(/<propertyName>BRAND_COLOR<\/propertyName>/, "<propertyName>OTHER</propertyName>"));
    const none = await check(root, true);
    assert.equal(none.result.code, 2, none.stderr);
    assert.deepEqual(none.result.issues.map((i) => [i.file, i.rule]), [[file, "brand-color"]]);
  });
});

test("--style은 config 브랜드의 BrandingSet이 없으면 2이고 init 재실행을 안내한다", async () => {
  await withProject(async (root) => {
    const file = `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`;
    rmSync(join(root, file));
    const r = await check(root, true);
    assert.equal(r.result.code, 2, r.stderr);
    assert.deepEqual(r.result.issues.map((i) => [i.file, i.rule]), [[file, "brand-color"]]);
    assert.match(r.stderr, /브랜드 메타데이터가 없습니다\. pnpm milvus init을 다시 실행하거나 파일을 복구하세요/);
  });
});

test("--style은 config 브랜드가 아닌 BrandingSet(BRAND_COLOR 없음 포함)은 검사하지 않는다", async () => {
  await withProject(async (root) => {
    // Experience Cloud 사이트의 BrandingSet처럼 BRAND_COLOR가 없거나 형식이 다른 파일
    const site = (name: string, body: string) =>
      write(root, `${FA}/brandingSets/${name}.brandingSet-meta.xml`, `<?xml version="1.0" encoding="UTF-8" ?>\n<BrandingSet xmlns="http://soap.sforce.com/2006/04/metadata">\n${body}    <masterLabel>${name}</masterLabel>\n</BrandingSet>\n`);
    site("SiteTheme", "    <brandingSetProperty>\n        <propertyName>HEADER_BACKGROUND_COLOR</propertyName>\n        <propertyValue>rgb(1,2,3)</propertyValue>\n    </brandingSetProperty>\n");
    site("EmptyTheme", "");
    const r = await check(root, true);
    assert.equal(r.result.code, 0, r.stderr);
    assert.deepEqual(r.result.issues, []);
    assert.equal((await check(root, false)).result.code, 0); // 전체 check도 같다
  });
});

test("check 명령은 옵션 오류에만 사용법을 붙인다", async () => {
  const empty = mkdtempSync(join(tmpdir(), "밀버스 빈 폴더-"));
  const before = process.cwd();
  try {
    process.chdir(empty);
    const bad = await capture(() => checkCommand(["--bogus"]));
    assert.equal(bad.result, 1);
    assert.match(bad.stderr, /사용법: pnpm milvus check/);
    const noProject = await capture(() => checkCommand([]));
    assert.equal(noProject.result, 1);
    assert.match(noProject.stderr, /sfdx-project\.json을 찾지 못했습니다/);
    assert.doesNotMatch(noProject.stderr, /사용법/);
  } finally {
    process.chdir(before);
    rmSync(empty, { recursive: true, force: true });
  }
});

// hook 테스트. 가짜 CLI는 node 스크립트지만 Windows에서는 실행해 보지 않았다
const posixOnly = { skip: process.platform === "win32" && "Windows에서 확인하지 않음" };
const hook = join(pkgRoot, "templates/claude/hooks/milvus-check.mjs");
const PKG = "node_modules/@a40418a/milvus-design-system";

// 프로젝트에 패키지가 설치된 것처럼 둔다. dist/cli/index.js는 저장소 CLI의 main을 부른다(dist를 빌드하지 않는다)
function installPackage(root: string) {
  mkdirSync(join(root, PKG, "dist/cli"), { recursive: true });
  writeFileSync(join(root, PKG, "package.json"), JSON.stringify({ name: "@a40418a/milvus-design-system", type: "module" }));
  const main = JSON.stringify(pathToFileURL(join(pkgRoot, "cli/index.ts")).href);
  writeFileSync(join(root, PKG, "dist/cli/index.js"), `import { main } from ${main};\nprocess.exitCode = await main(process.argv.slice(2));\n`);
}

// Claude Code처럼 hook을 실행한다. PATH를 비워 pnpm 없이 도는지 본다. 패키지는 CLAUDE_PROJECT_DIR(없으면 입력의 cwd)에서 찾는다.
// NODE_NO_WARNINGS=1: Node 버전에 따라 type stripping ExperimentalWarning이 stderr에 섞여도 단정이 흔들리지 않게 한다(테스트에서만)
function runHook(input: unknown, projectDir?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: "", NODE_NO_WARNINGS: "1" };
  delete env.CLAUDE_PROJECT_DIR;
  if (projectDir) env.CLAUDE_PROJECT_DIR = projectDir;
  return spawnSync(process.execPath, [hook], { input: typeof input === "string" ? input : JSON.stringify(input), encoding: "utf8", env });
}
const edit = (cwd: string, file_path: string) => ({ hook_event_name: "PostToolUse", tool_name: "Edit", cwd, tool_input: { file_path } });
const TARGETS = [
  `${RES}/milvusBrand.css`,
  `${RES}/milvusOverride.css`,
  `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`,
  `${FA}/lwc/myCard/myCard.js`,
  `${FA}/lwc/myCard/myCard.html`,
];

test("hook은 다른 파일 수정에는 check를 실행하지 않는다", posixOnly, async () => {
  await withProject(async (root) => {
    installPackage(root);
    // check --style이 실패할 상태. 다른 파일에서 check를 실행했다면 2가 나온다
    write(root, `${RES}/milvusBrand.css`, ":root {\n  --slds-g-color-success-1: #7FBF7F;\n}\n");
    // hook은 고친 파일의 폴더에서 check를 실행한다. LWC 폴더를 만들어 둔다
    mkdirSync(join(root, `${FA}/lwc/myCard/__tests__`), { recursive: true });
    const others = [
      `${FA}/lwc/myCard/myCard.css`,
      `${FA}/lwc/myCard/__tests__/myCard.test.js`,
      `${RES}/milvusBrand.resource-meta.xml`,
      `${RES}/milvusBridge.css`,
      "brands/acme/milvusBrand.css",
      "README.md",
    ];
    for (const rel of others) {
      const r = runHook(edit(root, join(root, rel)));
      assert.deepEqual([r.status, r.stdout, r.stderr], [0, "", ""], rel);
    }

    // 대상 파일이면 패키지 CLI를 pnpm 없이 직접 실행하고, 2와 stderr(고칠 값)를 그대로 넘긴다. stdout은 비운다
    const fix = suggestPassingText("#7fbf7f", "#ffffff");
    for (const rel of TARGETS) {
      const r = runHook(edit(root, join(root, rel)));
      assert.equal(r.status, 2, `${rel}\n${r.stderr}`);
      assert.ok(r.stderr.includes(`고칠 값: ${fix}`), r.stderr);
      assert.equal(r.stdout, "", rel);
    }
  });
});

test("hook은 override 경고만 있으면 0이고 stdout JSON의 additionalContext로 Claude에게 알린다", posixOnly, async () => {
  await withProject(async (root) => {
    installPackage(root);
    copyFileSync(fixture("override-warn.css"), join(root, `${RES}/milvusOverride.css`));
    const r = runHook(edit(root, join(root, `${RES}/milvusOverride.css`)));
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stderr, "");
    const out = JSON.parse(r.stdout);
    assert.deepEqual(Object.keys(out), ["hookSpecificOutput"]);
    assert.deepEqual(Object.keys(out.hookSpecificOutput), ["hookEventName", "additionalContext"]);
    assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
    const context: string = out.hookSpecificOutput.additionalContext;
    assert.match(context, /milvusOverride\.css 경고 \d+개\. 공식 권고 밖/);
    for (const warning of ["#ff0000", "!important", ".my-class"]) assert.ok(context.includes(warning), warning);

    // 경고가 없으면 아무것도 쓰지 않는다(check의 "통과" 줄도 넘기지 않는다)
    write(root, `${RES}/milvusOverride.css`, "");
    const clean = runHook(edit(root, join(root, `${RES}/milvusOverride.css`)));
    assert.deepEqual([clean.status, clean.stdout, clean.stderr], [0, "", ""]);
  });
});

test("hook은 입력 JSON 오류와 패키지를 찾지 못한 경우 한국어 오류와 1", posixOnly, async () => {
  const bad = runHook("{ not json");
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /입력 JSON을 읽지 못했습니다/);

  await withProject(async (root) => {
    const r = runHook(edit(root, join(root, TARGETS[0]))); // node_modules에 패키지가 없다
    assert.equal(r.status, 1, r.stderr);
    assert.match(r.stderr, /@a40418a\/milvus-design-system을 찾지 못했습니다/);
    assert.equal(r.stdout, "");

    // CLAUDE_PROJECT_DIR이 있으면 입력의 cwd보다 먼저 쓴다
    installPackage(root);
    const elsewhere = mkdtempSync(join(tmpdir(), "밀버스 다른 폴더-"));
    try {
      assert.equal(runHook(edit(root, join(root, TARGETS[0])), elsewhere).status, 1);
      assert.equal(runHook(edit(elsewhere, join(root, TARGETS[0])), root).status, 0);
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });
});
