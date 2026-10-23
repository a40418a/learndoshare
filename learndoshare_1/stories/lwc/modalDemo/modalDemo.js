import { api } from "lwc";
import LightningModal from "lightning/modal";

// 스토리 전용. 프로젝트 모달이 하는 일 그대로다: LightningModal을 상속하고, 틀은 c-milvus-modal에 맡기고, 안(슬롯)만 채운다
export default class ModalDemo extends LightningModal {
  @api primaryLabel;
  @api secondaryLabel;
  @api primaryVariant;
  @api primaryDisabled;
  @api name = "";
  /** 있으면 폼 대신 문구만 보인다(확인·삭제 예시) */
  @api message;

  busy = false;

  handleNameChange(event) {
    this.name = event.detail.value;
  }

  handleSecondary() {
    this.close();
  }

  async handlePrimary() {
    // 저장 중에는 버튼과 X·Esc를 함께 막는다(modal.md 규칙 7)
    this.busy = true;
    this.disableClose = true;
    await new Promise((resolve) => setTimeout(resolve, 600));
    this.disableClose = false;
    this.close({ saved: true, name: this.name });
  }
}
