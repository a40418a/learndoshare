#!/usr/bin/env node
// milvus CLI 진입점. 명령은 cli/<명령>.ts에 하나씩 둔다
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { checkCommand } from "./check.ts";
import { packageInfo } from "./context.ts";
import { runDeploy } from "./deploy.ts";
import { runInit } from "./init.ts";
import { runStorybook } from "./storybook.ts";
import { runUpdate } from "./update.ts";

const USAGE =
  "사용법: milvus --version | milvus init --target-org <별칭> (--brand <이름> | --from-org) [--no-vf] | milvus check [--style] | milvus storybook [build] | milvus deploy [--target-org <별칭>] [--yes] | milvus update [--force]";

export async function main(argv: string[]): Promise<number> {
  if (argv[0] === "init") return runInit(argv.slice(1));
  if (argv[0] === "check") return checkCommand(argv.slice(1));
  if (argv[0] === "storybook") return runStorybook(argv.slice(1));
  if (argv[0] === "deploy") return runDeploy(argv.slice(1));
  if (argv[0] === "update") return runUpdate(argv.slice(1));
  // strict: false — 명령별 옵션(--target-org 등)은 각 명령이 읽는다
  const { values, positionals } = parseArgs({
    args: argv,
    options: { version: { type: "boolean" } },
    allowPositionals: true,
    strict: false
  });
  if (values.version) {
    process.stdout.write(`${packageInfo().version}\n`);
    return 0;
  }
  const command = positionals[0] ?? argv[0];
  process.stderr.write(command ? `알 수 없는 명령입니다: ${command}\n${USAGE}\n` : `${USAGE}\n`);
  return 1;
}

// import.meta.main은 v22.18.0·v24.2.0에 들어왔다. engines가 허용하는 23.6~24.1에는 없어서 실행 경로를 비교한다.
// bin shim·심볼릭 링크를 거쳐도 맞도록 양쪽을 실제 경로로 바꾼다
export function isEntryPoint(meta: { main?: boolean; url: string }, argv1: string | undefined): boolean {
  if (meta.main !== undefined) return meta.main;
  if (argv1 === undefined) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(meta.url));
  } catch {
    // ponytail: 없는 경로(import만 한 경우의 임의 인자)는 진입이 아니다. 한계: 23.6~24.1에서 `node dist/cli/index`처럼
    // 확장자 없이 실행하면 출력 없이 끝난다. engines를 >=24.2.0으로 좁히면 이 fallback을 지운다
    return false;
  }
}

if (isEntryPoint(import.meta, process.argv[1])) process.exitCode = await main(process.argv.slice(2));
