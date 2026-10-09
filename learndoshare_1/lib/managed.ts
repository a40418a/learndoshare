// init이 프로젝트에 놓는 밀버스 파일 목록 (설계 3장의 표시)
// - managed [관리]: 패키지 원본을 복사하고 sha256을 기록한다. 직접 고치지 않는다(permissions.deny), update가 갱신한다
// - owned [소유]: 없을 때만 복사한다. 그 뒤로는 skill과 사람이 고친다
// - generated [생성]: CLI가 만들고 다시 쓴다. src가 있으면 init이 처음 놓는 틀이다
// 병합·줄 추가·키 추가 대상(CLAUDE.md, .claude/settings.json, .gitignore 등)과 브랜드 이름이 들어가는 파일(BrandingSet, 테마, 로고)은
// 기존 내용이나 입력에 따라 달라서 init이 따로 다룬다
import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

export type ManagedFile = { dest: string; kind: "managed" | "owned" | "generated"; src?: string; optional?: "vf" };

const FA = "force-app/main/default";
const RES = `${FA}/staticresources`;

// dir 아래 파일의 상대 경로(/ 구분). __tests__와 점으로 시작하는 파일(.DS_Store 등)은 패키지에 들어가지 않으므로 뺀다
function filesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .map((e) => relative(dir, join(e.parentPath, e.name)).split(sep).join("/"))
    .filter((rel) => !rel.split("/").includes("__tests__"))
    .sort();
}

/** 상대 경로는 / 구분, 프로젝트 루트 기준이다. src는 pkgRoot 안의 절대 경로다 */
export function managedFiles(pkgRoot: string, o: { vf: boolean }): ManagedFile[] {
  const tpl = (path: string) => join(pkgRoot, "templates", path);
  const copy = (dest: string, kind: ManagedFile["kind"], src = tpl(dest)): ManagedFile => ({ dest, kind, src });
  const fromPackage = (dir: string) => filesIn(join(pkgRoot, dir)).map((rel) => copy(`${dir}/${rel}`, "managed", join(pkgRoot, dir, rel)));

  const lwc = join(pkgRoot, FA, "lwc");
  const bundles = readdirSync(lwc, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith("milvus"))
    .map((e) => e.name)
    .sort();

  const files: ManagedFile[] = [
    copy("milvus-design.md", "managed"),
    copy(".claude/skills/milvus-brand/SKILL.md", "managed", tpl("claude/skills/milvus-brand/SKILL.md")),
    copy(".claude/hooks/milvus-check.mjs", "managed", tpl("claude/hooks/milvus-check.mjs")),
    { dest: "milvus.config.json", kind: "generated" },
    copy(`${FA}/lwc/tsconfig.json`, "managed"),
    ...bundles.flatMap((b) => fromPackage(`${FA}/lwc/${b}`)),
    ...fromPackage(`${FA}/classes/utils/design`),
    copy(`${RES}/milvusBridge.css`, "managed"),
    copy(`${RES}/milvusBridge.resource-meta.xml`, "managed"),
    copy(`${RES}/milvusBrand.css`, "owned"),
    copy(`${RES}/milvusBrand.resource-meta.xml`, "owned"),
    copy(`${RES}/milvusOverride.css`, "owned"),
    copy(`${RES}/milvusOverride.resource-meta.xml`, "owned"),
  ];
  if (o.vf) {
    files.push(
      { ...copy(`${FA}/components/milvusHead.component`, "managed"), optional: "vf" },
      { ...copy(`${FA}/components/milvusHead.component-meta.xml`, "managed"), optional: "vf" },
      // check(전체)와 deploy가 지금 브랜드 색으로 다시 만든다. init은 milvusHead가 참조할 수 있게 틀을 놓는다(설계 3장)
      { ...copy(`${RES}/milvusVf.css`, "generated"), optional: "vf" },
      { ...copy(`${RES}/milvusVf.resource-meta.xml`, "generated"), optional: "vf" },
    );
  }
  return files;
}

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}
