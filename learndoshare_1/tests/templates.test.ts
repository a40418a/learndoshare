import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPEC_ITEMS } from "../lib/spec-items.ts";

const read = (path: string) => readFileSync(new URL(`../templates/${path}`, import.meta.url), "utf8");
const design = read("milvus-design.md");
const skill = read("claude/skills/milvus-brand/SKILL.md");

// 설계 7.1의 8개 절
const SECTIONS = ["이 프로젝트의 밀버스 설정", "준비물", "세팅 순서", "파일 지도", "디자인 규칙", "Claude에게 시키는 법", "배포 안전장치", "업데이트와 문제 해결"];
const section = (md: string, n: number) => md.split(/^## /m).find((s) => s.startsWith(`${n}. `)) ?? "";

test("milvus-design.md는 200줄 이하이고 8개 절 제목이 있다", () => {
  const lines = design.trimEnd().split("\n").length;
  assert.ok(lines <= 200, `${lines}줄`);
  const titles = [...design.matchAll(/^## (\d+)\. (.+)$/gm)].map((m) => `${m[1]}. ${m[2]}`);
  assert.deepEqual(titles, SECTIONS.map((t, i) => `${i + 1}. ${t}`));
  // 1절은 값을 쓰지 않고 원본(milvus.config.json)만 가리킨다
  assert.ok(section(design, 1).includes("milvus.config.json"));
});

test("milvus-design.md 3절에 배포 뒤 할 일 두 가지가 있다: VF 설정 이름 'Use SLDS 2 for pages that include <apex:slds>'과 App Manager의 milvusBrandLoader·'앱이 열릴 때 백그라운드로 로드'(10/9 D2·D3)", () => {
  const s3 = section(design, 3);
  assert.ok(s3.includes("Use SLDS 2 for pages that include `<apex:slds>` when an SLDS 2 theme is active"));
  for (const w of ["App Manager", "milvusBrandLoader", "앱이 열릴 때 백그라운드로 로드"]) assert.ok(s3.includes(w), w);
});

test("milvus-design.md 4절에 커밋된 hook은 팀원에게도 별도 동의 없이 실행된다는 안내가 있다(설계 7.2)", () => {
  const s4 = section(design, 4);
  assert.match(s4, /hook은[^\n]*팀원에게도 별도 동의 없이 실행된다/);
  // 그래서 hook은 하나만 둔다
  assert.match(s4, /hook은 `milvus-check\.mjs` 하나만 둔다/);
});

// Claude Code 권한 규칙의 Bash 와일드카드를 옮긴 근사(code.claude.com/docs/en/permissions "Wildcard patterns", 확인 2026-10-14):
// `*`는 공백을 포함한 아무 글자나 맞고, 와일드카드가 끝의 ` *` 하나뿐이면 인자 없는 명령도 맞는다
const bashRule = (rule: string) => {
  const body = /^Bash\((.*)\)$/.exec(rule)?.[1];
  if (body === undefined) return undefined;
  const re = body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body.endsWith(" *") && body.indexOf("*") === body.length - 1 ? `${re.slice(0, -3)}( .*)?` : re}$`);
};

test("settings.json deny는 토큰을 출력하는 sf org display·sf org open --url-only(-r)·--json·sf org list --json·sf auth list --json을 옵션 위치와 상관없이 막고, --json 없는 목록은 막지 않는다", () => {
  const deny: string[] = JSON.parse(read("claude/settings.json")).permissions.deny;
  const rules = deny.map(bashRule).filter((r) => r !== undefined);
  const denied = (cmd: string) => rules.some((r) => r.test(cmd));
  const tokenCommands = ["sf org display", "sf org display --json", "sf org list --json", "sf org list --json --all", "sf org list --all --json"];
  tokenCommands.push("sf org list --all --json --skip-connection-status", "sf org list auth --json", "sf auth list --json", "sf auth list --loglevel warn --json", "sf auth list --loglevel warn --json --dev-debug");
  // sf org open은 --url-only(-r)와 --json에서 front door URL을 출력한다(plugin-org src/shared/orgOpenCommandBase.ts의 output)
  tokenCommands.push("sf org open --url-only", "sf org open --target-org x --url-only", "sf org open -o x --url-only --path /home", "sf org open -r -o x", "sf org open -o x -r", "sf org open -o x -r -p /home");
  tokenCommands.push("sf org open --json", "sf org open -o x --json", "sf org open -o x --json --path /home");
  for (const cmd of tokenCommands) assert.ok(denied(cmd), cmd);
  // 설계 4.4: 대상 org가 없으면 sf org list로 별칭을 확인하라고 안내한다. 표 출력에는 토큰이 없다.
  // deploy가 출력하는 확인 명령 sf org open --path …는 브라우저만 연다
  for (const cmd of ["sf org list", "sf org list --all", "sf auth list", "sf org open --target-org x --path /lightning/page/home"]) assert.ok(!denied(cmd), cmd);
});

test("SKILL.md frontmatter에 name과 description이 있다", () => {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(skill)?.[1] ?? "";
  assert.match(fm, /^name: milvus-brand$/m);
  const description = /^description: (.+)$/m.exec(fm)?.[1] ?? "";
  // 브랜드 요청 반영과 입력 형식 5종(설계 6.4)
  for (const w of ["브랜드 요청", "자연어", "디자인 토큰", "Figma", "PDF", "이미지", "URL"]) assert.ok(description.includes(w), w);
});

test("SKILL.md의 hook·브리지 변수 이름은 모두 SPEC_ITEMS에 있다", () => {
  // SPEC_ITEMS의 hooks·bridgeVars와 설명·한계 문장에 나오는 이름(포커스 링 색)
  const known = new Set(JSON.stringify(SPEC_ITEMS).match(/--[\w-]+/g));
  // 예외 1: 5.2 규칙 설명에만 나오는 이름. shadow-4를 바꾸면 포커스 표시가 쓰는 -5·-6을 따로 적는다
  for (const n of ["--slds-g-shadow-5", "--slds-g-shadow-6"]) known.add(n);
  // 패턴(`--slds-c-*`)은 빼고 완성된 이름만 본다
  const names = skill.match(/--(?:slds|sds|milvus)-[\w-]*\w(?![\w*<-])/g) ?? [];
  assert.ok(names.length > 50, `${names.length}개`);
  assert.deepEqual([...new Set(names)].filter((n) => !known.has(n)), []);
});

// 이름은 요청 파일의 절 제목(SPEC_ITEMS.label, lib/request.ts)과 같아야 skill이 절을 항목에 맞춘다
test("SKILL.md 4장 표의 행은 SPEC_ITEMS 항목과 1:1이고 이름은 label과 같다", () => {
  const rows = [...skill.matchAll(/^\| ([^|]*?) \(`([\w-]+)`\) \|/gm)].map((m) => `${m[1]} (${m[2]})`);
  assert.deepEqual(rows.toSorted(), SPEC_ITEMS.map((i) => `${i.label} (${i.id})`).toSorted());
});

test("SKILL.md는 'pnpm milvus deploy --yes'를 채팅 승인 뒤에만 실행하라고 적는다", () => {
  const yesLines = skill.split("\n").filter((l) => l.includes("pnpm milvus deploy --yes"));
  assert.ok(yesLines.length > 0);
  for (const l of yesLines) assert.match(l, /채팅.*승인/, l);
  // 계획을 보여 주는 --yes 없는 명령이 먼저 나온다
  const plan = skill.search(/pnpm milvus deploy(?! --yes)/);
  assert.ok(plan >= 0 && plan < skill.indexOf("pnpm milvus deploy --yes"));
});
