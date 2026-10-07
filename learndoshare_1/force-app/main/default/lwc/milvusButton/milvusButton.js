import { LightningElement, api } from "lwc";

// lightning-button의 variant → SLDS 버튼 블루프린트 클래스
const VARIANT_CLASS = {
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
  @api label;
  @api variant = "neutral";
  @api iconName;
  @api iconPosition = "left";
  @api disabled = false;
  @api type = "button";
  @api title;

  custom = false;

  connectedCallback() {
    // CSS 변수는 shadow 경계를 넘어 상속되므로 호스트에서 브랜드 util.css 값을 읽을 수 있다
    this.custom =
      getComputedStyle(this.template.host)
        .getPropertyValue("--milvus-button-custom")
        .trim() === "on";
  }

  get safeVariant() {
    return VARIANT_CLASS[this.variant] === undefined ? "neutral" : this.variant;
  }

  get buttonClass() {
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
