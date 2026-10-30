import { createElement } from "lwc";
import SlackIconButton from "c/slackIconButton";
import { registerSa11yMatcher } from "@sa11y/jest";

const mount = (props) => {
  const el = createElement("c-slack-icon-button", { is: SlackIconButton });
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
};
const button = (el) => el.shadowRoot.querySelector("button");

beforeAll(registerSa11yMatcher);
afterEach(() => {
  while (document.body.firstChild)
    document.body.removeChild(document.body.firstChild);
});

describe("c-slack-icon-button", () => {
  it("points the icon at the slackIcons sprite id", () => {
    const el = mount({ iconName: "clock", label: "History" });
    const use = el.shadowRoot.querySelector("use");
    expect(use.getAttribute("xlink:href")).toMatch(/slackIcons#clock$/);
  });

  it("names the button with label for screen readers and tooltip", () => {
    const b = button(mount({ iconName: "clock", label: "History" }));
    expect(b.getAttribute("aria-label")).toBe("History");
    expect(b.title).toBe("History");
  });

  it("reflects active as a pressed state", async () => {
    const el = mount({ iconName: "clock", label: "History" });
    expect(button(el).getAttribute("aria-pressed")).toBe("false");
    expect(button(el).className).toBe("btn");
    el.active = true;
    await Promise.resolve();
    expect(button(el).getAttribute("aria-pressed")).toBe("true");
    expect(button(el).className).toBe("btn btn_active");
  });

  it("passes disabled to the native button", () => {
    expect(
      button(mount({ iconName: "clock", label: "History", disabled: true }))
        .disabled
    ).toBe(true);
  });

  it("is accessible in default and active states", async () => {
    await expect(
      mount({ iconName: "clock", label: "History" })
    ).toBeAccessible();
    await expect(
      mount({ iconName: "clock", label: "History", active: true })
    ).toBeAccessible();
  });
});
