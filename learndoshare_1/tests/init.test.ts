import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readBranding } from "../lib/branding.ts";
import { readConfig, runSf, type SfRunner } from "../cli/context.ts";
import { applyOps, planInit, runInit } from "../cli/init.ts";
import { buildMilvusVfCss } from "../lib/vf.ts";

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const version = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).version;
const FA = "force-app/main/default";
const BRAND = ["--target-org", "dev", "--brand", "Acme"];
const FROM = ["--target-org", "dev", "--from-org"];
// 토큰 줄은 넣지 않는다(pnpm 11은 프로젝트 .npmrc의 ${…} 토큰을 무시, #46). 사용자 ~/.npmrc에 둔다
const NPMRC = ["@a40418a:registry=https://npm.pkg.github.com"];

// 임시 SFDX 프로젝트. 폴더 이름에 공백과 한글을 넣는다(리뷰 중점 5)
function makeProject(files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "밀버스 init 테스트-"));
  const base: Record<string, string> = {
    "sfdx-project.json": JSON.stringify({ packageDirectories: [{ path: "force-app", default: true }], sourceApiVersion: "67.0" }, null, 2) + "\n",
    "package.json": JSON.stringify({ name: "customer-app", scripts: { test: "sfdx-lwc-jest" } }, null, 2) + "\n",
    ".forceignore": "**/jsconfig.json\n**/__tests__/**\n",
    [`${FA}/lwc/.eslintrc.json`]: "{}\n",
  };
  for (const [rel, text] of Object.entries({ ...base, ...files })) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

/** 프로젝트의 모든 파일: 상대 경로(/ 구분) → 내용 */
function snapshot(root: string): Record<string, string> {
  const files = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name));
  return Object.fromEntries(files.map((p) => [relative(root, p).split(sep).join("/"), readFileSync(p, "utf8")]).sort());
}

const read = (root: string, rel: string) => readFileSync(join(root, rel), "utf8");
const plan = (root: string, o: { vf?: boolean } = {}) =>
  planInit({ root, pkgRoot, targetOrg: "dev", brand: "Acme", vf: o.vf ?? true });

// 가짜 sf. 로그인 확인(org …)은 login 코드를, retrieve는 --target-metadata-dir/unpackaged 아래에 org 파일을 쓴다(실제 sf와 같은 배치)
type OrgFiles = Record<string, Record<string, string | Buffer>>;
const metadataOf = (args: string[]) => args.filter((_, i) => args[i - 1] === "--metadata");
function fakeSf(org: OrgFiles = {}, codes: { login?: number; retrieve?: number } = {}) {
  const calls: { args: string[]; cwd: string }[] = [];
  const sf: SfRunner = async (args, cwd) => {
    calls.push({ args, cwd });
    if (args[0] === "org") return { code: codes.login ?? 0, stdout: "{}", stderr: codes.login ? "로그인 안 됨(가짜)" : "" };
    if (codes.retrieve) return { code: codes.retrieve, stdout: JSON.stringify({ status: 1, message: "조회 실패(가짜)" }), stderr: "" };
    const out = join(args[args.indexOf("--target-metadata-dir") + 1], "unpackaged");
    for (const [rel, data] of metadataOf(args).flatMap((m) => Object.entries(org[m] ?? {}))) {
      mkdirSync(dirname(join(out, rel)), { recursive: true });
      writeFileSync(join(out, rel), data);
    }
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "package.xml"), "<Package/>\n");
    return { code: 0, stdout: JSON.stringify({ status: 0, result: { messages: [] } }), stderr: "" };
  };
  return Object.assign(sf, { calls });
}

const xml = (root: string, body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="http://soap.sforce.com/2006/04/metadata">\n${body}</${root}>\n`;
const prop = (name: string, value: string) =>
  `    <brandingSetProperty>\n        <propertyName>${name}</propertyName>\n        <propertyValue>${value}</propertyValue>\n    </brandingSetProperty>\n`;
const settingsXml = (active?: string) =>
  xml("LightningExperienceSettings", `${active ? `    <activeThemeName>${active}</activeThemeName>\n` : ""}    <enableS1DesktopEnabled>true</enableS1DesktopEnabled>\n`);
// 2026-10-09 org에서 받은 파일과 같은 모양(이름과 자산 이름만 바꿈)
const ORG_THEME = xml(
  "LightningExperienceTheme",
  "    <defaultBrandingSet>LEXTHEMINGAcme_Org</defaultBrandingSet>\n    <designSystemVersion>SLDS_v2</designSystemVersion>\n" +
    "    <isDarkModeEnabled>false</isDarkModeEnabled>\n    <masterLabel>에이크미 테마</masterLabel>\n    <shouldOverrideLoadingImage>false</shouldOverrideLoadingImage>\n",
);
const ORG_BRANDING = xml(
  "BrandingSet",
  prop("BRAND_COLOR", "#2E7D32") + prop("HEADER_BACKGROUND_COLOR", "#FFFFFF") + prop("BRAND_IMAGE", "/file-asset/acme_logo_1?v=3") +
    prop("BRAND_IMAGE_DARK_MODE", "") + "    <masterLabel>에이크미 테마</masterLabel>\n",
);
const LOGO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const ORG_LOGO_META = xml(
  "ContentAsset",
  "    <language>ko</language>\n    <masterLabel>acme_logo_1</masterLabel>\n    <versions>\n        <version>\n            <number>1</number>\n" +
    "            <pathOnClient>회사 로고.JPG</pathOnClient>\n        </version>\n    </versions>\n",
);
const ORG: OrgFiles = {
  "Settings:LightningExperience": { "settings/LightningExperience.settings": settingsXml("Acme_Org") },
  "LightningExperienceTheme:Acme_Org": { "lightningExperienceThemes/Acme_Org.lightningExperienceTheme": ORG_THEME },
  "BrandingSet:LEXTHEMINGAcme_Org": { "brandingSets/LEXTHEMINGAcme_Org.brandingSet": ORG_BRANDING },
  "ContentAsset:acme_logo_1": { "contentassets/acme_logo_1.asset": LOGO, "contentassets/acme_logo_1.asset-meta.xml": ORG_LOGO_META },
};

// cwd에서 runInit을 실행하고 stdout·stderr를 모은다. 바꿔 둔 cwd와 write는 끝나면 되돌린다
async function init(cwd: string, argv: string[], deps: { sf?: SfRunner; nodeVersion?: string } = {}) {
  const out = { code: -1, stdout: "", stderr: "" };
  const { stdout, stderr } = process;
  const originals = [stdout.write, stderr.write] as const;
  const before = process.cwd();
  process.chdir(cwd);
  stdout.write = ((chunk: string | Uint8Array) => ((out.stdout += String(chunk)), true)) as typeof stdout.write;
  stderr.write = ((chunk: string | Uint8Array) => ((out.stderr += String(chunk)), true)) as typeof stderr.write;
  try {
    out.code = await runInit(argv, { sf: deps.sf ?? fakeSf(), nodeVersion: deps.nodeVersion ?? "22.18.0" });
  } finally {
    [stdout.write, stderr.write] = originals;
    process.chdir(before);
  }
  return out;
}

async function withProject(files: Record<string, string>, fn: (root: string) => Promise<void> | void) {
  const root = makeProject(files);
  try {
    await fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

/** 1을 돌려주고, stderr가 message에 맞고, 프로젝트 파일이 하나도 바뀌지 않는다 */
async function assertFails(argv: string[], o: { message: RegExp; files?: Record<string, string>; sf?: SfRunner; nodeVersion?: string }) {
  await withProject(o.files ?? {}, async (root) => {
    const before = snapshot(root);
    const r = await init(root, argv, { sf: o.sf, nodeVersion: o.nodeVersion });
    assert.equal(r.code, 1, r.stdout);
    assert.match(r.stderr, o.message);
    assert.deepEqual(snapshot(root), before);
  });
}

test("두 번 실행해도 파일 내용과 milvus.config.json이 같다", async () => {
  await withProject({}, async (root) => {
    const first = await init(root, BRAND);
    assert.equal(first.code, 0, first.stderr);
    const once = snapshot(root);
    // 하위 폴더에서 실행해도 sfdx-project.json이 있는 루트를 찾는다
    const second = await init(join(root, FA), BRAND);
    assert.equal(second.code, 0, second.stderr);
    assert.deepEqual(snapshot(root), once);
    assert.match(second.stdout, /건너뛴 파일/);

    const config = readConfig(root)!;
    assert.deepEqual({ ...config, managed: {} }, { version, targetOrg: "dev", brand: "Acme", vf: true, managed: {} });
    const managed = Object.keys(config.managed);
    for (const dest of [".claude/rules/milvus/design.md", ".claude/hooks/milvus-check.mjs", `${FA}/lwc/milvusScript/milvusScript.js`, `${FA}/components/milvusHead.component`]) {
      assert.ok(managed.includes(dest), dest);
    }
    // [소유]·[생성] 파일은 sha256을 기록하지 않는다
    assert.deepEqual(managed.filter((d) => /milvusBrand\.|milvusOverride\.|milvusVf\./.test(d)), []);
    for (const [dest, hash] of Object.entries(config.managed)) {
      assert.equal(createHash("sha256").update(readFileSync(join(root, dest))).digest("hex"), hash, dest);
    }
    assert.deepEqual(readBranding(read(root, `${FA}/brandingSets/LEXTHEMINGAcme.brandingSet-meta.xml`)), { brandColor: "#0176D3" });
    assert.match(read(root, `${FA}/lightningExperienceThemes/Acme.lightningExperienceTheme-meta.xml`), /<defaultBrandingSet>LEXTHEMINGAcme</);
    // VF는 기본 포함이다: milvusHead(+meta)와 milvusVf(+meta)를 놓는다
    for (const f of ["components/milvusHead.component", "components/milvusHead.component-meta.xml", "staticresources/milvusVf.css", "staticresources/milvusVf.resource-meta.xml"]) {
      assert.ok(existsSync(join(root, `${FA}/${f}`)), f);
    }
    // milvusVf.css는 틀이 아니라 init이 BrandingSet과 같은 기본색(#0176D3)의 팔레트로 바로 만든다. 두 번째 init은 건너뛴다
    assert.equal(read(root, `${FA}/staticresources/milvusVf.css`), buildMilvusVfCss("#0176D3"));
    assert.ok(second.stdout.includes(`${FA}/staticresources/milvusVf.css`) && /건너뛴 파일/.test(second.stdout));
    // 배포 뒤 사람이 org에서 할 일(10/9 D2·D3)을 안내한다
    assert.match(first.stdout, /milvusBrandLoader/);
    assert.match(first.stdout, /Visualforce Settings/);
  });
});

test("Claude 규칙은 .claude/rules/milvus/design.md에 두고 CLAUDE.md는 만들지도 고치지도 않는다. 루트에 milvus-*.md를 두지 않는다 (#63)", async () => {
  await withProject({ "CLAUDE.md": "# 고객 규칙\n\n- 기존 줄" }, (root) => {
    applyOps(root, plan(root));
    assert.equal(read(root, "CLAUDE.md"), "# 고객 규칙\n\n- 기존 줄");
    assert.equal(read(root, ".claude/rules/milvus/design.md"), readFileSync(join(pkgRoot, "templates/claude/rules/milvus/design.md"), "utf8"));
  });
  await withProject({}, (root) => {
    applyOps(root, plan(root));
    assert.ok(!existsSync(join(root, "CLAUDE.md")));
    assert.deepEqual(readdirSync(root).filter((f) => /^milvus-.*\.md$/.test(f)), []);
  });
});

test(".npmrc 레지스트리 줄이 없을 때만 추가하고 토큰 줄은 넣지 않는다", async () => {
  await withProject({ ".npmrc": `auto-install-peers=true\n${NPMRC[0]}\n` }, (root) => {
    applyOps(root, plan(root));
    applyOps(root, plan(root));
    assert.equal(read(root, ".npmrc"), `auto-install-peers=true\n${NPMRC[0]}\n`);
    assert.ok(!read(root, ".npmrc").includes("_authToken"));
    assert.equal(read(root, ".forceignore"), "**/jsconfig.json\n**/__tests__/**\n");
  });
  // .forceignore에 줄이 없으면 끝에 붙인다
  await withProject({ ".forceignore": "**/jsconfig.json\n" }, (root) => {
    applyOps(root, plan(root));
    assert.equal(read(root, ".npmrc"), `${NPMRC.join("\n")}\n`);
    assert.equal(read(root, ".gitignore"), ".milvus/\n");
    assert.equal(read(root, ".forceignore"), "**/jsconfig.json\n**/__tests__/**\n");
  });
});

test("이미 있는 milvusBrand.css는 건너뛰고 skipped에 넣는다", async () => {
  const dest = `${FA}/staticresources/milvusBrand.css`;
  const mine = ":root {\n  --slds-g-radius-border-2: 0;\n}\n";
  await withProject({ [dest]: mine }, (root) => {
    const r = applyOps(root, plan(root));
    assert.ok(r.skipped.includes(dest), r.skipped.join("\n"));
    assert.ok(!r.written.includes(dest));
    assert.equal(read(root, dest), mine);
    assert.ok(r.written.includes(`${FA}/staticresources/milvusBrand.resource-meta.xml`));
  });
});

test("UI 패턴(소유) docs/milvus/patterns/modal.md를 없을 때만 놓고 managed sha256에 넣지 않는다", async () => {
  const patterns = "docs/milvus/patterns/modal.md";
  await withProject({}, async (root) => {
    assert.equal((await init(root, BRAND)).code, 0);
    assert.equal(read(root, patterns), readFileSync(join(pkgRoot, "templates", patterns), "utf8"));
    assert.ok(!(patterns in readConfig(root)!.managed));
  });
  const mine = "# 우리 패턴\n";
  await withProject({ [patterns]: mine }, (root) => {
    assert.ok(applyOps(root, plan(root)).skipped.includes(patterns));
    assert.equal(read(root, patterns), mine);
  });
});

test("LightningExperience.settings는 만들지 않는다", async () => {
  await withProject({}, async (root) => {
    const r = await init(root, FROM, { sf: fakeSf(ORG) });
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(Object.keys(snapshot(root)).filter((p) => p.includes("LightningExperience.settings")), []);
  });
});

test("sfdx-project.json은 바꾸지 않고(defaultLwcLanguage를 넣지 않는다, 10/9 D1), package.json에 storybook 스크립트를 없을 때만 추가한다", async () => {
  await withProject({}, async (root) => {
    const sfdx = read(root, "sfdx-project.json");
    assert.equal((await init(root, BRAND)).code, 0);
    assert.equal(read(root, "sfdx-project.json"), sfdx);
    assert.deepEqual(JSON.parse(read(root, "package.json")), {
      name: "customer-app",
      scripts: { test: "sfdx-lwc-jest", storybook: "milvus storybook" },
    });
    assert.ok(!existsSync(join(root, `${FA}/lwc/tsconfig.json`)));
  });
  const own = JSON.stringify({ scripts: { storybook: "storybook dev -p 6006" } }, null, 4);
  await withProject({ "package.json": own }, async (root) => {
    assert.equal((await init(root, BRAND)).code, 0);
    assert.equal(read(root, "package.json"), own);
  });
});

test("--no-vf면 milvusHead·milvusVf를 만들지 않고 config.vf가 거짓", async () => {
  await withProject({}, async (root) => {
    const r = await init(root, [...BRAND, "--no-vf"]);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(Object.keys(snapshot(root)).filter((p) => /milvusHead|milvusVf/.test(p)), []);
    assert.equal(readConfig(root)!.vf, false);
    assert.doesNotMatch(r.stdout, /Visualforce Settings/);
  });
});

test("milvusOverride.css를 설명 주석만 있는 상태로 만들고, 이미 있으면 건너뛴다", async () => {
  const dest = `${FA}/staticresources/milvusOverride.css`;
  await withProject({}, (root) => {
    applyOps(root, plan(root));
    const css = read(root, dest);
    assert.ok(css.includes("공식 권고 밖"));
    assert.equal(css.replace(/\/\*[\s\S]*?\*\//g, "").trim(), "");
  });
  const mine = ".slds-button { border-radius: 0; }\n";
  await withProject({ [dest]: mine }, (root) => {
    assert.ok(applyOps(root, plan(root)).skipped.includes(dest));
    assert.equal(read(root, dest), mine);
  });
});

test("--from-org는 활성 테마 이름을 브랜드로 쓰고, org 파일을 검증한 뒤 그대로 복사한다. 로고 자산 이름과 BRAND_IMAGE도 org 그대로다(R26)", async () => {
  await withProject({}, async (root) => {
    const sf = fakeSf(ORG);
    const r = await init(root, FROM, { sf });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(readConfig(root)!.brand, "Acme_Org");
    assert.equal(read(root, `${FA}/lightningExperienceThemes/Acme_Org.lightningExperienceTheme-meta.xml`), ORG_THEME);
    // BrandingSet은 다른 속성과 BRAND_IMAGE까지 org 파일 그대로다(배포해도 org에 로고 자산이 하나 더 생기지 않는다)
    assert.equal(read(root, `${FA}/brandingSets/LEXTHEMINGAcme_Org.brandingSet-meta.xml`), ORG_BRANDING);
    assert.ok(readFileSync(join(root, `${FA}/contentassets/acme_logo_1.asset`)).equals(LOGO));
    assert.equal(read(root, `${FA}/contentassets/acme_logo_1.asset-meta.xml`), ORG_LOGO_META);
    // milvusVf.css는 org BrandingSet의 BRAND_COLOR(#2E7D32)의 팔레트다(기본색이 아니다)
    assert.equal(read(root, `${FA}/staticresources/milvusVf.css`), buildMilvusVfCss("#2E7D32"));
    assert.deepEqual(Object.keys(snapshot(root)).filter((p) => p.includes("contentassets/")), [
      `${FA}/contentassets/acme_logo_1.asset`,
      `${FA}/contentassets/acme_logo_1.asset-meta.xml`,
    ]);
    // 로그인 확인 → 활성 테마 이름(Settings)을 먼저 → 그 테마·BrandingSet → 로고
    assert.deepEqual(
      sf.calls.map((c) => (c.args[0] === "org" ? c.args.slice(0, 3) : metadataOf(c.args))),
      [["org", "list", "limits"], ["Settings:LightningExperience"], ["LightningExperienceTheme:Acme_Org", "BrandingSet:LEXTHEMINGAcme_Org"], ["ContentAsset:acme_logo_1"]],
    );
    // sf는 인자 배열로 프로젝트 밖에서 실행한다. 작업 폴더는 받은 파일을 담는 임시 폴더가 아니다(Windows는 작업 폴더로 잡힌 폴더를 못 지운다, #49).
    // 조회 결과를 받은 임시 폴더는 끝나면 지운다
    for (const c of sf.calls) {
      assert.ok(relative(root, c.cwd).startsWith(".."), c.cwd);
      assert.ok(!c.cwd.includes("milvus-init-"), c.cwd);
      assert.equal(c.args[c.args.indexOf("--target-org") + 1], "dev");
      const dir = c.args.indexOf("--target-metadata-dir");
      if (dir >= 0) assert.ok(!existsSync(c.args[dir + 1]), c.args[dir + 1]);
    }
  });
});

test("--from-org인데 BrandingSet에 BRAND_IMAGE가 없으면 로고 없이 org 파일을 복사한다", async () => {
  const noImage = ORG_BRANDING.replace(prop("BRAND_IMAGE", "/file-asset/acme_logo_1?v=3"), "");
  const sf = fakeSf({ ...ORG, "BrandingSet:LEXTHEMINGAcme_Org": { "brandingSets/LEXTHEMINGAcme_Org.brandingSet": noImage } });
  await withProject({}, async (root) => {
    const r = await init(root, FROM, { sf });
    assert.equal(r.code, 0, r.stderr);
    assert.equal(read(root, `${FA}/brandingSets/LEXTHEMINGAcme_Org.brandingSet-meta.xml`), noImage);
    assert.deepEqual(Object.keys(snapshot(root)).filter((p) => p.includes("contentassets")), []);
    assert.equal(sf.calls.length, 3);
  });
});

test("init은 .claude/settings.json의 사용자 항목을 지우거나 바꾸지 않고 밀버스 항목을 더한다", async () => {
  const mine = {
    model: "opus",
    permissions: { allow: ["Bash(ls)"], deny: ["Read(.env)"] },
    hooks: { PostToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: "echo mine" }] }] },
  };
  await withProject({ ".claude/settings.json": JSON.stringify(mine, null, 2) + "\n" }, async (root) => {
    assert.equal((await init(root, BRAND)).code, 0);
    const s = JSON.parse(read(root, ".claude/settings.json"));
    assert.equal(s.model, "opus");
    assert.deepEqual(s.permissions.allow, ["Bash(ls)"]);
    assert.equal(s.permissions.deny[0], "Read(.env)");
    assert.ok(s.permissions.deny.includes("Bash(sf org display)"));
    assert.deepEqual(s.hooks.PostToolUse[0], mine.hooks.PostToolUse[0]);
    assert.match(JSON.stringify(s.hooks.PostToolUse.slice(1)), /milvus-check\.mjs/);
  });
});

test("JSON 파일을 고칠 때 기존 들여쓰기(공백 수, 탭)를 지키고, 새로 만들면 2칸이다", async () => {
  const pkg = { name: "customer-app", scripts: { test: "sfdx-lwc-jest" } };
  const files = { "package.json": JSON.stringify(pkg, null, 4) + "\n", ".claude/settings.json": JSON.stringify({ model: "opus" }, null, "\t") + "\n" };
  await withProject(files, async (root) => {
    assert.equal((await init(root, BRAND)).code, 0);
    assert.equal(read(root, "package.json"), JSON.stringify({ ...pkg, scripts: { ...pkg.scripts, storybook: "milvus storybook" } }, null, 4) + "\n");
    const s = read(root, ".claude/settings.json");
    assert.equal(s, JSON.stringify(JSON.parse(s), null, "\t") + "\n");
  });
  await withProject({}, async (root) => {
    assert.equal((await init(root, BRAND)).code, 0);
    const s = read(root, ".claude/settings.json");
    assert.equal(s, JSON.stringify(JSON.parse(s), null, 2) + "\n");
  });
});

test("milvus.config.json이 깨졌으면 init이 다시 쓴다", async () => {
  await withProject({ "milvus.config.json": "{" }, async (root) => {
    const r = await init(root, BRAND);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(readConfig(root)!.version, version);
  });
});

// 아래는 모두 '1을 돌려주고 쓴 파일이 0개'
test("Node 22.17", async () => {
  await assertFails(BRAND, { nodeVersion: "22.17.0", message: /Node 22\.18 이상/ });
  await assertFails(BRAND, { nodeVersion: "23.5.0", message: /Node 22\.18 이상/ });
});

test("깨진 .claude/settings.json", async () => {
  // 사전 점검(설계 4.1의 1)이라 sf를 한 번도 부르지 않는다
  const sf = fakeSf(ORG);
  const files = { ".claude/settings.json": '{ "permissions": ' };
  await assertFails(BRAND, { files, sf, message: /\.claude\/settings\.json.*JSON/ });
  await assertFails(FROM, { files, sf, message: /\.claude\/settings\.json.*JSON/ });
  assert.equal(sf.calls.length, 0);
});

test("milvus.config.json의 버전이 설치된 패키지 버전과 다르면 update를 안내한다", async () => {
  const sf = fakeSf();
  const old = JSON.stringify({ version: "0.0.0-old", targetOrg: "dev", brand: "Acme", vf: true, managed: {} }, null, 2) + "\n";
  await assertFails(BRAND, { files: { "milvus.config.json": old }, sf, message: /0\.0\.0-old[\s\S]*pnpm milvus update/ });
  assert.equal(sf.calls.length, 0);
});

test("--brand와 --from-org를 함께 / 둘 다 없음", async () => {
  await assertFails([...BRAND, "--from-org"], { message: /하나만/ });
  await assertFails(["--target-org", "dev"], { message: /--brand <이름> 또는 --from-org/ });
  await assertFails(["--brand", "Acme"], { message: /--target-org <별칭>이 필요/ });
});

test("브랜드 이름 '1A'", async () => {
  await assertFails(["--target-org", "dev", "--brand", "1A"], { message: /브랜드 이름/ });
});

test("기본 패키지 폴더가 force-app이 아님", async () => {
  const sfdx = JSON.stringify({ packageDirectories: [{ path: "force-app" }, { path: "src", default: true }] });
  await assertFails(BRAND, { files: { "sfdx-project.json": sfdx }, message: /force-app/ });
});

test("sf 없음 또는 org 로그인 안 됨 (가짜 SfRunner)", async () => {
  await assertFails(BRAND, { sf: fakeSf({}, { login: 127 }), message: /sf CLI/ });
  await assertFails(BRAND, { sf: fakeSf({}, { login: 1 }), message: /로그인/ });
});

test("--from-org인데 커스텀 테마가 없거나 조회 실패 (가짜 SfRunner)", async () => {
  const noActive = { ...ORG, "Settings:LightningExperience": { "settings/LightningExperience.settings": settingsXml() } };
  await assertFails(FROM, { sf: fakeSf(noActive), message: /활성 테마를 읽지 못했습니다/ });
  const standard = { ...ORG, "Settings:LightningExperience": { "settings/LightningExperience.settings": settingsXml("LightningBlue") } };
  await assertFails(FROM, { sf: fakeSf(standard), message: /커스텀 테마.*받지 못했습니다/ });
  const { "ContentAsset:acme_logo_1": _, ...noLogo } = ORG;
  await assertFails(FROM, { sf: fakeSf(noLogo), message: /로고 ContentAsset/ });
  await assertFails(FROM, { sf: fakeSf(ORG, { retrieve: 1 }), message: /조회에 실패/ });
});

test("--from-org인데 활성 테마가 SLDS 2가 아님", async () => {
  const SLDS2 = /밀버스는 SLDS 2 테마를 기준으로 합니다\. SLDS 1 테마 지원은 #22에서 검토 중입니다/;
  const withTheme = (text: string) => fakeSf({ ...ORG, "LightningExperienceTheme:Acme_Org": { "lightningExperienceThemes/Acme_Org.lightningExperienceTheme": text } });
  await assertFails(FROM, { sf: withTheme(ORG_THEME.replace("SLDS_v2", "SLDS_v1")), message: SLDS2 });
  await assertFails(FROM, { sf: withTheme(ORG_THEME.replace("    <designSystemVersion>SLDS_v2</designSystemVersion>\n", "")), message: SLDS2 });
});

test("runSf는 sf를 찾지 못하면 127을 돌려준다", async () => {
  const path = process.env.PATH;
  process.env.PATH = join(tmpdir(), "없는 경로");
  try {
    assert.equal((await runSf(["--version"], tmpdir())).code, 127);
  } finally {
    process.env.PATH = path;
  }
});
