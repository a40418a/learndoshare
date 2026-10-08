#!/usr/bin/env node
// milvus CLI 진입점. 명령은 cli/<명령>.ts에 하나씩 둔다
import { readFileSync } from "node:fs";
import { findPackageJSON } from "node:module";
import { parseArgs } from "node:util";

const USAGE = "사용법: milvus --version";

// 저장소(cli/index.ts)와 패키지(dist/cli/index.js) 모두 가장 가까운 package.json이 이 패키지의 것이다
function readVersion(): string {
  const path = findPackageJSON(import.meta.url);
  if (!path) throw new Error("package.json을 찾지 못했습니다");
  return JSON.parse(readFileSync(path, "utf8")).version;
}

export async function main(argv: string[]): Promise<number> {
  // strict: false — 명령별 옵션(--target-org 등)은 각 명령이 읽는다
  const { values, positionals } = parseArgs({
    args: argv,
    options: { version: { type: "boolean" } },
    allowPositionals: true,
    strict: false
  });
  if (values.version) {
    process.stdout.write(`${readVersion()}\n`);
    return 0;
  }
  const command = positionals[0] ?? argv[0];
  process.stderr.write(command ? `알 수 없는 명령입니다: ${command}\n${USAGE}\n` : `${USAGE}\n`);
  return 1;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
