// milvus update [--force] (설계 4.5, 10장). 설치된 패키지의 [관리] 파일을 프로젝트에 반영한다. 전부 반영하거나 아무것도 바꾸지 않는다.
// - [소유](milvusBrand.css, milvusOverride.css, BrandingSet 등)는 건드리지 않는다. 사람과 skill이 고치는 파일이다
// - [생성](milvusVf.css 등)도 건드리지 않는다. 패키지에 있는 것은 틀이고, 실제 내용은 check·deploy가 지금 BRAND_COLOR로 다시 만든다.
//   틀로 덮어쓰면 브랜드 팔레트가 사라진다
// - 새 패키지에 없는 관리 파일은 milvus.config.json의 managed에서만 빼고 파일은 지우지 않는다. 설계에 삭제 규칙이 없고,
//   org에 배포된 컴포넌트를 쓰는 화면이 있을 수 있어 지울지는 사람이 정한다
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { managedFiles, sha256 } from "../lib/managed.ts";
import { findProject, packageInfo, readConfig, writeConfig, type MilvusConfig } from "./context.ts";
import { applyOps, settingsOp } from "./init.ts";

const USAGE = "사용법: pnpm milvus update [--force]";

// ponytail: 전체 diff 대신 처음 달라진 줄 하나와 줄 수만 보인다. 자세한 차이는 패키지 원본과 diff 도구로 비교한다
function diffSummary(local: string, next: string): string {
  const a = local.split("\n");
  const b = next.split("\n");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const cut = (s: string | undefined) => (s === undefined ? "(파일 끝)" : s.length > 100 ? `${s.slice(0, 100)}…` : s);
  return `${i + 1}번째 줄부터 다릅니다(로컬 ${a.length}줄, 패키지 ${b.length}줄)\n    - 로컬: ${cut(a[i])}\n    + 패키지: ${cut(b[i])}`;
}

/**
 * 새 패키지(pkgRoot)의 [관리] 파일 중 바꿀 것(replace)과 로컬 수정이 있어 그냥 바꿀 수 없는 것(conflicts). 파일을 쓰지 않는다.
 * 판단 근거는 milvus.config.json의 managed(init·update가 놓은 패키지 원본의 sha256)다
 */
export function planUpdate(o: { root: string; pkgRoot: string; config: MilvusConfig }): { replace: string[]; conflicts: { path: string; diff: string }[] } {
  const replace: string[] = [];
  const conflicts: { path: string; diff: string }[] = [];
  for (const f of managedFiles(o.pkgRoot, { vf: o.config.vf })) {
    if (f.kind !== "managed" || !f.src) continue;
    const path = join(o.root, f.dest);
    // 없는 파일은 잃을 로컬 수정이 없어 복구한다(check가 "없습니다"라고 알린 파일, 새 버전에 생긴 파일)
    if (!existsSync(path)) {
      replace.push(f.dest);
      continue;
    }
    const local = readFileSync(path);
    const next = readFileSync(f.src);
    const hash = sha256(local);
    if (hash === sha256(next)) continue;
    // 기록한 sha256과 같으면 패키지가 놓은 그대로라 바꿔도 잃는 것이 없다. 다르면 로컬에서 고친 것이다.
    // 기록이 없는 경로(새 버전이 추가한 관리 파일)에 다른 내용의 파일이 이미 있으면 사용자 파일이라 충돌로 본다
    if (hash === o.config.managed[f.dest]) replace.push(f.dest);
    else conflicts.push({ path: f.dest, diff: diffSummary(local.toString("utf8"), next.toString("utf8")) });
  }
  return { replace, conflicts };
}

export async function runUpdate(argv: string[], deps: { pkg?: { root: string; version: string } } = {}): Promise<number> {
  try {
    let force: boolean;
    try {
      force = parseArgs({ args: argv, options: { force: { type: "boolean" } } }).values.force === true;
    } catch {
      throw new Error(`옵션이 올바르지 않습니다(알 수 없는 옵션 또는 남는 인자): ${argv.join(" ")}`);
    }
    const { root } = findProject(process.cwd());
    const config = readConfig(root);
    if (!config) throw new Error("milvus.config.json이 없습니다. pnpm milvus init을 먼저 실행하세요");
    const pkg = deps.pkg ?? packageInfo();
    const { replace, conflicts } = planUpdate({ root, pkgRoot: pkg.root, config });
    if (conflicts.length && !force) {
      const list = conflicts.map((c) => `  ${c.path}\n    ${c.diff}\n`).join("");
      process.stderr.write(
        `milvus update: 직접 고친 밀버스 관리 파일 ${conflicts.length}개가 있어 아무 파일도 바꾸지 않았습니다.\n${list}` +
          "고친 내용이 필요하면 다른 곳에 옮겨 둔 뒤, pnpm milvus update --force로 패키지 원본으로 덮어쓰세요\n",
      );
      return 1;
    }

    // 쓰기 전에 모든 내용을 읽는다
    const files = managedFiles(pkg.root, { vf: config.vf }).filter((f) => f.kind === "managed" && f.src);
    const src = new Map(files.map((f) => [f.dest, f.src!]));
    const writes = [...replace, ...conflicts.map((c) => c.path)].map((dest) => ({ dest, data: readFileSync(src.get(dest)!) }));
    const managed = Object.fromEntries(files.map((f) => [f.dest, sha256(readFileSync(f.src!))]));
    const dropped = Object.keys(config.managed).filter((dest) => !Object.hasOwn(managed, dest));

    // settings 병합이 먼저다. 기존 settings.json이 깨졌으면 applyOps가 쓰기 전에 던져 아무것도 바뀌지 않는다.
    // ponytail: 그 뒤의 파일 쓰기는 트랜잭션이 아니다. 도중에 디스크 오류가 나면 일부만 바뀌지만, config를 마지막에 쓰므로
    // 다시 update하면 이미 쓴 파일은 새 원본과 같아 건너뛰고 나머지를 마친다
    const settings = applyOps(root, [settingsOp(pkg.root)]).written;
    for (const w of writes) {
      mkdirSync(dirname(join(root, w.dest)), { recursive: true });
      writeFileSync(join(root, w.dest), w.data);
    }
    writeConfig(root, { ...config, version: pkg.version, managed });

    const list = (paths: string[]) => paths.map((p) => `  - ${p}\n`).join("");
    process.stdout.write(
      `밀버스 update를 마쳤습니다. 버전 ${config.version} → ${pkg.version}\n` +
        (writes.length ? `바꾼 밀버스 관리 파일 ${writes.length}개${conflicts.length ? `(로컬 수정을 덮어쓴 ${conflicts.length}개 포함)` : ""}:\n${list(writes.map((w) => w.dest))}` : "바꾼 밀버스 관리 파일이 없습니다\n") +
        (settings.length ? ".claude/settings.json에 새 permissions·hook을 병합했습니다\n" : "") +
        (dropped.length
          ? `새 패키지에 없는 관리 파일 ${dropped.length}개를 milvus.config.json에서 뺐습니다. 파일은 지우지 않았습니다. 쓰지 않으면 직접 지우세요(org에 배포한 것은 따로 지워야 합니다):\n${list(dropped)}`
          : "") +
        (writes.length ? "org에 반영하려면 pnpm milvus deploy로 계획을 확인하세요\n" : ""),
    );
    return 0;
  } catch (e) {
    process.stderr.write(`milvus update 실패: ${(e as Error).message}\n${USAGE}\n`);
    return 1;
  }
}
