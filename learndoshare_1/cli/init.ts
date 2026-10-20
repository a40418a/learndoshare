// milvus init (설계 3장, 4.1). 순서: 사전 점검 → (--from-org면 org 조회·검증) → planInit → applyOps → writeConfig
// 사전 점검, org 조회·검증, 병합 준비(기존 JSON 읽기) 중 하나라도 실패하면 프로젝트에 아무것도 쓰지 않고 1로 끝난다.
// applyOps는 모든 결과를 먼저 만든 뒤에 쓴다
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { isValidBrandName, logoAsset, readBranding, writeBrandingSet, writeContentAssetMeta, writeTheme } from "../lib/branding.ts";
import { managedFiles, sha256 } from "../lib/managed.ts";
import { addKeyIfMissing, appendLines, mergeSettings } from "../lib/merge.ts";
import { buildMilvusVfCss } from "../lib/vf.ts";
import { findProject, packageInfo, readConfig, runSf, writeConfig, type SfRunner } from "./context.ts";

export type Op = {
  kind: "copy" | "create" | "merge-json" | "append-lines" | "add-key";
  dest: string;
  src?: string;
  content?: string;
  lines?: string[];
  key?: string;
  value?: unknown;
};

const FA = "force-app/main/default";
const DEFAULT_BRAND_COLOR = "#0176D3";
const VF_CSS = `${FA}/staticresources/milvusVf.css`;
// 프로젝트 .npmrc에는 레지스트리 줄만 넣는다. 토큰 줄(//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN})은 사용자 ~/.npmrc에 둔다.
// pnpm 11.5.3·10.34.2부터 프로젝트 .npmrc의 ${…} 토큰은 경고와 함께 무시된다(#46). init은 설치 뒤에 돌므로 인증은 이미 동작한다
const NPMRC = ["@a40418a:registry=https://npm.pkg.github.com"];
const USAGE = "사용법: pnpm milvus init --target-org <별칭> (--brand <이름> | --from-org) [--no-vf]";

/** .claude/settings.json에 패키지 틀(설계 7.2)을 병합하는 op. init과 update가 같은 병합을 한다(설계 4.5) */
export function settingsOp(pkgRoot: string): Op {
  return { kind: "merge-json", dest: ".claude/settings.json", value: JSON.parse(readFileSync(join(pkgRoot, "templates/claude/settings.json"), "utf8")) };
}

/**
 * 프로젝트에 놓을 파일과 병합할 내용(설계 3장). root·targetOrg는 쓰지 않는다(경로는 루트 기준 상대 경로, 대상 org는 writeConfig가 기록).
 * orgBrand는 --from-org가 org에서 받아 검증한 테마·BrandingSet XML과 로고(자산 이름, 받은 파일, 메타 XML)다. 없으면 브랜드 이름과 기본색으로 만든다.
 * logoFile은 사용자가 준 새 로고이고 contentassets/<이름>Logo.asset으로 둔다
 */
export function planInit(o: {
  root: string;
  pkgRoot: string;
  targetOrg: string;
  brand: string;
  vf: boolean;
  logoFile?: string;
  orgBrand?: { brandingSet: string; theme: string; logo?: { asset: string; file: string; meta: string } };
}): Op[] {
  const b = o.brand;
  // milvusVf.css는 틀을 복사하지 않고 BrandingSet과 같은 브랜드 색(--from-org는 org 값, 아니면 기본색)의 팔레트로 바로 만든다(설계 3장 [생성]).
  // 그래야 첫 check나 deploy 전에 프로젝트 전체를 배포해도 VF 팔레트가 Salesforce 기본색으로 나오지 않는다
  const brandColor = o.orgBrand ? readBranding(o.orgBrand.brandingSet).brandColor : DEFAULT_BRAND_COLOR;
  const ops: Op[] = managedFiles(o.pkgRoot, { vf: o.vf }).flatMap((f): Op[] => {
    if (!f.src) return [];
    return f.dest === VF_CSS ? [{ kind: "create", dest: f.dest, content: buildMilvusVfCss(brandColor) }] : [{ kind: "copy", dest: f.dest, src: f.src }];
  });
  ops.push(
    { kind: "append-lines", dest: "CLAUDE.md", lines: ["@milvus-design.md"] },
    settingsOp(o.pkgRoot),
    { kind: "add-key", dest: "package.json", key: "scripts.storybook", value: "milvus storybook" },
    { kind: "append-lines", dest: ".gitignore", lines: [".milvus/"] },
    // 밀버스 LWC는 JS라 tsconfig 줄은 넣지 않는다(10/9 D1)
    { kind: "append-lines", dest: ".forceignore", lines: ["**/__tests__/**"] },
    { kind: "append-lines", dest: ".npmrc", lines: NPMRC },
    {
      kind: "create",
      dest: `${FA}/brandingSets/LEXTHEMING${b}.brandingSet-meta.xml`,
      content: o.orgBrand?.brandingSet ?? writeBrandingSet({ name: b, brandColor: DEFAULT_BRAND_COLOR, logo: o.logoFile !== undefined }),
    },
    { kind: "create", dest: `${FA}/lightningExperienceThemes/${b}.lightningExperienceTheme-meta.xml`, content: o.orgBrand?.theme ?? writeTheme(b) },
  );
  if (o.logoFile !== undefined) {
    ops.push(
      { kind: "copy", dest: `${FA}/contentassets/${b}Logo.asset`, src: o.logoFile },
      { kind: "create", dest: `${FA}/contentassets/${b}Logo.asset-meta.xml`, content: writeContentAssetMeta(b, o.logoFile) },
    );
  }
  const orgLogo = o.orgBrand?.logo;
  if (orgLogo) {
    // R26: org 로고는 자산 이름과 메타를 그대로 둔다. BRAND_IMAGE가 같은 자산을 가리키므로 배포해도 org에 자산이 하나 더 생기지 않는다
    ops.push(
      { kind: "copy", dest: `${FA}/contentassets/${orgLogo.asset}.asset`, src: orgLogo.file },
      { kind: "create", dest: `${FA}/contentassets/${orgLogo.asset}.asset-meta.xml`, content: orgLogo.meta },
    );
  }
  return ops;
}

function readJsonObject(text: string, dest: string): Record<string, unknown> {
  let v;
  try {
    v = JSON.parse(text);
  } catch (e) {
    throw new Error(`${dest}이 올바른 JSON이 아닙니다. 고친 뒤 다시 실행하세요: ${(e as Error).message}`);
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`${dest}의 최상위가 JSON 객체가 아닙니다. 고친 뒤 다시 실행하세요`);
  return v;
}

/**
 * ops를 프로젝트에 반영한다. copy·create는 파일이 이미 있으면 덮어쓰지 않고 skipped에 넣는다.
 * 병합·줄 추가·키 추가는 바뀔 때만 쓴다. 모든 결과를 먼저 만든 뒤에 쓰므로, 기존 JSON이 깨졌으면 아무것도 쓰지 않고 던진다
 */
export function applyOps(root: string, ops: Op[]): { written: string[]; skipped: string[] } {
  const writes: { dest: string; data: string | Buffer }[] = [];
  const skipped: string[] = [];
  for (const op of ops) {
    const path = join(root, op.dest);
    if (op.kind === "copy" || op.kind === "create") {
      if (existsSync(path)) skipped.push(op.dest);
      else writes.push({ dest: op.dest, data: op.kind === "copy" ? readFileSync(op.src!) : op.content! });
      continue;
    }
    const text = existsSync(path) ? readFileSync(path, "utf8") : undefined;
    let next: string;
    if (op.kind === "append-lines") {
      next = appendLines(text, op.lines!);
    } else {
      const before = text === undefined ? {} : readJsonObject(text, op.dest);
      const after = op.kind === "merge-json" ? mergeSettings(before, op.value as Record<string, unknown>) : addKeyIfMissing(before, op.key!, op.value);
      // 바뀌면 기존 들여쓰기(첫 키 줄의 공백 또는 탭)로 다시 쓴다. 새 파일은 2칸
      // ponytail: 한 줄로 압축된 JSON은 들여쓰기를 알 수 없어 2칸으로 펼친다. CRLF·끝 줄바꿈 유무는 지키지 않는다
      const indent = /^[ \t]+(?=")/m.exec(text ?? "")?.[0] ?? 2;
      next = text !== undefined && JSON.stringify(after) === JSON.stringify(before) ? text : `${JSON.stringify(after, null, indent)}\n`;
    }
    if (next !== text) writes.push({ dest: op.dest, data: next });
  }
  for (const w of writes) {
    mkdirSync(dirname(join(root, w.dest)), { recursive: true });
    writeFileSync(join(root, w.dest), w.data);
  }
  return { written: writes.map((w) => w.dest), skipped };
}

/** Node 22.18 이상, 23.x는 23.6 이상(.ts를 그대로 실행하는 버전, engines와 같다) */
function nodeSupported(version: string): boolean {
  const [major, minor] = version.replace(/^v/, "").split(".").map(Number);
  return major > 23 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18);
}

function sfMessage(r: { stdout: string; stderr: string }): string {
  try {
    const message = JSON.parse(r.stdout)?.message;
    if (typeof message === "string" && message) return message.trim();
  } catch {
    // --json 출력이 아니면 stderr를 쓴다
  }
  return r.stderr.trim();
}

/**
 * --from-org: 활성 테마 이름을 읽고, 그 테마·BrandingSet·로고만 임시 폴더(tmp)로 받아 검증한다(설계 4.1의 4).
 * 프로젝트에는 쓰지 않는다. 받은 파일은 바꾸지 않는다(R26: 로고 자산 이름과 BRAND_IMAGE도 org 그대로). 로고 내용은 tmp에 파일로 둔다
 */
async function fetchOrgBrand(
  sf: SfRunner,
  org: string,
  tmp: string,
): Promise<{ name: string; orgBrand: { brandingSet: string; theme: string; logo?: { asset: string; file: string; meta: string } } }> {
  const retrieve = async (step: string, members: string[]) => {
    const out = join(tmp, step);
    const args = ["project", "retrieve", "start", ...members.flatMap((m) => ["--metadata", m]), "--target-org", org];
    const r = await sf([...args, "--target-metadata-dir", out, "--unzip", "--single-package", "--json"], tmp);
    if (r.code !== 0) throw new Error(`org 조회에 실패했습니다(${members.join(", ")}): ${sfMessage(r)}`);
    return (rel: string) => {
      const file = join(out, "unpackaged", rel);
      return existsSync(file) ? readFileSync(file) : undefined;
    };
  };

  const settings = (await retrieve("settings", ["Settings:LightningExperience"]))("settings/LightningExperience.settings");
  const name = /<activeThemeName>([^<]*)<\/activeThemeName>/.exec(settings?.toString("utf8") ?? "")?.[1].trim();
  if (!name) throw new Error("org의 활성 테마를 읽지 못했습니다. --brand <이름>으로 실행하세요");
  if (!isValidBrandName(name)) throw new Error(`활성 테마 이름을 브랜드 이름으로 쓸 수 없습니다: ${name}. --brand <이름>으로 실행하세요`);

  const got = await retrieve("theme", [`LightningExperienceTheme:${name}`, `BrandingSet:LEXTHEMING${name}`]);
  const theme = got(`lightningExperienceThemes/${name}.lightningExperienceTheme`)?.toString("utf8");
  const brandingSet = got(`brandingSets/LEXTHEMING${name}.brandingSet`)?.toString("utf8");
  if (!theme || !brandingSet) {
    throw new Error(`활성 테마 ${name}의 커스텀 테마(LightningExperienceTheme·BrandingSet LEXTHEMING${name})를 org에서 받지 못했습니다. 기본 테마가 활성이면 --brand <이름>으로 실행하세요`);
  }
  if (!theme.includes(`<defaultBrandingSet>LEXTHEMING${name}</defaultBrandingSet>`)) {
    throw new Error(`테마 ${name}의 defaultBrandingSet이 LEXTHEMING${name}이 아닙니다. --brand <이름>으로 실행하세요`);
  }
  // 10/9 결정: SLDS 2 org 기준(설계 1장). SLDS 1 테마는 범위 밖이라 받지 않는다
  if (!theme.includes("<designSystemVersion>SLDS_v2</designSystemVersion>")) {
    throw new Error(`밀버스는 SLDS 2 테마를 기준으로 합니다. SLDS 1 테마 지원은 #22에서 검토 중입니다(활성 테마: ${name})`);
  }
  const { brandImage } = readBranding(brandingSet); // BRAND_COLOR가 없거나 #rrggbb가 아니면 던진다
  if (!brandImage) return { name, orgBrand: { brandingSet, theme } };

  const asset = logoAsset(brandImage);
  if (!asset) throw new Error(`BrandingSet의 로고 경로를 해석하지 못했습니다: ${brandImage}. --brand <이름>으로 실행하세요`);
  const gotLogo = await retrieve("logo", [`ContentAsset:${asset}`]);
  const content = gotLogo(`contentassets/${asset}.asset`);
  const meta = gotLogo(`contentassets/${asset}.asset-meta.xml`)?.toString("utf8");
  if (!content || !meta) throw new Error(`로고 ContentAsset ${asset}(파일과 메타)를 org에서 받지 못했습니다`);
  const file = join(tmp, `${asset}.asset`);
  writeFileSync(file, content);
  return { name, orgBrand: { brandingSet, theme, logo: { asset, file, meta } } };
}

function parseOptions(argv: string[]) {
  try {
    return parseArgs({
      args: argv,
      options: { "target-org": { type: "string" }, brand: { type: "string" }, "from-org": { type: "boolean" }, "no-vf": { type: "boolean" } },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch {
    throw new Error(`옵션이 올바르지 않습니다(알 수 없는 옵션, 값이 빠진 옵션 또는 남는 인자): ${argv.join(" ")}`);
  }
}

export async function runInit(argv: string[], deps: { sf?: SfRunner; nodeVersion?: string } = {}): Promise<number> {
  const sf = deps.sf ?? runSf;
  let tmp: string | undefined;
  try {
    const values = parseOptions(argv);
    const targetOrg = values["target-org"];
    if (!targetOrg) throw new Error("--target-org <별칭>이 필요합니다");
    if (values.brand !== undefined && values["from-org"]) throw new Error("--brand와 --from-org 중 하나만 쓰세요");
    if (values.brand === undefined && !values["from-org"]) throw new Error("--brand <이름> 또는 --from-org 중 하나가 필요합니다");
    if (values.brand !== undefined && !isValidBrandName(values.brand)) {
      throw new Error(`브랜드 이름은 영문자로 시작하고 영문자·숫자·_만 쓸 수 있습니다(__ 금지, _로 끝나지 않음, 한글 불가): ${values.brand}`);
    }
    const nodeVersion = deps.nodeVersion ?? process.versions.node;
    if (!nodeSupported(nodeVersion)) throw new Error(`Node 22.18 이상(23.x는 23.6 이상)이 필요합니다. 지금 버전: ${nodeVersion}`);
    const { root, defaultPackageDir } = findProject(process.cwd());
    if (defaultPackageDir !== "force-app") {
      throw new Error(`sfdx-project.json의 기본 패키지 폴더가 force-app이어야 합니다. 지금: ${defaultPackageDir}`);
    }
    // 로컬 파일 점검은 sf 조회(수 초)보다 먼저 한다(설계 4.1의 1). applyOps도 병합 전에 다시 읽는다
    const settingsFile = join(root, ".claude/settings.json");
    if (existsSync(settingsFile)) readJsonObject(readFileSync(settingsFile, "utf8"), ".claude/settings.json");
    const pkg = packageInfo();
    let configVersion: string | undefined;
    try {
      configVersion = readConfig(root)?.version;
    } catch {
      // 깨진 milvus.config.json은 init이 다시 쓴다(readConfig의 안내가 init 재실행이다)
    }
    // 다른 버전의 [관리] 파일 위에 init을 다시 하면 건너뛴 파일과 config의 sha256이 어긋난다
    if (configVersion !== undefined && configVersion !== pkg.version) {
      throw new Error(`milvus.config.json의 버전(${configVersion})이 설치된 패키지 버전(${pkg.version})과 다릅니다. init을 다시 실행하지 말고 pnpm milvus update를 쓰세요`);
    }

    // sf는 프로젝트 밖 임시 폴더에서 실행한다. 조회 결과도 여기에 받아 검증 전에는 프로젝트에 쓰지 않는다
    tmp = mkdtempSync(join(tmpdir(), "milvus-init-"));
    const login = await sf(["org", "list", "limits", "--target-org", targetOrg, "--json"], tmp);
    if (login.code === 127) throw new Error("sf CLI를 찾지 못했습니다. Salesforce CLI를 설치한 뒤 다시 실행하세요");
    if (login.code !== 0) {
      throw new Error(`org ${targetOrg}에 로그인되어 있지 않거나 연결하지 못했습니다. sf org login web --alias ${targetOrg}로 로그인하세요: ${sfMessage(login)}`);
    }
    const org = values["from-org"] ? await fetchOrgBrand(sf, targetOrg, tmp) : undefined;
    const brand = org?.name ?? values.brand!;
    const vf = !values["no-vf"];

    const ops = planInit({ root, pkgRoot: pkg.root, targetOrg, brand, vf, orgBrand: org?.orgBrand });
    const { written, skipped } = applyOps(root, ops);
    // [관리] 파일은 패키지 원본의 sha256을 기록한다. 이미 있어 건너뛴 파일을 고쳐 두었으면 check가 잡는다
    const managed = Object.fromEntries(
      managedFiles(pkg.root, { vf }).flatMap((f) => (f.kind === "managed" && f.src ? [[f.dest, sha256(readFileSync(f.src))]] : [])),
    );
    writeConfig(root, { version: pkg.version, targetOrg, brand, vf, managed });

    const list = (files: string[]) => files.map((f) => `  - ${f}\n`).join("");
    process.stdout.write(
      `밀버스 init을 마쳤습니다. 브랜드 ${brand}, 대상 org ${targetOrg}, VF ${vf ? "포함" : "제외"}\n` +
        `쓰거나 고친 파일 ${written.length + 1}개:\n${list([...written, "milvus.config.json"])}` +
        (skipped.length ? `이미 있어 건너뛴 파일 ${skipped.length}개(덮어쓰지 않음):\n${list(skipped)}` : "") +
        "\n다음 단계\n" +
        "  1. pnpm milvus storybook — 브랜드 명세 페이지에서 요청을 입력하고 저장\n" +
        '  2. Claude Code에 "브랜드 요청 반영해줘"\n' +
        "  3. pnpm milvus deploy — 배포 계획 확인 뒤 승인하면 pnpm milvus deploy --yes\n" +
        "배포 뒤 org에서 직접 할 일(메타데이터로 할 수 없음)\n" +
        '  - 앱 전체에 브랜드를 걸려면 App Manager에서 앱마다 유틸리티 바에 milvusBrandLoader를 추가하고 "앱이 열릴 때 백그라운드로 로드"를 체크하세요\n' +
        (vf
          ? '  - VF 페이지: Setup → User Interface → Visualforce Settings의 "Use SLDS 2 for pages that include <apex:slds> when an SLDS 2 theme is active"를 켜세요\n'
          : ""),
    );
    return 0;
  } catch (e) {
    process.stderr.write(`milvus init 실패: ${(e as Error).message}\n${USAGE}\n`);
    return 1;
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }
}
