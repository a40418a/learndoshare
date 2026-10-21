// 브랜드 요청 파일 docs/milvus/brand-request.md (설계 6.1). 명세 페이지(Storybook "시작하기/브랜드 명세")가 쓰고 milvus-brand skill이 읽는다.
// 형식: `# 브랜드 요청`, 머리 줄 `반영: <날짜>`(skill이 제목 바로 아래에 적음)·`저장: <날짜 시각>`, 항목마다 `## <제목>` 아래 `지금: …`(한 줄, 없을 수 있음)과 `요청: …`(여러 줄 가능)
// 요청의 앞뒤 공백(첫 줄 들여쓰기 포함)은 지운다. 안쪽 줄바꿈·빈 줄·들여쓰기·탭은 그대로 둔다
// 요청 안에서 `## `로 시작하는 줄(붙여 넣은 문서의 제목)은 `\## `로 적어 절이 깨지지 않게 한다. 이미 `\`로 시작하면 `\`를 하나 더 붙인다(읽을 때 하나 뗀다)
// 브라우저(Storybook)에서도 import하므로 Node 모듈을 쓰지 않는다
import { SPEC_ITEMS } from "./spec-items.ts";

export type BrandRequest = {
  appliedAt?: string;
  savedAt?: string;
  sections: { id: string; title: string; current?: string; request: string }[];
  /** 명세 항목이 아닌 머리 줄과 절(`## `로 시작하는 원문 그대로). 다시 쓸 때 머리 줄은 머리에, 절은 끝에 둔다 */
  unknown: string[];
};

export const FEEDBACK_KINDS = [
  ["success", "성공"],
  ["warning", "경고"],
  ["error", "오류"],
  ["info", "정보"],
] as const;

/** 요청 파일의 절. 입력이 있는 명세 항목마다 하나이고 피드백 색은 종류마다 하나다(`피드백 색 / 성공`). 제목은 SPEC_ITEMS의 label이다.
 *  입력이 없어진 항목(`## 모서리` 등, 2026-10-20 전에 저장한 세부 요청)의 절은 알 수 없는 절로 원문 그대로 남는다 */
export const REQUEST_SECTIONS: { id: string; title: string }[] = SPEC_ITEMS.filter((i) => i.input !== "none").flatMap((i) =>
  i.id === "feedback" ? FEEDBACK_KINDS.map(([kind, name]) => ({ id: `feedback-${kind}`, title: `${i.label} / ${name}` })) : [{ id: i.id, title: i.label }],
);

const TITLE = "# 브랜드 요청";
/** 바뀐 절 제목(옛 제목 → id). 읽을 때만 쓰고 다시 쓸 때는 지금 제목으로 적는다 */
const OLD_TITLES = new Map([["전체 스타일", "overall"]]);
const escapeHeadings = (text: string) => text.replace(/^(\\*## )/gm, "\\$1");
const unescapeHeadings = (text: string) => text.replace(/^\\(\\*## )/gm, "$1");

/** 옛 세부 절: 2026-10-20 전에 항목별 입력으로 저장한 절(`## 모서리` 등)과 둘째 옛 디자인 명세(`## 전체 스타일`). r.unknown 가운데 원문 그대로다.
 *  skill이 같은 제목을 그 항목으로 읽으므로 명세 페이지가 내용을 보여 준다. 디자인 명세가 우선한다(SKILL.md 1장) */
export function legacySections(r: BrandRequest): string[] {
  const titles = new Set([...SPEC_ITEMS.filter((i) => i.input === "none").map((i) => i.label), ...OLD_TITLES.keys()]);
  return r.unknown.filter((u) => u.startsWith("## ") && titles.has(u.slice(3).split("\n")[0].trim()));
}

export function parseRequest(md: string): BrandRequest {
  const r: BrandRequest = { sections: [], unknown: [] };
  const text = md.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const first = text.search(/^## /m);
  const head = first < 0 ? text : text.slice(0, first);
  const blocks = first < 0 ? [] : text.slice(first).split(/^(?=## )/m);

  // 머리: 빈 줄이 아닌 첫 줄의 제목과 빈 줄은 다시 쓸 때 새로 만든다. 반영·저장 줄은 머리 어디에 있어도 읽는다
  let firstLine = true;
  for (const line of head.split("\n")) {
    if (!line.trim()) continue;
    const isTitle = firstLine && line.startsWith("# ");
    firstLine = false;
    const m = /^(반영|저장):\s*(.*?)\s*$/.exec(line);
    if (isTitle) continue;
    if (m?.[1] === "반영") r.appliedAt = m[2];
    else if (m?.[1] === "저장") r.savedAt = m[2];
    else r.unknown.push(line);
  }

  const ids = new Map([...OLD_TITLES, ...REQUEST_SECTIONS.map((s) => [s.title, s.id] as const)]);
  for (const block of blocks) {
    const [heading, ...body] = block.trimEnd().split("\n");
    const id = ids.get(heading.slice(3).trim());
    const title = REQUEST_SECTIONS.find((s) => s.id === id)?.title ?? "";
    // 모르는 제목과 같은 제목의 둘째 절은 원문 그대로(안의 빈 줄 포함) 남긴다.
    // ponytail: 첫 절의 입력을 비우고 저장하면 다음에 읽을 때 둘째(옛) 절이 그 항목이 된다. 손으로 같은 제목을 두 번 쓴 경우만 생긴다
    if (!id || r.sections.some((s) => s.id === id)) {
      r.unknown.push(block.trimEnd());
      continue;
    }
    while (body.length && !body[0].trim()) body.shift();
    const current = body[0]?.startsWith("지금:") ? body.shift()!.slice("지금:".length).trim() : undefined;
    const request = unescapeHeadings(body.join("\n").trimStart().replace(/^요청:[ \t]*/, "").trim());
    r.sections.push(current === undefined ? { id, title, request } : { id, title, current, request });
  }
  return r;
}

/**
 * 명세 페이지가 저장할 요청(설계 6.1, 6.2의 6). fresh는 저장 직전에 다시 읽은 파일, inputs는 절 id → 입력이다.
 * 빈 입력은 빼고 반영 표시(appliedAt)는 지우고, 알 수 없는 줄·절은 fresh의 것을 쓴다.
 * current가 없으면(지금 값을 모를 때) fresh의 '지금:' 줄을 그대로 둔다. 있으면 그 값을 쓴다(undefined면 '지금:' 없음)
 */
export function saveRequest(fresh: BrandRequest, inputs: Map<string, string>, savedAt: string, current?: (id: string) => string | undefined): BrandRequest {
  const sections = REQUEST_SECTIONS.flatMap((s) => {
    const request = inputs.get(s.id)?.trim();
    if (!request) return [];
    const now = current ? current(s.id) : fresh.sections.find((f) => f.id === s.id)?.current;
    return [now ? { ...s, current: now, request } : { ...s, request }];
  });
  return { savedAt, sections, unknown: fresh.unknown };
}

export function serializeRequest(r: BrandRequest): string {
  const head = [TITLE];
  if (r.appliedAt) head.push(`반영: ${r.appliedAt}`);
  if (r.savedAt) head.push(`저장: ${r.savedAt}`);
  head.push(...r.unknown.filter((u) => !u.startsWith("## ")));
  const sections = r.sections.map((s) =>
    [`## ${s.title}`, ...(s.current ? [`지금: ${s.current.replace(/\s*\n\s*/g, " ")}`] : []), `요청: ${escapeHeadings(s.request)}`].join("\n"),
  );
  return `${[head.join("\n"), ...sections, ...r.unknown.filter((u) => u.startsWith("## "))].join("\n\n")}\n`;
}
