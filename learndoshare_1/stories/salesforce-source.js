// Storybook "원본과 hook" 보기 (설계 9.5). 카탈로그 스토리(scripts/generate-slds-catalog.ts가 만드는 stories/slds-catalog/*.stories.js)가 부른다.
// 데이터(요약·hook 표·빈틈 표)는 생성기가 정적 반영 검사(scripts/audit)를 다시 돌려 만든다. 손으로 쓰지 않는다.
// 원본 파일은 Storybook이 빌드할 때 ?raw로 읽고, 원본 절을 펼칠 때 불러온다
import lbcLicense from "lightning-base-components/LICENSE.txt?raw";
import sldsLicense from "@salesforce-ux/design-system-2/LICENSE.txt?raw";

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

function cellText(c) {
  const n = c.counts;
  const parts = [
    n.reached && `hook ${n.reached}`,
    n.bridge && `브리지 ${n.bridge}`,
    n.fixed && `고정 ${n.fixed}`,
    n.gap && `빈틈 ${n.gap}`
  ].filter(Boolean);
  return parts.length ? `${c.label} (${parts.join(" · ")})` : c.label;
}

function header(view) {
  return h(
    "dl",
    { className: "slds-dl_horizontal" },
    h("dt", { className: "slds-dl_horizontal__label" }, "컴포넌트"),
    h(
      "dd",
      { className: "slds-dl_horizontal__detail" },
      `${view.tag} (lightning-base-components 폴더 ${view.folder})`
    ),
    h("dt", { className: "slds-dl_horizontal__label" }, "SLDS 블루프린트"),
    h(
      "dd",
      { className: "slds-dl_horizontal__detail" },
      view.blueprints.length
        ? view.blueprints.join(", ")
        : "없음 (이 폴더에는 CSS가 없다. 안에서 쓰는 다른 기본 컴포넌트를 본다)"
    ),
    h("dt", { className: "slds-dl_horizontal__label" }, "native 지원 목록"),
    h(
      "dd",
      { className: "slds-dl_horizontal__detail" },
      view.native
        ? "있음 — Salesforce가 이 컴포넌트를 native shadow로 바꿀 수 있다(lightning-base-components package.json의 lwc.nativeShadowEnabledComponents)"
        : "없음 (lightning-base-components package.json의 lwc.nativeShadowEnabledComponents)"
    )
  );
}

function summary(view) {
  if (!view.summary.length)
    return h("p", {}, "브랜드 명세 항목에 해당하는 선언이 없다.");
  return table(
    "브랜드 명세 항목별 반영 상태",
    ["명세 항목", "지금", "native"],
    view.summary.map((r) => [r.label, cellText(r.now), cellText(r.native)])
  );
}

// 지금 브랜드 값: Storybook이 문서 루트에 적용한 값(브랜드 util.css가 없으면 SLDS 기본값)
function brandValue(name, info) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!value) return "—";
  const def =
    info.light === info.dark
      ? info.light
      : `light-dark(${info.light}, ${info.dark})`;
  return value.replace(/\s+/g, " ") === def ? "기본값" : value;
}

function hooks(view, hookInfo) {
  if (!view.hooks.length)
    return h("p", {}, "이 컴포넌트의 CSS가 읽는 변수가 없다.");
  const groups = KINDS.map((kind) => [
    kind,
    view.hooks.filter((r) => hookInfo[r.name]?.kind === kind)
  ]).filter(([, rows]) => rows.length);
  return groups.map(([kind, rows]) =>
    h(
      "details",
      { open: kind === "g" || kind === "s" },
      h(
        "summary",
        {
          className: "slds-text-title_bold slds-m-vertical_x-small",
          style: SUMMARY
        },
        `${kind} ${rows.length}개 — ${KIND_NOTE[kind]}`
      ),
      table(
        `${kind} hook`,
        [
          "hook",
          "종류",
          "기본값 (라이트 · 다크)",
          "지금 브랜드 값",
          "읽는 곳 (지금 · native)",
          "util.css로 바뀌는가",
          "명세 항목"
        ],
        rows.map((r) => {
          const info = hookInfo[r.name];
          const where = (mode, n, at) =>
            n
              ? h("div", {}, `${MODE[mode]} ${n}곳: ${at}${n > 1 ? " 등" : ""}`)
              : null;
          return [
            h("code", {}, r.name, info.next ? ` → ${info.next}` : ""),
            info.kind,
            info.light === undefined
              ? "—"
              : info.light === info.dark
                ? info.light
                : `${info.light} · ${info.dark}`,
            brandValue(r.name, info),
            [
              where("now", r.now, r.nowAt),
              where("native", r.native, r.nativeAt)
            ],
            info.util,
            info.items.length ? info.items.join(", ") : "—"
          ];
        })
      )
    )
  );
}

function gaps(view) {
  const count = (prefix) =>
    view.gaps.filter((g) => g.how.startsWith(prefix)).length;
  return [
    h(
      "p",
      {},
      `hook이 직접 닿지 않는 선언 ${view.gaps.length}개: 브리지 ${count("브리지")} · Salesforce 고정 ${count("Salesforce 고정")} · 고정 목록에 없는 빈틈 ${count("빈틈")}. ` +
        "빈틈이 생기면 정적 반영 검사(pnpm audit:brand)가 실패한다(설계 9.6)."
    ),
    view.gaps.length > 0 &&
      table(
        "빈틈 표",
        ["속성과 값", "위치", "모드", "영향(명세 항목)", "메우는 방법"],
        view.gaps.map((g) => [
          h("code", {}, `${g.prop}: ${g.value}`),
          [
            h("div", {}, g.selector),
            h("div", { className: "slds-text-color_weak" }, g.at)
          ],
          MODE[g.mode],
          g.item,
          g.how
        ])
      ),
    view.js.length > 0 && [
      h(
        "h4",
        { className: "slds-text-title_bold slds-m-top_medium" },
        "JS에 박힌 값"
      ),
      h(
        "ul",
        { className: "slds-list_dotted" },
        view.js.map((s) => h("li", {}, s))
      )
    ]
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
      ". 정적 검사는 SLDS 2 CSS를 합친 slds2.cosmos.css로 판정하므로 빈틈 표의 줄 번호는 그 파일 기준이다."
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

/** 원본과 hook 스토리 본문. view: 페이지 데이터, sources: [경로, () => import("…?raw")], hookInfo: hook-info.js */
export function sourceAndHooks(view, list, hookInfo) {
  return h(
    "div",
    { className: "sb-stack" },
    h(
      "p",
      {},
      "판정은 정적 반영 검사(설계 9.6, audit/report.json과 같은 계산)를 카탈로그를 만들 때 다시 돌린 결과다. " +
        "지금은 org가 쓰는 synthetic 경로(SLDS 2 CSS), native는 기본 컴포넌트가 native shadow로 바뀐 뒤(*.slds.css)다."
    ),
    header(view),
    heading("요약: 브랜드 명세 항목별 반영"),
    summary(view),
    heading("hook 표: 이 컴포넌트가 읽는 변수"),
    hooks(view, hookInfo),
    heading("빈틈 표: hook이 닿지 않는 선언"),
    gaps(view),
    heading("원본"),
    sources(list)
  );
}
