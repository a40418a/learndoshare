import {
  MilvusBadge,
  ORIGIN,
  lwc,
  row,
  sourceFor,
  sourceStory
} from "../../helpers.js";

const VARIANTS = [
  "default",
  "success",
  "warning",
  "error",
  "info",
  "inverse",
  "lightest"
];

export default {
  title: "컴포넌트/밀버스 추가/Badge",
  render: (args) => lwc("c-milvus-badge", MilvusBadge, args),
  args: {
    label: "완료",
    variant: "success",
    iconName: "",
    iconPosition: "start"
  },
  argTypes: {
    variant: { control: "select", options: VARIANTS, description: "의미색" },
    iconName: { control: "text", description: "예: `utility:check`" },
    iconPosition: { control: "inline-radio", options: ["start", "end"] }
  },
  parameters: {
    docs: {
      source: sourceFor("c-milvus-badge"),
      description: {
        component: `${ORIGIN.milvus}

상태를 짧게 보여 주는 뱃지입니다. \`variant\` 하나로 성공·경고·위험·정보 색을 고르세요.

| 이럴 때 쓰세요 | 이럴 땐 다른 것을 쓰세요 |
| --- | --- |
| 레코드 상태, 처리 결과처럼 뜻이 있는 짧은 표시 | 누르는 요소: 버튼·링크 |
| | 여러 문장의 알림: Notification |

- 색만으로 뜻을 전하지 않도록 \`label\`을 꼭 넣으세요.
- 아래 예제의 **Show code**를 눌러 코드를 복사하세요.`
      }
    }
  }
};

export const 기본 = {};

export const 의미색_모음 = {
  render: () =>
    row(
      ...VARIANTS.map((variant) =>
        lwc("c-milvus-badge", MilvusBadge, { label: variant, variant })
      )
    ),
  parameters: {
    docs: {
      source: {
        transform: (code) => code,
        code: VARIANTS.map(
          (v) => `<c-milvus-badge label="${v}" variant="${v}"></c-milvus-badge>`
        ).join("\n")
      }
    }
  }
};

export const 아이콘 = {
  args: { label: "승인 대기", variant: "warning", iconName: "utility:clock" }
};

export const 소스_코드 = sourceStory("milvusBadge");
