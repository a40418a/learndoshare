// milvusCalendar의 날짜 계산(순수 함수). LWC·DOM에 기대지 않아 node:test에서 바로 import한다(tests/calendar-model.test.ts).
// 시간대 변환은 하지 않는다. 문자열을 로컬 날짜로 그대로 읽는다. new Date("YYYY-MM-DD")는 UTC 자정으로 읽어 하루 밀릴 수 있다

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

export const VARIANTS = ["info", "success", "warning", "error"];

const pad = (n) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DD"(로컬) */
export const toKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** 오늘(로컬 자정) */
export function today() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * "YYYY-MM-DD" 또는 "YYYY-MM-DDTHH:mm" → { date(로컬 자정), key, time("HH:mm" | null) }.
 * 형식이 다르거나 없는 날짜(2월 30일)·시각(24:00)이면 null
 */
export function parseDateTime(text) {
  const match = typeof text === "string" ? DATE_TIME.exec(text) : null;
  if (!match) return null;
  const [, y, m, d, hh, mm] = match;
  const date = new Date(+y, +m - 1, +d);
  if (date.getFullYear() !== +y || date.getMonth() !== +m - 1 || date.getDate() !== +d) return null;
  if (hh !== undefined && (+hh > 23 || +mm > 59)) return null;
  return { date, key: `${y}-${m}-${d}`, time: hh === undefined ? null : `${hh}:${mm}` };
}

// 생성자가 넘친 날짜를 다음 달로 넘겨 준다. 자정 기준이라 서머타임 전환일에도 날짜는 그대로다
export const addDays = (date, n) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** n달 뒤 같은 날. 그 달에 없는 날(1월 31일 → 2월)은 말일로 맞춘다 */
export function addMonths(date, n) {
  const last = new Date(date.getFullYear(), date.getMonth() + n + 1, 0).getDate();
  return new Date(date.getFullYear(), date.getMonth() + n, Math.min(date.getDate(), last));
}

/** date가 든 주의 첫날. firstDayOfWeek: 0(일)~6(토) */
export const startOfWeek = (date, firstDayOfWeek) =>
  addDays(date, -((date.getDay() - firstDayOfWeek + 7) % 7));

export const normalizeView = (view) => (view === "week" ? "week" : "month");

export function normalizeFirstDay(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 6 ? n : 0;
}

export function normalizeMaxEvents(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 3;
}

/** 화면에 보이는 날짜. 월 보기는 6주(42칸) 고정, 주 보기는 7일 */
export function visibleDays(view, date, firstDayOfWeek) {
  const first =
    view === "week"
      ? startOfWeek(date, firstDayOfWeek)
      : startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1), firstDayOfWeek);
  return Array.from({ length: view === "week" ? 7 : 42 }, (_, i) => addDays(first, i));
}

/** 키보드 키에 따른 다음 날짜. 처리하지 않는 키면 null. 이전·다음 버튼은 PageUp·PageDown과 같다 */
export function moveDate(date, key, view, firstDayOfWeek) {
  switch (key) {
    case "ArrowLeft":
      return addDays(date, -1);
    case "ArrowRight":
      return addDays(date, 1);
    case "ArrowUp":
      return addDays(date, -7);
    case "ArrowDown":
      return addDays(date, 7);
    case "Home":
      return startOfWeek(date, firstDayOfWeek);
    case "End":
      return addDays(startOfWeek(date, firstDayOfWeek), 6);
    case "PageUp":
      return view === "week" ? addDays(date, -7) : addMonths(date, -1);
    case "PageDown":
      return view === "week" ? addDays(date, 7) : addMonths(date, 1);
    default:
      return null;
  }
}

// end가 start보다 앞인지. 날짜가 같고 둘 다 시각이 있을 때만 시각을 비교한다("HH:mm"은 문자열 비교로 순서가 맞다)
const endsBeforeStart = (start, end) =>
  end.key < start.key ||
  (end.key === start.key && start.time !== null && end.time !== null && end.time < start.time);

/**
 * events 입력을 검증한다. 형식이 틀린 항목은 빼고 warn으로 알린다.
 * 반환: [{ id, title, start, end, variant(VARIANTS 중 하나 | null), order(입력 순서) }]
 */
export function normalizeEvents(events, warn = (...args) => console.warn(...args)) {
  if (!Array.isArray(events)) return [];
  const list = [];
  events.forEach((event, order) => {
    const start = parseDateTime(event?.start);
    const end = event?.end == null || event.end === "" ? start : parseDateTime(event.end);
    let problem = null;
    if (event?.id == null || event.id === "") problem = "id가 없습니다";
    else if (event.title == null || event.title === "") problem = "title이 없습니다";
    else if (!start) problem = "start가 YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm 형식이 아닙니다";
    else if (!end) problem = "end가 YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm 형식이 아닙니다";
    else if (endsBeforeStart(start, end)) problem = "end가 start보다 앞입니다";
    if (problem) {
      warn(`[milvus] milvusCalendar: events[${order}]를 뺍니다. ${problem}`, event);
      return;
    }
    list.push({
      id: String(event.id),
      title: String(event.title),
      start,
      end,
      variant: VARIANTS.includes(event.variant) ? event.variant : null,
      order
    });
  });
  return list;
}

/**
 * 날짜별 일정. 여러 날 일정은 걸친 날마다 넣는다(first~last 안만). 시각은 시작일에만 붙인다.
 * 하루 안에서는 종일 → 시각 순, 같으면 입력 순서다.
 * 반환: Map<"YYYY-MM-DD", [{ id, title, variant, time, order }]>
 */
export function eventsByDay(list, first, last) {
  const firstKey = toKey(first);
  const lastKey = toKey(last);
  const map = new Map();
  for (const event of list) {
    if (event.end.key < firstKey || event.start.key > lastKey) continue;
    const until = event.end.key < lastKey ? event.end.key : lastKey;
    for (let day = event.start.key < firstKey ? first : event.start.date; toKey(day) <= until; day = addDays(day, 1)) {
      const key = toKey(day);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({
        id: event.id,
        title: event.title,
        variant: event.variant,
        time: key === event.start.key ? event.start.time : null,
        order: event.order
      });
    }
  }
  for (const items of map.values()) {
    items.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.order - b.order);
  }
  return map;
}
