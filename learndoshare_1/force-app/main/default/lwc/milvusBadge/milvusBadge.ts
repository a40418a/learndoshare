import { LightningElement, api } from "lwc";
import { detectNativeShadow, loadBrand } from "c/milvusScript";

// 의미 → SLDS 클래스. lightning-badge에는 variant 속성이 없어서 이 매핑이 밀버스의 표준 API다.
const VARIANT_CLASS: Record<string, string> = {
  default: "",
  inverse: "slds-badge_inverse",
  lightest: "slds-badge_lightest",
  success: "slds-theme_success",
  warning: "slds-theme_warning",
  error: "slds-theme_error",
  info: "slds-theme_info"
};

export const VARIANTS = Object.keys(VARIANT_CLASS);

export default class MilvusBadge extends LightningElement {
  @api label?: string;
  @api iconName?: string;
  @api iconPosition = "start";
  @api iconAlternativeText?: string;
  @api variant = "default";

  nativeChecked = false;

  connectedCallback(): void {
    loadBrand(this);
  }

  renderedCallback(): void {
    if (this.nativeChecked) return;
    this.nativeChecked = true;
    const native = detectNativeShadow(this.template!);
    if (native.length) console.warn(`[milvus] native shadow로 그려지는 기본 컴포넌트: ${native.join(", ")}`);
  }

  get badgeClass(): string {
    // 목록에 없는 값은 기본 모양으로 떨어뜨린다
    return VARIANT_CLASS[this.variant] ?? VARIANT_CLASS.default;
  }
}
