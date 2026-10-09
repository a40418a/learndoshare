// 밀버스 PostToolUse hook(설계 7.2). Edit·Write로 milvusBrand.css·milvusOverride.css·브랜드 메타데이터(brandingSets/)를 고쳤을 때만
// pnpm milvus check --style을 실행하고 종료 코드와 stderr를 그대로 넘긴다. 2면 Claude Code가 stderr(고칠 값)를 Claude에게 보여 준다
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";

let file;
try {
  file = JSON.parse(readFileSync(0, "utf8"))?.tool_input?.file_path;
} catch (e) {
  process.stderr.write(`milvus-check hook: 입력 JSON을 읽지 못했습니다: ${e.message}\n`);
  process.exit(1);
}
// 경로는 절대 경로이고 Windows에서는 \ 구분이다
const target = typeof file === "string" && /\/staticresources\/milvus(Brand|Override)\.css$|\/brandingSets\//.test(file.replaceAll("\\", "/"));
if (target) {
  // 고친 파일의 폴더에서 실행한다. check가 위로 올라가며 sfdx-project.json을 찾는다(worktree에서도 그 파일의 프로젝트를 본다).
  // Windows의 pnpm은 pnpm.cmd라 셸로 실행한다. 인자는 고정 문자열이고 경로는 cwd로만 넘긴다
  const r = spawnSync("pnpm", ["milvus", "check", "--style"], {
    cwd: dirname(file),
    stdio: ["ignore", "inherit", "inherit"],
    shell: process.platform === "win32",
  });
  if (r.error) process.stderr.write(`milvus-check hook: pnpm milvus check --style을 실행하지 못했습니다: ${r.error.message}\n`);
  process.exitCode = r.status ?? 1;
}
