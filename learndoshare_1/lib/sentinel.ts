// 센티널 브랜드 util.css (설계 9.6의 2). 허용된 모든 hook과 브리지 변수에 서로 구별되는 값을 넣는다.
// Storybook "시작하기/반영 검사"가 기본 브랜드와 이 브랜드로 같은 스토리를 그려, 계산값이 바뀐 곳을 "반영"으로 본다.
// 값이 hook마다 다르므로 바뀐 계산값이 어느 hook에서 왔는지 거꾸로 찾을 수 있다(lib/reflect.ts의 지문).
// 결과는 util.css 규칙(lib/rules.ts의 checkUtilCss)을 통과해야 한다. 규칙 때문에 구별되는 값을 넣지 못한 hook은 missing으로 돌려준다
import type { RuleContext } from "./hooks-index.ts";
import { COLOR_S_WHITELIST, declProblem } from "./rules.ts";
import type { SpecItem } from "./spec-items.ts";

/** 값의 종류. 이름으로 정한다(kindOf). 반영 검사 페이지가 종류마다 계산값을 재는 속성을 고른다 */
export type Kind =
  | "color"
  | "alias"
  | "radius"
  | "border"
  | "spacing"
  | "size"
  | "font-size"
  | "wide"
  | "letter"
  | "weight"
  | "line-height"
  | "time"
  | "easing"
  | "shadow"
  | "focus-shadow"
  | "transform"
  | "align"
  | "font-style"
  | "text-transform";
export type SentinelDecl = { name: string; value: string; kind: Kind };
export type Missing = { name: string; reason: string };
export type SentinelPlan = { decls: SentinelDecl[]; missing: Missing[] };

// 이름 때문에 util.css에 둘 수 없다는 규칙(lib/rules.ts declProblem의 규칙 id). 이런 이름은 "허용된 hook"이 아니어서 센티널 대상이 아니다.
// 그 밖의 규칙(light-dark, 포커스 색, 단위 등)은 값의 문제라 이 파일의 값이 틀린 것이다. 그때는 빼지 않고 missing에 적는다
const NAME_RULES = new Set(["c-hook", "brand-color", "font-family", "unknown-name", "unread", "color-g", "milvus-var"]);

// 값이 하나뿐인 켜기 스위치. 켜면 milvusButton이 다른 마크업(블루프린트 버튼)을 그려 기본 브랜드와 요소를 맞춰 비교할 수 없다
const SWITCHES: Record<string, string> = {
  "--milvus-button-custom": "켜기 스위치(on)라 값이 하나뿐이다. 켜면 milvusButton이 다른 마크업을 그려 기본 브랜드와 요소를 맞춰 비교할 수 없다",
};

// 색 s hook은 값이 중립 g hook 하나여야 한다(설계 5.2). 그래서 그 g hook과 값이 같다. 배경막만 native용 g와 한 쌍이다
const BACKDROP_S = "--slds-s-backdrop-color-background";
const BACKDROP_G = "--slds-g-color-neutral-10-opacity-50";
const ALIAS_TARGET = "--slds-g-color-surface-container-3";
// 포커스 링 값 안에 쓸 수 있는 색(설계 5.2)
const FOCUS_BRAND = "--slds-g-color-brand-base-15";
const FOCUS_WHITE = "--slds-g-color-neutral-base-100";

/** 이름으로 값의 종류를 정한다. 정하지 못하면 undefined(missing에 적는다) */
export function kindOf(name: string): Kind | undefined {
  if (name === "letter-spacing") return "letter";
  if (COLOR_S_WHITELIST.includes(name)) return "alias";
  if (name.startsWith("--milvus-")) {
    if (/motion-duration/.test(name)) return "time";
    if (/easing/.test(name)) return "easing";
    if (/-transform$/.test(name)) return "text-transform";
    if (/background/.test(name)) return "color";
    if (/letter-spacing/.test(name)) return "letter";
    if (/modal-/.test(name)) return "wide";
  }
  // 이름에 color가 없는 색 hook 두 개: SLDS 2가 color 속성으로 읽는 alert-close-button-hover, 설계 9.8의 정의 없는 info-container-1
  if (/color|-container-\d|alert-close-button-hover/.test(name)) return "color";
  if (/shadow/.test(name)) return /focus/.test(name) ? "focus-shadow" : "shadow";
  if (/transform/.test(name)) return "transform";
  if (/radius/.test(name)) return "radius";
  if (/sizing-border|border-width/.test(name)) return "border";
  if (/weight/.test(name)) return "weight";
  if (/line-?height/.test(name)) return "line-height";
  if (/font-size|font-scale/.test(name)) return "font-size";
  if (/align/.test(name)) return "align";
  if (/font-style/.test(name)) return "font-style";
  if (/spacing|padding/.test(name)) return "spacing";
  if (/sizing/.test(name)) return "size";
  return undefined;
}

// HSL → #rrggbb
function hsl(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * 색의 명도(HSL L). 대비 규칙(글자 on-surface·피드백 글자 × 면·흰색 4.5:1)을 지키도록 글자는 어둡게, 면은 밝게 둔다.
 * 단계 이름(neutral-base-N, palette-*-N)은 단계 숫자를 명도로 써서 화면이 읽을 만하게 둔다
 */
function lightness(name: string): number {
  const step = /(?:neutral-base|palette-[a-z]+|neutral)-(\d+)(?:-opacity-\d+)?$/.exec(name);
  if (step) return Math.min(97, Math.max(4, Number(step[1])));
  if (/on-surface-inverse|border-inverse/.test(name)) return 88;
  if (/inverse/.test(name)) return 18;
  if (/on-disabled/.test(name)) return 45;
  if (/disabled-container/.test(name)) return 88;
  if (/disabled|border/.test(name)) return 58;
  if (/on-/.test(name)) return 22;
  if (/surface|container|background/.test(name)) return 94;
  return 22; // 피드백 글자(success-1 등)
}

/** 센티널 선언과, 구별되는 값을 넣지 못한 hook. items의 hook·브리지 변수는 규칙에 걸려도 조용히 빼지 않고 missing에 적는다 */
export function sentinelPlan(ctx: RuleContext, items: SpecItem[]): SentinelPlan {
  const fromItems = new Set(items.flatMap((i) => [...i.hooks, ...i.bridgeVars]));
  const names = [...new Set([...ctx.readGHooks, ...ctx.readSHooks, ...ctx.milvusVars, ...fromItems, "letter-spacing"])].sort();
  const decls: SentinelDecl[] = [];
  const missing: Missing[] = [];

  // 종류마다 i번째 값을 만들고, 앞에서 쓴 값(모든 종류)과 같으면 건너뛴다
  const used = new Set<string>();
  const counters = new Map<string, number>();
  const next = (key: string, make: (i: number) => string | undefined): string | undefined => {
    for (let i = counters.get(key) ?? 0; i < 1000; i++) {
      const v = make(i);
      if (v === undefined) return undefined;
      if (used.has(v)) continue;
      counters.set(key, i + 1);
      used.add(v);
      return v;
    }
    return undefined;
  };
  const pick = (list: string[]) => (i: number) => list[i];

  // 색상각은 황금각(약 137.5도)씩 돌려 이웃한 hook끼리도 색이 멀다. 투명도 이름(-opacity-N)은 그 투명도를 붙인다
  const color = (name: string) => {
    const alpha = /-opacity-(\d+)$/.exec(name)?.[1];
    const a = alpha ? Math.round((Number(alpha) / 100) * 255).toString(16).padStart(2, "0") : "";
    const hex = next("color", (i) => hsl((i * 137.508) % 360, 55, lightness(name)) + a);
    return hex && `light-dark(${hex}, ${hex})`;
  };

  // 길이는 종류마다 소수 자리를 달리해 종류끼리 겹치지 않는다(반경은 7·9·11px…, 테두리 두께는 정수 px: 브라우저가 두께를 장치 픽셀로 내린다)
  const valueOf = (name: string, kind: Kind): string | undefined => {
    switch (kind) {
      case "color":
        return color(name);
      case "alias":
        return `var(${name === BACKDROP_S ? BACKDROP_G : ALIAS_TARGET})`;
      case "radius":
        return next(kind, (i) => `${7 + 2 * i}px`);
      case "border":
        return next(kind, (i) => `${2 + i}px`);
      case "spacing":
        return next(kind, (i) => `${1 + i}.25px`);
      case "size":
        return next(kind, (i) => `${4 + i}.75px`);
      case "font-size":
        return next(kind, (i) => `${9 + i}.5px`);
      case "wide":
        return next(kind, (i) => `${303 + 10 * i}px`);
      case "letter":
        return next(kind, (i) => `${i}.375px`);
      case "weight":
        return next(kind, (i) => (105 + 50 * i <= 1000 ? `${105 + 50 * i}` : undefined));
      case "line-height":
        return next(kind, (i) => (1.11 + 0.02 * i).toFixed(2));
      // 설계 5.6: 단위를 붙이고 0.01ms 이상이다(브리지가 max(var(…), 0.01ms)로 감싼다). "0.777s 계열"
      case "time":
        return next(kind, (i) => `${(0.777 + 0.01 * i).toFixed(3)}s`);
      case "easing":
        return next(kind, (i) => `cubic-bezier(${(0.17 + 0.01 * i).toFixed(2)}, 0.27, 0.37, 0.47)`);
      case "shadow":
        return next(kind, (i) => `0 1px ${3 + i}.5px 0 #0000004d`);
      // 포커스 링 색은 브랜드 색을 따른다. 반전 링만 흰색(neutral-base-100)이다
      case "focus-shadow":
        return next(kind, (i) => `${/inset/.test(name) ? "inset " : ""}0 0 0 ${2 + i}.5px var(${/inverse/.test(name) ? FOCUS_WHITE : FOCUS_BRAND})`);
      case "transform":
        return next(kind, (i) => `translateY(-${3 + i}px)`);
      case "align":
        return next(kind, pick(["justify", "end", "right", "center"]));
      case "font-style":
        return next(kind, (i) => `oblique ${7 + 2 * i}deg`);
      case "text-transform":
        return next(kind, pick(["lowercase", "capitalize", "full-width"]));
    }
  };

  for (const name of names) {
    const probe = declProblem(name, "1px", ctx);
    const nameRule = probe && (NAME_RULES.has(probe[0]) || (probe[0] === "color-s-hook" && !COLOR_S_WHITELIST.includes(name)));
    if (nameRule) {
      // 허용되지 않은 이름. 명세 항목에 있는 이름만 알린다(색인의 나머지는 브랜드 색 등 원래 금지된 이름이다)
      if (fromItems.has(name)) missing.push({ name, reason: probe[1] });
      continue;
    }
    if (SWITCHES[name]) {
      missing.push({ name, reason: SWITCHES[name] });
      continue;
    }
    const kind = kindOf(name);
    const value = kind && valueOf(name, kind);
    if (!kind || !value) {
      missing.push({ name, reason: kind ? `${kind} 값이 모자라다` : "이름으로 값의 종류(길이, 색, 시간 등)를 정하지 못했다" });
      continue;
    }
    const problem = declProblem(name, value, ctx);
    if (problem) {
      missing.push({ name, reason: problem[1] });
      continue;
    }
    decls.push({ name, value, kind });
    if (kind === "alias") {
      missing.push({ name, reason: `규칙상 값이 중립 g hook 하나(${value})뿐이라 그 hook과 값이 같다. 바뀐 곳은 그 hook의 항목으로 잡힌다` });
    }
  }
  return { decls, missing };
}

export function sentinelCss(plan: SentinelPlan): string {
  const lines = plan.decls.map((d) => `  ${d.name}: ${d.value};`);
  return `/* 센티널 브랜드: 반영 검사(Storybook 시작하기/반영 검사) 전용. org에 배포하지 않는다 */\n:root {\n${lines.join("\n")}\n}\n`;
}

export function buildSentinelUtilCss(ctx: RuleContext, items: SpecItem[]): string {
  return sentinelCss(sentinelPlan(ctx, items));
}
