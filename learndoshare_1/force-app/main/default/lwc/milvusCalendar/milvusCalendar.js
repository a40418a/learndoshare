import { LightningElement, api } from "lwc";
import { detectNativeShadow, loadBrand } from "c/milvusScript";
import {
  addDays,
  eventsByDay,
  moveDate,
  normalizeEvents,
  normalizeFirstDay,
  normalizeMaxEvents,
  normalizeView,
  parseDateTime,
  startOfWeek,
  toKey,
  today,
  visibleDays
} from "./calendarModel";

// 날짜·요일 이름은 브라우저 기본 로케일로 만든다. @salesforce/i18n/*은 Storybook 빌드에서 해석되지 않는다
const FULL_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "full" });
const MONTH_TITLE = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long" });
const WEEK_TITLE = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" });
const WEEKDAY_SHORT = new Intl.DateTimeFormat(undefined, { weekday: "short" });
const WEEKDAY_LONG = new Intl.DateTimeFormat(undefined, { weekday: "long" });

/**
 * 월·주 일정표(표현 컴포넌트). 일정은 부모가 events로 넘기고, 보이는 범위가 바뀌면 rangechange로 알린다
 */
export default class MilvusCalendar extends LightningElement {
  _view = "month";
  _firstDayOfWeek = 0;
  _maxEventsPerDay = 3;
  _events = [];
  /** 로빙 tabindex가 가리키는 날. 이 날이 든 달·주를 보여 준다 */
  focusDate = today();
  selectedKey = null;
  nativeChecked = false;
  pendingFocus = false;
  lastRange = null;

  /** month(기본) | week. 그 밖의 값은 month */
  @api
  get view() {
    return this._view;
  }
  set view(value) {
    this._view = normalizeView(value);
  }

  /** 기준 날짜 YYYY-MM-DD. 비우면 오늘 */
  @api
  get value() {
    return toKey(this.focusDate);
  }
  set value(value) {
    const parsed = parseDateTime(value);
    if (!parsed && value != null && value !== "") {
      console.warn(`[milvus] milvusCalendar: value "${value}"가 YYYY-MM-DD 형식이 아니라 오늘을 보여 줍니다`);
    }
    this.focusDate = parsed ? parsed.date : today();
  }

  /** 0(일, 기본)~6(토). 범위 밖이나 숫자가 아니면 0 */
  @api
  get firstDayOfWeek() {
    return this._firstDayOfWeek;
  }
  set firstDayOfWeek(value) {
    this._firstDayOfWeek = normalizeFirstDay(value);
  }

  /** 월 보기에서 칸마다 보일 일정 수(기본 3). 넘으면 "+N개 더" */
  @api
  get maxEventsPerDay() {
    return this._maxEventsPerDay;
  }
  set maxEventsPerDay(value) {
    this._maxEventsPerDay = normalizeMaxEvents(value);
  }

  /** [{ id, title, start, end?, variant? }]. 형식이 틀린 항목은 빼고 console.warn */
  @api
  get events() {
    return this._events;
  }
  set events(value) {
    this._events = normalizeEvents(value);
  }

  connectedCallback() {
    loadBrand(this);
  }

  renderedCallback() {
    if (!this.nativeChecked) {
      this.nativeChecked = true;
      const native = detectNativeShadow(this.template);
      if (native.length) console.warn(`[milvus] native shadow로 그려지는 기본 컴포넌트: ${native.join(", ")}`);
    }
    if (this.pendingFocus) {
      this.pendingFocus = false;
      this.template.querySelector('[role="gridcell"][tabindex="0"]')?.focus();
    }
    // 처음 그릴 때와 보이는 범위가 바뀔 때 한 번씩 알린다. 같은 범위 안의 이동은 알리지 않는다
    const days = this.days;
    const detail = { view: this._view, start: toKey(days[0]), end: toKey(days[days.length - 1]) };
    const range = `${detail.view} ${detail.start} ${detail.end}`;
    if (range !== this.lastRange) {
      this.lastRange = range;
      this.dispatchEvent(new CustomEvent("rangechange", { detail }));
    }
  }

  get isWeek() {
    return this._view === "week";
  }

  get days() {
    return visibleDays(this._view, this.focusDate, this._firstDayOfWeek);
  }

  get title() {
    if (!this.isWeek) return MONTH_TITLE.format(this.focusDate);
    const days = this.days;
    return WEEK_TITLE.formatRange(days[0], days[6]);
  }

  get prevLabel() {
    return this.isWeek ? "이전 주" : "이전 달";
  }

  get nextLabel() {
    return this.isWeek ? "다음 주" : "다음 달";
  }

  get gridClass() {
    return this.isWeek ? "grid grid_week" : "grid";
  }

  get weekdays() {
    const first = startOfWeek(this.focusDate, this._firstDayOfWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(first, i);
      return { key: String(day.getDay()), short: WEEKDAY_SHORT.format(day), long: WEEKDAY_LONG.format(day) };
    });
  }

  get rows() {
    const days = this.days;
    const byDay = eventsByDay(this._events, days[0], days[days.length - 1]);
    const todayKey = toKey(today());
    const focusKey = toKey(this.focusDate);
    const month = this.focusDate.getMonth();
    const limit = this.isWeek ? Infinity : this._maxEventsPerDay;
    const cells = days.map((day) => {
      const key = toKey(day);
      const items = byDay.get(key) ?? [];
      const shown = items.slice(0, limit);
      const tabindex = key === focusKey ? "0" : "-1";
      let className = "cell";
      if (!this.isWeek && day.getMonth() !== month) className += " cell_outside";
      if (key === todayKey) className += " cell_today";
      return {
        key,
        day: day.getDate(),
        label: `${FULL_DATE.format(day)}, ${items.length ? `일정 ${items.length}개` : "일정 없음"}`,
        className,
        tabindex,
        ariaCurrent: key === todayKey ? "date" : undefined,
        ariaSelected: String(key === this.selectedKey),
        // 칩은 포커스가 있는 칸에서만 Tab으로 닿는다. 다른 칸의 칩까지 Tab 순서에 넣으면 수십 번 눌러야 표를 빠져나간다
        events: shown.map((item) => ({
          key: `${item.id}#${item.order}`,
          id: item.id,
          label: item.time ? `${item.time} ${item.title}` : item.title,
          className: item.variant ? `event event_${item.variant}` : "event",
          tabindex
        })),
        more: items.length > shown.length ? `+${items.length - shown.length}개 더` : null
      };
    });
    return Array.from({ length: cells.length / 7 }, (_, i) => ({
      key: cells[i * 7].key,
      cells: cells.slice(i * 7, i * 7 + 7)
    }));
  }

  handlePrev() {
    this.focusDate = moveDate(this.focusDate, "PageUp", this._view, this._firstDayOfWeek);
  }

  handleNext() {
    this.focusDate = moveDate(this.focusDate, "PageDown", this._view, this._firstDayOfWeek);
  }

  handleToday() {
    this.focusDate = today();
  }

  handleKeyDown(event) {
    // 칸 안의 버튼(일정·+N개 더)은 버튼 기본 동작(Enter·Space로 클릭)을 그대로 둔다
    if (event.target.getAttribute("role") !== "gridcell") return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.selectDay(event.target.dataset.date);
      return;
    }
    const next = moveDate(this.focusDate, event.key, this._view, this._firstDayOfWeek);
    if (!next) return;
    event.preventDefault();
    this.focusDate = next;
    this.pendingFocus = true;
  }

  handleCellClick(event) {
    this.selectDay(event.currentTarget.dataset.date);
  }

  handleMoreClick(event) {
    event.stopPropagation();
    this.selectDay(event.currentTarget.dataset.date);
  }

  handleEventClick(event) {
    event.stopPropagation();
    this.dispatchEvent(new CustomEvent("eventselect", { detail: { id: event.currentTarget.dataset.id } }));
  }

  selectDay(key) {
    this.selectedKey = key;
    this.focusDate = parseDateTime(key).date;
    this.pendingFocus = true;
    this.dispatchEvent(new CustomEvent("dayselect", { detail: { date: key } }));
  }
}
