import { createElement } from "lwc";
import MessageComposer from "c/messageComposer";
import { graphql } from "lightning/graphql";
import { registerSa11yMatcher } from "@sa11y/jest";

// 스텁의 gql 은 undefined 를 돌려줘 "열렸을 때만 조회"를 구분할 수 없으므로 문자열로 바꾼다
jest.mock("lightning/graphql", () => ({
  ...jest.requireActual("lightning/graphql"),
  gql: () => "USERS_QUERY"
}));

const USERS = {
  uiapi: {
    query: {
      User: {
        edges: [
          { node: { Id: "005A", Name: { value: "Ada Lovelace" } } },
          { node: { Id: "005B", Name: { value: "Alan Turing" } } }
        ]
      }
    }
  }
};

const flush = () => Promise.resolve();

function mount(props = {}) {
  const el = createElement("c-message-composer", { is: MessageComposer });
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

const $ = (el, sel) => el.shadowRoot.querySelector(sel);
const editor = (el) => $(el, "lightning-input-rich-text");
const sendButton = (el) => $(el, ".send-btn");

async function type(el, value) {
  editor(el).value = value;
  editor(el).dispatchEvent(new CustomEvent("change"));
  await flush();
}

// 이모지·멘션 삽입 경로: 스텁에 없는 rich text 메서드를 흉내 낸다
function stubEditorMethods(el) {
  const ed = editor(el);
  ed.focus = jest.fn();
  ed.setRangeText = jest.fn((text) => {
    ed.value = `${ed.value ?? ""}${text}`;
  });
  return ed;
}

beforeAll(registerSa11yMatcher);

afterEach(() => {
  while (document.body.firstChild)
    document.body.removeChild(document.body.firstChild);
  jest.clearAllMocks();
});

describe("c-message-composer", () => {
  it("passes Figma toolbar formats and placeholder to the rich text editor", () => {
    const el = mount({ placeholder: "Say hi" });
    expect(editor(el).formats).toEqual([
      "bold",
      "italic",
      "strike",
      "link",
      "list",
      "code",
      "code-block"
    ]);
    expect(editor(el).placeholder).toBe("Say hi");
  });

  it("disables send while empty (State=Empty) and enables it with text (State=Filled)", async () => {
    const el = mount();
    expect(sendButton(el).disabled).toBe(true);
    await type(el, "<p>&nbsp;</p>");
    expect(sendButton(el).disabled).toBe(true);
    await type(el, "<p>Example text</p>");
    expect(sendButton(el).disabled).toBe(false);
  });

  it("fires send with the HTML value and clears the editor", async () => {
    const el = mount();
    const handler = jest.fn();
    el.addEventListener("send", handler);
    await type(el, "<p>Example text</p>");
    sendButton(el).click();
    await flush();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      value: "<p>Example text</p>"
    });
    expect(editor(el).value).toBe("");
  });

  it("does not fire send when disabled", async () => {
    const el = mount({ disabled: true });
    const handler = jest.fn();
    el.addEventListener("send", handler);
    await type(el, "<p>Example text</p>");
    expect(sendButton(el).disabled).toBe(true);
    expect(editor(el).disabled).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([
    "attach",
    "formatting",
    "video",
    "audio",
    "shortcut",
    "sendoptions"
  ])("fires action for %s", async (name) => {
    const el = mount();
    await type(el, "<p>x</p>");
    const handler = jest.fn();
    el.addEventListener("action", handler);
    $(el, `[data-name="${name}"]`).click();
    expect(handler.mock.calls[0][0].detail).toEqual({ name });
  });

  it("inserts a picked emoji at the cursor and closes the popover", async () => {
    const el = mount();
    const ed = stubEditorMethods(el);
    $(el, '[data-popover="emoji"]').click();
    await flush();
    expect($(el, '[data-popover="emoji"]').getAttribute("aria-expanded")).toBe(
      "true"
    );
    $(el, '[data-char="👍"]').click();
    await flush();
    expect(ed.focus).toHaveBeenCalled();
    expect(ed.setRangeText).toHaveBeenCalledWith(
      "👍",
      undefined,
      undefined,
      "end"
    );
    expect($(el, "section.popover")).toBeNull();
    expect(sendButton(el).disabled).toBe(false);
  });

  it("closes a popover on Escape", async () => {
    const el = mount();
    $(el, '[data-popover="emoji"]').click();
    await flush();
    $(el, "section.popover").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape" })
    );
    await flush();
    expect($(el, "section.popover")).toBeNull();
  });

  it("queries users only while the mention popover is open, with a LIKE term", async () => {
    const el = mount();
    expect(graphql.getLastConfig().query).toBeUndefined();
    $(el, '[data-popover="mention"]').click();
    await flush();
    expect(graphql.getLastConfig().query).toBe("USERS_QUERY");
    const search = $(el, "lightning-input");
    search.value = "ad";
    search.dispatchEvent(new CustomEvent("change"));
    await flush();
    expect(graphql.getLastConfig().variables).toEqual({ term: "%ad%" });
  });

  it("lists matched users and inserts @name", async () => {
    const el = mount();
    const ed = stubEditorMethods(el);
    $(el, '[data-popover="mention"]').click();
    await flush();
    graphql.emit(USERS);
    await flush();
    const names = [...el.shadowRoot.querySelectorAll("li button")].map((b) =>
      b.textContent.trim()
    );
    expect(names).toEqual(["Ada Lovelace", "Alan Turing"]);
    $(el, '[data-name="Alan Turing"]').click();
    await flush();
    expect(ed.setRangeText).toHaveBeenCalledWith(
      "@Alan Turing ",
      undefined,
      undefined,
      "end"
    );
  });

  it("shows the empty message when no user matches", async () => {
    const el = mount();
    $(el, '[data-popover="mention"]').click();
    await flush();
    // 결과가 오기 전(로딩 중)에는 빈 결과 문구를 보이지 않는다
    expect($(el, ".slds-text-color_weak")).toBeNull();
    graphql.emit({ uiapi: { query: { User: { edges: [] } } } });
    await flush();
    expect($(el, ".slds-text-color_weak").textContent.trim()).toBe(
      "c.MessageComposer_MentionEmpty"
    );
  });

  it("shows an error when the user query fails", async () => {
    const el = mount();
    $(el, '[data-popover="mention"]').click();
    await flush();
    graphql.emitErrors([{ message: "boom" }]);
    await flush();
    expect($(el, ".slds-text-color_error").textContent.trim()).toBe(
      "c.MessageComposer_MentionError"
    );
  });

  it("is accessible in Empty, Filled and open-popover states", async () => {
    const el = mount();
    await expect(el).toBeAccessible();
    await type(el, "<p>Example text</p>");
    await expect(el).toBeAccessible();
    $(el, '[data-popover="mention"]').click();
    await flush();
    graphql.emit(USERS);
    await flush();
    await expect(el).toBeAccessible();
  });
});
