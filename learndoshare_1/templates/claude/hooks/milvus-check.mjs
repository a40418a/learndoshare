// 밀버스 PostToolUse hook(설계 7.2). Edit·Write로 milvusBrand.css·milvusOverride.css·brandingSets/, LWC 컴포넌트의 .js·.html(모달 규칙)을
// 고쳤을 때만 설치된 패키지의 CLI로 milvus check --style을 실행한다(판정 R24·R25, Claude Code hooks 문서 2026-10-09 확인)
// - 2: stderr(고칠 값)를 그대로 넘기고 2로 끝난다. Claude Code가 stderr를 Claude에게 보여 준다
// - 0이고 경고(stderr)가 있으면: 0으로 끝난 hook의 stderr는 Claude에게 가지 않으므로 stdout JSON의 additionalContext로 넘긴다
// - 0이고 경고가 없으면 아무것도 쓰지 않는다(check의 stdout "통과" 줄도 넘기지 않는다). 그 밖은 stderr와 종료 코드를 넘긴다
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const PKG = "@a40418a/milvus-design-system";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch (e) {
  process.stderr.write(`milvus-check hook: 입력 JSON을 읽지 못했습니다: ${e.message}\n`);
  process.exit(1);
}
const file = input?.tool_input?.file_path;
// 경로는 절대 경로이고 Windows에서는 \ 구분이다
// LWC는 컴포넌트 폴더 바로 아래 파일만 본다(__tests__ 안은 보지 않는다)
if (typeof file === "string" && /\/staticresources\/milvus(Brand|Override)\.css$|\/brandingSets\/|\/lwc\/[^/]+\/[^/]+\.(js|html)$/.test(file.replaceAll("\\", "/"))) {
  // pnpm을 거치지 않는다(기동 약 0.3초, Windows의 pnpm.cmd에 셸이 필요한 문제). 프로젝트의 node_modules에서 패키지를 찾아 node로 직접 실행한다
  const start = process.env.CLAUDE_PROJECT_DIR || input.cwd;
  let cli;
  try {
    cli = join(dirname(createRequire(join(start, "package.json")).resolve(`${PKG}/package.json`)), "dist/cli/index.js");
    if (!existsSync(cli)) throw new Error(cli);
  } catch {
    process.stderr.write(`milvus-check hook: ${start}에서 ${PKG}을 찾지 못했습니다. pnpm install을 실행하세요\n`);
    process.exit(1);
  }
  // 고친 파일의 폴더에서 실행한다. check가 위로 올라가며 sfdx-project.json을 찾는다(worktree에서도 그 파일의 프로젝트를 본다)
  const r = spawnSync(process.execPath, [cli, "check", "--style"], { cwd: dirname(file), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status === 0) {
    if (r.stderr) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: r.stderr } }));
  } else {
    process.stderr.write(r.stderr || `milvus-check hook: milvus check --style을 실행하지 못했습니다: ${r.error?.message ?? r.signal}\n`);
    process.exitCode = r.status ?? 1;
  }
}
