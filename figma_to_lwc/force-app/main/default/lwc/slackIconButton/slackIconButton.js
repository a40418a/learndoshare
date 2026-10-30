import { LightningElement, api } from "lwc";
import ICONS from "@salesforce/resourceUrl/slackIcons";

// Figma: Slack UI Kit › Icon Button (7:10043). State=Default·Hover 는 CSS, Active 는 active 속성
export default class SlackIconButton extends LightningElement {
  /** slackIcons 스프라이트의 아이콘 id (Figma 레이어 이름, 예: clock) */
  @api iconName;
  /** 화면 읽기·툴팁용 이름. 글자가 없는 버튼이라 반드시 준다 */
  @api label;
  /** 눌린(켜진) 상태 — Figma State=Active */
  @api active = false;
  @api disabled = false;

  get href() {
    return `${ICONS}#${this.iconName}`;
  }

  get className() {
    return this.active ? "btn btn_active" : "btn";
  }

  get ariaPressed() {
    return String(this.active);
  }
}
