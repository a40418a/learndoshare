import {
  MilvusCalendar,
  ORIGIN,
  lwc,
  sourceFor,
  sourceStory
} from "../../helpers.js";

const EVENTS = ["rangechange", "dayselect", "eventselect"];

// 스토리는 날짜를 고정해 언제 열어도 같은 화면을 보인다
const VALUE = "2026-10-20";
const SAMPLE = [
  { id: "1", title: "주간 회의", start: "2026-10-05T10:00" },
  { id: "2", title: "릴리스 마감", start: "2026-10-16", variant: "error" },
  { id: "3", title: "고객 미팅", start: "2026-10-20T14:00", variant: "info" },
  { id: "4", title: "디자인 리뷰", start: "2026-10-20T09:30" },
  { id: "5", title: "발표", start: "2026-10-23", variant: "success" },
  { id: "6", title: "워크숍", start: "2026-10-27", end: "2026-10-29", variant: "warning" }
];

const BUSY = [
  ...["09:00 스탠드업", "10:30 1:1", "13:00 점심 세미나", "15:00 고객 통화", "17:00 회고"].map((text, i) => ({
    id: `busy-${i}`,
    title: text.slice(6),
    start: `2026-10-21T${text.slice(0, 5)}`
  })),
  { id: "busy-all", title: "재택", start: "2026-10-21", variant: "info" }
];

const MULTI_DAY = [
  { id: "m1", title: "출장 (부산)", start: "2026-10-19T08:00", end: "2026-10-21", variant: "info" },
  { id: "m2", title: "분기 마감 주간", start: "2026-09-28", end: "2026-10-02", variant: "warning" },
  { id: "m3", title: "연말 프로젝트", start: "2026-10-29", end: "2026-11-03", variant: "success" }
];

const TIMED = [
  { id: "t1", title: "오후 회의", start: "2026-10-20T16:00" },
  { id: "t2", title: "아침 점검", start: "2026-10-20T08:30", variant: "success" },
  { id: "t3", title: "창립 기념일", start: "2026-10-20" },
  { id: "t4", title: "점심 약속", start: "2026-10-20T12:00", end: "2026-10-20T13:00", variant: "info" }
];

/** Storybook actions(onRangechange 등)를 이벤트 이름별로 묶는다 */
const actionsOf = ({ onRangechange, onDayselect, onEventselect }) => ({
  rangechange: onRangechange,
  dayselect: onDayselect,
  eventselect: onEventselect
});

export default {
  title: "컴포넌트/밀버스 추가/Calendar",
  render: ({ onRangechange, onDayselect, onEventselect, ...args }) =>
    lwc("c-milvus-calendar", MilvusCalendar, args, actionsOf({ onRangechange, onDayselect, onEventselect })),
  args: {
    view: "month",
    value: VALUE,
    firstDayOfWeek: 0,
    maxEventsPerDay: 3,
    events: SAMPLE
  },
  argTypes: {
    view: { control: "inline-radio", options: ["month", "week"], description: "월 또는 주" },
    value: { control: "text", description: "기준 날짜 `YYYY-MM-DD`. 비우면 오늘입니다" },
    firstDayOfWeek: {
      control: { type: "select", labels: { 0: "0 (일)", 1: "1 (월)", 2: "2 (화)", 3: "3 (수)", 4: "4 (목)", 5: "5 (금)", 6: "6 (토)" } },
      options: [0, 1, 2, 3, 4, 5, 6],
      description: "한 주의 첫날. 0(일)~6(토)"
    },
    maxEventsPerDay: { control: { type: "number", min: 1 }, description: "월 보기에서 칸마다 보일 일정 수" },
    events: { control: "object", description: "`[{ id, title, start, end?, variant? }]`" },
    onRangechange: { action: "rangechange", table: { disable: true } },
    onDayselect: { action: "dayselect", table: { disable: true } },
    onEventselect: { action: "eventselect", table: { disable: true } }
  },
  parameters: {
    docs: {
      source: sourceFor("c-milvus-calendar", { events: EVENTS }),
      description: {
        component: `${ORIGIN.milvus}

한 달이나 한 주 단위로 일정을 보여 주는 달력입니다. 일정 데이터는 부모 컴포넌트가 넘겨 주세요.

| 이럴 때 쓰세요 | 이럴 땐 다른 것을 쓰세요 |
| --- | --- |
| 날짜별 일정·마감·행사를 보여 줄 때 | 날짜 하나 고르기: \`lightning-input type="date"\` |

**이렇게 쓰세요**

1. \`rangechange\` 이벤트로 보이는 기간(\`start\`~\`end\`)을 받으세요.
2. 그 기간의 일정을 불러와 \`events\`로 넘기세요.
3. 날짜를 누르면 \`dayselect\`, 일정을 누르면 \`eventselect\`가 옵니다.

| 속성 | 설명 |
| --- | --- |
| \`view\` | \`month\`(기본) · \`week\` |
| \`value\` | 기준 날짜 \`YYYY-MM-DD\`. 기본은 오늘 |
| \`first-day-of-week\` | 0(일, 기본)~6(토) |
| \`max-events-per-day\` | 월 보기 칸마다 보일 일정 수(기본 3) |
| \`events\` | \`[{ id, title, start, end?, variant? }]\`. 날짜는 \`YYYY-MM-DD\`나 \`YYYY-MM-DDTHH:mm\` |

- 일정의 뜻은 색이 아니라 제목에 담으세요.
- 아래 예제의 **Show code**를 눌러 코드를 복사하세요.`
      }
    }
  }
};

export const 월_보기 = {};

export const 주_보기 = { args: { view: "week" } };

export const 월요일_시작 = { args: { firstDayOfWeek: 1 } };

export const 일정_많은_날 = { args: { events: BUSY, maxEventsPerDay: 3 } };

export const 여러_날_일정 = { args: { events: MULTI_DAY } };

export const 시각_있는_일정 = { args: { events: TIMED } };

export const 이벤트_로그 = {
  render: ({ onRangechange, onDayselect, onEventselect, ...args }) => {
    const actions = actionsOf({ onRangechange, onDayselect, onEventselect });
    const log = document.createElement("pre");
    log.className = "sb-code";
    // 최근 8개를 최근 것이 위에 오게 쌓는다
    const write = (name) => (detail) => {
      const lines = log.textContent ? log.textContent.split("\n") : [];
      log.textContent = [`${name} ${JSON.stringify(detail)}`, ...lines].slice(0, 8).join("\n");
      actions[name]?.(detail);
    };
    const calendar = lwc(
      "c-milvus-calendar",
      MilvusCalendar,
      args,
      Object.fromEntries(EVENTS.map((name) => [name, write(name)]))
    );
    const root = document.createElement("div");
    root.className = "sb-stack";
    root.append(calendar, log);
    return root;
  }
};

export const 소스_코드 = sourceStory("milvusCalendar");
