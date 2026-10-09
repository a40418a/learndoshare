// prepack이 실행한다: SLDS 2 CSS와 기본 컴포넌트 CSS가 var()로 읽는 hook 이름을 dist/hooks-index.json에 쓴다.
// 설치된 프로젝트의 check --style은 이 파일만 읽고 원본 CSS를 다시 파싱하지 않는다(lib/hooks-index.ts)
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hooksIndexFromSource } from "../lib/hooks-index.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "dist/hooks-index.json");
const index = hooksIndexFromSource(root);
mkdirSync(dirname(out), { recursive: true });
// 같은 때 이 파일을 읽는 검사가 반쯤 쓴 JSON을 보지 않게 임시 파일에 쓰고 이름을 바꾼다
const tmp = `${out}.${process.pid}.tmp`;
writeFileSync(tmp, JSON.stringify(index));
renameSync(tmp, out);
console.log(`dist/hooks-index.json: s hook ${index.readSHooks.length}개, g hook ${index.readGHooks.length}개`);
