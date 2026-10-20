// 명령들이 함께 쓰는 것: 패키지 위치, SFDX 프로젝트 찾기, milvus.config.json, sf 실행
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { dirname, join, resolve } from "node:path";

export type MilvusConfig = { version: string; targetOrg: string; brand: string; vf: boolean; managed: Record<string, string> };
export type SfRunner = (args: string[], cwd: string) => Promise<{ code: number; stdout: string; stderr: string }>;

const CONFIG = "milvus.config.json";

/** 이 패키지의 루트와 버전. 저장소(cli/*.ts)와 패키지(dist/cli/*.js) 모두 가장 가까운 package.json이 이 패키지의 것이다 */
export function packageInfo(): { root: string; version: string } {
  const path = findPackageJSON(import.meta.url);
  if (!path) throw new Error("package.json을 찾지 못했습니다");
  return { root: dirname(path), version: JSON.parse(readFileSync(path, "utf8")).version };
}

/** cwd에서 위로 올라가며 sfdx-project.json을 찾는다. defaultPackageDir는 앞의 ./와 끝의 /를 뺀 기본 패키지 폴더다 */
export function findProject(cwd: string): { root: string; defaultPackageDir: string } {
  for (let dir = resolve(cwd); ; dir = dirname(dir)) {
    const file = join(dir, "sfdx-project.json");
    if (existsSync(file)) {
      let project;
      try {
        project = JSON.parse(readFileSync(file, "utf8"));
      } catch (e) {
        throw new Error(`sfdx-project.json이 올바른 JSON이 아닙니다: ${(e as Error).message}`);
      }
      const dirs: { path?: unknown; default?: unknown }[] = Array.isArray(project?.packageDirectories) ? project.packageDirectories : [];
      const pkg = dirs.find((d) => d?.default === true) ?? dirs[0];
      if (typeof pkg?.path !== "string") throw new Error("sfdx-project.json에 packageDirectories의 path가 없습니다");
      return { root: dir, defaultPackageDir: pkg.path.replace(/^\.\//, "").replace(/\/+$/, "") };
    }
    if (dirname(dir) === dir) throw new Error(`sfdx-project.json을 찾지 못했습니다. SFDX 프로젝트 폴더에서 실행하세요: ${cwd}`);
  }
}

/** milvus.config.json. 없으면 undefined, 형식이 틀리면 던진다 */
export function readConfig(root: string): MilvusConfig | undefined {
  const file = join(root, CONFIG);
  if (!existsSync(file)) return undefined;
  let c;
  try {
    c = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    throw new Error(`${CONFIG}이 올바른 JSON이 아닙니다: ${(e as Error).message}`);
  }
  const ok =
    typeof c?.version === "string" && typeof c.targetOrg === "string" && typeof c.brand === "string" &&
    typeof c.vf === "boolean" && typeof c.managed === "object" && c.managed !== null && !Array.isArray(c.managed);
  if (!ok) throw new Error(`${CONFIG} 형식이 올바르지 않습니다. pnpm milvus init을 다시 실행하세요`);
  return c;
}

/**
 * 프로젝트에 놓인 밀버스 파일의 버전(milvus.config.json)이 pkgRoot 패키지와 같은지 본다. 다르면 update 안내로 던진다.
 * 패키지만 올리고 update를 안 하면 패키지 스토리가 프로젝트에 아직 없는 c/milvus*를 import해 원인이 안 보이는 빌드 오류가 난다
 */
export function assertSameVersion(config: MilvusConfig, pkgRoot: string): void {
  const { version } = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as { version?: string };
  if (config.version !== version) {
    throw new Error(`설치된 패키지(${version})와 프로젝트에 놓인 밀버스 파일(${config.version})의 버전이 다릅니다. pnpm milvus update를 먼저 실행하세요`);
  }
}

export function writeConfig(root: string, c: MilvusConfig): void {
  writeFileSync(join(root, CONFIG), `${JSON.stringify(c, null, 2)}\n`);
}

/** sf를 인자 배열로 실행한다(셸을 거치지 않아 경로의 공백·한글이 그대로 간다). sf를 찾지 못하면 code 127 */
export const runSf: SfRunner = (args, cwd) =>
  new Promise((done) => {
    // ponytail: Windows의 sf는 sf.cmd라 셸 없이 spawn하면 찾지 못한다(127). Windows 사용자가 생기면 sf.cmd와 인자 인용을 처리한다
    const child = spawn("sf", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => done({ code: 127, stdout, stderr: e.message }));
    child.on("close", (code) => done({ code: code ?? 1, stdout, stderr }));
  });
