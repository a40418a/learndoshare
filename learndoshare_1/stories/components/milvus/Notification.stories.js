import {
  MilvusNotification,
  NotificationSlotDemo,
  ORIGIN,
  lwc,
  sourceFor,
  sourceStory
} from "../../helpers.js";

const VARIANTS = ["info", "success", "warning", "error"];
const MESSAGES = {
  info: "이 리드와 같은 이메일을 쓰는 리드가 있습니다.",
  success: "저장했습니다.",
  warning: "필수 항목 2개가 비어 있습니다.",
  error: "저장하지 못했습니다. 권한을 확인하세요."
};

/** 여러 요소를 세로로 쌓는다 */
function stack(...children) {
  const div = document.createElement("div");
  // 호스트(c-milvus-notification)는 inline이라 margin이 먹지 않는다. grid 간격으로 띄운다
  div.style.cssText = "display: grid; gap: 0.75rem";
  div.append(...children);
  return div;
}

export default {
  title: "컴포넌트/밀버스 추가/Notification",
  render: ({ onClose, ...args }) =>
    lwc("c-milvus-notification", MilvusNotification, args, { close: onClose }),
  args: {
    message: MESSAGES.info,
    variant: "info",
    dismissible: false
  },
  argTypes: {
    variant: { control: "select", options: VARIANTS, description: "정보·성공·경고·오류" },
    message: { control: "text", description: "안내 문구" },
    dismissible: { control: "boolean", description: "켜면 닫기 버튼(X)이 보입니다" },
    onClose: { action: "close", table: { disable: true } }
  },
  parameters: {
    docs: {
      source: sourceFor("c-milvus-notification", { events: ["close"] }),
      description: {
        component: `${ORIGIN.milvus}

화면 안 정해진 자리에 계속 보이는 안내 문구입니다. \`dismissible\`을 켜면 사용자가 X로 닫을 수 있습니다.

| 이럴 때 쓰세요 | 이럴 땐 다른 것을 쓰세요 |
| --- | --- |
| 카드·폼·목록 위에 그 영역의 안내를 계속 보여 줄 때 | 잠깐 떴다 사라지는 알림: \`lightning/toast\` |
| 문구 뒤에 링크·버튼이 필요할 때(기본 슬롯) | 한 단어 상태 표시: Badge |

| 속성 | 설명 |
| --- | --- |
| \`variant\` | \`info\`·\`success\`·\`warning\`·\`error\` |
| \`message\` | 안내 문구 |
| \`dismissible\` | 닫기 버튼을 보입니다. 닫으면 \`close\` 이벤트가 옵니다 |

- 닫은 뒤에는 \`close\` 핸들러에서 다음 작업 위치로 \`focus()\`를 옮기세요(키보드 사용자용).
- 닫히지 않게 하려면 \`close\` 핸들러에서 \`event.preventDefault()\`를 부르세요.
- 아래 예제의 **Show code**를 눌러 코드를 복사하세요.`
      }
    }
  }
};

export const 기본 = {};

export const 의미색_모음 = {
  render: () =>
    stack(
      ...VARIANTS.map((variant) =>
        lwc("c-milvus-notification", MilvusNotification, { variant, message: MESSAGES[variant] })
      )
    ),
  parameters: {
    controls: { disable: true },
    docs: {
      source: {
        transform: (code) => code,
        code: VARIANTS.map(
          (v) => `<c-milvus-notification variant="${v}" message="${MESSAGES[v]}"></c-milvus-notification>`
        ).join("\n")
      }
    }
  }
};

export const 닫기_가능 = {
  args: { dismissible: true, variant: "warning", message: MESSAGES.warning },
  render: ({ onClose, ...args }) => {
    const log = document.createElement("p");
    log.className = "slds-text-body_small";
    log.textContent = "이벤트 로그: (아직 없음) · Tab으로 닫기 버튼에 가서 Enter를 눌러 보세요";
    const notification = lwc("c-milvus-notification", MilvusNotification, args, {
      close: (event) => {
        log.textContent = `이벤트 로그: close (${new Date().toLocaleTimeString()})`;
        onClose?.(event);
      }
    });
    return stack(notification, log);
  },
  parameters: {
    docs: {
      source: {
        transform: (code) => code,
        code: `<!-- 템플릿 -->
<c-milvus-notification
    variant="warning"
    message="${MESSAGES.warning}"
    dismissible
    onclose={handleClose}
></c-milvus-notification>
<lightning-input data-id="next" label="이름" required></lightning-input>

// JS: 닫은 뒤 키보드 포커스를 다음 작업 위치로 옮긴다
handleClose() {
    this.template.querySelector('[data-id="next"]').focus();
}`
      }
    }
  }
};

export const 슬롯_링크 = {
  args: { message: MESSAGES.info },
  // createElement로 만든 호스트에 자식을 붙이면 synthetic shadow가 슬롯에 넣지 않는다. 슬롯을 쓰는 예시 컴포넌트로 그린다
  render: ({ onClose, ...args }) =>
    lwc("c-notification-slot-demo", NotificationSlotDemo, args),
  parameters: {
    docs: {
      source: {
        transform: (code) => code,
        code: `<c-milvus-notification message="${MESSAGES.info}">
    <a href="#" onclick={handleViewDuplicates}>중복 보기</a>
</c-milvus-notification>`
      }
    }
  }
};

export const 소스_코드 = sourceStory("milvusNotification");
