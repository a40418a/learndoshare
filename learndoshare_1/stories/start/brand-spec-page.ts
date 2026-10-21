// 브랜드 명세 페이지(설계 6.1, 9.3). 입력은 브랜드 색·로고·피드백 색·디자인 명세 네 가지이고(2026-10-20 사용자 피드백),
// 나머지 SPEC_ITEMS는 접은 "바꿀 수 있는 것"(이름·예시)과 "바꿀 수 없는 것"(이름)으로만 그린다. 사용자 화면에는 할 일만 쓰고
// 한계·native·설계 참조는 보이지 않는다(#65). 그 내용은 SPEC_ITEMS에 그대로 있어 milvus-brand skill이 쓴다. 저장하면 프로젝트의 docs/milvus/brand-request.md를 쓴다.
// 요청 파일은 lib/storybook-plugin.ts의 /__milvus/brand-request(GET { text, writable }, POST { text })로 읽고 쓴다. 정적 빌드와 저장소 모드에서는 입력을 끈다
// 사용자 입력과 파일 내용은 textContent·value로만 넣는다(innerHTML을 쓰지 않는다)
import { brands, mode } from "../../.storybook/brand.ts";
import { FIXED_ITEMS } from "../../lib/fixed-list.ts";
import { brandPalette } from "../../lib/palette.ts";
import { FEEDBACK_KINDS, legacySections, parseRequest, REQUEST_SECTIONS, saveRequest, serializeRequest, type BrandRequest } from "../../lib/request.ts";
import { SPEC_ITEMS, type SpecItem } from "../../lib/spec-items.ts";

const ENDPOINT = "/__milvus/brand-request";

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
  400: "저장하지 못했습니다. 페이지를 새로 고친 뒤 다시 저장하세요",
  403: "저장하지 못했습니다. 프로젝트 폴더에서 pnpm milvus storybook으로 연 화면에서 저장하세요",
  413: "내용이 너무 깁니다. 1MB 이하로 줄여 저장하세요",
  500: "파일을 쓰지 못했습니다. 프로젝트 폴더의 쓰기 권한을 확인하세요",
};

// 입력 네 칸의 안내(사용자 화면). SPEC_ITEMS의 description·limits는 skill용이라 여기에 쓰지 않는다
const GUIDE: Record<string, string> = {
  "brand-color": "버튼과 링크에 쓸 브랜드 색을 적으세요. 예: #4A154B, \"딥그린\"",
  logo: "로고 파일 경로를 적으세요. 프로젝트 폴더 기준입니다",
  feedback: "성공·경고·오류·정보 메시지 색을 바꾸려면 적으세요",
  overall: "다른 디자인 시스템의 표, 피그마 토큰, 사이트 주소, 원하는 느낌을 그대로 붙여 넣으세요",
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
  const now = para(`지금: 브랜드 색 ${color ?? "Salesforce 기본"} · 버튼 ${b50} · 링크 ${b40}`, "slds-text-color_weak");
  // 요청에 #RRGGBB가 있으면 Salesforce가 만들 팔레트를 미리 보여 준다
  const preview = el("p", { className: "slds-m-top_x-small", role: "status" });
  field.addEventListener("input", () => {
    const hex = /#[0-9a-f]{6}(?![0-9a-f])/i.exec(field.value)?.[0];
    if (!hex) return void (preview.textContent = "");
    const p = brandPalette(hex);
    preview.textContent = `${hex.toUpperCase()}로 하면 버튼은 ${p[50].toUpperCase()}, 링크는 ${p[40].toUpperCase()}로 보입니다(Salesforce가 글자가 잘 보이는 색으로 바꿉니다)`;
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
    el("div", { className: "sb-row" }, sample, `지금: 글자 ${t} · 배경 ${b}`),
    input(`feedback-${kind}`, title, "color", "예: 글자 #1B5E20, 배경 #E8F5E9", inputs),
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

function inputCard(item: SpecItem, inputs: Fields): HTMLElement {
  const box = el("section", { className: "slds-box slds-m-top_small" }, el("h4", { className: "slds-text-heading_small" }, item.label), para(GUIDE[item.id] ?? ""));
  const placeholder = item.examples.length ? `예: ${item.examples.join(" / ")}` : "";
  if (item.id === "brand-color") {
    box.append(brandColorView(input(item.id, "브랜드 색", item.input, placeholder, inputs).querySelector("textarea")!));
    box.append(inputs.get(item.id)!.closest(".slds-form-element")!);
  } else if (item.id === "logo") {
    const { brand } = brandNow();
    if (brand.logoUrl) box.append(el("img", { src: brand.logoUrl, alt: `${brand.label} 로고`, height: 48 }));
    box.append(input(item.id, "로고 파일 경로", "path", "assets/logo.png", inputs));
  } else if (item.id === "feedback") {
    for (const [kind, name] of FEEDBACK_KINDS) box.append(feedbackRow(kind, name, REQUEST_SECTIONS.find((s) => s.id === `feedback-${kind}`)!.title, inputs));
  } else if (item.id === "overall") {
    box.append(input(item.id, "디자인 명세", item.input, DESIGN_SPEC_PLACEHOLDER, inputs));
  }
  return box;
}

/** 접어 둔 목록. SLDS 리셋이 summary의 펼침 표시를 지우므로 되살린다 */
function folded(title: string, ...children: Node[]): HTMLElement {
  const summary = el("summary", { className: "slds-text-heading_small" }, title);
  Object.assign(summary.style, { display: "list-item", cursor: "pointer" });
  return el("details", { className: "slds-box slds-m-top_small" }, summary, ...children);
}

function changeableList(): HTMLElement {
  const items = SPEC_ITEMS.filter((i) => i.input === "none" && i.group !== "표시만");
  const groups = [...new Set(items.map((i) => i.group))].map((group) =>
    el(
      "div",
      { className: "slds-m-top_small" },
      el("h5", { className: "slds-text-title_bold" }, group),
      el("ul", { className: "slds-list_dotted" }, ...items.filter((i) => i.group === group).map((i) => el("li", {}, i.examples.length ? `${i.label}: ${i.examples.map((e) => `"${e}"`).join(", ")}` : i.label))),
    ),
  );
  return folded(`바꿀 수 있는 것 (${items.length}가지)`, para("디자인 명세에 이런 식으로 적으세요."), ...groups);
}

function fixedList(): HTMLElement {
  const labels = [...SPEC_ITEMS.filter((i) => i.group === "표시만" && i.id !== "fixed").map((i) => i.label), ...FIXED_ITEMS.filter((f) => f.mode === "both").map((f) => f.label)];
  return folded(`바꿀 수 없는 것 (${labels.length}가지)`, para("Salesforce가 정해 둔 값이라 요청해도 바뀌지 않습니다."), el("ul", { className: "slds-list_dotted slds-m-top_x-small" }, ...labels.map((l) => el("li", {}, l))));
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

  const fileStatus = el("p", { role: "status", className: "slds-text-color_weak" }, "불러오는 중입니다");
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
    el(
      "ol",
      { className: "slds-list_ordered slds-m-top_x-small" },
      el("li", {}, "바꾸고 싶은 칸만 적으세요. 빈 칸은 그대로 둡니다."),
      el("li", {}, "저장을 누르세요."),
      el("li", {}, "Claude Code에 \"브랜드 요청 반영해줘\"라고 하세요."),
    ),
    reason,
  );
  const warn = (text: string) => page.append(el("div", { className: "slds-notify slds-notify_alert slds-alert_warning", role: "alert" }, text));
  if (mode === "project" && brand.error) warn("프로젝트 브랜드를 읽지 못했습니다. 위 오류 알림을 확인하세요");
  else if (mode === "project" && notProject) warn(`지금 ${brand.label}을 보고 있습니다. 툴바에서 프로젝트 브랜드를 고른 뒤 저장하세요`);
  page.append(fileStatus, toolbar);

  for (const item of SPEC_ITEMS.filter((i) => i.input !== "none")) page.append(inputCard(item, inputs));
  // 옛 세부 절(lib/request.ts legacySections). 파일을 읽은 뒤 showFile이 채운다
  const legacyBox = el("div", { className: "slds-box slds-m-top_small slds-hide" });
  page.append(legacyBox);

  page.append(changeableList(), fixedList());
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
    const parts = [r.savedAt ? `마지막 저장 ${r.savedAt}` : "", r.appliedAt ? `Claude 반영 ${r.appliedAt}` : "아직 반영 전"].filter(Boolean);
    // 2026-10-20 전에 항목별 입력으로 저장한 절(## 모서리 등). 지우지 않고 내용을 보여 준다
    const legacy = legacySections(r);
    fileStatus.textContent = parts.join(" · ");
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
    // 2026-10-20 전에 항목별로 저장한 요청. 저장해도 남고 Claude가 반영한다(디자인 명세와 겹치면 Claude가 확인을 받는다)
    legacyBox.append(
      el("h4", { className: "slds-text-heading_small" }, "예전에 저장한 요청"),
      para("그대로 반영됩니다. 필요 없으면 docs/milvus/brand-request.md에서 지우세요."),
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
      return enable("여기서는 저장할 수 없습니다. 프로젝트 폴더에서 pnpm milvus storybook으로 여세요");
    }
    if (!file.ok) {
      fileStatus.textContent = "";
      return enable(`요청 파일을 읽지 못했습니다: ${file.error ?? `HTTP ${file.status}`}`);
    }
    if (!file.writable) {
      fileStatus.textContent = "";
      return enable("여기서는 저장할 수 없습니다. 프로젝트 폴더에서 pnpm milvus storybook으로 여세요");
    }
    const r = file.text === null ? undefined : parseRequest(file.text);
    // 툴바에서 브랜드를 바꿔 다시 그려도 저장하지 않은 입력은 남는다
    fill(r ?? { sections: [], unknown: [] }, (id, fromFile) => drafts.get(id) ?? fromFile);
    if (r) showFile(r);
    else fileStatus.textContent = "아직 저장한 요청이 없습니다";
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
