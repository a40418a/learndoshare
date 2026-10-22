import {
  MilvusMultiSelect,
  ORIGIN,
  lwc,
  sourceStory,
  sourceFor
} from "../../helpers.js";

const OPTIONS = [
  { label: "서울", value: "seoul" },
  { label: "부산", value: "busan" },
  { label: "대구", value: "daegu" },
  { label: "인천", value: "incheon" },
  { label: "광주", value: "gwangju" },
  { label: "대전", value: "daejeon" },
  { label: "울산", value: "ulsan" },
  { label: "세종", value: "sejong" }
];

export default {
  title: "컴포넌트/밀버스 추가/MultiSelect",
  render: ({ onChange, ...args }) =>
    lwc("c-milvus-multi-select", MilvusMultiSelect, args, { change: onChange }),
  args: {
    label: "지역",
    placeholder: "지역 검색",
    options: OPTIONS,
    value: [],
    required: false,
    disabled: false
  },
  argTypes: {
    options: { control: "object" },
    value: { control: "object", description: "선택된 value 배열" },
    onChange: { action: "change", table: { disable: true } }
  },
  parameters: {
    docs: {
      source: sourceFor("c-milvus-multi-select", { events: ["change"] }),
      description: {
        component: `${ORIGIN.milvus}

Salesforce에는 **검색하면서 여러 개를 고르는** 기본 컴포넌트가 없다. \`lightning-combobox\`는 단일 선택만, \`lightning-dual-listbox\`와 \`lightning-select multiple\`은 검색이 없다. 밀버스 MultiSelect는 SLDS combobox(다중 선택) 블루프린트 마크업에 선택 항목을 \`lightning-pill\`로 보여 준다.

**다중 선택의 표준 컴포넌트다.** 같은 기능을 \`lightning-dual-listbox\`나 \`lightning-select multiple\`로 따로 만들지 않는다 (#6).

| 조작 | 동작 |
| --- | --- |
| 입력 | 목록을 거른다 |
| ↑ / ↓, Enter | 항목 이동, 선택·해제 |
| Esc | 목록 닫기 |
| 빈 입력창에서 Backspace | 마지막 선택 지우기 |

\`change\` 이벤트의 \`event.detail.value\`로 선택된 value 배열을 받는다.

맨 아래 **소스 코드**에서 실제 파일을 볼 수 있다.`
      }
    }
  }
};

export const 기본 = {};

export const 선택된_상태 = { args: { value: ["seoul", "busan"] } };

export const 필수 = { args: { required: true } };

export const 비활성 = { args: { disabled: true, value: ["daegu"] } };

export const 소스_코드 = sourceStory("milvusMultiSelect");
