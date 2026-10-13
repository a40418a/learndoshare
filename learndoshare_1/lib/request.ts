// 브랜드 요청 파일 milvus-brand-request.md (설계 6.1). 명세 페이지(Storybook "시작하기/브랜드 명세")가 쓰고 milvus-brand skill이 읽는다.
// 형식: `# 브랜드 요청`, 머리 줄 `반영: <날짜>`(skill이 제목 바로 아래에 적음)·`저장: <날짜 시각>`, 항목마다 `## <제목>` 아래 `지금: …`(한 줄, 없을 수 있음)과 `요청: …`(여러 줄 가능)
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

/** 요청 파일의 절. 입력이 있는 명세 항목마다 하나이고 피드백 색은 종류마다 하나다(`피드백 색 / 성공`). 제목은 SPEC_ITEMS의 label이다 */
export const REQUEST_SECTIONS: { id: string; title: string }[] = SPEC_ITEMS.filter((i) => i.input !== "none").flatMap((i) =>
  i.id === "feedback" ? FEEDBACK_KINDS.map(([kind, name]) => ({ id: `feedback-${kind}`, title: `${i.label} / ${name}` })) : [{ id: i.id, title: i.label }],
);

const TITLE = "# 브랜드 요청";

export function parseRequest(md: string): BrandRequest {
  const r: BrandRequest = { sections: [], unknown: [] };
  const text = md.replace(/\r\n?/g, "\n");
  const first = text.search(/^## /m);
  const head = first < 0 ? text : text.slice(0, first);
  const blocks = first < 0 ? [] : text.slice(first).split(/^(?=## )/m);

  // 머리: 첫 줄의 제목과 빈 줄은 다시 쓸 때 새로 만든다. 반영·저장 줄은 머리 어디에 있어도 읽는다
  head.split("\n").forEach((line, i) => {
    const m = /^(반영|저장):\s*(.*?)\s*$/.exec(line);
    if ((i === 0 && line.startsWith("# ")) || !line.trim()) return;
    if (m?.[1] === "반영") r.appliedAt = m[2];
    else if (m?.[1] === "저장") r.savedAt = m[2];
    else r.unknown.push(line);
  });

  const ids = new Map(REQUEST_SECTIONS.map((s) => [s.title, s.id]));
  for (const block of blocks) {
    const [heading, ...body] = block.trimEnd().split("\n");
    const title = heading.slice(3).trim();
    const id = ids.get(title);
    // 모르는 제목과 같은 제목의 둘째 절은 원문 그대로(안의 빈 줄 포함) 남긴다
    if (!id || r.sections.some((s) => s.id === id)) {
      r.unknown.push(block.trimEnd());
      continue;
    }
    const current = body[0]?.startsWith("지금:") ? body.shift()!.slice("지금:".length).trim() : undefined;
    // ponytail: 요청 안에 `## `로 시작하는 줄이 있으면 다시 읽을 때 새 절이 된다. 문제가 되면 쓸 때 이스케이프한다
    const request = body.join("\n").replace(/^요청:[ \t]*/, "").trim();
    r.sections.push(current === undefined ? { id, title, request } : { id, title, current, request });
  }
  return r;
}

export function serializeRequest(r: BrandRequest): string {
  const head = [TITLE];
  if (r.appliedAt) head.push(`반영: ${r.appliedAt}`);
  if (r.savedAt) head.push(`저장: ${r.savedAt}`);
  head.push(...r.unknown.filter((u) => !u.startsWith("## ")));
  const sections = r.sections.map((s) =>
    [`## ${s.title}`, ...(s.current ? [`지금: ${s.current.replace(/\s*\n\s*/g, " ")}`] : []), `요청: ${s.request}`].join("\n"),
  );
  return `${[head.join("\n"), ...sections, ...r.unknown.filter((u) => u.startsWith("## "))].join("\n\n")}\n`;
}
