// 브랜드 명세 페이지(설계 6.1, 9.3). 입력은 브랜드 색·로고·피드백 색·디자인 명세 네 가지이고(2026-10-20 사용자 피드백),
// 나머지 SPEC_ITEMS는 "바꿀 수 있는 것" 참고 목록(설명·예시·한계·지금 값)과 "바꿀 수 없는 것"(group 표시만)으로 그린다. 저장하면 프로젝트의 docs/milvus/brand-request.md를 쓴다.
// 요청 파일은 lib/storybook-plugin.ts의 /__milvus/brand-request(GET { text, writable }, POST { text })로 읽고 쓴다. 정적 빌드와 저장소 모드에서는 입력을 끈다
// 사용자 입력과 파일 내용은 textContent·value로만 넣는다(innerHTML을 쓰지 않는다)
import { brands, mode } from "../../.storybook/brand.ts";
import { contrastRatio } from "../../lib/contrast.ts";
import { FIXED_ITEMS } from "../../lib/fixed-list.ts";
import { brandPalette } from "../../lib/palette.ts";
import { FEEDBACK_KINDS, legacySections, parseRequest, REQUEST_SECTIONS, saveRequest, serializeRequest, type BrandRequest } from "../../lib/request.ts";
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

type Fields = Map<string, HTMLTextAreaElement>;

/** 저장하지 않은 입력(절 id → 값). 툴바에서 브랜드를 바꾸면 스토리를 다시 그리므로 모듈에 둔다. 새로고침하면 사라진다 */
const drafts = new Map<string, string>();

const SAVE_ERRORS: Record<number, string> = {
  400: "요청 형식이 잘못되어 저장하지 못했습니다",
  403: "저장이 거부되었습니다. localhost로 연 프로젝트 Storybook(pnpm milvus storybook)에서만 저장합니다",
  413: "요청이 너무 커서 저장하지 못했습니다. 1MB 이하로 줄여 주세요",
  500: "서버가 docs/milvus/brand-request.md를 쓰지 못했습니다",
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
  return el("details", { className: "slds-m-top_x-small" }, summary, table);
}

const para = (text: string, className = "") => el("p", { className: `slds-m-top_x-small ${className}` }, text);

function input(id: string, label: string, kind: SpecItem["input"], placeholder: string, inputs: Fields) {
  // 경로도 textarea다. 파일의 요청이 여러 줄이어도 줄바꿈을 잃지 않는다
  const field = el("textarea", { id: `milvus-spec-${id}`, className: "slds-textarea", placeholder, rows: id === "overall" ? 14 : kind === "path" ? 1 : 2, disabled: true });
  inputs.set(id, field);
  return el(
    "div",
    { className: "slds-form-element slds-m-top_small" },
    el("label", { className: "slds-form-element__label", htmlFor: field.id }, label),
    el("div", { className: "slds-form-element__control" }, field),
  );
}

function brandColorView(field: HTMLTextAreaElement): HTMLElement {
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

function feedbackRow(kind: string, name: string, title: string, inputs: Fields): HTMLElement {
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

const DESIGN_SPEC_PLACEHOLDER = `예:
| 토큰 | 값 |
| --- | --- |
| radius | 4px |
| spacing | 8px 단위 |

{ "color": { "gray": { "$value": "#5A6270" } } }

https://example.com
각지고 단단한 업무용 느낌, 촘촘하게`;

function itemView(item: SpecItem, inputs: Fields, level: "h4" | "h5" = "h4"): HTMLElement {
  const heading = el(level, { className: "slds-text-heading_small" }, item.label);
  const description = para(item.description);
  const box = el("section", { className: "slds-box slds-m-top_small" }, heading, description);
  // Salesforce 고정의 예시는 바꿀 수 없는 요청이라 보이지 않는다
  if (item.input === "none" && item.id !== "fixed" && item.examples.length) box.append(para(`예: ${item.examples.map((e) => `"${e}"`).join(", ")}`));
  if (item.nativeLoss) {
    heading.append(" ", el("span", { className: "slds-badge slds-theme_warning" }, "브리지 부분은 native 전환 시 잃음"));
    const all = item.hooks.length === 0;
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
  } else if (item.id === "overall") {
    const note = para("색·간격 표는 통째로 붙여 넣어도 된다. 줄바꿈은 그대로 저장되고, 바꿀 수 없는 것은 Claude가 대안과 함께 알려 준다. 이전에 저장한 세부 요청과 같은 항목을 다루면 디자인 명세가 우선한다", "slds-text-color_weak");
    [description.id, note.id] = ["milvus-spec-overall-guide", "milvus-spec-overall-note"];
    box.append(input(item.id, "디자인 명세 붙여 넣기", item.input, DESIGN_SPEC_PLACEHOLDER, inputs), note);
    inputs.get(item.id)!.setAttribute("aria-describedby", `${description.id} ${note.id}`);
  } else if (item.id === "fixed") {
    box.append(fixedView());
  } else {
    const entries = valueEntries(item);
    if (entries.length) box.append(valueTable(entries));
    if (item.input !== "none") box.append(input(item.id, `${item.label} 요청`, item.input, placeholder, inputs));
  }
  return box;
}

const pad = (n: number) => String(n).padStart(2, "0");
const stamp = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** 요청 파일을 읽는다. 서버가 없으면(정적 빌드) JSON이 아니어서 던진다 */
async function readRequestFile(): Promise<{ ok: boolean; status: number; error?: string; text: string | null; writable: boolean }> {
  const res = await fetch(ENDPOINT);
  const body = await res.json();
  return { ok: res.ok, status: res.status, error: body.error, text: typeof body.text === "string" ? body.text : null, writable: !!body.writable };
}

export function renderBrandSpec(): HTMLElement {
  const inputs: Fields = new Map();
  // 연 때(또는 마지막 저장 때) 파일의 요청. 이것과 같은 입력은 사용자가 바꾸지 않은 것이다
  let opened = new Map<string, string>();

  const fileStatus = el("p", { role: "status" }, "요청 파일을 읽는 중입니다");
  // hidden 속성은 slds-notify_alert의 display에 져서 slds-hide로 숨긴다
  const reason = el("div", { className: "slds-notify slds-notify_alert slds-alert_warning slds-hide", role: "alert" });
  const saveButton = el("button", { type: "button", className: "slds-button slds-button_brand", disabled: true }, "저장");
  const saveMessage = el("span", { role: "status" });
  const toolbar = el("div", { className: "sb-row slds-p-vertical_small" }, saveButton, saveMessage);
  Object.assign(toolbar.style, { position: "sticky", top: "0", zIndex: "1", background: "var(--slds-g-color-surface-1, #fff)" });

  const { brand } = brandNow();
  // 프로젝트 브랜드를 보고 있지 않으면(툴바가 SLDS 기본이거나 프로젝트 브랜드를 읽지 못함) 지금 값이 프로젝트 값이 아니어서 '지금:'을 새로 적지 않는다
  const notProject = brand !== brands[0] || !!brand.error;
  const page = el(
    "div",
    { className: "sb-stack" },
    el("h2", { className: "slds-text-heading_large" }, "브랜드 명세"),
    para("입력은 브랜드 색, 로고, 피드백 색, 디자인 명세 네 가지이고 모두 선택이다. 다 채우지 않아도 된다. 저장하면 프로젝트의 docs/milvus/brand-request.md가 된다. Claude에게 \"브랜드 요청 반영해줘\"라고 하면 milvus-brand skill이 이 파일을 읽어 반영한다. 빈 칸은 파일에 적지 않는다"),
    para(`지금 값은 툴바에서 고른 브랜드(${brand.label}) 기준이다. 저장할 때 항목마다 '지금:' 줄에 이 값을 함께 적는다`, "slds-text-color_weak"),
    reason,
  );
  const warn = (text: string) => page.append(el("div", { className: "slds-notify slds-notify_alert slds-alert_warning", role: "alert" }, text));
  if (mode === "project" && brand.error) warn("프로젝트 브랜드를 읽지 못해 지금 값은 SLDS 기본 값입니다(위 오류 알림 참고). 고치기 전에 저장하면 '지금:' 줄은 새로 적지 않습니다(기존 줄은 그대로 둡니다)");
  else if (mode === "project" && notProject) warn(`프로젝트 브랜드가 아닌 ${brand.label}을 보고 있습니다. 이대로 저장하면 '지금:' 줄은 새로 적지 않습니다(기존 줄은 그대로 둡니다). 새로 적으려면 툴바에서 프로젝트 브랜드를 고르세요`);
  page.append(fileStatus, toolbar);

  page.append(el("h3", { className: "slds-text-heading_medium slds-m-top_large" }, "입력"));
  for (const item of SPEC_ITEMS.filter((i) => i.input !== "none")) page.append(itemView(item, inputs));
  // 옛 세부 절(lib/request.ts legacySections). 파일을 읽은 뒤 showFile이 채운다
  const legacyBox = el("div", { className: "slds-box slds-m-top_small slds-hide" });
  page.append(legacyBox);

  const reference = SPEC_ITEMS.filter((i) => i.input === "none" && i.group !== "표시만");
  page.append(
    el("h3", { className: "slds-text-heading_medium slds-m-top_large" }, "바꿀 수 있는 것"),
    para("입력 칸이 없는 참고 목록이다. 디자인 명세에 붙여 넣은 내용을 Claude가 이 항목들로 나눠 반영한다. 특정 항목만 바꾸고 싶으면 디자인 명세에 항목 이름과 함께 적는다. 디자인 명세는 이전에 저장한 세부 요청보다 우선한다", "slds-text-color_weak"),
  );
  for (const group of [...new Set(reference.map((i) => i.group))]) {
    page.append(el("h4", { className: "slds-text-title_caps slds-m-top_medium" }, group));
    for (const item of reference.filter((i) => i.group === group)) page.append(itemView(item, inputs, "h5"));
  }
  page.append(
    el("h3", { className: "slds-text-heading_medium slds-m-top_large" }, "바꿀 수 없는 것"),
    para("요청해도 바꿀 수 없다. Claude는 이 항목의 요청에 바꿀 수 없다고 답하고 대안이 있으면 알려 준다(설계 9.4)", "slds-text-color_weak"),
  );
  for (const item of SPEC_ITEMS.filter((i) => i.group === "표시만")) page.append(itemView(item, inputs));
  for (const [id, field] of inputs) {
    field.addEventListener("input", () => (field.value === (opened.get(id) ?? "") ? drafts.delete(id) : drafts.set(id, field.value)));
  }

  /** 파일 r을 연 것으로 하고 입력마다 pick(id, 파일의 요청)을 넣는다 */
  const fill = (r: BrandRequest, pick: (id: string, fromFile: string) => string) => {
    opened = new Map(r.sections.map((s) => [s.id, s.request]));
    for (const [id, field] of inputs) {
      field.value = pick(id, opened.get(id) ?? "");
      field.dispatchEvent(new Event("input"));
    }
  };

  const showFile = (r: BrandRequest) => {
    const parts = [r.savedAt ? `마지막 저장 ${r.savedAt}` : "저장 시각 없음", r.appliedAt ? `Claude 반영 ${r.appliedAt} (다시 저장하면 반영 표시를 지운다)` : "아직 반영 표시 없음"];
    // 2026-10-20 전에 항목별 입력으로 저장한 절(## 모서리 등). 지우지 않고 내용을 보여 준다
    const legacy = legacySections(r);
    if (legacy.length) parts.push(`이전에 저장한 세부 요청 ${legacy.length}개가 있다(아래 입력 다음)`);
    if (r.unknown.length > legacy.length) parts.push(`명세 항목이 아닌 줄·절 ${r.unknown.length - legacy.length}개는 저장해도 그대로 남는다`);
    fileStatus.textContent = `docs/milvus/brand-request.md: ${parts.join(". ")}`;
    legacyBox.replaceChildren();
    legacyBox.classList.toggle("slds-hide", !legacy.length);
    if (!legacy.length) return;
    const summary = el("summary", {}, `이전에 저장한 세부 요청 ${legacy.length}개`);
    Object.assign(summary.style, { display: "list-item", cursor: "pointer" });
    const blocks = legacy.map((block) => {
      const pre = el("pre", { className: "slds-m-top_x-small" }, block);
      Object.assign(pre.style, { whiteSpace: "pre-wrap", overflowWrap: "anywhere" });
      return pre;
    });
    legacyBox.append(
      el("h4", { className: "slds-text-heading_small" }, "이전에 저장한 세부 요청"),
      para("2026-10-20 전에 항목별 입력으로 저장한 요청이다. 저장해도 그대로 남고 Claude가 그 항목에 반영한다. 디자인 명세와 같은 항목을 다루면 디자인 명세가 우선하고, Claude가 반영 전에 어느 쪽인지 확인을 받는다. 필요 없으면 docs/milvus/brand-request.md에서 그 절을 지운다"),
      el("details", { className: "slds-m-top_x-small" }, summary, ...blocks),
    );
  };

  const enable = (why?: string) => {
    for (const field of inputs.values()) field.disabled = !!why;
    saveButton.disabled = !!why;
    reason.classList.toggle("slds-hide", !why);
    reason.textContent = why ?? "";
  };

  void (async () => {
    let file;
    try {
      file = await readRequestFile();
    } catch {
      fileStatus.textContent = "";
      return enable("정적 빌드에는 저장 서버가 없어 입력을 껐습니다. 입력과 저장은 pnpm milvus storybook(개발 서버)에서 합니다");
    }
    if (!file.ok) {
      fileStatus.textContent = "";
      return enable(`요청 파일을 읽지 못해 입력을 껐습니다: ${file.error ?? `HTTP ${file.status}`}`);
    }
    if (!file.writable) {
      fileStatus.textContent = "";
      return enable("저장소 Storybook에서는 요청 파일을 읽거나 쓰지 않아 입력을 껐습니다. 고객 프로젝트에서 pnpm milvus storybook으로 열면 저장할 수 있습니다");
    }
    const r = file.text === null ? undefined : parseRequest(file.text);
    // 툴바에서 브랜드를 바꿔 다시 그려도 저장하지 않은 입력은 남는다
    fill(r ?? { sections: [], unknown: [] }, (id, fromFile) => drafts.get(id) ?? fromFile);
    if (r) showFile(r);
    else fileStatus.textContent = "docs/milvus/brand-request.md가 아직 없습니다. 저장하면 만든다";
    enable();
  })();

  saveButton.addEventListener("click", async () => {
    saveButton.disabled = true;
    saveMessage.textContent = "저장하는 중입니다";
    try {
      // 페이지를 연 뒤 편집기로 고친 파일을 덮지 않도록 저장 직전에 다시 읽는다.
      // 바꾸지 않은 입력은 지금 파일의 요청을 따르고, 명세 항목이 아닌 줄·절도 지금 파일의 것을 쓴다
      const file = await readRequestFile();
      if (!file.ok) throw new Error(file.error ?? `HTTP ${file.status}`);
      const fresh = file.text === null ? { sections: [], unknown: [] } : parseRequest(file.text);
      const base = opened;
      fill(fresh, (id, fromFile) => {
        const mine = inputs.get(id)!.value;
        return mine.trim() === (base.get(id) ?? "") ? fromFile : mine;
      });

      const savedAt = stamp(new Date());
      // 프로젝트 브랜드를 보고 있지 않으면 지금 값을 모르므로 파일의 '지금:' 줄을 그대로 둔다
      const values = new Map([...inputs].map(([id, field]) => [id, field.value]));
      const text = serializeRequest(saveRequest(fresh, values, savedAt, notProject ? undefined : currentFor));
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const body: { error?: string } = await res.json().catch(() => ({}));
      if (res.ok) {
        const saved = parseRequest(text);
        drafts.clear();
        opened = new Map(saved.sections.map((s) => [s.id, s.request]));
        showFile(saved);
        saveMessage.textContent = `저장했습니다(${savedAt}). Claude에게 "브랜드 요청 반영해줘"라고 하세요`;
      } else {
        saveMessage.textContent = `${SAVE_ERRORS[res.status] ?? `저장하지 못했습니다(HTTP ${res.status})`}${body.error ? `: ${body.error}` : ""}`;
      }
    } catch (e) {
      saveMessage.textContent =
        e instanceof TypeError || e instanceof SyntaxError
          ? "저장하지 못했습니다: 개발 서버에 연결할 수 없습니다. Storybook이 켜져 있는지 확인하세요"
          : `저장하지 못했습니다: 요청 파일을 다시 읽지 못했습니다(${(e as Error).message})`;
    } finally {
      saveButton.disabled = false;
    }
  });

  return page;
}
