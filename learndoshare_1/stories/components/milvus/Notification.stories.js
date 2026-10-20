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
    variant: { control: "select", options: VARIANTS, description: "의미색. 그 밖의 값은 `info`로 그린다" },
    message: { control: "text", description: "안내 문구(텍스트)" },
    dismissible: { control: "boolean", description: "켜면 오른쪽에 닫기 버튼을 둔다 (밀버스 확장)" },
    onClose: { action: "close", table: { disable: true } }
  },
  parameters: {
    docs: {
      source: sourceFor("c-milvus-notification", { events: ["close"] }),
      description: {
        component: `${ORIGIN.milvus}

화면 안 **정해진 자리**에 놓는 안내 문구다. SLDS **Scoped Notification** 블루프린트(\`slds-scoped-notification\` + \`slds-theme_*\`)를 그대로 쓴다. 공식 LWC(\`lightning-*\`)에는 이 블루프린트를 쓰는 컴포넌트가 없어서 밀버스가 만든다.

**SLDS와 다른 점 (밀버스 확장):** SLDS는 Scoped Notification을 "닫을 수 없음"으로 정의한다. \`dismissible\`과 닫기 버튼(X)은 밀버스가 더한 것이다.

| 언제 쓰나 | 언제 쓰지 않나 |
| --- | --- |
| 카드·폼·목록 위처럼 **그 영역에 대한** 안내를 계속 보여 줄 때 | 잠깐 떴다 사라지는 결과 알림 (\`lightning/toast\` 사용) |
| 사용자가 읽고 나서 **직접 닫아도 되는** 안내 (\`dismissible\`) | 페이지 맨 위의 시스템 알림 (SLDS Alert 사용) |
| 문구 뒤에 "중복 보기" 같은 **링크·버튼**이 필요할 때 (기본 슬롯) | 짧은 상태 표시 한 단어 (Badge 사용) |

| API | 설명 |
| --- | --- |
| \`variant\` | \`info\`·\`success\`·\`warning\`·\`error\`. 아이콘과 대체 텍스트(정보·성공·경고·오류)가 함께 바뀌어 색만으로 뜻을 전하지 않는다 |
| \`message\` | 안내 문구 |
| 기본 슬롯 | 문구 뒤에 넣는 링크·버튼 |
| \`dismissible\` | 닫기 버튼. 누르면 스스로 숨고 \`close\` 이벤트를 보낸다 |

- \`close\`는 취소할 수 있다. 부모가 \`event.preventDefault()\`를 부르면 숨지 않는다
- 닫으면 버튼이 사라지므로 포커스가 문서 맨 앞으로 간다. 키보드 사용자를 위해 **부모가 \`close\` 핸들러에서 다음 작업 위치로 \`focus()\`를 옮긴다**
- 컨테이너는 \`role="status"\`라 내용이 바뀌면 화면 낭독기가 읽는다

맨 아래 **소스 코드**에서 실제 파일을 볼 수 있다.`
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
    log.textContent = "이벤트 로그: (아직 없음) · Tab으로 닫기 버튼에 가서 Enter를 눌러도 된다";
    const notification = lwc("c-milvus-notification", MilvusNotification, args, {
      close: (event) => {
        log.textContent = `이벤트 로그: close (${new Date().toLocaleTimeString()})`;
        onClose?.(event);
      }
    });
    return stack(notification, log);
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
