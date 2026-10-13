// milvus storybook (설계 4.2, 프로젝트 모드). 고객 프로젝트의 LWC와 SLDS 카탈로그를 <root>/.milvus/lwc로 빌드한 뒤,
// 패키지 안의 .storybook 설정으로 Storybook을 띄운다(build면 정적 빌드). 설정은 MILVUS_PROJECT_DIR로 프로젝트 모드가 된다(Task 17).
// 실행은 셸 없이 node로 storybook bin을 직접 부른다(공백·한글 경로 안전, Windows DEP0190 회피)
import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { constants } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { buildLwc, catalogModules, lightningBaseComponentsDir, sfdxLwcModules } from "../lib/lwc-build.ts";
import { findProject, packageInfo, readConfig } from "./context.ts";

const USAGE = "사용법: pnpm milvus storybook [build]";
// 정적 빌드 출력. init이 .gitignore에 넣는 .milvus/ 안이라 따로 무시 설정을 하지 않아도 커밋되지 않는다
const BUILD_OUT = ".milvus/storybook-static";

// 패키지 의존성의 storybook 실행 파일. 패키지 위치에서 찾으므로 고객 프로젝트에 storybook이 없어도 된다
function storybookBin(): string {
  const file = createRequire(import.meta.url).resolve("storybook/package.json");
  const { bin } = JSON.parse(readFileSync(file, "utf8")) as { bin: string | Record<string, string> };
  return join(dirname(file), typeof bin === "string" ? bin : bin.storybook);
}

/**
 * 실행 계획. 파일은 쓰지 않는다(읽기만). build는 정적 빌드 출력 폴더(root 기준)이고 없으면 dev 서버다.
 * env는 process.env에 더할 값이다. -c에는 패키지 설정 폴더의 realpath를 넘긴다(Task 3. pnpm 심볼릭 링크 안에서도 같은 폴더).
 * dev 서버는 localhost에만 연다. 인자가 없으면 Storybook이 모든 인터페이스에 열어 같은 네트워크의 다른 PC가 /@fs/로 고객 소스를 읽는다
 */
export function planStorybook(o: { root: string; pkgRoot: string; build?: string }): {
  env: Record<string, string>;
  lwc: Parameters<typeof buildLwc>[0];
  command: string;
  args: string[];
} {
  const catalog = join(o.pkgRoot, "stories/slds-catalog");
  const config = join(o.pkgRoot, ".storybook");
  for (const need of [join(catalog, "examples.json"), config]) {
    if (!existsSync(need)) throw new Error(`패키지 파일이 없습니다(${need}). 패키지를 다시 설치하세요`);
  }
  const examples = JSON.parse(readFileSync(join(catalog, "examples.json"), "utf8"));
  return {
    // 심볼릭 링크 폴더 안의 프로젝트도 Vite fs.allow와 실경로로 풀린 모듈 경로가 같도록 실경로를 넘긴다
    env: { MILVUS_PROJECT_DIR: realpathSync(o.root) },
    lwc: {
      out: join(o.root, ".milvus/lwc"),
      npmFromPackage: true,
      entries: { index: join(o.pkgRoot, "stories/lwc-entry.js"), catalog: join(catalog, "entry.js") },
      modules: [...sfdxLwcModules(o.root), ...catalogModules(examples, lightningBaseComponentsDir())]
    },
    command: process.execPath,
    args: [
      storybookBin(),
      o.build === undefined ? "dev" : "build",
      "-c",
      realpathSync(config),
      ...(o.build === undefined ? ["--host", "localhost"] : ["-o", resolve(o.root, o.build)])
    ]
  };
}

/**
 * pnpm milvus storybook [build]. sfdx-project.json이 있는 폴더를 위로 찾고 milvus.config.json이 있어야 한다.
 * LWC 빌드가 실패하면 Storybook을 띄우지 않는다. Storybook의 종료 코드를 그대로 돌려준다.
 * deps는 테스트용이다: cwd(시작 폴더), pkgRoot(패키지 폴더)
 */
export async function runStorybook(argv: string[], deps: { spawn?: typeof spawn; cwd?: string; pkgRoot?: string } = {}): Promise<number> {
  let build: boolean;
  try {
    const { values, positionals } = parseArgs({ args: argv, options: { build: { type: "boolean" } }, allowPositionals: true });
    if (positionals.length > 1 || (positionals[0] ?? "build") !== "build") throw new Error("알 수 없는 인자");
    build = values.build === true || positionals.length > 0;
  } catch {
    process.stderr.write(`milvus storybook 실패: 옵션이 올바르지 않습니다: ${argv.join(" ")}\n${USAGE}\n`);
    return 1;
  }

  let root: string;
  try {
    root = findProject(deps.cwd ?? process.cwd()).root;
    if (!readConfig(root)) throw new Error("milvus.config.json이 없습니다");
  } catch (e) {
    // readConfig의 오류 문구에는 init 안내가 이미 있는 것이 있다
    const message = (e as Error).message;
    process.stderr.write(`milvus storybook 실패: ${message}${message.includes("milvus init") ? "" : "\n프로젝트에 밀버스를 준비하려면 pnpm milvus init을 먼저 실행하세요"}\n`);
    return 1;
  }

  try {
    const plan = planStorybook({ root, pkgRoot: deps.pkgRoot ?? packageInfo().root, build: build ? BUILD_OUT : undefined });
    process.stdout.write(`LWC 빌드 중: ${plan.lwc.out}\n`);
    await buildLwc(plan.lwc);
    return await new Promise<number>((done) => {
      // cwd가 프로젝트라 Storybook 캐시(node_modules/.cache)와 오류 로그가 패키지 안이 아니라 프로젝트에 생긴다
      const child = (deps.spawn ?? spawn)(plan.command, plan.args, { cwd: root, env: { ...process.env, ...plan.env }, stdio: "inherit" });
      // 부모에게만 오는 종료 신호(kill, 작업 중지, 컨테이너 종료)는 자식에게 넘긴다. 안 넘기면 부모만 죽고 Storybook이 포트를 쥔 채 남는다.
      // Ctrl-C(SIGINT)는 터미널이 자식에게도 보내므로 두 번 보내지 않는다. 빈 핸들러는 부모가 자식이 끝날 때까지 살아 있게 한다
      const handlers = { SIGINT: () => {}, SIGTERM: () => child.kill("SIGTERM"), SIGHUP: () => child.kill("SIGHUP") } as const;
      for (const [signal, handler] of Object.entries(handlers)) process.on(signal, handler);
      const release = () => {
        for (const [signal, handler] of Object.entries(handlers)) process.off(signal, handler);
      };
      child.on("error", (e) => {
        release();
        process.stderr.write(`milvus storybook 실패: Storybook을 실행하지 못했습니다: ${e.message}\n`);
        done(1);
      });
      // 신호로 끝났으면 관례대로 128+신호 번호(Ctrl-C는 130)
      child.on("close", (code, signal) => {
        release();
        done(code ?? (signal ? 128 + constants.signals[signal] : 1));
      });
    });
  } catch (e) {
    process.stderr.write(`milvus storybook 실패: ${(e as Error).message}\n`);
    return 1;
  }
}
