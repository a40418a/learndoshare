import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRequest, REQUEST_SECTIONS, serializeRequest, type BrandRequest } from "../lib/request.ts";
import { SPEC_ITEMS } from "../lib/spec-items.ts";

// 설계 6.1의 예시 파일에 Claude가 적은 반영 줄(SKILL.md 1장 6단계: 제목 줄 바로 아래)을 더한 것
const EXAMPLE = `# 브랜드 요청
반영: 2026-10-14
저장: 2026-10-14 15:20

## 브랜드 색
지금: #0176D3 (버튼 #2976CA, 링크 #1F5DA1)
요청: 신뢰감 있는 딥그린

## 로고
요청: assets/logo.png

## 피드백 색 / 성공
지금: 글자 #056764, 배경 #ACF3E4
요청: 글자 #1B5E20, 배경 #E8F5E9

## 전체 스타일
요청: 각지고 단단한 업무용 느낌, 촘촘하게
`;

test("serialize → parse 왕복에서 sections가 같다", () => {
  const r: BrandRequest = {
    savedAt: "2026-10-14 15:20",
    sections: [
      { id: "brand-color", title: "브랜드 색", current: "#0176D3 (버튼 #2976CA, 링크 #1F5DA1)", request: "신뢰감 있는 딥그린" },
      { id: "feedback-error", title: "피드백 색 / 오류", current: "글자 #B60554, 배경 #FFDDE1", request: "#C62828" },
      // 여러 줄 요청과 그 안의 빈 줄, '지금:'으로 시작하는 요청 줄
      { id: "overall", title: "전체 스타일", request: "각지고 단단한 업무용 느낌\n\n지금: 보다 촘촘하게" },
    ],
    unknown: [],
  };
  const back = parseRequest(serializeRequest(r));
  assert.deepEqual(back.sections, r.sections);
  assert.equal(back.savedAt, r.savedAt);
  assert.deepEqual(back.unknown, []);

  // 설계 6.1 예시 파일은 그대로 다시 쓰인다
  assert.equal(serializeRequest(parseRequest(EXAMPLE)), EXAMPLE);
  assert.deepEqual(
    parseRequest(EXAMPLE).sections.map((s) => s.id),
    ["brand-color", "logo", "feedback-success", "overall"],
  );
});

test("알 수 없는 절과 빈 줄은 unknown에 보존되어 다시 쓴 파일에 남는다", () => {
  const md = `# 브랜드 요청
저장: 2026-10-14 15:20
메모: 대표 확인 필요

## 회의 메모
첫째 줄

둘째 줄 (위에 빈 줄)

## 브랜드 색
요청: 딥그린

## 브랜드 색
요청: 같은 제목이 두 번이면 둘째는 알 수 없는 절이다
`;
  const r = parseRequest(md);
  assert.deepEqual(r.sections, [{ id: "brand-color", title: "브랜드 색", request: "딥그린" }]);
  assert.deepEqual(r.unknown, [
    "메모: 대표 확인 필요",
    "## 회의 메모\n첫째 줄\n\n둘째 줄 (위에 빈 줄)",
    "## 브랜드 색\n요청: 같은 제목이 두 번이면 둘째는 알 수 없는 절이다",
  ]);

  // 명세 페이지 저장: 입력으로 sections를 바꾸고 반영 줄을 지워도 unknown은 남는다
  const sections = [...r.sections, { id: "radius", title: "모서리", request: "각지게" }];
  const saved = serializeRequest({ ...r, appliedAt: undefined, savedAt: "2026-10-15 09:00", sections });
  const head = saved.slice(0, saved.indexOf("\n## "));
  assert.match(head, /^메모: 대표 확인 필요$/m, "머리의 알 수 없는 줄은 머리에 남는다");
  assert.ok(saved.includes("\n## 회의 메모\n첫째 줄\n\n둘째 줄 (위에 빈 줄)\n"), saved);
  assert.ok(saved.includes("\n## 브랜드 색\n요청: 같은 제목이 두 번이면 둘째는 알 수 없는 절이다\n"), saved);
  assert.deepEqual(parseRequest(saved).unknown, r.unknown);
  assert.deepEqual(parseRequest(saved).sections, sections);
});

test("'반영: 2026-10-14'를 appliedAt으로 읽는다", () => {
  assert.equal(parseRequest(EXAMPLE).appliedAt, "2026-10-14");
  assert.equal(parseRequest(EXAMPLE).savedAt, "2026-10-14 15:20");
  // 머리(첫 ## 앞) 어디에 있어도 읽는다. CRLF 파일도 같다
  assert.equal(parseRequest("# 브랜드 요청\r\n저장: 2026-10-14 15:20\r\n\r\n반영: 2026-10-16\r\n\r\n## 로고\r\n요청: a.png\r\n").appliedAt, "2026-10-16");
  // 절 안의 '반영:'은 반영 표시가 아니다
  assert.equal(parseRequest("# 브랜드 요청\n\n## 전체 스타일\n요청: 단단하게\n반영: 2026-10-14\n").appliedAt, undefined);
  // 반영 줄을 지우고 쓰면 다시 읽을 때도 없다
  assert.equal(parseRequest(serializeRequest({ ...parseRequest(EXAMPLE), appliedAt: undefined })).appliedAt, undefined);
});

test("로고 절은 '요청: <상대 경로>' 한 줄", () => {
  const md = serializeRequest({ sections: [{ id: "logo", title: "로고", request: "assets/회사 로고.png" }], unknown: [] });
  assert.equal(md, "# 브랜드 요청\n\n## 로고\n요청: assets/회사 로고.png\n");
  assert.deepEqual(parseRequest(md).sections, [{ id: "logo", title: "로고", request: "assets/회사 로고.png" }]);
});

test("REQUEST_SECTIONS는 입력이 있는 명세 항목마다 하나, 피드백 색은 종류마다 하나다", () => {
  const withInput = SPEC_ITEMS.filter((i) => i.input !== "none");
  assert.equal(REQUEST_SECTIONS.length, withInput.length - 1 + 4);
  assert.equal(new Set(REQUEST_SECTIONS.map((s) => s.title)).size, REQUEST_SECTIONS.length);
  assert.deepEqual(
    REQUEST_SECTIONS.filter((s) => s.id.startsWith("feedback-")).map((s) => s.title),
    ["피드백 색 / 성공", "피드백 색 / 경고", "피드백 색 / 오류", "피드백 색 / 정보"],
  );
});
