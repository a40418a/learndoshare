// 반영 검사 페이지(설계 9.6의 2). 스토리마다 기본 브랜드와 센티널 브랜드(lib/sentinel.ts)로 iframe을 하나씩 열어
// shadowRoot까지 내려가며 요소마다 getComputedStyle(::before·::after 포함)을 비교하고, lib/reflect.ts로 명세 항목의 반영·빈틈·고정을 낸다.
// - 센티널은 스토리 URL의 globals=brand:milvus-sentinel로 연다(.storybook/brand.ts SENTINEL). 처음부터 센티널로 그린다
// - 재기 전에 두 문서의 움직임을 멈춘다(transition은 끝 값, animation은 처음 값). 센티널 시간(0.777s)이 길어 중간값을 읽지 않게 한다
// - disabled는 스토리 변형(disabled 스토리)에서 :disabled·aria-disabled 요소로 잰다. focus는 focus()를 부르고 transition을 끝낸 뒤 잰다
// - 판정은 컴포넌트 호스트(lightning-*, c-*)와 그 shadow 안의 요소만 한다(슬롯에 넣은 예제 내용은 뺀다). 상속 속성은 컴포넌트 경계에서 한 번 센다
// - 두 그림의 요소 수가 다르면(가상 스크롤, 넘침 메뉴처럼 크기에 따라 그리는 것) 그 스토리는 비교하지 않고 "재지 못한 스토리"에 적는다
// - 처음에는 사람이 버튼으로 돌린다(CI는 헤드리스 브라우저라는 새 의존성이 필요하다)
// 스토리 이름·값은 textContent로만 넣는다(innerHTML을 쓰지 않는다)
import { brandColorHooks, missing, sentinelCss, sentinelHooks } from "virtual:milvus-sentinel";
import { brands, SENTINEL } from "../../.storybook/brand.ts";
import { FIXED_ITEMS } from "../../lib/fixed-list.ts";
import {
  cellLabel,
  FOCUS_PROPS,
  fingerprintKey,
  hookItems,
  INHERITED,
  itemScore,
  judgeProbe,
  PROBE_PROP,
  STATIC_PROPS,
  UNMATCHED_FIXED,
  type Cell,
  type JudgeContext,
  type Probe,
  type State,
} from "../../lib/reflect.ts";
import type { Kind } from "../../lib/sentinel.ts";
import { SPEC_ITEMS } from "../../lib/spec-items.ts";

// ponytail: 동시에 그리는 스토리 3개(iframe 6개), 스토리마다 포커스 요소 6개까지. 느리면 숫자를 바꾼다
const PAIRS = 3;
const MAX_FOCUS = 6;
const READY_MS = 20_000;
const SETTLE_MS = 300;
const PSEUDOS = ["", "::before", "::after"];
// 반영 검사가 재는 스토리. 시작하기·Foundations는 hook 값을 그대로 찍는 문서라 뺀다. "원본과 hook"은 원본 코드 화면이다
const DOC_TITLE = /^(시작하기|Foundations)\//;
const SOURCE_STORY = "SourceAndHooks";
// body 바로 아래에서 건너뛸 Storybook 요소(스토리 영역 #storybook-root만 남긴다)와 브랜드 오류 배너
const SKIP_TAGS = new Set(["script", "style", "link", "noscript", "template"]);
const SKIP_IDS = /^(storybook-(?!root$)|milvus-brand-error$|milvus-spec-probe$)/;
// 스토리의 보조 배치 클래스(.storybook/preview.css의 sb-row·sb-code 등)는 컴포넌트가 아니라 판정하지 않는다. 그 안의 컴포넌트는 잰다
const isHelper = (e: Element) => [...e.classList].some((k) => k.startsWith("sb-"));
// 판정은 컴포넌트(lightning-*, 밀버스·프로젝트 c-*) 안의 요소만 한다. 공식 예제의 틀(kbd, 예제 배경 div)은 컴포넌트가 아니다
const COMPONENT_HOST = /^(lightning|c)-/;

type Entry = { id: string; title: string; name: string; type: string; exportName?: string };
/** owner: 이 요소의 스타일을 정하는 컴포넌트 태그(고정 매처의 컴포넌트 폴더 이름에 쓴다). 호스트는 자기 태그, 그 shadow 안은 그 호스트다 */
type Box = { el: Element; parent: number; disabled: boolean; judged: boolean; owner: string; host: boolean };
type Row = { comp: string; item: string; selector: string; prop: string; value: string; story: string; fixed?: string; count: number };
type Tally = {
  table: Map<string, Map<string, Cell>>;
  gaps: Map<string, Row>;
  fixed: Map<string, Row>;
  errors: [story: string, message: string][];
  done: number;
  /** 브랜드 색과 같아 판정하지 않은 값의 수 */
  brand: number;
};

type Props<K extends keyof HTMLElementTagNameMap> = Partial<Omit<HTMLElementTagNameMap[K], "style">>;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props<K> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));
const label = (id: string) => SPEC_ITEMS.find((i) => i.id === id)?.label ?? id;
const compOf = (e: Entry) => e.title.replace(/^컴포넌트\//, "");

// 스토리를 iframe에 그린다. 지우는 일은 부르는 쪽이 한다(렌더가 실패해도 지운다)
function frameOf(entry: Entry, sentinel: boolean, area: HTMLElement): HTMLIFrameElement {
  // a11y 애드온의 자동 검사를 끈다(스토리마다 axe가 돌아 느려진다)
  const globals = `${sentinel ? `brand:${SENTINEL};` : ""}a11y.manual:!true`;
  const frame = el("iframe", {
    src: `iframe.html?id=${encodeURIComponent(entry.id)}&viewMode=story&globals=${globals}`,
    title: `${entry.title} / ${entry.name} (${sentinel ? "센티널" : "기본"})`,
    width: "480",
    height: "320",
  });
  return area.appendChild(frame);
}

// 렌더가 끝날 때까지(Storybook 10 렌더 단계 completed·finished, 오류면 sb-show-errordisplay) 기다린다
async function ready(frame: HTMLIFrameElement): Promise<void> {
  const start = Date.now();
  // 짝 iframe이 실패해 이 iframe을 지웠으면 그만 기다린다
  while (frame.isConnected) {
    const win = frame.contentWindow as (Window & { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } }) | null;
    const phase = win?.__STORYBOOK_PREVIEW__?.currentRender?.phase;
    if (phase === "errored" || win?.document.body?.classList.contains("sb-show-errordisplay")) throw new Error("스토리를 그리다 오류가 났다");
    if (phase === "completed" || phase === "finished") break;
    if (Date.now() - start > READY_MS) throw new Error(`${READY_MS / 1000}초 안에 다 그리지 못했다`);
    await sleep(50);
  }
  // LWC가 렌더 뒤에 비동기로 그리는 부분(아이콘 등)을 기다린다
  await sleep(SETTLE_MS);
}

// shadowRoot까지 내려가며 요소를 앞순서로 모은다. synthetic shadow에서 호스트의 children은 light DOM(슬롯에 넣은 요소)이다
function collect(doc: Document): Box[] {
  const out: Box[] = [];
  // 컴포넌트 호스트와 그 shadow 안만 판정한다. 호스트의 클래스(lightning-badge.slds-badge, lightning-progress-step.slds-path__item)는
  // 컴포넌트가 붙인다. 컴포넌트에 슬롯으로 넣은 light DOM(예제의 본문 p, custom-box div)은 예제 것이라 판정하지 않는다
  const visit = (e: Element, parent: number, disabled: boolean, inside: boolean, owner: string) => {
    const d = disabled || e.matches(":disabled, [aria-disabled='true']");
    const host = COMPONENT_HOST.test(e.localName);
    const i = out.push({ el: e, parent, disabled: d, judged: (inside || host) && !isHelper(e), owner: host ? e.localName : owner, host }) - 1;
    for (const c of e.shadowRoot?.children ?? []) visit(c, i, d, inside || host, e.localName);
    for (const c of e.children) visit(c, i, d, inside, owner);
  };
  for (const c of doc.body.children) {
    if (!SKIP_TAGS.has(c.localName) && !SKIP_IDS.test(c.id) && !isHelper(c)) visit(c, -1, false, false, "");
  }
  return out;
}

function snap(e: Element, pseudo: string, props: string[]): Record<string, string> | undefined {
  const cs = e.ownerDocument.defaultView!.getComputedStyle(e, pseudo || null);
  if (pseudo && /^(none|normal)$/.test(cs.content)) return undefined;
  return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
}

const selectorOf = (e: Element, pseudo: string, state: State) =>
  e.localName +
  [...e.classList].map((c) => `.${c}`).join("") +
  (e.localName === "input" ? `[type='${(e as HTMLInputElement).type}']` : "") +
  (e.hasAttribute("readonly") ? "[readonly]" : "") +
  (e.getAttribute("part") ? `[part='${e.getAttribute("part")}']` : "") +
  (state === "focus" ? ":focus" : "") +
  pseudo;

// 가까운 조상 셋의 선택자(먼 것부터). 고정 목록의 후손 선택자(.slds-theme_x a, 애니메이션 아이콘 안의 svg)를 맞출 때만 쓴다
function contextOf(nodes: Box[], i: number): string[] {
  const out: string[] = [];
  for (let p = nodes[i].parent; p >= 0 && out.length < 3; p = nodes[p].parent) out.unshift(selectorOf(nodes[p].el, "", "static"));
  return out;
}

// 고정 매처에 넘길 요소 정보: 조상(합의한 후손 선택자 항목만 쓴다), 호스트 태그, 첫째·마지막 자식
const whereOf = (nodes: Box[], i: number): Pick<Probe, "context" | "host" | "nth"> => ({
  context: contextOf(nodes, i),
  host: nodes[i].owner,
  nth: [":first-child", ":last-child"].filter((n) => nodes[i].el.matches(n)),
});

// 움직임을 멈춘다. transition은 끝 값으로 보내고, animation(무한 반복은 끝낼 수 없다)은 멈추고 처음 값으로 맞춘다.
// 센티널 시간(0.777s)이 기본보다 길어 렌더 뒤에 움직이는 요소(팝오버, carousel, 점 애니메이션)의 중간값을 읽지 않게 한다
function settle(doc: Document) {
  for (const a of doc.getAnimations()) {
    if ("transitionProperty" in a) a.finish();
    else {
      a.pause();
      a.currentTime = 0;
    }
  }
}

// 센티널 hook마다 계산값을 재어 지문을 만들고, 기본 브랜드에서 브랜드 색 계열을 잰다(lib/reflect.ts JudgeContext)
function buildContext(baseDoc: Document, sentDoc: Document): JudgeContext {
  const measure = (doc: Document, name: string, prop: string) => {
    if (!doc.defaultView!.getComputedStyle(doc.documentElement).getPropertyValue(name).trim()) return undefined;
    const probe = doc.body.appendChild(doc.createElement("div"));
    probe.style.cssText = "position:absolute;visibility:hidden;display:block";
    probe.style.setProperty(prop, `var(${name})`);
    const value = doc.defaultView!.getComputedStyle(probe).getPropertyValue(prop);
    probe.remove();
    return value;
  };
  const fingerprints = new Map<string, string[]>();
  for (const [name, kind] of sentinelHooks as [string, Kind][]) {
    // :root의 일반 속성(letter-spacing)은 var()로 읽을 수 없다. 자간은 속성 묶음으로 센다
    if (!name.startsWith("--")) continue;
    const prop = PROBE_PROP[kind];
    const value = prop && measure(sentDoc, name, prop);
    const key = value && fingerprintKey(kind, value);
    if (key) fingerprints.set(key, [...(fingerprints.get(key) ?? []), name]);
  }
  const palette = Object.keys(brands[0].palette).map((s) => `--slds-r-color-brand-${s}`);
  const brandColors = new Set([...brandColorHooks, ...palette].map((n) => measure(baseDoc, n, "color")).filter((v): v is string => !!v));
  return { fingerprints, hookItems: hookItems(SPEC_ITEMS), brandColors, fixed: FIXED_ITEMS };
}

function record(t: Tally, story: string, p: Probe, ctx: JudgeContext) {
  for (const v of judgeProbe(p, ctx)) {
    if (v.status === "brand") {
      t.brand++;
      continue;
    }
    const row = t.table.get(p.comp) ?? new Map<string, Cell>();
    t.table.set(p.comp, row);
    const cell = row.get(v.item) ?? { reached: 0, gap: 0, fixed: 0 };
    cell[v.status]++;
    row.set(v.item, cell);
    if (v.status === "reached") continue;
    const list = v.status === "gap" ? t.gaps : t.fixed;
    const key = [p.comp, v.item, p.selector, p.prop, p.base].join("|");
    const prev = list.get(key);
    if (prev) prev.count++;
    else list.set(key, { comp: p.comp, item: v.item, selector: p.selector, prop: p.prop, value: p.base, story, fixed: v.fixed, count: 1 });
  }
}

// 포커스로 값이 바뀌는 요소: 포커스 받은 요소와 조상 둘, 다음 형제와 그 자손(체크박스는 input 다음 label 안의 faux가 링을 그린다)
function focusTargets(nodes: Box[], i: number): number[] {
  const out = [i];
  for (let p = nodes[i].parent, n = 0; p >= 0 && n < 2; p = nodes[p].parent, n++) out.push(p);
  const sibling = nodes[i].el.nextElementSibling;
  const s = sibling ? nodes.findIndex((n) => n.el === sibling) : -1;
  const under = (j: number, root: number): boolean => j === root || (j >= 0 && under(nodes[j].parent, root));
  for (let j = s; j >= 0 && j < nodes.length && j < s + 30 && under(j, s); j++) out.push(j);
  return out;
}

/**
 * 포커스하고 읽는다. :focus가 맞지 않으면 까닭을 가른다
 * - "element": 요소가 포커스를 받지 못한다(href 없는 a, 숨긴 패널 안의 버튼). 그 요소만 건너뛴다
 * - "window": 브라우저 창에 포커스가 없다. iframe 창을 포커스해 봐도 문서에 포커스가 없으면 이 경우다
 * 바깥 문서의 hasFocus()로는 가르지 못한다. 포커스를 가진 iframe을 지우면 창이 앞에 있어도 거짓이 된다(실측)
 */
function focusAndRead(nodes: Box[], i: number, targets: number[]): Record<string, string>[][] | "element" | "window" {
  const doc = nodes[i].el.ownerDocument;
  (nodes[i].el as HTMLElement).focus({ preventScroll: true, focusVisible: true } as FocusOptions);
  if (!nodes[i].el.matches(":focus")) {
    doc.defaultView!.focus();
    return doc.hasFocus() ? "element" : "window";
  }
  // 포커스 링의 transition을 끝까지 돌려 끝 값을 읽는다
  for (const a of doc.getAnimations()) if ("transitionProperty" in a) a.finish();
  const read = targets.map((j) => PSEUDOS.map((ps) => snap(nodes[j].el, ps, FOCUS_PROPS) ?? {}));
  (nodes[i].el as HTMLElement).blur();
  return read;
}

async function measure(entry: Entry, area: HTMLElement, t: Tally, getCtx: (b: Document, s: Document) => JudgeContext) {
  const frames = [frameOf(entry, false, area), frameOf(entry, true, area)];
  try {
    await Promise.all(frames.map(ready));
    const [baseDoc, sentDoc] = frames.map((f) => f.contentDocument!);
    const ctx = getCtx(baseDoc, sentDoc);
    settle(baseDoc);
    settle(sentDoc);
    let [base, sent] = [collect(baseDoc), collect(sentDoc)];
    if (base.length !== sent.length) {
      await sleep(800);
      // 기다리는 사이에 시작한 움직임도 멈춘다
      settle(baseDoc);
      settle(sentDoc);
      [base, sent] = [collect(baseDoc), collect(sentDoc)];
    }
    if (base.length !== sent.length || base.some((n, i) => n.el.localName !== sent[i].el.localName)) {
      t.errors.push([`${entry.title} / ${entry.name}`, `요소가 맞지 않아 비교하지 않았다(기본 ${base.length}개, 센티널 ${sent.length}개)`]);
      return;
    }
    const comp = compOf(entry);
    const story = entry.name;
    const own = new Map<number, [Record<string, string>, Record<string, string>]>();
    for (let i = 0; i < base.length; i++) {
      const state: State = base[i].disabled ? "disabled" : "static";
      for (const pseudo of PSEUDOS) {
        const [b, s] = [snap(base[i].el, pseudo, STATIC_PROPS), snap(sent[i].el, pseudo, STATIC_PROPS)];
        if (!b || !s) continue;
        if (!pseudo) own.set(i, [b, s]);
        // 가상 요소는 자기 요소에게서, 요소는 부모 요소에게서 상속한다
        const parent = pseudo ? own.get(i) : own.get(base[i].parent);
        if (!base[i].judged) continue;
        // 컴포넌트 경계(부모가 판정 밖)에서는 상속으로 바뀐 값(:root 자간, body 글자색 등)도 그 컴포넌트에 닿은 것으로 센다
        const boundary = !pseudo && !base[base[i].parent]?.judged;
        const selector = selectorOf(base[i].el, pseudo, state);
        const where = whereOf(base, i);
        for (const prop of STATIC_PROPS) {
          // 호스트의 바깥 여백은 놓인 자리(예제 배치의 slds-m-* 클래스)가 정한다
          if (base[i].host && prop.startsWith("margin-")) continue;
          const p: Probe = { comp, selector, ...where, prop, base: b[prop], sentinel: s[prop], state, fontSize: [b["font-size"], s["font-size"]], el: b };
          if (parent && INHERITED.has(prop) && !(boundary && b[prop] !== s[prop])) p.parent = [parent[0][prop], parent[1][prop]];
          record(t, story, p, ctx);
        }
      }
    }

    // focus: 포커스 전과 값이 달라진 속성만 본다(포커스 링). 두 문서를 차례로 포커스하고 바로 읽는다(한 번에 한 요소만 포커스를 가진다)
    const focusable = base
      .map((n, i) => [n, i] as const)
      .filter(([n]) => n.judged && (n.el as HTMLElement).tabIndex >= 0 && !n.disabled && typeof (n.el as HTMLElement).focus === "function")
      .slice(0, MAX_FOCUS);
    for (const [, i] of focusable) {
      const targets = focusTargets(base, i);
      const before = targets.map((j) => PSEUDOS.map((ps) => snap(base[j].el, ps, FOCUS_PROPS) ?? {}));
      const [fb, fs] = [focusAndRead(base, i, targets), focusAndRead(sent, i, targets)];
      // 브라우저 창에 포커스가 없으면 이 스토리의 나머지 요소도 재지 못한다
      if (fb === "window" || fs === "window") {
        t.errors.push([`${entry.title} / ${entry.name}`, "브라우저 창에 포커스가 없어 focus 상태를 재지 못했다. 이 화면을 앞에 두고 다시 돌린다"]);
        break;
      }
      if (fb === "element" || fs === "element") continue;
      targets.forEach((j, k) =>
        PSEUDOS.forEach((pseudo, m) => {
          for (const prop of FOCUS_PROPS) {
            const [pre, b, s] = [before[k][m][prop], fb[k][m][prop], fs[k][m][prop]];
            if (!base[j].judged || b === undefined || s === undefined || pre === b) continue;
            const selector = selectorOf(base[j].el, pseudo, "focus");
            const p: Probe = { comp, selector, ...whereOf(base, j), prop, base: b, sentinel: s, state: "focus", fontSize: ["", ""], el: fb[k][m] };
            record(t, story, p, ctx);
          }
        }),
      );
    }
  } finally {
    frames.forEach((f) => f.remove());
  }
}

// 결과 그리기 ----------------------------------------------------------------

const STATUS_CLASS: Record<string, string> = { 반영: "", 일부: "slds-text-color_weak", 빈틈: "slds-text-color_error", 고정: "slds-text-color_weak" };

function table(head: string[], rows: (string | Node)[][]): HTMLElement {
  const th = (c: string) => el("th", { scope: "col" }, el("div", { className: "slds-truncate", title: c }, c));
  return el(
    "div",
    { className: "slds-scrollable_x" },
    el(
      "table",
      { className: "slds-table slds-table_bordered slds-table_cell-buffer slds-table_col-bordered" },
      el("thead", {}, el("tr", {}, ...head.map(th))),
      el("tbody", {}, ...rows.map((r) => el("tr", {}, ...r.map((c, i) => (i === 0 ? el("th", { scope: "row" }, c) : el("td", {}, c)))))),
    ),
  );
}

function rowsBlock(title: string, rows: Row[], withFixed: boolean): HTMLElement {
  const byItem = Map.groupBy(rows, (r) => r.item);
  return el(
    "section",
    { className: "sb-stack" },
    el("h2", { className: "slds-text-heading_medium" }, `${title} ${rows.length}곳`),
    ...[...byItem].map(([item, list]) =>
      el(
        "details",
        {},
        el("summary", {}, `${label(item)} — ${list.length}곳, 컴포넌트 ${new Set(list.map((r) => r.comp)).size}개`),
        table(
          ["컴포넌트", "요소", "속성", "값", ...(withFixed ? ["고정 항목"] : []), "스토리", "횟수"],
          list.map((r) => [r.comp, el("code", {}, r.selector), r.prop, el("code", {}, r.value), ...(withFixed ? [r.fixed ?? ""] : []), r.story, String(r.count)]),
        ),
      ),
    ),
  );
}

function renderResult(t: Tally, out: HTMLElement) {
  const items = SPEC_ITEMS.map((i) => i.id).filter((id) => itemScore(t.table, id).total > 0);
  const comps = [...t.table.keys()].sort();
  const status = (c: string, i: string) => {
    const s = cellLabel(t.table.get(c)?.get(i));
    return el("span", { className: STATUS_CLASS[s.split(" ")[0]] ?? "" }, s);
  };
  const unmeasured = SPEC_ITEMS.filter((i) => !items.includes(i.id)).map((i) => i.label);
  out.replaceChildren(
    el(
      "section",
      { className: "sb-stack" },
      el("h2", { className: "slds-text-heading_medium" }, "판정 (설계 9.6의 4: 반영된 컴포넌트 수 / 해당 컴포넌트 수)"),
      el(
        "p",
        {},
        "지금: hook이 닿고 빈틈이 없는 컴포넌트 수 / 해당 컴포넌트 수. 9.4 고정은 합의한 예외라 섞여 있어도 반영으로 센다. 정적 검사 방식: 정적 검사(pnpm audit:brand)처럼 가장 나쁜 상태를 따라, 고정이 섞인 칸은 반영으로 세지 않는다. 칸 글자는 \"원본과 hook\" 보기처럼 개수를 함께 보인다: hook이 닿고 고정이나 빈틈이 섞이면 일부다. native는 Storybook이 synthetic shadow로만 빌드해 잴 수 없다(설계 9.2: native 빌드는 발표 뒤).",
      ),
      table(
        ["항목", "지금", "정적 검사 방식", "native"],
        items.map((id) => {
          const s = itemScore(t.table, id);
          return [label(id), `${s.reached} / ${s.total}`, `${s.strict} / ${s.total}`, "잴 수 없음"];
        }),
      ),
      el("p", {}, `이 검사로 재지 않은 항목: ${unmeasured.join(", ")}. hover·눌림은 재지 않는다(마우스를 올린 상태를 만들지 않는다).`),
      el(
        "p",
        {},
        `브랜드 색과 같아 판정하지 않은 값 ${t.brand}곳: 브랜드 색은 org 테마가 원본이라 util.css의 빈틈으로 세지 않는다. 흰색도 브랜드 흰 글자(on-accent)와 같아 함께 빠지므로, 하드코딩된 흰색은 이 검사의 빈틈에 나오지 않는다.`,
      ),
    ),
    el(
      "section",
      { className: "sb-stack" },
      el("h2", { className: "slds-text-heading_medium" }, `컴포넌트 × 항목 (컴포넌트 ${comps.length}개)`),
      table(["컴포넌트", ...items.map(label)], comps.map((c) => [c, ...items.map((i) => status(c, i))])),
    ),
    rowsBlock("빈틈", [...t.gaps.values()], false),
    rowsBlock("고정 (설계 9.4 목록에 있는 빈틈)", [...t.fixed.values()], true),
    el(
      "details",
      {},
      el("summary", {}, `동적 검사로 맞출 수 없는 9.4 고정 항목 ${Object.keys(UNMATCHED_FIXED).length}개`),
      table(
        ["고정 항목", "이유"],
        Object.entries(UNMATCHED_FIXED).map(([id, why]) => [FIXED_ITEMS.find((f) => f.id === id)?.label ?? id, why]),
      ),
    ),
    el(
      "section",
      { className: "sb-stack" },
      el("h2", { className: "slds-text-heading_medium" }, `재지 못한 스토리 ${t.errors.length}개`),
      table(["스토리", "이유"], t.errors.map(([s, m]) => [s, m])),
    ),
  );
}

let root: HTMLElement | undefined;

/** 스토리를 다시 그려도(툴바에서 브랜드를 바꾸는 등) 진행 중인 검사와 결과를 잃지 않게 같은 요소를 돌려준다 */
export function renderReflectCheck(): HTMLElement {
  if (root) return root;
  const start = el("button", { className: "slds-button slds-button_brand", type: "button" }, "반영 검사 시작");
  const progress = el("progress", { max: 1, value: 0 });
  const status = el("p", { role: "status" }, "아직 돌리지 않았다");
  const area = el("div", { className: "sb-row" });
  const out = el("div", { className: "sb-stack" });

  start.addEventListener("click", async () => {
    start.disabled = true;
    out.replaceChildren();
    try {
      const index = (await (await fetch("index.json")).json()) as { entries: Record<string, Entry> };
      const entries = Object.values(index.entries).filter((e) => e.type === "story" && !DOC_TITLE.test(e.title) && e.exportName !== SOURCE_STORY);
      const t: Tally = { table: new Map(), gaps: new Map(), fixed: new Map(), errors: [], done: 0, brand: 0 };
      let ctx: JudgeContext | undefined;
      const getCtx = (b: Document, s: Document) => (ctx ??= buildContext(b, s));
      progress.max = entries.length;
      let next = 0;
      const worker = async () => {
        while (next < entries.length) {
          const entry = entries[next++];
          try {
            await measure(entry, area, t, getCtx);
          } catch (e) {
            t.errors.push([`${entry.title} / ${entry.name}`, (e as Error).message]);
          }
          progress.value = ++t.done;
          status.textContent = `${t.done} / ${entries.length} 스토리 · 빈틈 ${t.gaps.size}곳 · 재지 못함 ${t.errors.length}`;
        }
      };
      await Promise.all(Array.from({ length: PAIRS }, worker));
      status.textContent = `끝: 스토리 ${entries.length}개 · 빈틈 ${t.gaps.size}곳 · 고정 ${t.fixed.size}곳 · 재지 못함 ${t.errors.length}`;
      renderResult(t, out);
    } catch (e) {
      status.textContent = `검사를 끝내지 못했다: ${(e as Error).message}`;
    } finally {
      start.disabled = false;
    }
  });

  root = el(
    "div",
    { className: "sb-stack" },
    el("h1", { className: "slds-text-heading_large" }, "반영 검사"),
    el(
      "p",
      {},
      "모든 컴포넌트 스토리를 기본 브랜드와 센티널 브랜드로 그려 요소마다 계산된 스타일을 비교한다. 센티널은 util.css에서 쓸 수 있는 모든 hook과 브리지 변수에 서로 다른 값을 넣은 브랜드다(설계 9.6의 2). 값이 바뀌면 반영, 그대로면 빈틈 후보다. 바뀐 값이 어느 hook의 센티널 값과 같은지로 명세 항목을 고른다. 컴포넌트(lightning-*, c-*) 안의 요소만 판정하고, 공식 예제의 틀(예제 배경, kbd 등)은 세지 않는다. 스토리마다 iframe 두 개를 열어 몇 분 걸린다.",
    ),
    el(
      "details",
      {},
      el("summary", {}, `센티널 없음 ${missing.length}개 (구별되는 값을 넣지 못한 hook)`),
      table(["이름", "이유"], (missing as { name: string; reason: string }[]).map((m) => [el("code", {}, m.name), m.reason])),
    ),
    el("details", {}, el("summary", {}, `센티널 util.css (선언 ${sentinelHooks.length}개)`), el("pre", { className: "sb-code" }, sentinelCss)),
    el("div", { className: "sb-row" }, start, progress),
    status,
    area,
    out,
  );
  return root;
}
