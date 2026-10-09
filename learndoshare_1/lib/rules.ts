// 브랜드 스타일 파일 규칙. 원본은 설계 5.1(override), 5.2(util.css), 5.3(피드백 색)이다
// - util.css(milvusBrand.css, brands/<브랜드>/util.css): :root 블록 하나에 허용된 이름만 둔다. 위반은 check --style을 실패시킨다
// - milvusOverride.css: 공식 권고 밖인 opt-in 파일이라 경고만 낸다. 글꼴·외부 CSS를 들이는 @font-face·@import만 실패시킨다
// hook 이름은 SLDS 2 2.264.2(slds2.cosmos.css)와 lightning-base-components 1.28.19-alpha 원본에서 확인했다(2026-10-10)
import postcss, { CssSyntaxError, type AtRule, type Root } from "postcss";
import { contrastRatio, suggestPassingText } from "./contrast.ts";
import type { RuleContext } from "./hooks-index.ts";

export type Issue = { file: string; rule: string; message: string; fix?: string };

/** 브랜드 색 계열. 색의 원본은 org 테마(BrandingSet)다 */
export const BRAND_COLOR_PATTERNS = [
  /^--slds-g-color-accent/,
  /^--slds-g-color-on-accent/,
  /^--slds-g-color-border-accent/,
  /^--slds-g-color-brand-base/,
  /^--slds-r-color-brand/,
];

type FeedbackKind = { text: string | null; onContainer: string; container: string; border: string | null; hover: string[] };

/**
 * 피드백 색 hook (설계 5.3). SLDS 2 CSS가 실제로 읽는 이름만 둔다. null은 읽는 곳이 없는 칸이다
 * (border-warning-1은 정의만 있고, info-1도 정의만 있고, border-info-1은 정의도 없다)
 */
export const FEEDBACK_HOOKS: Record<"success" | "warning" | "error" | "info", FeedbackKind> = {
  success: {
    text: "--slds-g-color-success-1",
    onContainer: "--slds-g-color-on-success-1",
    container: "--slds-g-color-success-container-1",
    border: "--slds-g-color-border-success-1",
    hover: ["--slds-g-color-success-container-2"],
  },
  warning: {
    text: "--slds-g-color-warning-1",
    onContainer: "--slds-g-color-on-warning-1",
    container: "--slds-g-color-warning-container-1",
    border: null,
    hover: [],
  },
  error: {
    text: "--slds-g-color-error-1",
    onContainer: "--slds-g-color-on-error-1",
    container: "--slds-g-color-error-container-1",
    border: "--slds-g-color-border-error-1",
    hover: ["--slds-g-color-error-container-2", "--slds-g-color-border-error-2"],
  },
  info: {
    text: null,
    onContainer: "--slds-g-color-on-info-1",
    container: "--slds-g-color-info-container-1",
    border: null,
    hover: [],
  },
};

const FEEDBACK_NAMES = new Set(
  Object.values(FEEDBACK_HOOKS).flatMap((k) => [k.text, k.onContainer, k.container, k.border, ...k.hover].filter((n) => n !== null)),
);

/** 기본 hover·선택 바탕 중 브랜드 틴트인 것을 중립으로 바꾸는 색 s hook. 값은 중립 g hook 하나만 참조한다 */
export const COLOR_S_WHITELIST = [
  "--slds-s-backdrop-color-background",
  "--slds-s-menu-item-color-background-active",
  "--slds-s-table-row-color-background-selected",
  "--slds-s-navigation-color-background-hover",
  "--slds-s-pill-color-background-hover",
  "--slds-s-button-color-background-hover",
];

/**
 * 기본 컴포넌트 CSS만 읽는 g 이름. native 전환 대비용이고 지금은 효과가 없다.
 * SLDS 2 CSS에는 정의가 없다(border-base-1만 border-1의 fallback으로 한 번 읽힌다)
 */
export const LBC_ONLY_G = [
  "--slds-g-color-border-base-1",
  "--slds-g-color-border-base-4",
  "--slds-g-color-neutral-10-opacity-50",
  "--slds-g-color-neutral-100-opacity-10",
  "--slds-g-color-neutral-100-opacity-50",
];

/** 중립 색. 값은 light-dark(라이트, 다크)로 쓴다 */
export const NEUTRAL_COLOR_PATTERNS = [
  /^--slds-g-color-surface/,
  /^--slds-g-color-on-surface/,
  /^--slds-g-color-border-[12]$/,
  /^--slds-g-color-neutral-base-/,
  /^--slds-g-color-disabled/,
  /^--slds-g-color-on-disabled/,
  /^--slds-g-color-border-disabled/,
  /^--slds-g-color-.*inverse/,
  /^--slds-g-color-palette-neutral-/,
  /^--slds-g-color-palette-yellow-(80|90)$/,
];

/** :root에 둘 수 있는 일반(상속) 속성 */
export const ALLOWED_PLAIN_PROPS = ["letter-spacing"];

// 포커스 링 그림자 값 안에 쓸 수 있는 색. 색의 원본은 org 테마다
const FOCUS_COLORS = ["--slds-g-color-brand-base-15", "--slds-g-color-neutral-base-100"];

const ROOT_ONLY = "util.css에는 :root 블록 하나만 둔다. 클래스 규칙은 milvusBridge.css(패키지)나 milvusOverride.css(마지막 수단)에 둔다";

function syntaxIssue(e: unknown, file: string): Issue {
  if (!(e instanceof CssSyntaxError)) throw e;
  return { file, rule: "syntax", message: `CSS 문법 오류(${e.line}줄): ${e.reason}` };
}

const isNeutral = (name: string) => NEUTRAL_COLOR_PATTERNS.some((p) => p.test(name));

// 값에 hex·rgb·이름 색 같은 리터럴이 없고, 참조하는 색 hook이 FOCUS_COLORS뿐인가
function focusShadowOk(value: string): boolean {
  const refs = value.match(/--[\w-]+/g) ?? [];
  const words = value.replace(/--[\w-]+/g, "").replace(/-?\d*\.?\d+[a-z%]*/gi, "").match(/[a-z][\w-]*/gi) ?? [];
  return (
    !value.includes("#") &&
    refs.every((r) => !r.includes("color") || FOCUS_COLORS.includes(r)) &&
    words.every((w) => ["var", "inset", "calc"].includes(w.toLowerCase()))
  );
}

// 선언 하나의 문제. [규칙, 메시지] 또는 undefined
function declProblem(name: string, value: string, ctx: RuleContext): [string, string] | undefined {
  if (!name.startsWith("--")) {
    return ALLOWED_PLAIN_PROPS.includes(name)
      ? undefined
      : ["plain-prop", `${name}: :root의 일반 속성은 ${ALLOWED_PLAIN_PROPS.join(", ")}만 쓴다`];
  }
  if (name.startsWith("--milvus-")) {
    return ctx.milvusVars.has(name)
      ? undefined
      : ["milvus-var", `${name}: 이 변수를 읽는 밀버스 컴포넌트나 milvusBridge.css가 없다(오타이거나 효과가 없다)`];
  }
  if (/^--(slds|sds)-c-/.test(name)) {
    return ["c-hook", `${name}: --slds-c-*·--sds-c-*는 쓰지 않는다. SLDS 2 지원이 미확인이고 :root에 두면 모든 변형을 덮는다`];
  }
  if (BRAND_COLOR_PATTERNS.some((p) => p.test(name))) {
    return ["brand-color", `${name}: 브랜드 색은 org 테마(BrandingSet)가 원본이다`];
  }
  if (name.startsWith("--slds-g-font-family")) return ["font-family", `${name}: 글꼴은 바꾸지 않는다`];

  const isS = name.startsWith("--slds-s-");
  if (!isS && !name.startsWith("--slds-g-")) {
    return ["unknown-name", `${name}: util.css에는 --slds-g-*, --slds-s-*, --milvus-*와 ${ALLOWED_PLAIN_PROPS.join(", ")}만 쓴다`];
  }
  if (!(isS ? ctx.readSHooks : ctx.readGHooks).has(name)) {
    return ["unread", `${name}: SLDS 2 CSS와 기본 컴포넌트 CSS 어디에서도 읽지 않는 이름이다(오타이거나 효과가 없다)`];
  }

  if (!name.includes("color")) {
    if (/^--slds-g-shadow-.*focus/.test(name) && !focusShadowOk(value)) {
      return ["focus-shadow", `${name}: 포커스 링 값 안의 색은 var(${FOCUS_COLORS.join(")와 var(")})만 쓴다. hex·rgb 같은 리터럴은 쓰지 않는다`];
    }
    return undefined;
  }
  if (isS) {
    if (!COLOR_S_WHITELIST.includes(name)) {
      return ["color-s-hook", `${name}: 색 s hook은 브랜드 색에 이어진 것이 많다. 쓸 수 있는 것은 ${COLOR_S_WHITELIST.join(", ")}뿐이다`];
    }
    const ref = /^var\(\s*(--slds-g-color-[\w-]+)\s*\)$/.exec(value.trim());
    return ref && isNeutral(ref[1])
      ? undefined
      : ["color-s-hook", `${name}: 값은 중립 g hook 하나만 참조한다(예: var(--slds-g-color-surface-container-2))`];
  }
  if (FEEDBACK_NAMES.has(name) || LBC_ONLY_G.includes(name)) return undefined;
  if (isNeutral(name)) {
    return /^light-dark\(/.test(value.trim())
      ? undefined
      : ["neutral-light-dark", `${name}: 중립 색은 light-dark(라이트, 다크)로 쓴다. 일반 값으로 쓰면 다크 모드 값이 사라진다`];
  }
  return ["color-g", `${name}: 중립 색과 피드백 색(설계 5.3) 밖의 색 hook은 브랜드 색에 이어진 것이 많아 쓰지 않는다`];
}

// light-dark(a, b)의 a. 괄호 안의 쉼표는 건너뛴다
function firstArg(args: string): string {
  let depth = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "(") depth++;
    else if (args[i] === ")") depth--;
    else if (args[i] === "," && depth === 0) return args.slice(0, i);
  }
  return args;
}

/**
 * 값의 라이트 모드 색(#rrggbb). light-dark()는 첫 인자, var()는 같은 파일의 정의를 따라간다(없으면 fallback).
 * ponytail: #rgb·#rrggbb만 잰다. rgb()나 이 파일에 없는 hook을 참조하면 재지 않고 넘어간다
 */
function lightHex(value: string, decls: Map<string, string>, seen = new Set<string>()): string | undefined {
  const v = value.trim();
  const ld = /^light-dark\(([\s\S]*)\)$/.exec(v);
  if (ld) return lightHex(firstArg(ld[1]), decls, seen);
  const ref = /^var\(\s*(--[\w-]+)\s*(?:,([\s\S]*))?\)$/.exec(v);
  if (ref) {
    const [, name, fallback] = ref;
    if (decls.has(name) && !seen.has(name)) return lightHex(decls.get(name)!, decls, seen.add(name));
    return fallback === undefined ? undefined : lightHex(fallback, decls, seen);
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v)?.[1].toLowerCase();
  if (!hex) return undefined;
  return "#" + (hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex);
}

/**
 * 대비를 잴 글자 hook → [배경 이름, 라이트 색] 목록
 * - 중립: on-surface-N × surface-N·surface-container-N (반전은 반전끼리)
 * - 피드백: 글자(-1, on-*-1) × 흰색과 배경(container-1)
 * ponytail: 둘 다 이 파일에 있는 쌍만 잰다. 한쪽만 바꾸면 SLDS 기본값과의 대비는 보지 않는다(기본값은 색인에 없다)
 */
function contrastTargets(decls: Map<string, string>): Map<string, [string, string][]> {
  const targets = new Map<string, [string, string][]>();
  const light = (name: string) => (decls.has(name) ? lightHex(decls.get(name)!, decls) : undefined);
  const add = (text: string, bg: string, hex = light(bg)) => {
    if (hex) targets.set(text, [...(targets.get(text) ?? []), [bg, hex]]);
  };
  for (const text of decls.keys()) {
    const t = /^--slds-g-color-on-surface(-inverse)?-\d+$/.exec(text);
    if (!t) continue;
    for (const bg of decls.keys()) {
      const b = /^--slds-g-color-surface(?:-container)?(-inverse)?-\d+$/.exec(bg);
      if (b && b[1] === t[1]) add(text, bg);
    }
  }
  for (const kind of Object.values(FEEDBACK_HOOKS)) {
    for (const text of [kind.text, kind.onContainer]) {
      if (!text || !decls.has(text)) continue;
      add(text, "흰색", "#ffffff");
      add(text, kind.container);
    }
  }
  return targets;
}

/** util.css 규칙 (설계 5.2, 5.3). 문제가 없으면 빈 배열 */
export function checkUtilCss(css: string, file: string, ctx: RuleContext): Issue[] {
  let root: Root;
  try {
    root = postcss.parse(css);
  } catch (e) {
    return [syntaxIssue(e, file)];
  }
  const issues: Issue[] = [];
  const add = (rule: string, message: string, fix?: string) => {
    issues.push(fix ? { file, rule, message, fix } : { file, rule, message });
  };

  root.walkAtRules((at) => {
    if (at.name === "font-face") add("font-face", "@font-face는 쓰지 않는다. 글꼴은 바꾸지 않는다");
    else add("root-only", `@${at.name}: ${ROOT_ONLY}`);
  });
  root.walkRules((r) => {
    if (r.selector.trim() !== ":root" || r.parent?.type !== "root") add("root-only", `"${r.selector}": ${ROOT_ONLY}`);
  });

  // 최상위 :root의 선언. postcss가 주석을 노드로 떼어 내므로 주석 안의 선언은 여기 오지 않는다
  const decls = new Map<string, string>();
  for (const node of root.nodes) {
    if (node.type !== "rule" || node.selector.trim() !== ":root") continue;
    node.each((d) => {
      if (d.type === "decl") decls.set(d.prop, d.value);
    });
  }
  for (const [name, value] of decls) {
    const problem = declProblem(name, value, ctx);
    if (problem) add(...problem);
  }

  if (decls.has("--slds-g-shadow-4") && !(decls.has("--slds-g-shadow-5") && decls.has("--slds-g-shadow-6"))) {
    add(
      "shadow-focus-keep",
      "--slds-g-shadow-4를 바꾸면 기본값이 var(--slds-g-shadow-4)인 --slds-g-shadow-5·-6(기본 컴포넌트의 포커스 표시)도 바뀐다. 두 값을 SLDS 2 기본 shadow-4 값으로 따로 적는다",
    );
  }

  for (const [text, bgs] of contrastTargets(decls)) {
    const hex = lightHex(decls.get(text)!, decls);
    if (!hex) continue;
    const low = bgs
      .map(([bg, bgHex]) => ({ bg, bgHex, ratio: contrastRatio(hex, bgHex) }))
      .filter((x) => x.ratio < 4.5)
      .sort((a, b) => a.ratio - b.ratio);
    if (!low.length) continue;
    add(
      "contrast",
      `${text} ${hex}의 대비가 4.5:1보다 낮다: ${low.map((x) => `${x.bg}(${x.bgHex}) 위 ${x.ratio.toFixed(2)}:1`).join(", ")}`,
      // 반전 면의 밝은 글자에는 진한 단계를 제안하지 않는다
      text.includes("inverse") ? undefined : suggestPassingText(hex, low[0].bgHex),
    );
  }
  return issues;
}

/** milvusOverride.css 규칙 (설계 5.1). 경고는 알리기만 하고, 오류만 check --style을 실패시킨다 */
export function checkOverrideCss(css: string, file: string): { warnings: Issue[]; errors: Issue[] } {
  const warnings: Issue[] = [];
  const errors: Issue[] = [];
  let root: Root;
  try {
    root = postcss.parse(css);
  } catch (e) {
    return { warnings, errors: [syntaxIssue(e, file)] };
  }
  const warn = (rule: string, message: string) => {
    warnings.push({ file, rule, message });
  };

  root.walkAtRules((at) => {
    if (at.name === "font-face" || at.name === "import") {
      errors.push({ file, rule: at.name, message: `@${at.name}: 글꼴과 외부 CSS는 들이지 않는다(글꼴은 바꾸지 않는다)` });
    }
  });
  root.walkRules((r) => {
    if (r.parent?.type === "atrule" && /keyframes$/.test((r.parent as AtRule).name)) return;
    for (const sel of r.selectors) {
      const classes = sel.match(/\.[\w-]+/g) ?? [];
      if (!classes.length || classes.some((c) => !c.startsWith(".slds-"))) {
        warn("selector", `"${sel}": .slds-* 클래스가 아닌 선택자다. override는 Salesforce 클래스의 모양만 덮어쓴다`);
      }
    }
  });
  root.walkDecls((d) => {
    if (/#[0-9a-f]{3,8}\b/i.test(d.value)) {
      warn("hex", `${d.prop}: ${d.value} — hex 색을 쓰지 않는다. 브랜드 색은 org 테마가, 중립 색은 util.css의 hook이 원본이다`);
    }
    if (d.important) warn("important", `${d.prop}: !important는 Salesforce가 바꾼 규칙까지 이겨 업데이트 때 깨지기 쉽다`);
    if (BRAND_COLOR_PATTERNS.some((p) => p.test(d.prop))) warn("brand-color", `${d.prop}: 브랜드 색 hook은 org 테마(BrandingSet)가 원본이다`);
  });
  return { warnings, errors };
}
