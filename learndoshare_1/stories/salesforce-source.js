// Storybook "원본과 hook" 보기 (설계 9.5). 카탈로그 스토리(scripts/generate-slds-catalog.ts가 만드는 stories/slds-catalog/*.stories.js)가 부른다.
// 데이터(요약·hook 표·빈틈 표)는 생성기가 정적 반영 검사(scripts/audit)를 다시 돌려 만든다. 손으로 쓰지 않는다.
// 출처마다 절을 나눈다: 기본 컴포넌트 폴더의 자기 파일, 여러 폴더에 복사된 공용 사본, SLDS 2 블루프린트(직접 / 공용 사본에서 온 것).
// 원본 파일은 Storybook이 빌드할 때 ?raw로 읽고, 원본 절을 펼칠 때 불러온다
import lbcLicense from "lightning-base-components/LICENSE.txt?raw";
import sldsLicense from "@salesforce-ux/design-system-2/LICENSE.txt?raw";
import { SPEC_ITEMS } from "../lib/spec-items.ts";

export const NOTICE =
  "원본은 고치는 대상이 아니라 확인 근거다. 고쳐도 Storybook만 바뀌고 org는 바뀌지 않는다.";

const MODE = { now: "지금", native: "native" };
const KINDS = ["g", "s", "c", "기본 컴포넌트 전용", "내부 전용", "정의 없음"];
const KIND_NOTE = {
  g: "util.css에서 바꾸는 global hook",
  s: "util.css에서 바꾸는 컴포넌트 hook(--slds-s-*). 값이 없으면 이어지는 g hook을 쓴다",
  c: "--slds-c-*·--sds-c-*. 밀버스는 쓰지 않는다(설계 5.2)",
  "기본 컴포넌트 전용": "기본 컴포넌트 CSS만 읽는 g 이름. native 전환 대비",
  "내부 전용": "SLDS·기본 컴포넌트 안에서만 정의해 쓰는 변수",
  "정의 없음":
    "SLDS 2·기본 컴포넌트 CSS 어디에도 정의가 없어 fallback이 쓰인다(--lwc-*는 org가 정의할 수 있다, 미확인)"
};
// 강조 색은 SLDS 피드백 색 hook을 쓴다. 초록은 hook, 노랑은 하드코딩
const MARK = {
  hook: "background: var(--slds-g-color-success-container-1, #ebf7e6); color: inherit",
  literal:
    "background: var(--slds-g-color-warning-container-1, #fef1cd); color: inherit"
};
// SLDS 리셋이 summary의 펼침 표시를 지운다. 눌러 펼칠 수 있다는 것을 다시 보인다
const SUMMARY = "display: list-item; cursor: pointer";
const item = (id) => SPEC_ITEMS.find((i) => i.id === id);

function h(tag, props = {}, ...children) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(
    ...children
      .flat(Infinity)
      .filter((c) => c !== undefined && c !== null && c !== false)
  );
  return e;
}

function table(caption, head, rows) {
  return h(
    "div",
    { style: "overflow-x: auto" },
    h(
      "table",
      {
        className:
          "slds-table slds-table_bordered slds-table_cell-buffer slds-table_col-bordered"
      },
      h("caption", { className: "slds-assistive-text" }, caption),
      h(
        "thead",
        {},
        h(
          "tr",
          { className: "slds-line-height_reset" },
          head.map((c) =>
            h(
              "th",
              { scope: "col" },
              h("div", { className: "slds-cell-wrap" }, c)
            )
          )
        )
      ),
      h(
        "tbody",
        {},
        rows.map((r) =>
          h(
            "tr",
            {},
            r.map((c) =>
              h("td", {}, h("div", { className: "slds-cell-wrap" }, c))
            )
          )
        )
      )
    )
  );
}

const heading = (s) =>
  h("h3", { className: "slds-text-heading_small slds-m-top_large" }, s);
const fold = (title, open, ...body) =>
  h(
    "details",
    { open },
    h(
      "summary",
      {
        className: "slds-text-title_bold slds-m-vertical_x-small",
        style: SUMMARY
      },
      title
    ),
    h("div", { className: "slds-m-left_medium sb-stack" }, body)
  );

// 요약 칸: 절 여러 개의 개수 [hook, 브리지, 고정, 빈틈]를 더해 반영 / 일부 / 안 됨 / 해당 없음
function cell(sections, id, mode) {
  const n = [0, 0, 0, 0];
  for (const s of sections) s.counts[id]?.[mode].forEach((x, i) => (n[i] += x));
  const [reached, bridge, fixed, gap] = n;
  if (!(reached + bridge + fixed + gap)) return "해당 없음";
  const label = !(fixed + gap)
    ? "반영"
    : !(reached + bridge)
      ? "안 됨"
      : "일부";
  const parts = [
    reached && `hook ${reached}`,
    bridge && `브리지 ${bridge}`,
    fixed && `고정 ${fixed}`,
    gap && `빈틈 ${gap}`
  ].filter(Boolean);
  return `${label} (${parts.join(" · ")})`;
}

/** 페이지의 절: 자기 파일 → 공용 사본 → 블루프린트. 공용 사본은 이 폴더에서 판정이 다른 부분만 페이지 데이터가 덮어쓴다 */
function sectionsOf(view, sharedInfo) {
  const blueprint = (b) => ({
    ...sharedInfo.blueprints[b.name],
    kind: "blueprint",
    ...b
  });
  return {
    own: { ...view.own, kind: "own" },
    files: view.shared.map((s) => ({
      ...sharedInfo.files[s.file],
      kind: "file",
      ...s
    })),
    direct: view.blueprints.filter((b) => !b.shared).map(blueprint),
    sharedBlueprints: view.blueprints.filter((b) => b.shared).map(blueprint)
  };
}

function directText(all) {
  if (all.direct.length) return all.direct.map((b) => b.name).join(", ");
  if (!all.own.files.length && !all.files.length)
    return "없음 (이 폴더에는 CSS가 없다. 안에서 쓰는 다른 기본 컴포넌트를 본다)";
  return all.sharedBlueprints.length
    ? "없음 (공용 사본에서 온 블루프린트만 있다)"
    : "없음 (이 폴더의 CSS에 SLDS 2 블루프린트 선택자가 없다)";
}

function header(view, all) {
  const names = (list) =>
    list.length ? list.map((b) => b.name).join(", ") : "없음";
  const row = (label, value) => [
    h("dt", { className: "slds-dl_horizontal__label" }, label),
    h("dd", { className: "slds-dl_horizontal__detail" }, value)
  ];
  return h(
    "dl",
    { className: "slds-dl_horizontal" },
    row(
      "컴포넌트",
      `${view.tag} (lightning-base-components 폴더 ${view.folder})`
    ),
    row("SLDS 블루프린트 (직접)", directText(all)),
    all.files.length > 0 &&
      row(
        "공용 사본",
        `${all.files.map((f) => f.file).join(", ")} → 블루프린트 ${names(all.sharedBlueprints)}`
      ),
    row(
      "native 지원 목록",
      view.native
        ? "있음 — Salesforce가 이 컴포넌트를 native shadow로 바꿀 수 있다(lightning-base-components package.json의 lwc.nativeShadowEnabledComponents)"
        : "없음 (lightning-base-components package.json의 lwc.nativeShadowEnabledComponents)"
    )
  );
}

function summary(all) {
  const main = [all.own, ...all.direct];
  const shared = [...all.files, ...all.sharedBlueprints];
  const ids = SPEC_ITEMS.map((i) => i.id).filter((id) =>
    [...main, ...shared].some((s) => s.counts[id])
  );
  if (!ids.length)
    return h("p", {}, "브랜드 명세 항목에 해당하는 선언이 없다.");
  const head = ["명세 항목", "이 컴포넌트 · 지금", "이 컴포넌트 · native"];
  if (shared.length)
    head.push(
      "공용 사본·공용 블루프린트 · 지금",
      "공용 사본·공용 블루프린트 · native"
    );
  return [
    h(
      "p",
      {},
      "이 컴포넌트 = 폴더의 자기 파일 + 직접 쓰는 블루프린트. 공용 사본(여러 기본 컴포넌트에 복사된 파일)과 거기서만 오는 블루프린트는 다른 컴포넌트와 함께 쓰는 판정이라 따로 센다."
    ),
    table(
      "브랜드 명세 항목별 반영 상태",
      head,
      ids.map((id) => [
        item(id).label,
        cell(main, id, "now"),
        cell(main, id, "native"),
        ...(shared.length
          ? [cell(shared, id, "now"), cell(shared, id, "native")]
          : [])
      ])
    )
  ];
}

// 지금 값: Storybook이 문서 루트에서 계산한 값. 기본값(var()는 푼 식)과 같으면 "기본값"이라 적어 브랜드가 바꾼 값과 구분한다
function currentValue(name, info) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
    .replace(/\s+/g, " ");
  if (!value) return "—";
  const def =
    info.resolved ??
    (info.light === info.dark
      ? info.light
      : `light-dark(${info.light}, ${info.dark})`);
  return value === def ? "기본값" : value;
}

function hooks(rows, hookInfo) {
  if (!rows.length) return h("p", {}, "읽는 변수가 없다.");
  return KINDS.map((kind) => [
    kind,
    rows.filter(([name]) => hookInfo[name]?.kind === kind)
  ])
    .filter(([, list]) => list.length)
    .map(([kind, list]) =>
      fold(
        `${kind} ${list.length}개 — ${KIND_NOTE[kind]}`,
        kind === "g" || kind === "s",
        table(
          `${kind} hook`,
          [
            "hook",
            "종류",
            "기본값 (라이트 · 다크)",
            "지금 값 (계산된 값)",
            "읽는 곳 (지금 · native)",
            "util.css로 바뀌는가",
            "명세 항목"
          ],
          list.map(([name, now, nowAt, native, nativeAt]) => {
            const info = hookInfo[name];
            const where = (mode, n, at) =>
              n
                ? h(
                    "div",
                    {},
                    `${MODE[mode]} ${n}곳: ${at}${n > 1 ? " 등" : ""}`
                  )
                : null;
            return [
              h("code", {}, name, info.next ? ` → ${info.next}` : ""),
              info.kind,
              info.light === undefined
                ? "—"
                : info.light === info.dark
                  ? info.light
                  : `${info.light} · ${info.dark}`,
              currentValue(name, info),
              [where("now", now, nowAt), where("native", native, nativeAt)],
              info.util,
              info.items.length ? info.items.join(", ") : "—"
            ];
          })
        )
      )
    );
}

function gaps(rows) {
  const count = (prefix) => rows.filter((g) => g.how.startsWith(prefix)).length;
  // 브리지가 잇는 변수는 명세 항목(SPEC_ITEMS)의 bridgeVars다
  const how = (g) =>
    g.how === "브리지" && item(g.item)?.bridgeVars.length
      ? `브리지 (${item(g.item).bridgeVars.join(", ")})`
      : g.how;
  return [
    h(
      "p",
      {},
      `hook이 직접 닿지 않는 선언 ${rows.length}개: 브리지 ${count("브리지")} · Salesforce 고정 ${count("Salesforce 고정")} · 고정 목록에 없는 빈틈 ${count("빈틈")}`
    ),
    rows.length > 0 &&
      table(
        "빈틈 표",
        [
          "속성과 값",
          "위치 (선택자, 파일:줄)",
          "모드",
          "영향(명세 항목)",
          "메우는 방법"
        ],
        rows.map((g) => [
          h("code", {}, `${g.prop}: ${g.value}`),
          [
            h("div", {}, g.selector),
            h("div", { className: "slds-text-color_weak" }, g.at)
          ],
          MODE[g.mode],
          item(g.item)?.label ?? g.item,
          how(g)
        ])
      )
  ];
}

const sectionBody = (s, hookInfo) => [
  h("p", { className: "slds-text-title_bold" }, "hook 표"),
  hooks(s.hooks, hookInfo),
  h("p", { className: "slds-text-title_bold" }, "빈틈 표"),
  gaps(s.gaps)
];

function sections(all, hookInfo) {
  const files = (list) => list.join(", ");
  return [
    h(
      "p",
      {},
      "줄 번호: 기본 컴포넌트 선언은 원본 절의 같은 이름 파일 기준이다. SLDS 2 선언은 정적 검사가 읽는 합친 파일 slds2.cosmos.css 기준인데, 이 파일은 원본 절에 없으니(원본 절은 컴포넌트별 SLDS 2 CSS) 선택자로 찾는다."
    ),
    fold(
      `기본 컴포넌트 폴더의 자기 파일: ${files(all.own.files) || "CSS 없음"}`,
      true,
      sectionBody(all.own, hookInfo)
    ),
    all.files.map((f) =>
      fold(
        `공용 사본 ${f.file} — 여러 기본 컴포넌트 폴더에 같은 파일이 복사돼 있다. 이 컴포넌트도 native에서 싣는다`,
        false,
        sectionBody(f, hookInfo)
      )
    ),
    [...all.direct, ...all.sharedBlueprints].map((b) =>
      fold(
        `SLDS 2 블루프린트 ${b.name} — ${
          b.shared
            ? `공용 사본 ${files(b.files)}에 .slds-${b.name} 선택자가 있어 함께 본다`
            : b.files.some((f) => all.own.files.includes(f))
              ? `이 컴포넌트 파일 ${files(b.files.filter((f) => all.own.files.includes(f)))}이 직접 쓴다`
              : `폴더 이름과 같은 블루프린트(지금 org에서 SLDS 2 CSS가 꾸민다. report.json도 폴더와 같은 키로 센다)${
                  b.files.length
                    ? `. 공용 사본 ${files(b.files)}에도 선택자가 있다`
                    : ""
                }`
        }`,
        false,
        sectionBody(b, hookInfo)
      )
    )
  ];
}

// CSS의 "속성: 값;" 줄. 값에 var()가 없고 색·길이·시간 리터럴이 있으면 하드코딩으로 칠한다
const HOOK = /--(?:slds|sds)-[gsc]-[\w-]+/g;
const CSS_DECL = /^([ \t]*[a-z][a-z-]*[ \t]*:[ \t]*)([^;{}\n]+);/gm;
const LITERAL =
  /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|\d(?:px|rem|em|s|ms|deg|%)(?![\w-])/i;
const JS_COLOR = /#[0-9a-f]{6}\b|rgba?\([^)]*\)/gi;

function highlighted(code, css) {
  const marks = [...code.matchAll(HOOK)].map((m) => [
    m.index,
    m.index + m[0].length,
    "hook"
  ]);
  if (css) {
    for (const m of code.matchAll(CSS_DECL)) {
      if (m[2].includes("var(") || !LITERAL.test(m[2])) continue;
      const start = m.index + m[1].length;
      marks.push([start, start + m[2].length, "literal"]);
    }
  } else {
    for (const m of code.matchAll(JS_COLOR))
      marks.push([m.index, m.index + m[0].length, "literal"]);
  }
  marks.sort((a, b) => a[0] - b[0]);
  const pre = h("pre", {
    className: "sb-code",
    style: "max-height: 36rem; overflow: auto"
  });
  let i = 0;
  for (const [start, end, kind] of marks) {
    if (start < i) continue;
    pre.append(
      code.slice(i, start),
      h("mark", { style: MARK[kind] }, code.slice(start, end))
    );
    i = end;
  }
  pre.append(code.slice(i));
  return pre;
}

function sourceFile([path, load]) {
  const details = h(
    "details",
    {},
    h(
      "summary",
      { className: "slds-m-vertical_xx-small", style: SUMMARY },
      h("code", {}, path)
    )
  );
  details.addEventListener("toggle", async () => {
    if (!details.open || details.dataset.loaded) return;
    details.dataset.loaded = "true";
    try {
      const { default: code } = await load();
      details.append(highlighted(code, path.endsWith(".css")));
    } catch (error) {
      details.append(
        h(
          "p",
          { className: "slds-text-color_error" },
          `원본을 읽지 못했다: ${error.message}`
        )
      );
    }
  });
  return details;
}

/** Salesforce 이용 약관 전문. 원본 절과 시작하기/Salesforce 이용 약관 페이지가 함께 쓴다 */
export function licenseBlock() {
  return h(
    "div",
    { className: "sb-stack" },
    h(
      "p",
      {},
      "원본 파일을 보여 주는 근거다. 두 패키지에 들어 있는 LICENSE.txt를 빌드할 때 그대로 읽는다."
    ),
    h(
      "p",
      { className: "slds-text-title_bold" },
      "lightning-base-components / LICENSE.txt"
    ),
    h(
      "pre",
      { className: "sb-code", style: "white-space: pre-wrap" },
      lbcLicense
    ),
    h(
      "p",
      { className: "slds-text-title_bold" },
      "@salesforce-ux/design-system-2 / LICENSE.txt"
    ),
    h(
      "pre",
      { className: "sb-code", style: "white-space: pre-wrap" },
      sldsLicense
    )
  );
}

function sources(list) {
  return [
    h(
      "div",
      { className: "slds-box slds-theme_shade", role: "note" },
      h("strong", {}, NOTICE)
    ),
    h(
      "p",
      {},
      "기본 컴포넌트 폴더의 html·js·css(native용 *.slds.css 포함)와 SLDS 2 컴포넌트 CSS다. 색: ",
      h("mark", { style: MARK.hook }, "hook"),
      " ",
      h("mark", { style: MARK.literal }, "하드코딩(var() 없는 색·길이·시간)"),
      "."
    ),
    list.map(sourceFile),
    h(
      "details",
      {},
      h(
        "summary",
        { className: "slds-m-vertical_xx-small", style: SUMMARY },
        "Salesforce 이용 약관 전문 (LICENSE.txt)"
      ),
      licenseBlock()
    )
  ];
}

/**
 * 원본과 hook 스토리 본문.
 * view: 페이지 데이터, list: [경로, () => import("…?raw")], hookInfo: hook-info.js, sharedInfo: shared-info.js(블루프린트·공용 사본 절)
 */
export function sourceAndHooks(view, list, hookInfo, sharedInfo) {
  const all = sectionsOf(view, sharedInfo);
  return h(
    "div",
    { className: "sb-stack" },
    h(
      "p",
      {},
      "판정은 정적 반영 검사(설계 9.6, audit/report.json과 같은 계산)를 카탈로그를 만들 때 다시 돌린 결과다. " +
        "지금은 org가 쓰는 synthetic 경로(SLDS 2 CSS), native는 기본 컴포넌트가 native shadow로 바뀐 뒤(*.slds.css)다."
    ),
    header(view, all),
    heading("요약: 브랜드 명세 항목별 반영"),
    summary(all),
    heading("출처별 hook 표와 빈틈 표"),
    sections(all, hookInfo),
    view.js.length > 0 && [
      heading("JS에 박힌 값"),
      h(
        "ul",
        { className: "slds-list_dotted" },
        view.js.map((s) => h("li", {}, s))
      )
    ],
    heading("원본"),
    sources(list)
  );
}
