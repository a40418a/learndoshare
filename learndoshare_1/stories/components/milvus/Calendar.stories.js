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
    view: { control: "inline-radio", options: ["month", "week"], description: "그 밖의 값은 `month`" },
    value: { control: "text", description: "기준 날짜 `YYYY-MM-DD`. 비우면 오늘" },
    firstDayOfWeek: {
      control: { type: "select", labels: { 0: "0 (일)", 1: "1 (월)", 2: "2 (화)", 3: "3 (수)", 4: "4 (목)", 5: "5 (금)", 6: "6 (토)" } },
      options: [0, 1, 2, 3, 4, 5, 6],
      description: "주 첫날. 범위 밖이면 0(일)"
    },
    maxEventsPerDay: { control: { type: "number", min: 1 }, description: "월 보기에서 칸마다 보일 일정 수. 넘으면 \"+N개 더\"" },
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

**날짜 칸에 일정을 보여 주는** 월·주 일정표다. Component Reference에 월간 달력이 없고, 패키지 안의 \`lightning/calendar\`는 Date Picker 내부 부품(비공개)이라 밀버스가 만든다. SLDS에도 월간 달력 블루프린트가 없어 레이아웃은 밀버스 CSS이고, 색·테두리·간격·반경·글자는 모두 global hook(\`--slds-g-*\`)을 읽어 브랜드가 그대로 닿는다.

| 언제 쓰나 | 언제 쓰지 않나 |
| --- | --- |
| 날짜별 일정·마감·행사를 **한 달이나 한 주 단위로** 보여 줄 때 | **날짜 하나를 고르는** 입력 (\`lightning-input type="date"\` 사용) |
| 날짜·일정을 눌러 상세나 생성 화면으로 넘어갈 때 | 시간대별 세로 일정표(이번 범위 밖) |

**표현 컴포넌트다.** 데이터를 불러오지 않는다. 부모가 \`rangechange\`의 범위로 일정을 불러와 \`events\`로 넘긴다.

| API | 설명 |
| --- | --- |
| \`view\` | \`month\`(기본, 6주 42칸) · \`week\`(7일, 일정 전부) |
| \`value\` | 기준 날짜 \`YYYY-MM-DD\`. 이 날짜가 든 달·주를 보여 준다. 기본은 오늘 |
| \`first-day-of-week\` | 0(일, 기본)~6(토) |
| \`max-events-per-day\` | 월 보기 칸마다 보일 일정 수(기본 3). 넘으면 "+N개 더" 버튼(누르면 \`dayselect\`) |
| \`events\` | \`[{ id, title, start, end?, variant? }]\`. \`start\`·\`end\`는 \`YYYY-MM-DD\`(종일)나 \`YYYY-MM-DDTHH:mm\`. \`end\`까지 걸친 날마다 보인다. \`variant\`는 \`info\`·\`success\`·\`warning\`·\`error\` |

| 이벤트 | \`event.detail\` | 언제 |
| --- | --- | --- |
| \`rangechange\` | \`{ view, start, end }\` | 처음 그릴 때와 보이는 범위(첫 칸~마지막 칸)가 바뀔 때 |
| \`dayselect\` | \`{ date }\` | 날짜 칸 클릭, Enter·Space, "+N개 더" |
| \`eventselect\` | \`{ id }\` | 일정 클릭(Enter·Space) |

| 조작 | 동작 |
| --- | --- |
| ← → / ↑ ↓ | 하루 / 일주일 이동. 범위를 벗어나면 달·주가 바뀐다 |
| Home / End | 그 주의 처음 / 끝 |
| PageUp / PageDown | 이전 / 다음 달 (주 보기는 주) |
| Enter · Space | 날짜 선택 |
| Tab | 포커스가 있는 칸의 일정 버튼으로 간다 |

- 형식이 틀린 일정(날짜 파싱 실패, \`end\`가 \`start\`보다 앞, \`id\`·\`title\` 없음)은 빼고 콘솔에 경고한다
- 시간대 변환은 하지 않는다. 문자열을 로컬 날짜·시각 그대로 읽는다
- 색만으로 뜻을 전하지 않도록 일정의 의미는 **제목에** 담는다

맨 아래 **소스 코드**에서 실제 파일을 볼 수 있다.`
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
