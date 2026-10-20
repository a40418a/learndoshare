// milvusCalendar의 날짜 계산(lwc/milvusCalendar/calendarModel.js). LWC Jest 대신 순수 함수만 node:test로 본다
// UTC(+0, CI)나 KST(+9, DST 없음)에서는 "YYYY-MM-DD"를 UTC로 읽는 실수와 DST 날의 24시간 덧셈 실수가 드러나지 않는다.
// 음수 오프셋이고 DST가 있는 시간대로 고정해 두 실수를 잡는다. Date를 만들기 전에 정해야 한다
process.env.TZ = "America/Los_Angeles";
import { test } from "node:test";
import assert from "node:assert/strict";

// JS 모듈이라 타입 선언이 없다. 경로를 값으로 넘겨 any로 받는다(strict에서 선언 없는 .js import는 TS7016)
const modelUrl = new URL("../force-app/main/default/lwc/milvusCalendar/calendarModel.js", import.meta.url).href;
const m = await import(modelUrl);

const d = (key: string) => m.parseDateTime(key).date as Date;
const keys = (days: Date[]) => days.map((day) => m.toKey(day));

test("parseDateTime: 로컬 날짜로 읽고 없는 날짜·시각·형식은 null", () => {
  const parsed = m.parseDateTime("2026-10-23T14:05");
  assert.equal(parsed.key, "2026-10-23");
  assert.equal(parsed.time, "14:05");
  assert.equal(parsed.date.getDate(), 23); // UTC로 읽으면 시간대에 따라 22일이 된다
  assert.equal(m.parseDateTime("2028-02-29").key, "2028-02-29");
  for (const bad of ["2026-02-29", "2026-13-01", "2026-10-23T24:00", "2026-10-23 14:00", "2026/10/23", "", null, 20261023]) {
    assert.equal(m.parseDateTime(bad), null, String(bad));
  }
});

test("addMonths: 그 달에 없는 날은 말일로 맞춘다(윤년 포함)", () => {
  assert.equal(m.toKey(m.addMonths(d("2026-01-31"), 1)), "2026-02-28");
  assert.equal(m.toKey(m.addMonths(d("2028-01-31"), 1)), "2028-02-29");
  assert.equal(m.toKey(m.addMonths(d("2026-03-31"), -1)), "2026-02-28");
  assert.equal(m.toKey(m.addMonths(d("2026-12-15"), 1)), "2027-01-15");
});

test("visibleDays: 월 보기는 42칸, 첫 칸은 firstDayOfWeek 요일", () => {
  // 2026-10-01은 목요일
  const sun = m.visibleDays("month", d("2026-10-20"), 0);
  assert.equal(sun.length, 42);
  assert.deepEqual([m.toKey(sun[0]), m.toKey(sun[41])], ["2026-09-27", "2026-11-07"]);
  const mon = m.visibleDays("month", d("2026-10-20"), 1);
  assert.deepEqual([m.toKey(mon[0]), mon[0].getDay()], ["2026-09-28", 1]);
  const sat = m.visibleDays("month", d("2026-10-20"), 6);
  assert.deepEqual([m.toKey(sat[0]), sat[0].getDay()], ["2026-09-26", 6]);
  // 윤년 2월: 2028-02-01은 화요일, 29일까지 들어간다
  assert.ok(keys(m.visibleDays("month", d("2028-02-10"), 0)).includes("2028-02-29"));
  // 1일이 주 첫날이면 첫 칸이 1일이다(2026-02-01은 일요일)
  assert.equal(m.toKey(m.visibleDays("month", d("2026-02-14"), 0)[0]), "2026-02-01");
});

test("visibleDays: 주 보기는 7일, 연말 주는 해를 넘긴다", () => {
  assert.deepEqual(keys(m.visibleDays("week", d("2026-12-31"), 0)), [
    "2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"
  ]);
  assert.equal(m.toKey(m.visibleDays("week", d("2027-01-01"), 1)[0]), "2026-12-28");
  assert.equal(m.toKey(m.visibleDays("week", d("2026-10-25"), 1)[0]), "2026-10-19"); // 일요일은 월요일 시작 주의 끝
});

test("moveDate: 방향키·Home·End·PageUp·PageDown", () => {
  const at = (key: string, view = "month", first = 0) => m.toKey(m.moveDate(d("2026-10-31"), key, view, first));
  assert.equal(at("ArrowRight"), "2026-11-01");
  assert.equal(at("ArrowLeft"), "2026-10-30");
  assert.equal(at("ArrowDown"), "2026-11-07");
  assert.equal(at("ArrowUp"), "2026-10-24");
  assert.equal(at("Home"), "2026-10-25");
  assert.equal(at("End"), "2026-10-31");
  assert.equal(at("Home", "month", 1), "2026-10-26");
  assert.equal(at("End", "month", 1), "2026-11-01");
  assert.equal(at("PageDown"), "2026-11-30");
  assert.equal(at("PageUp"), "2026-09-30");
  assert.equal(at("PageDown", "week"), "2026-11-07");
  assert.equal(m.moveDate(d("2026-10-31"), "a", "month", 0), null);
});

test("normalize*: 범위 밖 값은 기본값", () => {
  assert.equal(m.normalizeView("week"), "week");
  assert.equal(m.normalizeView("day"), "month");
  assert.deepEqual([1, "6", 7, -1, 1.5, "x", undefined].map(m.normalizeFirstDay), [1, 6, 0, 0, 0, 0, 0]);
  assert.deepEqual([5, "2", 0, -1, "x", undefined].map(m.normalizeMaxEvents), [5, 2, 3, 3, 3, 3]);
});

test("normalizeEvents: 틀린 항목은 빼고 경고한다", () => {
  const warnings: string[] = [];
  const list = m.normalizeEvents(
    [
      { id: 1, title: "정상", start: "2026-10-20", variant: "success" },
      { id: 2, title: "end가 앞", start: "2026-10-20", end: "2026-10-19" },
      { id: 3, title: "같은 날 시각이 앞", start: "2026-10-20T10:00", end: "2026-10-20T09:00" },
      { title: "id 없음", start: "2026-10-20" },
      { id: 5, start: "2026-10-20" },
      { id: 6, title: "없는 날", start: "2026-02-30" },
      { id: 7, title: "모르는 variant", start: "2026-10-20T09:00", end: "2026-10-20", variant: "brand" },
      null
    ],
    (message: string) => warnings.push(message)
  );
  assert.deepEqual(list.map((e: { id: string }) => e.id), ["1", "7"]);
  assert.equal(list[0].variant, "success");
  assert.equal(list[1].variant, null);
  assert.equal(warnings.length, 6);
  assert.ok(warnings.every((w) => w.startsWith("[milvus] milvusCalendar: events[")));
  assert.deepEqual(m.normalizeEvents("x"), []);
});

test("eventsByDay: 여러 날 일정은 보이는 범위 안의 날마다, 종일 → 시각 순", () => {
  const list = m.normalizeEvents([
    { id: "late", title: "오후", start: "2026-10-20T14:00" },
    { id: "early", title: "오전", start: "2026-10-20T09:30" },
    { id: "trip", title: "출장", start: "2026-10-19T08:00", end: "2026-10-21" },
    { id: "allday", title: "종일", start: "2026-10-20" },
    { id: "long", title: "월을 넘김", start: "2026-09-20", end: "2026-11-10" }
  ]);
  const map = m.eventsByDay(list, d("2026-09-27"), d("2026-11-07"));
  const ids = (key: string) => (map.get(key) ?? []).map((e: { id: string }) => e.id);
  // 출장의 시각(08:00)은 시작일에만 붙어 20일에는 종일로 앞에 선다
  assert.deepEqual(ids("2026-10-20"), ["trip", "allday", "long", "early", "late"]);
  assert.equal(map.get("2026-10-19").find((e: { id: string }) => e.id === "trip").time, "08:00");
  assert.deepEqual(ids("2026-10-22"), ["long"]);
  // 범위 밖은 넣지 않는다
  assert.equal(map.has("2026-09-26"), false);
  assert.equal(map.has("2026-11-08"), false);
  assert.deepEqual([ids("2026-09-27"), ids("2026-11-07")], [["long"], ["long"]]);
});
