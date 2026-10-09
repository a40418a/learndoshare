// milvus check (설계 4.3, 10장)
// - --style: hook이 milvusBrand.css·milvusOverride.css·브랜드 메타데이터를 고칠 때마다 실행한다. util.css 규칙·대비(5.2, 5.3)와
//   milvusOverride.css(5.1)만 보고, hook 이름은 설치된 패키지의 dist/hooks-index.json에서 읽는다(lib/hooks-index.ts).
//   실패하면 2(Claude Code가 stderr를 Claude에게 보여 준다)
// - 전체: deploy와 CI가 실행한다. --style 항목 + 밀버스 관리 파일 sha256(milvus.config.json). 실패하면 1.
//   밀버스 LWC는 JS라 타입 검사는 하지 않는다(10/9 D1). milvusVf.css 다시 만들기는 Task 24에서 붙인다
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadRuleContext } from "../lib/hooks-index.ts";
import { sha256 } from "../lib/managed.ts";
import { checkOverrideCss, checkUtilCss, type Issue } from "../lib/rules.ts";
import { findProject, packageInfo, readConfig } from "./context.ts";

const RES = "force-app/main/default/staticresources";
const BRAND_CSS = `${RES}/milvusBrand.css`;
const OVERRIDE_CSS = `${RES}/milvusOverride.css`;
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
    return [{ file, rule: "managed", message: `밀버스 관리 파일을 ${what}. pnpm milvus update --force로 패키지 원본으로 되돌리세요` }];
  });
}

/**
 * 검사 결과를 stderr에 쓰고 종료 코드를 돌려준다. issues는 실패시키는 문제만 담는다(override 경고는 stderr에만).
 * pkgRoot는 dist/hooks-index.json을 찾을 패키지 폴더다. 기본은 이 패키지다
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
  issues.push(...errors);
  if (!o.style) issues.push(...managedIssues(o.root));

  if (warnings.length) {
    process.stderr.write(
      `milvusOverride.css 경고 ${warnings.length}개. 공식 권고 밖인 opt-in 파일이라 막지 않지만, native 전환이나 Salesforce 업데이트 때 깨질 수 있습니다:\n${lines(warnings)}`,
    );
  }
  if (issues.length) process.stderr.write(`milvus check${o.style ? " --style" : ""}: 고칠 것 ${issues.length}개\n${lines(issues)}`);
  return { code: issues.length ? (o.style ? 2 : 1) : 0, issues, regenerated: [] };
}

/** pnpm milvus check [--style]. sfdx-project.json이 있는 폴더를 위로 찾아 검사한다 */
export async function checkCommand(argv: string[]): Promise<number> {
  try {
    let style: boolean;
    try {
      style = parseArgs({ args: argv, options: { style: { type: "boolean" } } }).values.style === true;
    } catch {
      throw new Error(`옵션이 올바르지 않습니다(알 수 없는 옵션 또는 남는 인자): ${argv.join(" ")}`);
    }
    const { code } = await runCheck({ root: findProject(process.cwd()).root, style });
    if (code === 0) process.stdout.write(`milvus check${style ? " --style" : ""} 통과\n`);
    return code;
  } catch (e) {
    process.stderr.write(`milvus check 실패: ${(e as Error).message}\n${USAGE}\n`);
    return 1;
  }
}
