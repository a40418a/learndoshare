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

\`lightning-badge\`에는 \`variant\` 속성이 없어서 상태색을 쓰려면 화면마다 SLDS 클래스를 직접 붙여야 했다. 밀버스 Badge는 **의미(성공·경고·위험·정보)를 \`variant\` 하나로** 표준화한다. 내부는 \`lightning-badge\` 그대로다.

| 언제 쓰나 | 언제 쓰지 않나 |
| --- | --- |
| 레코드 상태, 처리 결과처럼 **의미가 있는** 짧은 표시 | 클릭하는 요소 (버튼·링크를 쓴다) |
| 색만으로 뜻을 전하지 않도록 **글자(label)를 항상** 넣는다 | 여러 문장을 넣는 알림 (SLDS Alert 사용) |

맨 아래 **소스 코드**에서 실제 파일을 볼 수 있다.`
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
