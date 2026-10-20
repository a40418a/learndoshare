import { test } from "node:test";
import assert from "node:assert/strict";
import { legacySections, parseRequest, REQUEST_SECTIONS, saveRequest, serializeRequest, type BrandRequest } from "../lib/request.ts";
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

## 디자인 명세
요청: 각지고 단단한 업무용 느낌, 촘촘하게
| 토큰 | 값 |
| --- | --- |
| spacing | 8px 단위 |
`;

test("serialize → parse 왕복에서 sections가 같다", () => {
  const r: BrandRequest = {
    savedAt: "2026-10-14 15:20",
    sections: [
      { id: "brand-color", title: "브랜드 색", current: "#0176D3 (버튼 #2976CA, 링크 #1F5DA1)", request: "신뢰감 있는 딥그린" },
      { id: "feedback-error", title: "피드백 색 / 오류", current: "글자 #B60554, 배경 #FFDDE1", request: "#C62828" },
      // 여러 줄 요청과 그 안의 빈 줄, '지금:'으로 시작하는 요청 줄
      { id: "overall", title: "디자인 명세", request: "각지고 단단한 업무용 느낌\n\n지금: 보다 촘촘하게" },
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
  const sections = [...r.sections, { id: "logo", title: "로고", request: "assets/logo.png" }];
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
  assert.equal(parseRequest("# 브랜드 요청\n\n## 디자인 명세\n요청: 단단하게\n반영: 2026-10-14\n").appliedAt, undefined);
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

// 손으로 고친 파일의 경계 사례(Task 19 리뷰 M5)
test("BOM과 제목 앞 빈 줄, 절 제목과 '지금:' 사이 빈 줄을 견딘다", () => {
  const md = "﻿\n\n# 브랜드 요청\n저장: 2026-10-14 15:20\n\n## 피드백 색 / 성공\n\n지금: 글자 #056764, 배경 #ACF3E4\n요청: 진하게\n";
  const r = parseRequest(md);
  assert.deepEqual(r.unknown, []);
  assert.equal(r.savedAt, "2026-10-14 15:20");
  assert.deepEqual(r.sections, [{ id: "feedback-success", title: "피드백 색 / 성공", current: "글자 #056764, 배경 #ACF3E4", request: "진하게" }]);
  assert.equal(serializeRequest(r), "# 브랜드 요청\n저장: 2026-10-14 15:20\n\n## 피드백 색 / 성공\n지금: 글자 #056764, 배경 #ACF3E4\n요청: 진하게\n");
});

test("'지금:'과 '요청:' 사이 빈 줄이 있어도 '요청:'을 뗀다", () => {
  const r = parseRequest("# 브랜드 요청\n\n## 브랜드 색\n지금: x\n\n요청: 딥그린\n");
  assert.deepEqual(r.sections, [{ id: "brand-color", title: "브랜드 색", current: "x", request: "딥그린" }]);
});

test("saveRequest: 빈 입력은 빼고 반영 표시는 지우며, 지금 값을 모르면 파일의 '지금:' 줄을 그대로 둔다", () => {
  const fresh = parseRequest(`${EXAMPLE}\n## 회의 메모\n메모\n`);
  const inputs = new Map([
    ["brand-color", "신뢰감 있는 딥그린"],
    ["feedback-error", "#C62828"],
    ["logo", "  "],
  ]);
  // 지금 값을 모름(툴바가 프로젝트 브랜드가 아니거나 브랜드를 읽지 못함): 파일에 있던 '지금:'을 둔다
  const kept = saveRequest(fresh, inputs, "2026-10-15 09:00");
  assert.equal(kept.appliedAt, undefined);
  assert.equal(kept.savedAt, "2026-10-15 09:00");
  assert.deepEqual(kept.unknown, ["## 회의 메모\n메모"]);
  assert.deepEqual(kept.sections, [
    { id: "brand-color", title: "브랜드 색", current: "#0176D3 (버튼 #2976CA, 링크 #1F5DA1)", request: "신뢰감 있는 딥그린" },
    { id: "feedback-error", title: "피드백 색 / 오류", request: "#C62828" },
  ]);
  // 지금 값을 앎: 새로 계산한 값을 쓴다(undefined면 '지금:' 없음)
  const fresh2 = saveRequest(fresh, inputs, "2026-10-15 09:00", (id) => (id === "feedback-error" ? "글자 #B60554, 배경 #FFDDE1" : undefined));
  assert.deepEqual(fresh2.sections, [
    { id: "brand-color", title: "브랜드 색", request: "신뢰감 있는 딥그린" },
    { id: "feedback-error", title: "피드백 색 / 오류", current: "글자 #B60554, 배경 #FFDDE1", request: "#C62828" },
  ]);
});

test("여러 줄 로고 요청은 줄바꿈 그대로 왕복한다", () => {
  const r: BrandRequest = { sections: [{ id: "logo", title: "로고", request: "assets/logo.png\n흰 배경용은 assets/logo-white.png" }], unknown: [] };
  const md = serializeRequest(r);
  assert.ok(md.includes("## 로고\n요청: assets/logo.png\n흰 배경용은 assets/logo-white.png\n"), md);
  assert.deepEqual(parseRequest(md).sections, r.sections);
});

test("입력 칸은 브랜드 색·로고·피드백 색·디자인 명세 네 가지다(2026-10-20 사용자 피드백)", () => {
  assert.deepEqual(
    SPEC_ITEMS.filter((i) => i.input !== "none").map((i) => i.id),
    ["brand-color", "logo", "feedback", "overall"],
  );
});

test("옛 제목 '전체 스타일'은 디자인 명세로 읽고 '디자인 명세'로 다시 쓴다", () => {
  const r = parseRequest("# 브랜드 요청\n\n## 전체 스타일\n요청: 각지게\n");
  assert.deepEqual(r.sections, [{ id: "overall", title: "디자인 명세", request: "각지게" }]);
  assert.equal(serializeRequest(r), "# 브랜드 요청\n\n## 디자인 명세\n요청: 각지게\n");
});

test("옛 세부 절(## 모서리 등)은 지우지 않고 저장해도 원문 그대로 남는다", () => {
  const md = "# 브랜드 요청\n저장: 2026-10-14 15:20\n\n## 모서리\n지금: --slds-g-radius-border-2 0.5rem\n요청: 각지게\n\n## 밀도\n요청: 촘촘하게\n";
  const fresh = parseRequest(md);
  assert.deepEqual(fresh.sections, []);
  const old = ["## 모서리\n지금: --slds-g-radius-border-2 0.5rem\n요청: 각지게", "## 밀도\n요청: 촘촘하게"];
  assert.deepEqual(fresh.unknown, old);
  const saved = serializeRequest(saveRequest(fresh, new Map([["brand-color", "딥그린"]]), "2026-10-20 10:00"));
  assert.deepEqual(parseRequest(saved).unknown, old);
  assert.deepEqual(parseRequest(saved).sections, [{ id: "brand-color", title: "브랜드 색", request: "딥그린" }]);
});

test("디자인 명세에 붙여 넣은 표·JSON·제목 줄은 줄바꿈과 들여쓰기 그대로 왕복하고 절을 깨지 않는다", () => {
  const pasted = [
    "## Color",
    "| 토큰 | 값 |",
    "| --- | --- |",
    "| primary | #4A154B |",
    "",
    "### Spacing",
    "\\## 이미 이스케이프된 줄",
    "\\\\## 백슬래시 두 개",
    "{",
    '  "radius": { "$value": "4px" }',
    "}",
    "## 로고",
  ].join("\n");
  const r: BrandRequest = {
    sections: [
      { id: "logo", title: "로고", request: "assets/logo.png" },
      { id: "overall", title: "디자인 명세", request: pasted },
    ],
    unknown: [],
  };
  const md = serializeRequest(r);
  assert.ok(md.includes("요청: \\## Color\n"), md);
  assert.ok(md.includes("\n\\## 로고\n"), md);
  const back = parseRequest(md);
  assert.deepEqual(back.sections, r.sections);
  assert.deepEqual(back.unknown, []);
  // 저장 경로(saveRequest)로 써도 같다
  const saved = serializeRequest(saveRequest(back, new Map([["overall", pasted]]), "2026-10-20 10:00"));
  assert.deepEqual(parseRequest(saved).sections, [{ id: "overall", title: "디자인 명세", request: pasted }]);
});

test("legacySections: 입력이 없어진 항목의 옛 절과 둘째 옛 디자인 명세만 고르고 메모와 같은 제목 둘째 절은 고르지 않는다", () => {
  const r = parseRequest(
    "# 브랜드 요청\n\n## 디자인 명세\n요청: 새 명세\n\n## 전체 스타일\n요청: 옛 명세\n\n## 모서리\n요청: 각지게\n\n## 회의 메모\n메모\n\n## 브랜드 색\n요청: a\n\n## 브랜드 색\n요청: b\n",
  );
  assert.deepEqual(legacySections(r), ["## 전체 스타일\n요청: 옛 명세", "## 모서리\n요청: 각지게"]);
});
