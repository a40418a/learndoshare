import { LightningElement, api } from "lwc";
import { detectNativeShadow, loadBrand } from "c/milvusScript";

// 주 동작 버튼에 쓸 수 있는 variant. 되돌릴 수 없는 동작은 destructive(패턴 명세 modal.md 규칙 5)
export const PRIMARY_VARIANTS = ["brand", "destructive"];

/**
 * LightningModal 안에 넣는 틀. 제목(header) → 내용(기본 슬롯) → 버튼(footer)을 패턴 명세(modal.md) 순서로 그린다.
 * 버튼은 SLDS 기본대로 오른쪽 아래에 "비강조(neutral) → 강조(brand)" 순서로 붙고, 제목은 SLDS 기본대로 가운데다.
 * 이 컴포넌트는 모달을 닫지 못한다. 닫기는 LightningModal을 상속한 부모가 primary·secondary 이벤트를 받아 this.close(result)로 한다.
 * lightning-modal-header·body·footer는 bubbles·composed 이벤트로 가장 가까운 모달에 등록하므로 한 단계 안쪽에 있어도 된다
 */
export default class MilvusModal extends LightningElement {
  /** 제목. 모달의 접근성 이름도 된다(LightningModal은 header label이 없으면 오류를 낸다) */
  @api label;
  /** 강조 버튼(맨 오른쪽) 라벨. 비우면 버튼을 그리지 않는다 */
  @api primaryLabel;
  /** 비강조 버튼(강조 버튼 왼쪽) 라벨. 비우면 버튼을 그리지 않는다 */
  @api secondaryLabel;
  /** brand(기본) 또는 destructive */
  @api primaryVariant = "brand";
  /** 입력이 모자랄 때처럼 강조 버튼만 막는다 */
  @api primaryDisabled = false;
  /** 저장 중. 두 버튼을 모두 막는다. X·Esc는 부모가 disableClose로 함께 막는다(modal.md 규칙 7) */
  @api busy = false;

  nativeChecked = false;

  connectedCallback() {
    loadBrand(this);
  }

  renderedCallback() {
    if (this.nativeChecked) return;
    this.nativeChecked = true;
    const native = detectNativeShadow(this.template);
    if (native.length) console.warn(`[milvus] native shadow로 그려지는 기본 컴포넌트: ${native.join(", ")}`);
  }

  get hasFooter() {
    return Boolean(this.primaryLabel || this.secondaryLabel);
  }

  get primaryButtonVariant() {
    // 목록에 없는 값은 brand로 떨어뜨린다
    return PRIMARY_VARIANTS.includes(this.primaryVariant) ? this.primaryVariant : "brand";
  }

  get primaryButtonDisabled() {
    return this.busy || this.primaryDisabled;
  }

  get primaryClass() {
    // 두 번째 버튼부터 띄운다(modal.md 규칙 4)
    return this.secondaryLabel ? "slds-m-left_x-small" : "";
  }

  handleSecondary() {
    this.dispatchEvent(new CustomEvent("secondary"));
  }

  handlePrimary() {
    this.dispatchEvent(new CustomEvent("primary"));
  }
}
