import { createElement } from "lwc";
import MilvusMultiSelect from "c/milvusMultiSelect";
import { detectNativeShadow, loadBrand } from "c/milvusScript";

jest.mock("c/milvusScript", () => ({
  loadBrand: jest.fn(),
  detectNativeShadow: jest.fn(() => [])
}));

const OPTIONS = [
  { label: "서울", value: "seoul" },
  { label: "부산", value: "busan" },
  { label: "대구", value: "daegu" }
];

const flush = () => Promise.resolve();

describe("c-milvus-multi-select", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  function render(props: Record<string, unknown> = {}) {
    const element = createElement("c-milvus-multi-select", {
      is: MilvusMultiSelect
    });
    Object.assign(element, { label: "지역", options: OPTIONS, ...props });
    document.body.appendChild(element);
    return element;
  }

  type Host = ReturnType<typeof render>;
  const input = (element: Host) =>
    element.shadowRoot!.querySelector("input")!;
  const options = (element: Host) => [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '[role="option"][data-value]'
    )
  ];

  it("검색어로 목록을 거른다", async () => {
    const element = render();
    input(element).value = "부";
    input(element).dispatchEvent(new CustomEvent("input"));
    await flush();
    expect(options(element).map((option) => option.dataset.value)).toEqual([
      "busan"
    ]);
  });

  it("항목을 누르면 선택하고 change 이벤트로 value 배열을 알린다", async () => {
    const element = render();
    const handler = jest.fn();
    element.addEventListener("change", handler);
    options(element)[1].dispatchEvent(new CustomEvent("mousedown"));
    await flush();
    expect(handler.mock.calls[0][0].detail.value).toEqual(["busan"]);
    expect(element.shadowRoot!.querySelectorAll("lightning-pill")).toHaveLength(
      1
    );
  });

  it("선택된 항목을 다시 누르면 선택을 해제한다", async () => {
    const element = render({ value: ["seoul"] });
    options(element)[0].dispatchEvent(new CustomEvent("mousedown"));
    await flush();
    expect(element.value).toEqual([]);
  });

  it("키보드: 아래 화살표 후 Enter로 선택한다", async () => {
    const element = render();
    input(element).dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown" })
    );
    input(element).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter" })
    );
    await flush();
    expect(element.value).toEqual(["seoul"]);
    expect(input(element).getAttribute("aria-expanded")).toBe("true");
  });

  it("검색어가 비었을 때 Backspace는 마지막 선택을 지운다", async () => {
    const element = render({ value: ["seoul", "busan"] });
    input(element).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace" })
    );
    await flush();
    expect(element.value).toEqual(["seoul"]);
  });

  it("pill의 remove 이벤트로 선택을 지운다", async () => {
    const element = render({ value: ["daegu"] });
    const pill = element.shadowRoot!.querySelector("lightning-pill")!;
    pill.dispatchEvent(new CustomEvent("remove"));
    await flush();
    expect(element.value).toEqual([]);
  });

  it("value가 없는 옵션은 무시한다", () => {
    const element = render({ options: [{ label: "값 없음" }, ...OPTIONS] });
    expect(options(element)).toHaveLength(3);
  });

  it("연결되면 loadBrand를 부르고, 첫 렌더에서만 native shadow 기본 컴포넌트를 경고한다", async () => {
    jest.mocked(detectNativeShadow).mockReturnValueOnce(["lightning-icon"]);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const element = render();
    element.label = "변경";
    await flush();
    expect(loadBrand).toHaveBeenCalledTimes(1);
    expect(detectNativeShadow).toHaveBeenCalledTimes(1);
    expect(detectNativeShadow).toHaveBeenCalledWith(element.shadowRoot);
    expect(warn.mock.calls).toEqual([["[milvus] native shadow로 그려지는 기본 컴포넌트: lightning-icon"]]);
  });
});
