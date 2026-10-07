import { createElement } from "lwc";
import MilvusButton from "c/milvusButton";

function render(props, custom) {
  jest
    .spyOn(window, "getComputedStyle")
    .mockReturnValue({ getPropertyValue: () => (custom ? " on" : "") });
  const element = createElement("c-milvus-button", { is: MilvusButton });
  Object.assign(element, props);
  document.body.appendChild(element);
  return element;
}

describe("c-milvus-button", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("브랜드 util.css에 custom 신호가 없으면 lightning-button을 그대로 쓴다", () => {
    const element = render({ label: "저장", variant: "brand" }, false);
    const button = element.shadowRoot.querySelector("lightning-button");
    expect(button.label).toBe("저장");
    expect(button.variant).toBe("brand");
    expect(element.shadowRoot.querySelector("button")).toBeNull();
  });

  it("custom 신호가 있으면 SLDS 블루프린트 버튼을 그린다", () => {
    const element = render(
      { label: "저장", variant: "brand", disabled: true },
      true
    );
    const button = element.shadowRoot.querySelector("button");
    expect(button.className).toBe(
      "slds-button slds-button_brand milvus-button"
    );
    expect(button.textContent.trim()).toBe("저장");
    expect(button.disabled).toBe(true);
    expect(button.type).toBe("button");
  });

  it("알 수 없는 variant는 neutral로 떨어진다", () => {
    const fallback = render({ label: "x", variant: "purple" }, false);
    expect(fallback.shadowRoot.querySelector("lightning-button").variant).toBe(
      "neutral"
    );
  });

  it("base variant는 추가 클래스 없이 렌더한다", () => {
    const element = render({ label: "x", variant: "base" }, true);
    expect(element.shadowRoot.querySelector("button").className).toBe(
      "slds-button milvus-button milvus-button_base"
    );
  });

  it("아이콘 위치를 지킨다", () => {
    const element = render(
      {
        label: "다운로드",
        iconName: "utility:download",
        iconPosition: "right"
      },
      true
    );
    expect(
      element.shadowRoot.querySelector(
        ".slds-button__icon_right lightning-icon"
      ).iconName
    ).toBe("utility:download");
    expect(
      element.shadowRoot.querySelector(".slds-button__icon_left")
    ).toBeNull();
  });

  it("클릭 이벤트가 호스트까지 전달된다", () => {
    const element = render({ label: "저장" }, true);
    const handler = jest.fn();
    element.addEventListener("click", handler);
    element.shadowRoot.querySelector("button").click();
    expect(handler).toHaveBeenCalled();
  });
});
