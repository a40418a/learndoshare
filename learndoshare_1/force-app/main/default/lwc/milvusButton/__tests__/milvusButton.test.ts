import { createElement } from "lwc";
import MilvusButton from "c/milvusButton";
import { detectNativeShadow, loadBrand } from "c/milvusScript";

jest.mock("c/milvusScript", () => ({
  loadBrand: jest.fn(),
  detectNativeShadow: jest.fn(() => [])
}));

type Lightning = HTMLElement & Record<string, unknown>;

function render(props: Record<string, unknown>, custom: boolean) {
  jest
    .spyOn(window, "getComputedStyle")
    .mockReturnValue({ getPropertyValue: () => (custom ? " on" : "") } as unknown as CSSStyleDeclaration);
  const element = createElement("c-milvus-button", { is: MilvusButton });
  Object.assign(element, props);
  document.body.appendChild(element);
  return element;
}

const query = <T extends Element = Lightning>(element: HTMLElement, selector: string) =>
  element.shadowRoot!.querySelector(selector) as T;

describe("c-milvus-button", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("브랜드 util.css에 custom 신호가 없으면 lightning-button을 그대로 쓴다", () => {
    const element = render({ label: "저장", variant: "brand" }, false);
    const button = query(element, "lightning-button");
    expect(button.label).toBe("저장");
    expect(button.variant).toBe("brand");
    expect(query(element, "button")).toBeNull();
  });

  it("custom 신호가 있으면 SLDS 블루프린트 버튼을 그린다", () => {
    const element = render(
      { label: "저장", variant: "brand", disabled: true },
      true
    );
    const button = query<HTMLButtonElement>(element, "button");
    expect(button.className).toBe(
      "slds-button slds-button_brand milvus-button"
    );
    expect(button.textContent!.trim()).toBe("저장");
    expect(button.disabled).toBe(true);
    expect(button.type).toBe("button");
  });

  it("알 수 없는 variant는 neutral로 떨어진다", () => {
    const fallback = render({ label: "x", variant: "purple" }, false);
    expect(query(fallback, "lightning-button").variant).toBe("neutral");
  });

  it("base variant는 추가 클래스 없이 렌더한다", () => {
    const element = render({ label: "x", variant: "base" }, true);
    expect(query(element, "button").className).toBe(
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
      query(element, ".slds-button__icon_right lightning-icon").iconName
    ).toBe("utility:download");
    expect(query(element, ".slds-button__icon_left")).toBeNull();
  });

  it("클릭 이벤트가 호스트까지 전달된다", () => {
    const element = render({ label: "저장" }, true);
    const handler = jest.fn();
    element.addEventListener("click", handler);
    query(element, "button").click();
    expect(handler).toHaveBeenCalled();
  });

  it("연결되면 loadBrand를 부르고, 첫 렌더에서만 native shadow 기본 컴포넌트를 경고한다", async () => {
    jest.mocked(detectNativeShadow).mockReturnValueOnce(["lightning-button"]);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const element = render({ label: "저장" }, false);
    element.label = "변경";
    await Promise.resolve();
    expect(loadBrand).toHaveBeenCalledTimes(1);
    expect(detectNativeShadow).toHaveBeenCalledTimes(1);
    expect(detectNativeShadow).toHaveBeenCalledWith(element.shadowRoot);
    expect(warn.mock.calls).toEqual([["[milvus] native shadow로 그려지는 기본 컴포넌트: lightning-button"]]);
  });
});
