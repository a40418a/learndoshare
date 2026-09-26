import { createElement } from "lwc";
import MilvusBadge from "c/milvusBadge";

describe("c-milvus-badge", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  function render(props) {
    const element = createElement("c-milvus-badge", { is: MilvusBadge });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element.shadowRoot.querySelector("lightning-badge");
  }

  it.each([
    ["success", "slds-theme_success"],
    ["warning", "slds-theme_warning"],
    ["error", "slds-theme_error"],
    ["info", "slds-theme_info"],
    ["inverse", "slds-badge_inverse"]
  ])("variant %s는 %s 클래스를 붙인다", (variant, className) => {
    const badge = render({ label: "상태", variant });
    expect(badge.classList).toContain(className);
  });

  it("알 수 없는 variant는 기본 모양으로 렌더한다", () => {
    const badge = render({ label: "상태", variant: "purple" });
    expect(badge.className).toBe("");
  });

  it("label과 아이콘 속성을 lightning-badge에 전달한다", () => {
    const badge = render({
      label: "완료",
      iconName: "utility:check",
      iconPosition: "end"
    });
    expect(badge.label).toBe("완료");
    expect(badge.iconName).toBe("utility:check");
    expect(badge.iconPosition).toBe("end");
  });
});
