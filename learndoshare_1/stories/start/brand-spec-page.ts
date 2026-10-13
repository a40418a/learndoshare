// 브랜드 명세 페이지(설계 6.1, 9.3). SPEC_ITEMS마다 설명·지금 값·요청 입력을 그리고, 저장하면 프로젝트 루트의 milvus-brand-request.md를 쓴다.
// 요청 파일은 lib/storybook-plugin.ts의 /__milvus/brand-request(GET { text, writable }, POST { text })로 읽고 쓴다. 정적 빌드와 저장소 모드에서는 입력을 끈다
// 사용자 입력과 파일 내용은 textContent·value로만 넣는다(innerHTML을 쓰지 않는다)
import { brands, mode } from "../../.storybook/brand.ts";
import { contrastRatio } from "../../lib/contrast.ts";
import { FIXED_ITEMS } from "../../lib/fixed-list.ts";
import { brandPalette } from "../../lib/palette.ts";
import { FEEDBACK_KINDS, parseRequest, REQUEST_SECTIONS, serializeRequest, type BrandRequest } from "../../lib/request.ts";
import { SPEC_ITEMS, type SpecItem } from "../../lib/spec-items.ts";

const ENDPOINT = "/__milvus/brand-request";
const WHITE = "#ffffff";
const HEX6 = /^#[0-9a-f]{6}$/i;

// 피드백 색 견본의 글자·배경 hook(설계 5.3). 정보는 글자 hook(info-1)을 읽는 곳이 없어 배경 위 글자(on-info-1)를 쓴다
const FEEDBACK_SWATCH: Record<string, [text: string, background: string]> = {
  success: ["--slds-g-color-success-1", "--slds-g-color-success-container-1"],
  warning: ["--slds-g-color-warning-1", "--slds-g-color-warning-container-1"],
  error: ["--slds-g-color-error-1", "--slds-g-color-error-container-1"],
  info: ["--slds-g-color-on-info-1", "--slds-g-color-info-container-1"],
};

const SAVE_ERRORS: Record<number, string> = {
  400: "요청 형식이 잘못되어 저장하지 못했습니다",
  403: "저장이 거부되었습니다. localhost로 연 프로젝트 Storybook(pnpm milvus storybook)에서만 저장합니다",
  413: "요청이 너무 커서 저장하지 못했습니다. 1MB 이하로 줄여 주세요",
  500: "서버가 milvus-brand-request.md를 쓰지 못했습니다",
};

type Props<K extends keyof HTMLElementTagNameMap> = Partial<Omit<HTMLElementTagNameMap[K], "style">>;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props<K> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

// 어떤 색 형식(light-dark, color-mix, oklch …)이든 canvas에 칠해 sRGB 값을 읽는다(Foundations/컬러와 같은 방법)
const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
function toHex(color: string): string {
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  const hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  return a < 255 ? `${hex} (${Math.round((a / 255) * 100)}%)` : hex;
}

/** :root에 정해진 값(var()는 풀린 값). 정하지 않았으면 빈 문자열 */
const raw = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** 색 변수의 지금 색(#RRGGBB). 정하지 않았으면 undefined */
function colorOf(name: string): string | undefined {
  if (!raw(name)) return undefined;
  const probe = document.getElementById("milvus-spec-probe") ?? document.body.appendChild(el("span", { id: "milvus-spec-probe", hidden: true }));
  probe.style.color = `var(${name})`;
  return toHex(getComputedStyle(probe).color);
}

const isColor = (name: string) => /color|background/.test(name);

/** 변수 하나의 지금 값. 색은 #RRGGBB로 바꾼다 */
function valueOf(name: string): string {
  const v = raw(name);
  if (!v) return name.startsWith("--milvus-") ? "정하지 않음(Salesforce 원래 값)" : "정하지 않음(SLDS 기본값)";
  return isColor(name) ? colorOf(name)! : v;
}

function contrast(fg: string | undefined, bg: string | undefined, label: string): string {
  if (!fg || !bg || !HEX6.test(fg) || !HEX6.test(bg)) return "";
  const r = contrastRatio(fg, bg);
  return `${label} ${r.toFixed(2)}:1${r >= 4.5 ? "" : " (4.5:1 미만)"}`;
}

const brandNow = () => {
  const brand = brands.find((b) => b.name === document.documentElement.dataset.milvusBrand) ?? brands[0];
  return { brand, b50: colorOf("--slds-r-color-brand-50"), b40: colorOf("--slds-r-color-brand-40") };
};

/** 요청 파일 '지금:' 줄에 적을 값. 로고·표시만 항목과 값이 없는 항목은 적지 않는다 */
function currentFor(sectionId: string): string | undefined {
  if (sectionId === "brand-color") {
    const { brand, b50, b40 } = brandNow();
    return `${brand.brandColor ?? "SLDS 기본"} (버튼 ${b50}, 링크 ${b40})`;
  }
  if (sectionId.startsWith("feedback-")) {
    const [text, background] = FEEDBACK_SWATCH[sectionId.slice("feedback-".length)];
    return `글자 ${valueOf(text)}, 배경 ${valueOf(background)}`;
  }
  const entries = valueEntries(SPEC_ITEMS.find((i) => i.id === sectionId)!);
  return entries.length ? entries.map(([name, value]) => `${name} ${value}`).join(", ") : undefined;
}

/** 항목의 hook·브리지 변수와 지금 값. 몇 항목은 hook 밖의 값을 더한다 */
function valueEntries(item: SpecItem): [string, string][] {
  const entries: [string, string][] = [...item.hooks, ...item.bridgeVars].map((n) => [n, valueOf(n)]);
  if (item.id === "letter-spacing") entries.unshift(["letter-spacing(:root)", getComputedStyle(document.documentElement).letterSpacing]);
  if (item.id === "milvus-component") entries.push(["--milvus-button-custom", raw("--milvus-button-custom") || "정하지 않음(lightning-button 그대로)"]);
  if (item.id === "font") entries.push(["font-family", getComputedStyle(document.body).fontFamily]);
  return entries;
}

function valueTable(entries: [string, string][]): HTMLElement {
  const rows = entries.map(([name, value]) => {
    const cell = el("td", { className: "slds-cell-wrap" });
    if (name.startsWith("--") && isColor(name) && raw(name)) {
      const chip = cell.appendChild(el("span"));
      Object.assign(chip.style, { display: "inline-block", width: "1rem", height: "1rem", marginRight: "0.5rem", verticalAlign: "middle", background: `var(${name})`, border: "1px solid var(--slds-g-color-border-1, #c9c9c9)" });
    }
    cell.append(value);
    return el("tr", {}, el("td", { className: "slds-cell-wrap" }, el("code", {}, name)), cell);
  });
  const table = el("table", { className: "slds-table slds-table_bordered slds-table_cell-buffer slds-table_fixed-layout" }, el("tbody", {}, ...rows));
  const summary = el("summary", {}, `지금 값 (${entries.length}개)`);
  // SLDS 리셋이 summary의 펼침 표시를 지우므로 되살린다
  Object.assign(summary.style, { display: "list-item", cursor: "pointer" });
  return el("details", { open: entries.length <= 6 }, summary, table);
}

const para = (text: string, className = "") => el("p", { className: `slds-m-top_x-small ${className}` }, text);

function input(id: string, label: string, kind: SpecItem["input"], placeholder: string, inputs: Map<string, HTMLInputElement | HTMLTextAreaElement>) {
  const field =
    kind === "path"
      ? el("input", { id: `milvus-spec-${id}`, type: "text", className: "slds-input", placeholder, disabled: true })
      : el("textarea", { id: `milvus-spec-${id}`, className: "slds-textarea", placeholder, rows: id === "overall" ? 6 : 2, disabled: true });
  inputs.set(id, field);
  return el(
    "div",
    { className: "slds-form-element slds-m-top_small" },
    el("label", { className: "slds-form-element__label", htmlFor: field.id }, label),
    el("div", { className: "slds-form-element__control" }, field),
  );
}

function brandColorView(field: HTMLInputElement | HTMLTextAreaElement): HTMLElement {
  const { brand, b50, b40 } = brandNow();
  const color = brand.brandColor;
  const now = el(
    "ul",
    { className: "slds-list_dotted slds-m-top_x-small" },
    el("li", {}, `입력 색(BRAND_COLOR): ${color ?? "없음(SLDS 기본 팔레트)"} ${contrast(color, WHITE, "흰색 대비")}`),
    el("li", {}, `버튼 색(50단계): ${b50} ${contrast(WHITE, b50, "흰 글자 대비")}`),
    el("li", {}, `링크 색(40단계): ${b40} ${contrast(b40, WHITE, "흰 바탕 대비")}`),
  );
  // 요청에 #RRGGBB가 있으면 Salesforce가 만들 팔레트를 미리 보여 준다
  const preview = el("p", { className: "slds-m-top_x-small", role: "status" });
  field.addEventListener("input", () => {
    const hex = /#[0-9a-f]{6}(?![0-9a-f])/i.exec(field.value)?.[0];
    if (!hex) return void (preview.textContent = "");
    const p = brandPalette(hex);
    preview.textContent = `요청 색 ${hex.toUpperCase()}이면: ${contrast(hex, WHITE, "흰색 대비")}, 버튼 ${p[50].toUpperCase()} ${contrast(WHITE, p[50], "흰 글자 대비")}, 링크 ${p[40].toUpperCase()} ${contrast(p[40], WHITE, "흰 바탕 대비")}`;
  });
  return el("div", {}, now, preview);
}

function feedbackRow(kind: string, name: string, title: string, inputs: Map<string, HTMLInputElement | HTMLTextAreaElement>): HTMLElement {
  const [text, background] = FEEDBACK_SWATCH[kind];
  const [t, b] = [valueOf(text), valueOf(background)];
  const sample = el("span", { className: "slds-p-around_x-small" }, `${name} 메시지 Aa`);
  Object.assign(sample.style, { display: "inline-block", color: `var(${text})`, background: `var(${background})`, borderRadius: "0.25rem" });
  return el(
    "div",
    { className: "slds-m-top_small" },
    el("div", { className: "sb-row" }, sample, `글자 ${t}, 배경 ${b}. ${contrast(t, b, "배경 위")} ${contrast(t, WHITE, "흰색 위")}`),
    input(`feedback-${kind}`, title, "color", "예: 글자 #1B5E20, 배경 #E8F5E9", inputs),
  );
}

function fixedView(): HTMLElement {
  const list = (m: "both" | "native") => el("ul", { className: "slds-list_dotted" }, ...FIXED_ITEMS.filter((f) => f.mode === m).map((f) => el("li", {}, f.label)));
  return el(
    "div",
    { className: "slds-m-top_x-small" },
    el("h5", { className: "slds-text-title_bold" }, "두 모드 모두 고정 (지금과 native 전환 뒤)"),
    list("both"),
    el("h5", { className: "slds-text-title_bold slds-m-top_small" }, "native 전환 뒤 생기는 고정"),
    list("native"),
  );
}

function itemView(item: SpecItem, inputs: Map<string, HTMLInputElement | HTMLTextAreaElement>): HTMLElement {
  const heading = el("h4", { className: "slds-text-heading_small" }, item.label);
  const box = el("section", { className: "slds-box slds-m-top_small" }, heading, para(item.description));
  if (item.nativeLoss) {
    heading.append(" ", el("span", { className: "slds-badge slds-theme_warning" }, "브리지 부분은 native 전환 시 잃음"));
    const all = item.hooks.length === 0 && item.id !== "letter-spacing";
    box.append(para(`${all ? "이 항목은 브리지로만 바뀐다." : "이 항목 중 브리지 변수로 바꾸는 부분만 해당한다."} 기본 컴포넌트가 native shadow로 바뀌면 ${item.bridgeVars.join(", ")}의 효과가 사라진다(설계 5.6)`, "slds-text-color_weak"));
  }
  if (item.limits) box.append(para(`한계: ${item.limits}`, "slds-text-color_weak"));

  const placeholder = item.examples.length ? `예: ${item.examples.join(" / ")}` : "";
  if (item.id === "brand-color") {
    const field = input(item.id, `${item.label} 요청`, item.input, placeholder, inputs);
    box.append(brandColorView(inputs.get(item.id)!), field);
  } else if (item.id === "logo") {
    const { brand } = brandNow();
    box.append(brand.logoUrl ? el("img", { src: brand.logoUrl, alt: `${brand.label} 로고`, height: 48 }) : para("지금 로고 없음"));
    box.append(input(item.id, "로고 파일 경로 (프로젝트 루트 기준 상대 경로)", "path", "assets/logo.png", inputs));
  } else if (item.id === "feedback") {
    for (const [kind, name] of FEEDBACK_KINDS) box.append(feedbackRow(kind, name, REQUEST_SECTIONS.find((s) => s.id === `feedback-${kind}`)!.title, inputs));
  } else if (item.id === "fixed") {
    box.append(fixedView());
  } else {
    if (item.id === "object-icon-color") {
      box.append(
        para("변수 이름: lightning-icon icon-name `종류:이름`에서 `:`와 `_`를 `-`로 바꾼다. 예: standard:account → --milvus-icon-standard-account, standard:user_role → --milvus-icon-standard-user-role, custom:custom110 → --milvus-icon-custom-custom110"),
        para("별칭 클래스 이름(slds-icon-custom-110)으로 만든 변수(--milvus-icon-custom-110)는 읽는 곳이 없어 check가 막는다", "slds-text-color_weak"),
      );
    }
    const entries = valueEntries(item);
    if (entries.length) box.append(valueTable(entries));
    if (item.input !== "none") box.append(input(item.id, `${item.label} 요청`, item.input, placeholder, inputs));
  }
  return box;
}

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function renderBrandSpec(): HTMLElement {
  const inputs = new Map<string, HTMLInputElement | HTMLTextAreaElement>();
  let loaded: BrandRequest = { sections: [], unknown: [] };

  const fileStatus = el("p", { role: "status" }, "요청 파일을 읽는 중입니다");
  const reason = el("div", { className: "slds-notify slds-notify_alert slds-alert_warning", role: "alert", hidden: true });
  const saveButton = el("button", { type: "button", className: "slds-button slds-button_brand", disabled: true }, "저장");
  const saveMessage = el("span", { role: "status" });
  const toolbar = el("div", { className: "sb-row slds-p-vertical_small" }, saveButton, saveMessage);
  Object.assign(toolbar.style, { position: "sticky", top: "0", zIndex: "1", background: "var(--slds-g-color-surface-1, #fff)" });

  const { brand } = brandNow();
  const page = el(
    "div",
    { className: "sb-stack" },
    el("h2", { className: "slds-text-heading_large" }, "브랜드 명세"),
    para("항목마다 원하는 것을 자연어로 적고 저장하면 프로젝트 루트의 milvus-brand-request.md가 된다. Claude에게 \"브랜드 요청 반영해줘\"라고 하면 milvus-brand skill이 이 파일을 읽어 반영한다. 빈 항목은 파일에 적지 않는다"),
    para(`지금 값은 툴바에서 고른 브랜드(${brand.label}) 기준이다. 저장할 때 '지금:' 줄도 이 브랜드 값으로 적는다`, "slds-text-color_weak"),
    reason,
    fileStatus,
    toolbar,
  );
  if (mode === "project" && brand !== brands[0]) {
    page.append(el("div", { className: "slds-notify slds-notify_alert slds-alert_warning", role: "alert" }, `프로젝트 브랜드가 아닌 ${brand.label}을 보고 있습니다. 툴바에서 프로젝트 브랜드를 고르고 저장하세요`));
  }

  for (const group of [...new Set(SPEC_ITEMS.map((i) => i.group))]) {
    page.append(el("h3", { className: "slds-text-heading_medium slds-m-top_large" }, group));
    for (const item of SPEC_ITEMS.filter((i) => i.group === group)) page.append(itemView(item, inputs));
  }

  const showFile = (r: BrandRequest) => {
    const parts = [r.savedAt ? `마지막 저장 ${r.savedAt}` : "저장 시각 없음", r.appliedAt ? `Claude 반영 ${r.appliedAt} (다시 저장하면 반영 표시를 지운다)` : "아직 반영 표시 없음"];
    if (r.unknown.length) parts.push(`명세 항목이 아닌 줄·절 ${r.unknown.length}개는 저장해도 그대로 남는다`);
    fileStatus.textContent = `milvus-brand-request.md: ${parts.join(". ")}`;
  };

  const enable = (why?: string) => {
    for (const field of inputs.values()) field.disabled = !!why;
    saveButton.disabled = !!why;
    reason.hidden = !why;
    reason.textContent = why ?? "";
  };

  void (async () => {
    try {
      const res = await fetch(ENDPOINT);
      const body = await res.json();
      if (!res.ok) {
        fileStatus.textContent = "";
        return enable(`요청 파일을 읽지 못해 입력을 껐습니다: ${body.error ?? `HTTP ${res.status}`}`);
      }
      if (typeof body.text === "string") {
        loaded = parseRequest(body.text);
        for (const s of loaded.sections) {
          const field = inputs.get(s.id);
          if (field) field.value = s.request;
          field?.dispatchEvent(new Event("input"));
        }
        showFile(loaded);
      } else {
        fileStatus.textContent = "milvus-brand-request.md가 아직 없습니다. 저장하면 만든다";
      }
      enable(body.writable ? undefined : "저장소 Storybook에서는 저장하지 않아 입력을 껐습니다. 고객 프로젝트에서 pnpm milvus storybook으로 열면 저장할 수 있습니다");
    } catch {
      fileStatus.textContent = "";
      enable("정적 빌드에는 저장 서버가 없어 입력을 껐습니다. 입력과 저장은 pnpm milvus storybook(개발 서버)에서 합니다");
    }
  })();

  saveButton.addEventListener("click", async () => {
    const savedAt = stamp(new Date());
    // 빈 항목은 빼고 반영 표시(appliedAt)는 지운다. 명세 항목이 아닌 줄·절(unknown)은 그대로 둔다(설계 6.1, 6.2의 6)
    const sections = REQUEST_SECTIONS.flatMap((s) => {
      const request = inputs.get(s.id)?.value.trim();
      if (!request) return [];
      const current = currentFor(s.id);
      return [current ? { ...s, current, request } : { ...s, request }];
    });
    const text = serializeRequest({ savedAt, sections, unknown: loaded.unknown });
    saveButton.disabled = true;
    saveMessage.textContent = "저장하는 중입니다";
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const body: { error?: string } = await res.json().catch(() => ({}));
      if (res.ok) {
        loaded = parseRequest(text);
        showFile(loaded);
        saveMessage.textContent = `저장했습니다(${savedAt}). Claude에게 "브랜드 요청 반영해줘"라고 하세요`;
      } else {
        saveMessage.textContent = `${SAVE_ERRORS[res.status] ?? `저장하지 못했습니다(HTTP ${res.status})`}${body.error ? `: ${body.error}` : ""}`;
      }
    } catch {
      saveMessage.textContent = "저장하지 못했습니다: 개발 서버에 연결할 수 없습니다. Storybook이 켜져 있는지 확인하세요";
    } finally {
      saveButton.disabled = false;
    }
  });

  return page;
}
