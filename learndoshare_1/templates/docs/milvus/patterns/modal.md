# 밀버스 UI 패턴 명세: 모달

화면을 어떻게 짤지 정한 팀 규칙이다. 같은 SLDS를 써도 모달마다 버튼 위치나 여는 방식이 달라지지 않게 한다.

- 이 폴더(`docs/milvus/patterns/`)는 프로젝트 소유다. 패턴마다 파일 하나를 둔다. `pnpm milvus init`(이 파일이 없던 프로젝트는 `update`)이 처음 한 번 놓고, 그 뒤로는 팀이 규칙을 바꾸거나 파일을 더한다. `update`는 있는 파일을 건드리지 않는다
- Claude는 LWC 화면(모달 등)을 만들거나 고치기 전에 이 폴더에서 해당 패턴 파일을 읽고 따른다(`.claude/rules/milvus/design.md` 5절). 다르게 해야 하면 이유를 말하고 확인받는다
- 패턴마다 "규칙 / 이유 / 예시 코드 / 출처"로 적는다. 공식 문서에 근거가 없는 규칙은 **밀버스 규칙(팀 합의)**으로 표시한다
- 브랜드(색·모양)는 이 파일이 아니라 `milvus-brand` skill과 `milvusBrand.css`가 맡는다. 이 파일은 화면 구성만 다룬다

## 1. 모달

### 규칙

1. 모달은 `lightning/modal`의 `LightningModal`을 상속한 컴포넌트로 만든다. `slds-modal` 마크업을 직접 쓰지 않는다
2. 템플릿에는 `c-milvus-modal` 하나를 두고 **그 안(기본 슬롯)만 채운다.** `c-milvus-modal`이 `lightning-modal-header`(제목) → `lightning-modal-body`(슬롯) → `lightning-modal-footer`(버튼) 순서로 그린다 — **밀버스 규칙(팀 합의)**
3. 제목은 `label`로 준다. SLDS 기본대로 헤더 가운데에 놓이고 모달의 접근성 이름이 된다. 정렬을 CSS로 바꾸지 않는다
4. 버튼은 `primary-label`(강조, `brand`)과 `secondary-label`(비강조, `neutral`)로 준다. SLDS 기본대로 오른쪽 아래에 "비강조 → 강조" 순서로 붙고, 강조 버튼은 맨 오른쪽 하나다. 버튼 하나면 그 라벨만 준다 — 순서는 **밀버스 규칙(팀 합의)**. 공식 예시를 따랐지만 규칙으로 정한 공식 문서는 없다
5. 삭제처럼 되돌릴 수 없는 동작은 `primary-variant="destructive"`로 두고, 본문에 무엇이 사라지는지 적은 확인 문구를 둔다. 모달 없이 확인만 받으면 `lightning/confirm`(`LightningConfirm.open`)을 쓴다 — 확인 문구는 **밀버스 규칙(팀 합의)**
6. 크기는 `open()`의 `size`에서 `small`·`medium`(기본)·`large`·`full` 중에서 고른다. 너비를 CSS로 정하지 않는다
7. 닫기는 부모(LightningModal)가 한다. `c-milvus-modal`의 `primary`·`secondary` 이벤트를 받아 `this.close(result)`로 결과를 돌려준다. X·Esc로 닫으면 결과는 `undefined`다. 저장 중에는 `busy`(두 버튼 비활성)와 `this.disableClose = true`(X·Esc 막기)를 함께 켠다
8. 열 때는 `MyModal.open({ size, description, … })`를 쓰고 promise 결과를 받는다
9. 여러 단계로 넘어가는 모달(이전 버튼을 왼쪽에 두는 경우)은 `c-milvus-modal`이 맡지 않는다. 이때만 helper 세 개를 직접 쓰고 버튼을 `<div class="slds-modal__footer_directional">`로 감싼다

### 이유

- `LightningModal`은 SLDS 모달 블루프린트를 구현하고, org 테마에 따라 SLDS 1·2 모양을 고른다. 포커스 이동, Esc 닫기, 접근성 라벨도 맡는다. 직접 쓴 `slds-modal` 마크업은 이것을 모두 다시 만들어야 한다
- 틀을 `c-milvus-modal` 하나로 모으면 제목·버튼 자리를 모달마다 다시 짜지 않는다. 개발자는 내용만 만든다. helper는 bubbles·composed 이벤트로 가장 가까운 모달에 등록하므로 한 단계 안쪽에 있어도 동작한다(Storybook 확인. org 화면 확인은 **미확인**)
- SLDS 2 CSS의 `.slds-modal__footer`는 `text-align: end`이고, 블루프린트 구성도 오른쪽 버튼 두 개("Right button 2", "Right button 1")다. 모든 모달이 같은 자리에 버튼을 두면 사용자가 찾지 않는다
- 모달을 닫으면 인스턴스가 사라진다. 입력 값은 `close(result)`로 넘기지 않으면 잃는다

### 예시 코드

```js
// c/accountEditModal.js
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
    this.disableClose = true;
    // ... 저장
    this.disableClose = false;
    this.close({ saved: true });
  }
}
```

```html
<!-- c/accountEditModal.html -->
<template>
  <c-milvus-modal
    label="거래처 수정"
    primary-label="저장"
    secondary-label="취소"
    busy={busy}
    onprimary={handleSave}
    onsecondary={handleCancel}
  >
    <!-- 여기만 채운다 -->
    <lightning-input label="거래처 이름" value={recordName}></lightning-input>
  </c-milvus-modal>
</template>
```

```js
// 여는 쪽
import AccountEditModal from "c/accountEditModal";

async handleEdit() {
  const result = await AccountEditModal.open({ size: "small", description: "거래처 수정 창", recordName: this.name });
  if (result?.saved) {
    // 저장 뒤 처리
  }
}
```

```js
// 파괴적 동작: 모달 없이 확인만 받을 때
import LightningConfirm from "lightning/confirm";

const ok = await LightningConfirm.open({ label: "거래처 삭제", message: "삭제하면 되돌릴 수 없습니다. 삭제할까요?", theme: "error" });
```

### 출처 (2026-10-20 확인)

- 밀버스 Storybook: "컴포넌트 / 밀버스 추가 / Modal" — `c-milvus-modal`의 속성·이벤트와 실제 소스

- Lightning Component Reference: [Modal (`lightning/modal`)](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-modal) — 상속, helper 순서, `label`·`size`·`description`·`disableClose`, `open()`·`close(result)`, directional
- Lightning Component Reference: [Modal Footer](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-modal-footer) — 취소(`neutral`)·저장(`brand`) 예시와 `slds-m-left_x-small`
- Lightning Component Reference: [Confirm (`lightning/confirm`)](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-confirm) — `message`·`label`·`variant`·`theme`
- SLDS 2: [Modals](https://www.lightningdesignsystem.com/components/modals/) — 구성(오른쪽 버튼 두 개), 크기, directional은 여러 단계용
- `@salesforce-ux/design-system-2` 2.264.2 `dist/components/modal/modal.css` — `.slds-modal__footer { text-align: end }`, `.slds-modal__footer_directional .slds-button:first-child { float: inline-start }`

## 다음 패턴 후보

아직 비어 있다. 팀이 정하면 이 폴더에 파일 하나(예: `form.md`)를 위와 같은 형식으로 더한다.

- 폼 레이아웃
- 목록 툴바
- 빈 상태
- 오류 표시
