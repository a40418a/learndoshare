import { LightningElement, api } from "lwc";

// 스토리 전용. createElement로 만든 호스트에 자식을 붙이면 synthetic shadow가 슬롯에 넣지 않는다. 그래서 슬롯 예시는 템플릿으로 그린다
export default class NotificationSlotDemo extends LightningElement {
  @api message;
  @api variant;
  @api dismissible;

  handleClick(event) {
    event.preventDefault();
  }
}
