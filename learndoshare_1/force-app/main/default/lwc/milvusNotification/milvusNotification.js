import { LightningElement, api } from "lwc";
import { detectNativeShadow, loadBrand } from "c/milvusScript";

// 의미 → SLDS Scoped Notification 테마 클래스·아이콘·대체 텍스트. 색만으로 뜻을 전하지 않도록 아이콘에 의미 단어를 붙인다
const VARIANT = {
  info: { theme: "slds-theme_info", icon: "utility:info", label: "정보" },
  success: { theme: "slds-theme_success", icon: "utility:success", label: "성공" },
  warning: { theme: "slds-theme_warning", icon: "utility:warning", label: "경고" },
  error: { theme: "slds-theme_error", icon: "utility:error", label: "오류" }
};

export const VARIANTS = Object.keys(VARIANT);

/**
 * 화면 안 정해진 자리에 놓는 안내 문구. SLDS Scoped Notification 블루프린트를 그대로 쓴다.
 * 밀버스 확장: SLDS는 Scoped Notification을 "닫을 수 없음"으로 정의한다. dismissible과 닫기 버튼은 밀버스가 더한 것이다.
 */
export default class MilvusNotification extends LightningElement {
  @api variant = "info";
  @api message;
  @api dismissible = false;

  isOpen = true;
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

  get current() {
    // 목록에 없는 값은 info로 떨어뜨린다. hasOwn이라 "constructor" 같은 프로토타입 이름도 거른다
    return Object.hasOwn(VARIANT, this.variant) ? VARIANT[this.variant] : VARIANT.info;
  }

  get containerClass() {
    return `slds-scoped-notification slds-media slds-media_center ${this.current.theme}`;
  }

  handleClose() {
    // cancelable: 부모가 preventDefault()하면 숨지 않는다. 닫기 전에 확인을 받거나, 부모가 직접 DOM에서 빼고 싶을 때 쓴다
    const proceed = this.dispatchEvent(new CustomEvent("close", { cancelable: true }));
    // 닫은 뒤 포커스는 부모가 정한다. 이 컴포넌트는 주변 화면을 모르므로 임의로 옮기지 않는다.
    // 버튼이 사라지면 포커스는 문서 맨 앞(body)으로 간다. 키보드 사용자를 위해 부모는 close 핸들러에서 다음 작업 위치로 focus()를 옮긴다
    if (proceed) this.isOpen = false;
  }
}
