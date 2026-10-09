import type { LightningElement } from "lwc";
import { loadStyle } from "lightning/platformResourceLoader";
import bridgeUrl from "@salesforce/resourceUrl/milvusBridge";
import brandUrl from "@salesforce/resourceUrl/milvusBrand";
import overrideUrl from "@salesforce/resourceUrl/milvusOverride";
import { detectNativeShadow, loadBrand } from "c/milvusScript";

// loadStyle은 sfdx-lwc-jest의 기본 stub(jest.fn, resolve)이다
const loadStyleMock = jest.mocked(loadStyle);
const el = {} as LightningElement;

describe("c/milvusScript", () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("milvusBridge → milvusBrand → milvusOverride 순서로 loadStyle을 부른다", async () => {
    await loadBrand(el);
    expect(loadStyleMock.mock.calls.map((c) => c[1])).toEqual([bridgeUrl, brandUrl, overrideUrl]);
    expect(loadStyleMock.mock.calls.every((c) => c[0] === el)).toBe(true);
  });

  it("data-render-mode=shadow인 lightning-* 이름을 돌려준다", () => {
    const host = (tag: string, native: boolean) => {
      const node = document.createElement(tag);
      if (native) node.dataset.renderMode = "shadow";
      return node;
    };
    const fixture = document.createElement("div");
    fixture.append(host("lightning-button", true), host("lightning-badge", false), host("c-other", true));
    expect(detectNativeShadow(fixture)).toEqual(["lightning-button"]);
  });

  it("loadStyle이 실패해도 던지지 않고 console.error로 남긴다", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => {});
    loadStyleMock.mockRejectedValueOnce(new Error("없는 리소스"));
    await expect(loadBrand(el)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toContain(bridgeUrl);
    // 하나가 실패해도 나머지는 순서대로 불러온다
    expect(loadStyleMock.mock.calls.map((c) => c[1])).toEqual([bridgeUrl, brandUrl, overrideUrl]);
  });
});
