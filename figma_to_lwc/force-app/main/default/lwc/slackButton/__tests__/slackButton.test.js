import { createElement } from "lwc";
import SlackButton from "c/slackButton";
import { registerSa11yMatcher } from "@sa11y/jest";

const mount = (props) => {
  const el = createElement("c-slack-button", { is: SlackButton });
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

describe("c-slack-button", () => {
  it("renders the label as a secondary type=button by default", () => {
    const el = mount({ label: "Button" });
    expect(button(el).textContent).toBe("Button");
    expect(button(el).className).toBe("btn btn_secondary");
    expect(button(el).type).toBe("button");
  });

  it.each(["primary", "secondary", "tertiary"])(
    "applies the %s variant",
    (variant) => {
      expect(button(mount({ label: "B", variant })).className).toBe(
        `btn btn_${variant}`
      );
    }
  );

  it("falls back to secondary for an unknown variant", () => {
    expect(button(mount({ label: "B", variant: "brand" })).className).toBe(
      "btn btn_secondary"
    );
  });

  it("passes type and disabled to the native button", () => {
    const el = mount({ label: "B", type: "submit", disabled: true });
    expect(button(el).type).toBe("submit");
    expect(button(el).disabled).toBe(true);
  });

  it("lets click reach the host only when enabled", () => {
    const handler = jest.fn();
    const el = mount({ label: "B" });
    el.addEventListener("click", handler);
    button(el).click();
    el.disabled = true;
    return Promise.resolve().then(() => {
      button(el).click();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  it.each(["primary", "secondary", "tertiary"])(
    "is accessible as %s",
    async (variant) => {
      await expect(mount({ label: "Button", variant })).toBeAccessible();
    }
  );
});
