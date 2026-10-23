import { ModalDemo, ORIGIN, sourceStory } from "../../helpers.js";

const VARIANTS = ["brand", "destructive"];
const SIZES = ["small", "medium", "large", "full"];

/** 모달을 여는 버튼과 결과 로그. LightningModal은 open()으로만 뜨므로 스토리 화면에는 여는 쪽을 그린다 */
function opener(args, buttonLabel = "모달 열기") {
  const { size, onResult, ...props } = args;
  const wrap = document.createElement("div");
  const button = document.createElement("button");
  button.className = "slds-button slds-button_neutral";
  button.textContent = buttonLabel;
  const log = document.createElement("p");
  log.className = "slds-text-body_small slds-m-top_small";
  log.textContent = "결과: (아직 없음) · X나 Esc로 닫으면 undefined";
  button.addEventListener("click", async () => {
    const result = await ModalDemo.open({ size, description: `${props.label} 창`, ...props });
    log.textContent = `결과: ${JSON.stringify(result) ?? "undefined"}`;
    onResult?.(result);
  });
  wrap.append(button, log);
  return wrap;
}

const PROJECT_MODAL = `// c/accountEditModal.js — 프로젝트 모달. 틀은 c-milvus-modal에 맡기고 안만 채운다
import { api } from "lwc";
import LightningModal from "lightning/modal";

export default class AccountEditModal extends LightningModal {
    @api recordName;
    busy = false;

    handleCancel() {
        this.close();
    }

    async handleSave() {
        this.busy = true;
        this.disableClose = true; // 저장 중 X·Esc 막기
        // ... 저장
        this.disableClose = false;
        this.close({ saved: true });
    }
}`;

const usageCode = ({ label, primaryLabel, secondaryLabel, primaryVariant, primaryDisabled }) => {
  const attrs = [`label="${label}"`];
  if (primaryLabel) attrs.push(`primary-label="${primaryLabel}"`);
  if (secondaryLabel) attrs.push(`secondary-label="${secondaryLabel}"`);
  if (primaryVariant && primaryVariant !== "brand") attrs.push(`primary-variant="${primaryVariant}"`);
  if (primaryDisabled) attrs.push("primary-disabled");
  attrs.push("busy={busy}");
  if (primaryLabel) attrs.push("onprimary={handleSave}");
  if (secondaryLabel) attrs.push("onsecondary={handleCancel}");
  return `<!-- c/accountEditModal.html -->
<template>
    <c-milvus-modal
        ${attrs.join("\n        ")}
    >
        <!-- 여기만 채운다 -->
        <lightning-input label="거래처 이름" value={recordName}></lightning-input>
    </c-milvus-modal>
</template>

${PROJECT_MODAL}

// 여는 쪽
const result = await AccountEditModal.open({ size: "small", description: "거래처 수정 창", recordName: this.name });`;
};

export default {
  title: "컴포넌트/밀버스 추가/Modal",
  render: (args) => opener(args),
  args: {
    label: "거래처 수정",
    primaryLabel: "저장",
    secondaryLabel: "취소",
    primaryVariant: "brand",
    primaryDisabled: false,
    size: "small"
  },
  argTypes: {
    label: { control: "text", description: "제목. 헤더 가운데에 놓이고 모달의 접근성 이름이 된다 (필수)" },
    primaryLabel: { control: "text", description: "강조 버튼 라벨. 맨 오른쪽. 비우면 버튼을 그리지 않는다" },
    secondaryLabel: { control: "text", description: "비강조 버튼 라벨. 강조 버튼 왼쪽. 비우면 버튼을 그리지 않는다" },
    primaryVariant: { control: "select", options: VARIANTS, description: "`brand`(기본) 또는 되돌릴 수 없는 동작의 `destructive`" },
    primaryDisabled: { control: "boolean", description: "강조 버튼만 막는다 (입력이 모자랄 때)" },
    size: { control: "select", options: SIZES, description: "`open()`에 넘기는 크기 (LightningModal 속성)" },
    message: { table: { disable: true } },
    onResult: { action: "result", table: { disable: true } }
  },
  parameters: {
    docs: {
      source: { transform: (_code, context) => usageCode(context.args) },
      description: {
        component: `${ORIGIN.milvus}

**모달 안만 채우면 되는 틀**이다. 프로젝트 모달은 패턴 명세(\`docs/milvus/patterns/modal.md\`)대로 \`LightningModal\`을 상속하고, 템플릿에는 \`c-milvus-modal\` 하나를 두고 그 안(기본 슬롯)에 내용만 넣는다. 제목과 버튼 자리는 이 컴포넌트가 정한다.

| 자리 | 정해진 것 |
| --- | --- |
| 제목 | \`lightning-modal-header\`의 \`label\`. SLDS 기본대로 **가운데** |
| 내용 | \`lightning-modal-body\` 안의 기본 슬롯 |
| 버튼 | \`lightning-modal-footer\`. SLDS 기본대로 **오른쪽 아래**, "비강조(\`neutral\`) → 강조(\`brand\`)" 순서. 강조 버튼은 하나 |

| API | 설명 |
| --- | --- |
| \`label\` | 제목 (필수) |
| \`primary-label\` / \`secondary-label\` | 강조·비강조 버튼 라벨. 비운 버튼은 그리지 않고, 둘 다 비우면 footer도 없다 |
| \`primary-variant\` | \`brand\`(기본)·\`destructive\` |
| \`primary-disabled\` | 강조 버튼만 막는다 |
| \`busy\` | 저장 중. 두 버튼을 모두 막는다 |
| \`primary\` / \`secondary\` 이벤트 | 버튼을 눌렀을 때. **닫기는 부모가 \`this.close(result)\`로 한다** |

- 이 컴포넌트는 모달을 닫지 못한다. 닫기와 결과는 \`LightningModal\`을 상속한 부모의 몫이다(modal.md 규칙 7)
- 저장 중에는 부모가 \`busy\`와 \`this.disableClose = true\`를 함께 켠다. \`busy\`는 버튼을, \`disableClose\`는 X·Esc를 막는다
- 크기(\`size\`)와 설명(\`description\`)은 \`open()\`에 넘긴다
- \`lightning-modal-header\`·\`body\`·\`footer\`는 bubbles·composed 이벤트로 모달에 등록되므로 \`c-milvus-modal\` 한 단계 안에 있어도 동작한다. org 화면 확인은 아직이다 **(미확인)**

맨 아래 **소스 코드**에서 실제 파일을 볼 수 있다.`
      }
    }
  }
};

export const 기본 = {};

export const 버튼_하나 = {
  args: { label: "안내", primaryLabel: "확인", secondaryLabel: "", message: "변경 내용을 저장했습니다." }
};

export const 되돌릴_수_없는_동작 = {
  args: { label: "거래처 삭제", primaryLabel: "삭제", secondaryLabel: "취소", primaryVariant: "destructive", message: "삭제하면 이 거래처의 연락처 3건도 함께 사라지고 되돌릴 수 없습니다." }
};

export const 소스_코드 = sourceStory("milvusModal");
