import { createElement } from "lwc";
import MilvusBadge from "c/milvusBadge";
import { detectNativeShadow, loadBrand } from "c/milvusScript";

jest.mock("c/milvusScript", () => ({
  loadBrand: jest.fn(),
  detectNativeShadow: jest.fn(() => [])
}));

describe("c-milvus-badge", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  function create(props: Record<string, unknown>) {
    const element = createElement("c-milvus-badge", { is: MilvusBadge });
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
  }

  function render(props: Record<string, unknown>) {
    return create(props).shadowRoot!.querySelector("lightning-badge") as HTMLElement & Record<string, unknown>;
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

  it("연결되면 loadBrand를 부르고, 첫 렌더에서만 native shadow 기본 컴포넌트를 경고한다", async () => {
    jest.mocked(detectNativeShadow).mockReturnValueOnce(["lightning-badge"]);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const element = create({ label: "상태" });
    element.label = "변경";
    await Promise.resolve();
    expect(loadBrand).toHaveBeenCalledTimes(1);
    expect(detectNativeShadow).toHaveBeenCalledTimes(1);
    expect(detectNativeShadow).toHaveBeenCalledWith(element.shadowRoot);
    expect(warn.mock.calls).toEqual([["[milvus] native shadow로 그려지는 기본 컴포넌트: lightning-badge"]]);
  });
});
