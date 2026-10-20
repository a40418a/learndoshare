// milvus deploy (설계 4.4). 순서: 대상 org → 전체 check → org의 지금 활성 테마 조회(sf 없음·로그인 만료면 멈춤) → 계획 출력 →
// (--yes 또는 TTY에서 y) 1단계 밀버스 메타데이터 배포 → 성공했을 때만 2단계 활성 테마 변경.
// sf는 SfRunner로만, 셸 없이 인자 배열로 부른다. sf 기본 org는 쓰지 않는다. 앱 메타데이터(flexipages, applications)는 배포하지 않는다(10/9 D3).
// LWC는 JS라 변환 단계가 없다(10/9 D4)
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { logoAsset, readBranding, writeActiveThemeSettings, writeSettingsPackageXml } from "../lib/branding.ts";
import { runCheck } from "./check.ts";
import { findProject, readConfig, runSf, type MilvusConfig, type SfRunner, removeTemp } from "./context.ts";

/** root는 sf를 실행할 프로젝트 폴더다. sourceDirs·settingsDir는 root 기준 상대 경로(/ 구분) */
export type DeployPlan = { root: string; targetOrg: string; currentTheme: string; newTheme: string; sourceDirs: string[]; settingsDir: string };
type Failure = { name: string; problem: string };

const FA = "force-app/main/default";
const SETTINGS_DIR = ".milvus/deploy/settings-mdapi";
const USAGE = "사용법: pnpm milvus deploy [--target-org <별칭>] [--yes]";
const WARNING = "활성 테마 변경은 org 전체 사용자 화면에 적용됩니다";
const VF_NOTICE =
  'VF 페이지가 SLDS 2로 그려지려면 Setup → User Interface → Visualforce Settings의 "Use SLDS 2 for pages that include <apex:slds> when an SLDS 2 theme is active"를 켜야 합니다. 이 설정은 메타데이터로 읽거나 바꿀 수 없어 deploy가 확인하지 못합니다';
// sf 오류 문구에 실릴 수 있는 액세스 토큰(org ID 00D… + ! + 세션 값). 출력하기 전에 가린다
const TOKEN = /00D[A-Za-z0-9]{12,15}![A-Za-z0-9._]+/g;
const redact = (text: string) => text.replace(TOKEN, "<토큰 가림>");

/**
 * sf를 실행하고 --json 결과를 해석한다. 성공이면 빈 배열, 실패면 실패 항목(componentFailures, 없으면 sf 오류 하나).
 * sf 없음(127), 종료 코드≠0(로그인 만료 등), JSON 해석 실패를 한국어로 설명한다
 */
async function callSf(sf: SfRunner, args: string[], cwd: string, org: string): Promise<Failure[]> {
  const r = await sf(args, cwd);
  if (r.code === 127) return [{ name: "sf", problem: "sf CLI를 찾지 못했습니다. Salesforce CLI를 설치한 뒤 다시 실행하세요" }];
  let json;
  try {
    json = JSON.parse(r.stdout);
  } catch {
    return [{ name: "sf", problem: redact(`sf 결과(--json)를 해석하지 못했습니다(종료 코드 ${r.code}). sf 버전을 확인하세요: ${(r.stderr || r.stdout).trim()}`) }];
  }
  if (r.code === 0) return [];
  // 배포 실패는 오류 봉투가 아니라 { status, result: { errorMessage, details } }로 끝난다(맨 위 message 없음).
  // componentFailures·runTestResult.failures는 하나면 배열이 아닌 객체로 올 수 있다
  const result = json?.result;
  const details = (result ?? json?.data)?.details;
  const failures: Failure[] = [
    ...[details?.componentFailures ?? []].flat().map((f) => ({ name: `${f.componentType}:${f.fullName}`, problem: String(f.problem) })),
    ...[details?.runTestResult?.failures ?? []].flat().map((f) => ({ name: `${f.name}.${f.methodName}`, problem: String(f.message) })),
  ];
  if (!failures.length && typeof result?.errorMessage === "string") failures.push({ name: "sf", problem: result.errorMessage });
  if (failures.length) return failures.map((f) => ({ name: redact(f.name), problem: redact(f.problem) }));
  const message = (typeof json?.message === "string" ? json.message : r.stderr).trim() || "sf가 이유를 알려 주지 않았습니다";
  // result가 없는 오류 봉투(NoAuthInfoFound 등)만 로그인·연결 문제일 수 있다
  const login = result ? "" : ` 로그인이 만료되었으면 sf org login web --alias ${org}로 로그인하세요.`;
  return [{ name: "sf", problem: redact(`sf가 실패했습니다(종료 코드 ${r.code}).${login} ${message}`) }];
}

// dir(force-app/main/default 기준) 안에서 이름이 prefix.로 시작하는 파일. 정적 리소스·BrandingSet처럼 본문과 -meta.xml을 함께 고른다
function filesNamed(root: string, dir: string, prefix: string): string[] {
  const abs = join(root, FA, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.startsWith(`${prefix}.`))
    .sort()
    .map((f) => `${FA}/${dir}/${f}`);
}

/** org의 Settings:LightningExperience를 프로젝트 밖 임시 폴더로 받아 activeThemeName을 읽는다(읽기 전용, init --from-org와 같은 명령) */
async function activeTheme(sf: SfRunner, org: string): Promise<string> {
  const tmp = mkdtempSync(join(tmpdir(), "milvus-deploy-"));
  try {
    const args = ["project", "retrieve", "start", "--metadata", "Settings:LightningExperience", "--target-org", org];
    const failures = await callSf(sf, [...args, "--target-metadata-dir", tmp, "--unzip", "--single-package", "--json"], tmpdir(), org);
    if (failures.length) throw new Error(`org ${org}의 활성 테마를 읽지 못해 배포하지 않습니다. ${failures[0].problem}`);
    const file = join(tmp, "unpackaged/settings/LightningExperience.settings");
    if (!existsSync(file)) throw new Error(`org ${org}에서 Settings:LightningExperience를 받지 못했습니다`);
    const name = /<activeThemeName>([^<]*)<\/activeThemeName>/.exec(readFileSync(file, "utf8"))?.[1].trim();
    return name || "Salesforce 기본 테마(활성 커스텀 테마 없음)";
  } finally {
    removeTemp(tmp);
  }
}

/** 배포 계획. 대상 org는 --target-org → config.targetOrg 순서다(sf 기본 org는 쓰지 않는다). 프로젝트에는 쓰지 않는다 */
export async function planDeploy(o: { root: string; config: MilvusConfig; targetOrg?: string }, sf: SfRunner): Promise<DeployPlan> {
  const targetOrg = o.targetOrg || o.config.targetOrg;
  if (!targetOrg) throw new Error("대상 org가 없습니다. --target-org <별칭>을 주세요. 로그인된 org는 sf org list로 확인합니다");
  const brand = o.config.brand;
  const brandingSet = `${FA}/brandingSets/LEXTHEMING${brand}.brandingSet-meta.xml`;
  const themes = filesNamed(o.root, "lightningExperienceThemes", brand);
  if (!themes.length) throw new Error(`테마 메타데이터가 없습니다: ${FA}/lightningExperienceThemes/${brand}.lightningExperienceTheme-meta.xml. pnpm milvus init을 다시 실행하세요`);
  // R26: 로고 자산 이름은 BRAND_IMAGE(/file-asset/<자산 이름>?v=…)에서 읽는다. <브랜드>Logo로 가정하지 않는다
  const { brandImage } = readBranding(readFileSync(join(o.root, brandingSet), "utf8"));
  const logo = brandImage ? logoAsset(brandImage) : undefined;

  // 밀버스 번들 각각(milvusBrandLoader 포함). lwc/ 전체를 넘기면 프로젝트 자체 컴포넌트까지 올라간다
  const bundles = readdirSync(join(o.root, FA, "lwc"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("milvus"))
    .map((e) => `${FA}/lwc/${e.name}`)
    .sort();
  const sourceDirs = [
    ...bundles,
    ...(existsSync(join(o.root, FA, "classes/utils/design")) ? [`${FA}/classes/utils/design`] : []),
    ...["milvusBrand", "milvusBridge", "milvusOverride"].flatMap((r) => filesNamed(o.root, "staticresources", r)),
    ...filesNamed(o.root, "brandingSets", `LEXTHEMING${brand}`),
    ...themes,
    ...(logo ? filesNamed(o.root, "contentassets", logo) : []),
    ...(o.config.vf ? [...filesNamed(o.root, "staticresources", "milvusVf"), ...filesNamed(o.root, "components", "milvusHead")] : []),
  ];
  const currentTheme = await activeTheme(sf, targetOrg);
  return { root: o.root, targetOrg, currentTheme, newTheme: brand, sourceDirs, settingsDir: SETTINGS_DIR };
}

/**
 * 1단계: 밀버스 메타데이터를 한 번의 배포로 올린다(원자적이라 하나라도 실패하면 전부 롤백).
 * 2단계: 1단계가 성공했을 때만 settingsDir(activeThemeName 한 필드)를 만들어 mdapi 형식으로 배포한다
 */
export async function executeDeploy(
  plan: DeployPlan,
  sf: SfRunner,
): Promise<{ code: number; stage: "metadata" | "activate" | "done"; failures: Failure[] }> {
  const org = ["--target-org", plan.targetOrg, "--json"];
  const metadata = await callSf(sf, ["project", "deploy", "start", ...plan.sourceDirs.flatMap((d) => ["--source-dir", d]), ...org], plan.root, plan.targetOrg);
  if (metadata.length) return { code: 1, stage: "metadata", failures: metadata };

  // 이전 실행이 남긴 파일이 배포에 섞이지 않게 비우고 다시 만든다(.milvus/는 init이 .gitignore에 넣는다)
  const dir = join(plan.root, plan.settingsDir);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, "settings"), { recursive: true });
  writeFileSync(join(dir, "package.xml"), writeSettingsPackageXml());
  writeFileSync(join(dir, "settings/LightningExperience.settings"), writeActiveThemeSettings(plan.newTheme));
  const activate = await callSf(sf, ["project", "deploy", "start", "--metadata-dir", plan.settingsDir, ...org], plan.root, plan.targetOrg);
  if (activate.length) return { code: 1, stage: "activate", failures: activate };
  return { code: 0, stage: "done", failures: [] };
}

function planText(plan: DeployPlan, vf: boolean): string {
  return (
    "milvus deploy 계획\n" +
    `  대상 org: ${plan.targetOrg}\n` +
    `  활성 테마: ${plan.currentTheme} → ${plan.newTheme}\n` +
    `  1단계 밀버스 메타데이터 배포(한 번에, 하나라도 실패하면 전부 롤백) ${plan.sourceDirs.length}개:\n` +
    plan.sourceDirs.map((d) => `    - ${d}\n`).join("") +
    `  2단계 활성 테마 변경(1단계가 성공했을 때만): ${plan.settingsDir} (activeThemeName = ${plan.newTheme})\n` +
    `경고: ${WARNING}\n` +
    (vf ? `안내: ${VF_NOTICE}\n` : "")
  );
}

async function askYesNo(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(question)).trim());
  } finally {
    rl.close();
  }
}

/**
 * pnpm milvus deploy [--target-org <별칭>] [--yes]. --yes가 없으면 계획만 출력하고 0으로 끝난다.
 * 사람이 터미널(TTY)에서 --yes 없이 실행하면 y/N을 묻는다(기본 N). deps는 테스트용이다
 */
export async function runDeploy(argv: string[], deps: { sf?: SfRunner; isTTY?: boolean; ask?: (q: string) => Promise<boolean> } = {}): Promise<number> {
  const sf = deps.sf ?? runSf;
  let values;
  try {
    values = parseArgs({ args: argv, options: { "target-org": { type: "string" }, yes: { type: "boolean" } }, strict: true, allowPositionals: false }).values;
  } catch {
    process.stderr.write(`milvus deploy 실패: 옵션이 올바르지 않습니다(알 수 없는 옵션, 값이 빠진 옵션 또는 남는 인자): ${argv.join(" ")}\n${USAGE}\n`);
    return 1;
  }
  try {
    const { root } = findProject(process.cwd());
    const config = readConfig(root);
    if (!config) throw new Error("milvus.config.json이 없습니다. 프로젝트에 밀버스를 준비하려면 pnpm milvus init을 먼저 실행하세요");
    const check = await runCheck({ root, style: false });
    if (check.regenerated.length) process.stdout.write(`지금 브랜드 색으로 다시 만든 파일: ${check.regenerated.join(", ")}\n`);
    if (check.code !== 0) throw new Error("milvus check를 통과하지 못해 배포하지 않습니다. 위 안내대로 고친 뒤 다시 실행하세요");

    const plan = await planDeploy({ root, config, targetOrg: values["target-org"] }, sf);
    process.stdout.write(planText(plan, config.vf));
    if (!values.yes) {
      const tty = deps.isTTY ?? process.stdin.isTTY === true;
      if (!tty || !(await (deps.ask ?? askYesNo)("이 계획대로 배포할까요? (y/N) "))) {
        process.stdout.write("배포하지 않았습니다. 계획을 승인했으면 pnpm milvus deploy --yes로 실행하세요\n");
        return 0;
      }
    }

    const result = await executeDeploy(plan, sf);
    const list = result.failures.map((f) => `  - ${f.name}  ${f.problem}\n`).join("");
    if (result.stage === "metadata") {
      process.stderr.write(
        `milvus deploy 실패: 1단계(밀버스 메타데이터 배포)의 성공을 확인하지 못해 활성 테마는 바꾸지 않았습니다. 배포는 원자적이라 실패했으면 전부 롤백되었습니다. 실패 항목 ${result.failures.length}개:\n${list}`,
      );
      return 1;
    }
    if (result.stage === "activate") {
      process.stderr.write(`milvus deploy 실패: 1단계 배포는 됐지만 2단계(활성 테마 변경)의 성공을 확인하지 못했습니다. 활성 테마는 ${plan.currentTheme}에서 바뀌지 않았을 수 있습니다. org에서 확인하세요:\n${list}`);
      return 1;
    }
    process.stdout.write(
      `배포를 마쳤습니다. 활성 테마: ${plan.newTheme}\n` +
        "확인(직접 실행하세요. 테마 색은 브라우저를 새로고침한 뒤에 보입니다):\n" +
        `  sf org open --target-org ${plan.targetOrg} --path /lightning/page/home\n` +
        "org에서 직접 할 일(메타데이터로 할 수 없음)\n" +
        '  - 앱 전체에 브랜드를 걸려면 App Manager에서 앱마다 유틸리티 바에 milvusBrandLoader를 추가하고 "앱이 열릴 때 백그라운드로 로드"를 체크하세요\n' +
        (config.vf ? `  - ${VF_NOTICE}\n` : ""),
    );
    return 0;
  } catch (e) {
    process.stderr.write(`milvus deploy 실패: ${redact((e as Error).message)}\n`);
    return 1;
  }
}
