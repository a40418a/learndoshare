import { LightningElement, api } from "lwc";
import { detectNativeShadow, loadBrand } from "c/milvusScript";

// lightning-button의 variant → SLDS 버튼 블루프린트 클래스
const VARIANT_CLASS: Record<string, string> = {
  base: "",
  neutral: "slds-button_neutral",
  brand: "slds-button_brand",
  "brand-outline": "slds-button_outline-brand",
  destructive: "slds-button_destructive",
  "destructive-text": "slds-button_text-destructive",
  inverse: "slds-button_inverse",
  success: "slds-button_success"
};

export const VARIANTS = Object.keys(VARIANT_CLASS);

/**
 * 브랜드 util.css에 --milvus-button-custom: on이 있으면 블루프린트 버튼(--milvus-button-* 적용),
 * 없으면 lightning-button을 그대로 렌더한다. 화면 코드는 항상 <c-milvus-button> 하나만 쓴다.
 */
export default class MilvusButton extends LightningElement {
  @api label?: string;
  @api variant = "neutral";
  @api iconName?: string;
  @api iconPosition = "left";
  @api disabled = false;
  @api type = "button";
  // LightningElement가 title을 string으로 선언해 두어 ?를 쓸 수 없다. 값이 없으면 실행 시점에는 undefined다
  @api title!: string;

  custom = false;
  nativeChecked = false;

  connectedCallback(): void {
    // CSS 변수는 shadow 경계를 넘어 상속되므로 호스트에서 브랜드 util.css 값을 읽을 수 있다
    this.custom =
      getComputedStyle(this.template!.host)
        .getPropertyValue("--milvus-button-custom")
        .trim() === "on";
    loadBrand(this);
  }

  renderedCallback(): void {
    if (this.nativeChecked) return;
    this.nativeChecked = true;
    const native = detectNativeShadow(this.template!);
    if (native.length) console.warn(`[milvus] native shadow로 그려지는 기본 컴포넌트: ${native.join(", ")}`);
  }

  get safeVariant(): string {
    return VARIANT_CLASS[this.variant] === undefined ? "neutral" : this.variant;
  }

  get buttonClass(): string {
    // base는 텍스트형 버튼이라 여백을 주지 않는다 (SLDS와 같음)
    const base = this.safeVariant === "base" ? "milvus-button_base" : "";
    return ["slds-button", VARIANT_CLASS[this.safeVariant], "milvus-button", base]
      .filter(Boolean)
      .join(" ");
  }

  get iconLeft() {
    return this.iconName && this.iconPosition !== "right";
  }

  get iconRight() {
    return this.iconName && this.iconPosition === "right";
  }
}
