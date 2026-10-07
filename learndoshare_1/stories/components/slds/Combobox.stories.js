import { LightningCombobox, ORIGIN, lwc, sourceFor } from "../../helpers.js";

const OPTIONS = [
  { label: "신규", value: "new" },
  { label: "진행 중", value: "inProgress" },
  { label: "완료", value: "done" }
];

export default {
  title: "컴포넌트/SLDS 기반/Combobox",
  render: ({ onChange, ...args }) =>
    lwc("lightning-combobox", LightningCombobox, args, { change: onChange }),
  args: {
    label: "상태",
    placeholder: "선택하세요",
    options: OPTIONS,
    value: "",
    required: false,
    disabled: false
  },
  argTypes: {
    options: { control: "object" },
    onChange: { action: "change", table: { disable: true } }
  },
  parameters: {
    docs: {
      source: sourceFor("lightning-combobox", { events: ["change"] }),
      description: {
        component: `${ORIGIN.slds}

- **단일 선택의 표준 컴포넌트다.** 여러 개를 고르는 경우는 [밀버스 추가 / MultiSelect](?path=/docs/컴포넌트-밀버스-추가-multiselect--docs)를 쓴다
- \`lightning-combobox\`는 다중 선택을 지원하지 않는다 (Salesforce 공식 문서)`
      }
    }
  }
};

export const 기본 = {};

export const 필수 = { args: { required: true } };

export const 값_선택됨 = { args: { value: "inProgress" } };
