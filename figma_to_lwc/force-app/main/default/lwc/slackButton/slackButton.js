import { LightningElement, api } from "lwc";

// Figma: Slack UI Kit › Button (92:11225). Hierarchy 변형 → variant, State 는 :hover·:active 로 그린다
const VARIANTS = ["primary", "secondary", "tertiary"];

export default class SlackButton extends LightningElement {
  /** 버튼 글자 */
  @api label;
  /** primary | secondary | tertiary (그 밖의 값은 secondary) */
  @api variant = "secondary";
  /** true 면 누를 수 없다 (Figma 에 없는 상태 — PRD 6) */
  @api disabled = false;
  /** button | submit | reset */
  @api type = "button";

  get className() {
    const variant = VARIANTS.includes(this.variant)
      ? this.variant
      : "secondary";
    return `btn btn_${variant}`;
  }
}
