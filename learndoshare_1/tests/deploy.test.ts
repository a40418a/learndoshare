import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { writeActiveThemeSettings } from "../lib/branding.ts";
import { readConfig, type SfRunner } from "../cli/context.ts";
import { executeDeploy, planDeploy, runDeploy } from "../cli/deploy.ts";
import { runInit } from "../cli/init.ts";

const FA = "force-app/main/default";
const SETTINGS = ".milvus/deploy/settings-mdapi";
// 액세스 토큰 형식(org ID 00D… + ! + 세션 값). 출력에 나오면 안 된다
const TOKEN = /00D[A-Za-z0-9]{12,15}![A-Za-z0-9._]+/;
const FAKE_TOKEN = "00D5g000000AbCdE!AQ4AQFakeSessionValue.abc";

type Result = { code: number; stdout: string; stderr: string };
const ok = (result: object = {}): Result => ({ code: 0, stdout: JSON.stringify({ status: 0, result }), stderr: "" });

// 가짜 sf. retrieve는 --target-metadata-dir/unpackaged에 설정 파일을 쓴다(실제 sf와 같은 배치, Task 11 실측).
// deploy는 --metadata-dir가 있으면 활성화(2단계), 없으면 메타데이터 배포(1단계)다
function fakeSf(o: { active?: string; retrieve?: Result; deploy?: Result; activate?: Result } = {}) {
  const calls: { args: string[]; cwd: string }[] = [];
  const sf: SfRunner = async (args, cwd) => {
    calls.push({ args, cwd });
    if (args[1] === "retrieve") {
      if (o.retrieve) return o.retrieve;
      const out = join(args[args.indexOf("--target-metadata-dir") + 1], "unpackaged/settings");
      mkdirSync(out, { recursive: true });
      const active = o.active === undefined ? "" : `    <activeThemeName>${o.active}</activeThemeName>\n`;
      writeFileSync(join(out, "LightningExperience.settings"), `<?xml version="1.0" encoding="UTF-8"?>\n<LightningExperienceSettings>\n${active}</LightningExperienceSettings>\n`);
      return ok();
    }
    if (args.includes("--metadata-dir")) return o.activate ?? ok({ success: true });
    return o.deploy ?? ok({ success: true });
  };
  const deploys = () => calls.filter((c) => c.args[1] === "deploy");
  return Object.assign(sf, { calls, deploys });
}

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

const put = (root: string, rel: string, text: string) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const prop = (name: string, value: string) =>
  `    <brandingSetProperty>\n        <propertyName>${name}</propertyName>\n        <propertyValue>${value}</propertyValue>\n    </brandingSetProperty>\n`;

/**
 * init(--brand Acme, 대상 org dev)으로 만든 임시 프로젝트. 폴더 이름에 공백과 한글을 넣는다(리뷰 중점 5).
 * 로고는 org에서 받은 것처럼 자산 이름이 <브랜드>Logo가 아니다(R26). 프로젝트 자체 컴포넌트·앱 메타데이터도 둔다
 */
async function withProject(o: { vf?: boolean; init?: boolean }, fn: (root: string) => Promise<void>) {
  const root = mkdtempSync(join(tmpdir(), "밀버스 deploy 테스트-"));
  const before = process.cwd();
  try {
    put(root, "sfdx-project.json", JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }] }));
    if (o.init !== false) {
      process.chdir(root);
      const sf = async () => ({ code: 0, stdout: "{}", stderr: "" }); // init은 로그인 확인만 부른다
      const argv = ["--target-org", "dev", "--brand", "Acme", ...(o.vf === false ? ["--no-vf"] : [])];
      const init = await capture(() => runInit(argv, { sf, nodeVersion: "22.18.0" }));
      process.chdir(before);
      assert.equal(init.result, 0, init.stderr);
      put(
        root,
        `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`,
        `<?xml version="1.0" encoding="UTF-8"?>\n<BrandingSet xmlns="http://soap.sforce.com/2006/04/metadata">\n${prop("BRAND_COLOR", "#2E7D32")}${prop("BRAND_IMAGE", "/file-asset/acme_logo_1?v=3")}    <masterLabel>Acme</masterLabel>\n</BrandingSet>\n`,
      );
      put(root, `${FA}/contentassets/acme_logo_1.asset`, "logo");
      put(root, `${FA}/contentassets/acme_logo_1.asset-meta.xml`, "<ContentAsset/>\n");
      put(root, `${FA}/classes/utils/design/MilvusDesign.cls`, "public class MilvusDesign {}\n");
      put(root, `${FA}/lwc/myCard/myCard.js`, "export default class {}\n");
      put(root, `${FA}/flexipages/Home.flexipage-meta.xml`, "<FlexiPage/>\n");
      put(root, `${FA}/applications/Sales.app-meta.xml`, "<CustomApplication/>\n");
    }
    await fn(root);
  } finally {
    process.chdir(before);
    rmSync(root, { recursive: true, force: true });
  }
}

// root에서 runDeploy를 실행한다. 기본은 TTY가 아니다(Claude Code의 Bash와 같다)
async function deploy(root: string, argv: string[], deps: Parameters<typeof runDeploy>[1] = {}) {
  const before = process.cwd();
  process.chdir(root);
  try {
    return await capture(() => runDeploy(argv, { isTTY: false, ...deps }));
  } finally {
    process.chdir(before);
  }
}

const config = (root: string) => readConfig(root)!;

test("--yes 없이 실행하면 계획만 출력하고 deploy start를 부르지 않는다", async () => {
  await withProject({}, async (root) => {
    const sf = fakeSf({ active: "Old_Theme" });
    const r = await deploy(root, [], { sf });
    assert.equal(r.result, 0, r.stderr);
    assert.match(r.stdout, /대상 org: dev/);
    assert.match(r.stdout, /Old_Theme → Acme/);
    assert.match(r.stdout, /lwc\/milvusButton/);
    assert.match(r.stdout, /pnpm milvus deploy --yes/);
    assert.deepEqual(sf.deploys(), []);
    assert.equal(existsSync(join(root, SETTINGS)), false);

    // 사람이 터미널에서 실행하면 y/N을 묻는다. 기본(빈 답)은 N이라 배포하지 않는다
    const questions: string[] = [];
    const no = await deploy(root, [], { sf, isTTY: true, ask: async (q) => (questions.push(q), false) });
    assert.equal(no.result, 0, no.stderr);
    assert.equal(questions.length, 1);
    assert.match(questions[0], /\(y\/N\)/);
    assert.deepEqual(sf.deploys(), []);

    const yes = await deploy(root, [], { sf, isTTY: true, ask: async () => true });
    assert.equal(yes.result, 0, yes.stderr);
    assert.equal(sf.deploys().length, 2);
  });
});

test("활성 커스텀 테마가 없으면 지금 테마를 Salesforce 기본 테마로 보여 준다", async () => {
  await withProject({}, async (root) => {
    const r = await deploy(root, [], { sf: fakeSf() });
    assert.equal(r.result, 0, r.stderr);
    assert.match(r.stdout, /Salesforce 기본 테마.* → Acme/);
  });
});

test("인자가 없으면 config.targetOrg를 쓰고 sf 기본 org를 묻지 않는다", async () => {
  await withProject({}, async (root) => {
    const sf = fakeSf({ active: "Old_Theme" });
    const r = await deploy(root, ["--yes"], { sf });
    assert.equal(r.result, 0, r.stderr);
    assert.ok(sf.calls.length >= 3);
    for (const { args, cwd } of sf.calls) {
      assert.equal(args[args.indexOf("--target-org") + 1], "dev", args.join(" "));
      assert.ok(args.includes("--json"), args.join(" "));
      assert.ok(!args.includes("display") && !args.includes("config"), args.join(" "));
      // 배포는 프로젝트 폴더(공백·한글 경로)에서 인자 배열로 실행한다
      if (args[1] === "deploy") assert.equal(cwd, realpathSync(root));
    }

    const other = fakeSf({ active: "Old_Theme" });
    const o = await deploy(root, ["--target-org", "uat"], { sf: other });
    assert.equal(o.result, 0, o.stderr);
    assert.match(o.stdout, /대상 org: uat/);
    for (const { args } of other.calls) assert.equal(args[args.indexOf("--target-org") + 1], "uat");
  });
});

test("milvus.config.json이 없으면 1이고 'pnpm milvus init'을 안내한다", async () => {
  await withProject({ init: false }, async (root) => {
    const sf = fakeSf();
    const r = await deploy(root, ["--yes"], { sf });
    assert.equal(r.result, 1);
    assert.match(r.stderr, /pnpm milvus init/);
    assert.deepEqual(sf.calls, []);
  });
});

test("sf가 없거나 로그인 만료(code≠0)면 deploy start를 부르지 않고 1", async () => {
  await withProject({}, async (root) => {
    const cases: [Result, RegExp][] = [
      [{ code: 127, stdout: "", stderr: "spawn sf ENOENT" }, /sf CLI를 찾지 못했습니다/],
      [{ code: 1, stdout: JSON.stringify({ status: 1, name: "NoAuthInfoFound", message: "No authorization information found for dev." }), stderr: "" }, /sf org login web --alias dev[\s\S]*No authorization information found/],
      [{ code: 0, stdout: "Warning: not json", stderr: "" }, /sf 결과\(--json\)를 해석하지 못했습니다/],
    ];
    for (const [retrieve, message] of cases) {
      const sf = fakeSf({ retrieve });
      const r = await deploy(root, ["--yes"], { sf });
      assert.equal(r.result, 1, r.stdout);
      assert.match(r.stderr, message);
      assert.deepEqual(sf.deploys(), []);
    }
  });
});

test("1단계 실패 시 2단계를 부르지 않고 failures를 출력한다", async () => {
  await withProject({}, async (root) => {
    const failed = {
      status: 1,
      result: {
        success: false,
        details: { componentFailures: [{ componentType: "LightningComponentBundle", fullName: "milvusButton", problem: "Invalid reference c/milvusScript" }] },
      },
    };
    const sf = fakeSf({ active: "Old_Theme", deploy: { code: 1, stdout: JSON.stringify(failed), stderr: "" } });
    const r = await deploy(root, ["--yes"], { sf });
    assert.equal(r.result, 1);
    assert.equal(sf.deploys().length, 1);
    assert.ok(!sf.deploys()[0].args.includes("--metadata-dir"));
    assert.match(r.stderr, /LightningComponentBundle:milvusButton/);
    assert.match(r.stderr, /Invalid reference c\/milvusScript/);
    assert.match(r.stderr, /롤백/);
    assert.equal(existsSync(join(root, SETTINGS)), false);

    // executeDeploy가 돌려주는 값. componentFailures가 하나면 sf가 배열이 아닌 객체로 줄 수 있다
    const single = { ...failed, result: { details: { componentFailures: failed.result.details.componentFailures[0] } } };
    const plan = await planDeploy({ root, config: config(root) }, fakeSf({ active: "Old_Theme" }));
    const e = await executeDeploy(plan, fakeSf({ deploy: { code: 1, stdout: JSON.stringify(single), stderr: "" } }));
    assert.deepEqual(e, { code: 1, stage: "metadata", failures: [{ name: "LightningComponentBundle:milvusButton", problem: "Invalid reference c/milvusScript" }] });

    // 2단계가 실패하면 stage는 activate
    const a = await executeDeploy(plan, fakeSf({ activate: { code: 1, stdout: JSON.stringify({ status: 1, message: "활성화 실패(가짜)" }), stderr: "" } }));
    assert.equal(a.code, 1);
    assert.equal(a.stage, "activate");
    assert.match(a.failures[0].problem, /활성화 실패\(가짜\)/);
  });
});

test("sourceDirs에 milvusBridge·milvusOverride·milvusBrandLoader와 contentassets 로고가 있고, 프로젝트 자체 컴포넌트와 flexipages·applications는 없다", async () => {
  await withProject({}, async (root) => {
    const plan = await planDeploy({ root, config: config(root) }, fakeSf({ active: "Old_Theme" }));
    assert.equal(plan.targetOrg, "dev");
    assert.equal(plan.currentTheme, "Old_Theme");
    assert.equal(plan.newTheme, "Acme");
    assert.equal(plan.settingsDir, SETTINGS);
    for (const want of [
      `${FA}/lwc/milvusBrandLoader`,
      `${FA}/lwc/milvusButton`,
      `${FA}/lwc/milvusScript`,
      `${FA}/classes/utils/design`,
      `${FA}/staticresources/milvusBrand.css`,
      `${FA}/staticresources/milvusBridge.css`,
      `${FA}/staticresources/milvusBridge.resource-meta.xml`,
      `${FA}/staticresources/milvusOverride.css`,
      `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`,
      `${FA}/lightningExperienceThemes/Acme.lightningExperienceTheme-meta.xml`,
      // R26: 로고 자산 이름은 BRAND_IMAGE에서 읽는다(<브랜드>Logo가 아니다)
      `${FA}/contentassets/acme_logo_1.asset`,
      `${FA}/contentassets/acme_logo_1.asset-meta.xml`,
    ]) {
      assert.ok(plan.sourceDirs.includes(want), `${want} 없음:\n${plan.sourceDirs.join("\n")}`);
    }
    for (const dir of plan.sourceDirs) {
      assert.ok(!/myCard|flexipages|applications|AcmeLogo|__tests__/.test(dir), dir);
      assert.ok(existsSync(join(root, dir)), dir);
    }

    // 배포 명령은 sourceDirs마다 --source-dir를 붙인다
    const sf = fakeSf();
    await executeDeploy(plan, sf);
    const [first, second] = sf.deploys().map((c) => c.args);
    assert.deepEqual(first.filter((_, i) => first[i - 1] === "--source-dir"), plan.sourceDirs);
    assert.deepEqual(second.slice(second.indexOf("--metadata-dir"), second.indexOf("--metadata-dir") + 2), ["--metadata-dir", SETTINGS]);
  });
});

test("vf:false면 milvusVf·milvusHead가 없다", async () => {
  await withProject({ vf: false }, async (root) => {
    const plan = await planDeploy({ root, config: config(root) }, fakeSf());
    assert.deepEqual(plan.sourceDirs.filter((d) => /milvusVf|milvusHead/.test(d)), []);
  });
  await withProject({}, async (root) => {
    const plan = await planDeploy({ root, config: config(root) }, fakeSf());
    for (const want of ["staticresources/milvusVf.css", "components/milvusHead.component", "components/milvusHead.component-meta.xml"]) {
      assert.ok(plan.sourceDirs.includes(`${FA}/${want}`), want);
    }
  });
});

test("vf:true면 계획 출력에 VF SLDS 2 설정 안내가 있고, vf:false면 없다", async () => {
  const notice =
    'VF 페이지가 SLDS 2로 그려지려면 Setup → User Interface → Visualforce Settings의 "Use SLDS 2 for pages that include <apex:slds> when an SLDS 2 theme is active"를 켜야 합니다. 이 설정은 메타데이터로 읽거나 바꿀 수 없어 deploy가 확인하지 못합니다';
  await withProject({}, async (root) => {
    const r = await deploy(root, [], { sf: fakeSf() });
    assert.equal(r.result, 0, r.stderr);
    assert.ok(r.stdout.includes(notice), r.stdout);
  });
  await withProject({ vf: false }, async (root) => {
    const r = await deploy(root, [], { sf: fakeSf() });
    assert.equal(r.result, 0, r.stderr);
    assert.ok(!r.stdout.includes("Visualforce Settings"), r.stdout);
  });
});

test("settings 파일에는 activeThemeName 하나만", async () => {
  await withProject({}, async (root) => {
    // 이전 실행이 남긴 파일은 지우고 다시 만든다(배포 대상에 섞이지 않게)
    put(root, `${SETTINGS}/settings/Stale.settings`, "<x/>\n");
    const r = await deploy(root, ["--yes"], { sf: fakeSf({ active: "Old_Theme" }) });
    assert.equal(r.result, 0, r.stderr);
    const settings = readFileSync(join(root, SETTINGS, "settings/LightningExperience.settings"), "utf8");
    assert.equal(settings, writeActiveThemeSettings("Acme"));
    const body = settings.replace(/^[\s\S]*?<LightningExperienceSettings[^>]*>|<\/LightningExperienceSettings>[\s\S]*$/g, "");
    assert.deepEqual([...body.matchAll(/<(\w+)>/g)].map((m) => m[1]), ["activeThemeName"]);
    assert.match(readFileSync(join(root, SETTINGS, "package.xml"), "utf8"), /<members>LightningExperience<\/members>/);
    assert.equal(existsSync(join(root, SETTINGS, "settings/Stale.settings")), false);
  });
});

test("check가 실패하면 배포하지 않는다", async () => {
  await withProject({}, async (root) => {
    rmSync(join(root, `${FA}/staticresources/milvusBrand.css`));
    const sf = fakeSf({ active: "Old_Theme" });
    const r = await deploy(root, ["--yes"], { sf });
    assert.equal(r.result, 1);
    assert.match(r.stderr, /check/);
    assert.deepEqual(sf.calls, []);
  });
});

test("경고 '활성 테마 변경은 org 전체 사용자 화면에 적용됩니다'를 출력한다", async () => {
  await withProject({}, async (root) => {
    const r = await deploy(root, [], { sf: fakeSf({ active: "Old_Theme" }) });
    assert.ok(r.stdout.includes("활성 테마 변경은 org 전체 사용자 화면에 적용됩니다"), r.stdout);
  });
});

test("출력에 --url-only와 액세스 토큰 형식 문자열이 없다", async () => {
  assert.match(FAKE_TOKEN, TOKEN);
  await withProject({}, async (root) => {
    // 성공: 확인용 sf org open 명령만 출력한다(실행하지 않는다)
    const sf = fakeSf({ active: "Old_Theme", deploy: ok({ success: true, accessToken: FAKE_TOKEN }) });
    const r = await deploy(root, ["--yes"], { sf });
    assert.equal(r.result, 0, r.stderr);
    assert.match(r.stdout, /sf org open --target-org dev --path \//);
    assert.ok(!sf.calls.some((c) => c.args.includes("open")));

    // 실패: sf가 오류 문구에 토큰을 실어도 가린다
    const leaky = fakeSf({ retrieve: { code: 1, stdout: JSON.stringify({ status: 1, message: `INVALID_SESSION_ID ${FAKE_TOKEN}` }), stderr: "" } });
    const l = await deploy(root, ["--yes"], { sf: leaky });
    assert.equal(l.result, 1);
    const failedDeploy = fakeSf({ deploy: { code: 1, stdout: "not json", stderr: `session ${FAKE_TOKEN}` } });
    const f = await deploy(root, ["--yes"], { sf: failedDeploy });
    assert.equal(f.result, 1);

    for (const out of [r, l, f]) {
      const all = out.stdout + out.stderr;
      assert.ok(!all.includes("--url-only"), all);
      assert.doesNotMatch(all, TOKEN);
    }
    assert.match(l.stderr, /INVALID_SESSION_ID/);
  });
});

test("알 수 없는 옵션은 사용법과 1", async () => {
  await withProject({}, async (root) => {
    const sf = fakeSf();
    const r = await deploy(root, ["--force"], { sf });
    assert.equal(r.result, 1);
    assert.match(r.stderr, /사용법: pnpm milvus deploy/);
    assert.deepEqual(sf.calls, []);
  });
});
