// milvus check (설계 4.3, 10장)
// - --style: hook이 milvusBrand.css·milvusOverride.css·brandingSets/를 고칠 때마다 실행한다. util.css 규칙·대비(5.2, 5.3),
//   milvusOverride.css(5.1), config 브랜드 BrandingSet의 BRAND_COLOR 형식, 프로젝트 LWC의 모달 규칙(lib/modal-rules.ts)만 보고,
//   hook 이름은 설치된 패키지의 dist/hooks-index.json에서 읽는다(lib/hooks-index.ts). 실패하면 2(Claude Code가 stderr를 Claude에게 보여 준다)
// - 전체: deploy와 CI가 실행한다. --style 항목 + 밀버스 관리 파일 sha256(milvus.config.json). 실패하면 1.
//   밀버스 LWC는 JS라 타입 검사는 하지 않는다(10/9 D1). config.vf면 milvusVf.css도 지금 BRAND_COLOR 팔레트로 다시 만든다(설계 3장 [생성])
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { readBranding } from "../lib/branding.ts";
import { loadRuleContext } from "../lib/hooks-index.ts";
import { RETIRED_COMPONENTS, sha256 } from "../lib/managed.ts";
import { checkModalComponent } from "../lib/modal-rules.ts";
import { checkOverrideCss, checkUtilCss, type Issue } from "../lib/rules.ts";
import { buildMilvusVfCss } from "../lib/vf.ts";
import { findProject, packageInfo, readConfig } from "./context.ts";

const RES = "force-app/main/default/staticresources";
const BRAND_CSS = `${RES}/milvusBrand.css`;
const OVERRIDE_CSS = `${RES}/milvusOverride.css`;
const VF_CSS = `${RES}/milvusVf.css`;
const BRANDING_SETS = "force-app/main/default/brandingSets";
const LWC = "force-app/main/default/lwc";
const USAGE = "사용법: pnpm milvus check [--style]";

const lines = (issues: Issue[]) => issues.map((i) => `  ${i.file}  ${i.message}${i.fix ? ` → 고칠 값: ${i.fix}` : ""}\n`).join("");

// milvus.config.json에 기록한 [관리] 파일과 지금 파일의 sha256 비교
function managedIssues(root: string): Issue[] {
  let config;
  try {
    config = readConfig(root);
  } catch (e) {
    return [{ file: "milvus.config.json", rule: "config", message: (e as Error).message }];
  }
  if (!config) return [{ file: "milvus.config.json", rule: "config", message: "파일이 없습니다. pnpm milvus init을 먼저 실행하세요" }];
  return Object.entries(config.managed).flatMap(([file, hash]): Issue[] => {
    const path = join(root, file);
    if (existsSync(path) && sha256(readFileSync(path)) === hash) return [];
    const what = existsSync(path) ? "직접 고쳤습니다" : "없습니다";
    return [
      { file, rule: "managed", message: `밀버스 관리 파일을 ${what}. pnpm milvus update --force로 패키지 원본으로 되돌리세요. 고칠 것이 있으면 밀버스에 요청하세요` },
    ];
  });
}

// milvus.config.json의 brand에 해당하는 brandingSets/LEXTHEMING<brand>.brandingSet-meta.xml 하나만 본다(판정 R27).
// 없거나 BRAND_COLOR가 없거나 #RRGGBB가 아니면 issue. 다른 BrandingSet(Experience Cloud 사이트 등)은 밀버스 것이 아니라 보지 않는다.
// config가 없거나 깨졌으면 어느 파일인지 알 수 없어 건너뛴다(전체 check의 managedIssues가 config 문제로 실패시킨다)
function brandingIssues(root: string): Issue[] {
  let brand: string | undefined;
  try {
    brand = readConfig(root)?.brand;
  } catch {
    return [];
  }
  if (brand === undefined) return [];
  const file = `${BRANDING_SETS}/LEXTHEMING${brand}.brandingSet-meta.xml`;
  if (!existsSync(join(root, file))) {
    return [{ file, rule: "brand-color", message: "브랜드 메타데이터가 없습니다. pnpm milvus init을 다시 실행하거나 파일을 복구하세요" }];
  }
  try {
    readBranding(readFileSync(join(root, file), "utf8"));
    return [];
  } catch (e) {
    return [{ file, rule: "brand-color", message: (e as Error).message, fix: "#RRGGBB 형식의 색(예: #0176D3)" }];
  }
}

// 패키지가 놓은 밀버스 LWC 폴더(milvus.config.json의 managed에 파일이 있는 폴더). config를 읽지 못하면 undefined
// (전체 check의 managedIssues가 config 문제로 실패시킨다)
function managedLwcDirs(root: string): Set<string> | undefined {
  let config;
  try {
    config = readConfig(root);
  } catch {
    return undefined;
  }
  if (!config) return undefined;
  const prefix = `${LWC}/`;
  return new Set(Object.keys(config.managed).filter((f) => f.startsWith(prefix)).map((f) => f.slice(prefix.length).split("/")[0]));
}

// milvus 접두사는 밀버스 패키지 전용이다(#74). 패키지에 없는 lwc/milvus* 폴더는 실패, 패키지에서 뺀 컴포넌트는 경고만 한다
function milvusNameIssues(root: string, managed: Set<string> | undefined): { errors: Issue[]; warnings: Issue[] } {
  const lwc = join(root, LWC);
  if (!managed || !existsSync(lwc)) return { errors: [], warnings: [] };
  const foreign = readdirSync(lwc, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith("milvus") && !managed.has(d.name));
  return {
    errors: foreign
      .filter((d) => !RETIRED_COMPONENTS.includes(d.name))
      .map((d) => ({
        file: `${LWC}/${d.name}`,
        rule: "milvus-name",
        message: "milvus는 밀버스 패키지 전용 이름입니다. 공용 컴포넌트가 필요하면 밀버스에 요청하고, 이 프로젝트 화면이면 이름을 바꾸세요",
      })),
    warnings: foreign
      .filter((d) => RETIRED_COMPONENTS.includes(d.name))
      .map((d) => ({ file: `${LWC}/${d.name}`, rule: "milvus-retired", message: "패키지에서 빠졌습니다. 화면에서 쓰지 않으면 이 폴더를 지우세요" })),
  };
}

// 프로젝트 LWC 폴더마다 바로 아래 .js·.html만 모달 규칙으로 본다(__tests__는 보지 않는다).
// 패키지가 놓은 밀버스 컴포넌트만 건너뛴다(c-milvus-modal 자신이 lightning-modal-*를 쓴다). config를 읽지 못하면 milvus*를 건너뛴다
function modalIssues(root: string, managed: Set<string> | undefined): Issue[] {
  const lwc = join(root, LWC);
  if (!existsSync(lwc)) return [];
  const skip = (name: string) => (managed ? managed.has(name) : name.startsWith("milvus"));
  return readdirSync(lwc, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !skip(d.name))
    .flatMap((d) => {
      const dir = `${LWC}/${d.name}`;
      const files = readdirSync(join(root, dir), { withFileTypes: true })
        .filter((f) => f.isFile() && /\.(js|html)$/.test(f.name))
        .map((f) => ({ path: `${dir}/${f.name}`, text: readFileSync(join(root, dir, f.name), "utf8") }));
      return checkModalComponent(dir, files);
    });
}

// config.vf면 milvusVf.css를 BrandingSet의 지금 BRAND_COLOR 팔레트로 다시 쓰고, 내용이 바뀌었을 때만 경로를 돌려준다.
// milvusVf는 [생성]이라 milvus.config.json의 managed(sha256)에 없어 관리 파일 검사와 겹치지 않는다.
// config나 BRAND_COLOR를 읽지 못하면 건너뛴다(managedIssues·brandingIssues가 이미 실패로 알린다)
function regenerateVfCss(root: string): string[] {
  let css: string;
  try {
    const config = readConfig(root);
    if (!config?.vf) return [];
    const brandingSet = readFileSync(join(root, `${BRANDING_SETS}/LEXTHEMING${config.brand}.brandingSet-meta.xml`), "utf8");
    css = buildMilvusVfCss(readBranding(brandingSet).brandColor);
  } catch {
    return [];
  }
  const path = join(root, VF_CSS);
  if (existsSync(path) && readFileSync(path, "utf8") === css) return [];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, css);
  return [VF_CSS];
}

/**
 * 검사 결과를 stderr에 쓰고 종료 코드를 돌려준다. issues는 실패시키는 문제만 담는다(override 경고는 stderr에만).
 * pkgRoot는 dist/hooks-index.json을 찾을 패키지 폴더다. 기본은 이 패키지다.
 * regenerated는 전체 check가 다시 쓴 [생성] 파일(루트 기준 경로)이다. --style은 파일을 쓰지 않는다
 */
export async function runCheck(o: { root: string; style: boolean; pkgRoot?: string }): Promise<{ code: 0 | 1 | 2; issues: Issue[]; regenerated: string[] }> {
  const issues: Issue[] = [];
  const read = (file: string) => {
    if (existsSync(join(o.root, file))) return readFileSync(join(o.root, file), "utf8");
    issues.push({ file, rule: "missing", message: "파일이 없습니다. 밀버스 컴포넌트와 deploy가 이 정적 리소스를 씁니다. pnpm milvus init을 다시 실행하면 틀을 만듭니다" });
  };

  const util = read(BRAND_CSS);
  if (util !== undefined) {
    const ctx = loadRuleContext({ pkgRoot: o.pkgRoot ?? packageInfo().root, projectRoot: o.root });
    issues.push(...checkUtilCss(util, BRAND_CSS, ctx));
  }
  const override = read(OVERRIDE_CSS);
  const { warnings, errors } = override === undefined ? { warnings: [], errors: [] } : checkOverrideCss(override, OVERRIDE_CSS);
  const managed = managedLwcDirs(o.root);
  const names = milvusNameIssues(o.root, managed);
  issues.push(...errors, ...brandingIssues(o.root), ...names.errors, ...modalIssues(o.root, managed));
  if (!o.style) issues.push(...managedIssues(o.root));

  if (warnings.length) {
    process.stderr.write(
      `milvusOverride.css 경고 ${warnings.length}개. 공식 권고 밖인 opt-in 파일이라 막지 않지만, native 전환이나 Salesforce 업데이트 때 깨질 수 있습니다:\n${lines(warnings)}`,
    );
  }
  if (names.warnings.length) process.stderr.write(`밀버스 컴포넌트 경고 ${names.warnings.length}개:\n${lines(names.warnings)}`);
  if (issues.length) process.stderr.write(`milvus check${o.style ? " --style" : ""}: 고칠 것 ${issues.length}개\n${lines(issues)}`);
  return { code: issues.length ? (o.style ? 2 : 1) : 0, issues, regenerated: o.style ? [] : regenerateVfCss(o.root) };
}

/** pnpm milvus check [--style]. sfdx-project.json이 있는 폴더를 위로 찾아 검사한다 */
export async function checkCommand(argv: string[]): Promise<number> {
  let style: boolean;
  try {
    style = parseArgs({ args: argv, options: { style: { type: "boolean" } } }).values.style === true;
  } catch {
    process.stderr.write(`milvus check 실패: 옵션이 올바르지 않습니다(알 수 없는 옵션 또는 남는 인자): ${argv.join(" ")}\n${USAGE}\n`);
    return 1;
  }
  try {
    const { code, regenerated } = await runCheck({ root: findProject(process.cwd()).root, style });
    if (regenerated.length) process.stdout.write(`지금 브랜드 색으로 다시 만든 파일: ${regenerated.join(", ")}\n`);
    if (code === 0) process.stdout.write(`milvus check${style ? " --style" : ""} 통과\n`);
    return code;
  } catch (e) {
    process.stderr.write(`milvus check 실패: ${(e as Error).message}\n`);
    return 1;
  }
}
