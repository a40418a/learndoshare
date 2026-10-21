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
    value: { control: "object", description: "선택한 값 배열" },
    onChange: { action: "change", table: { disable: true } }
  },
  parameters: {
    docs: {
      source: sourceFor("c-milvus-multi-select", { events: ["change"] }),
      description: {
        component: `${ORIGIN.milvus}

검색하면서 여러 개를 고르는 선택 상자입니다. 다중 선택은 이 컴포넌트 하나만 쓰세요.

| 조작 | 동작 |
| --- | --- |
| 입력 | 목록을 거릅니다 |
| ↑ / ↓, Enter | 항목 이동, 선택·해제 |
| Esc | 목록 닫기 |
| 빈 입력창에서 Backspace | 마지막 선택 지우기 |

- 선택한 값은 \`change\` 이벤트의 \`event.detail.value\`(배열)로 받으세요.
- 아래 예제의 **Show code**를 눌러 코드를 복사하세요.`
      }
    }
  }
};

export const 기본 = {};

export const 선택된_상태 = { args: { value: ["seoul", "busan"] } };

export const 필수 = { args: { required: true } };

export const 비활성 = { args: { disabled: true, value: ["daegu"] } };

export const 소스_코드 = sourceStory("milvusMultiSelect");
