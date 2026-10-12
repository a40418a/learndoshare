// milvusBridge.css 생성기 (설계 5.6). 사용: node scripts/bridge/generate.ts (pnpm bridge:generate)
// - 대상 선언을 var(--milvus-*, 원래 값)으로 바꾼 규칙을 원본과 같은 선택자 목록·맥락(@media·@supports) 안에 둔다.
//   브랜드가 변수를 정하지 않으면 화면이 그대로다
// - 브리지는 SLDS 2 CSS보다 뒤에 들어와 같은 우선순위(specificity)의 원본 규칙을 모두 이긴다. 그래서 원래 대상보다 뒤에서
//   이기던 같은 우선순위 규칙(예: .slds-button 뒤의 .slds-button_icon)의 같은 속성 선언을 원래 순서대로 그대로 다시 넣는다.
//   이 규칙이 다시 이기던 규칙도 같은 방식으로 넣는다. 우선순위가 다른 규칙은 원래대로 이기거나 진다
// - 줄인 움직임 규칙은 브랜드 선택과 상관없이 항상 넣는다(접근성). 스피너도 여기서만 다룬다
import { writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { list, parse, type AtRule, type Declaration, type Rule } from "postcss";
import { BRIDGE_TARGETS, bucketOf, isSmoothEasing, motionLonghand, readSlds2Css, selectorKey, type BridgeTarget } from "./targets.ts";

const HEADER = `/* hook이 없는 항목을 --milvus-* 변수로 잇는 클래스 규칙(설계 5.6). 직접 고치지 않는다.
   scripts/bridge/generate.ts가 SLDS 2 CSS에서 만든다(pnpm bridge:generate). 변수를 정하지 않으면 모든 값이 Salesforce 원래 값이다.
   var()가 없는 선언은 원래 이기던 규칙이 계속 이기도록 원본을 그대로 다시 넣은 것이다 */
`;
const REDUCED_MOTION = ["transition-duration: 0.01ms", "animation-duration: 0.01ms", "animation-iteration-count: 1"];

// 속성 묶음: 브리지 속성과 같은 값을 정하는 원본 속성. same은 그대로 다시 넣고, shorthand는 브리지 속성 값만 꺼내 넣는다
type Family = { same: RegExp; shorthand?: string; property: string };
const LOGICAL: Record<string, string> = { width: "inline-size", height: "block-size", "max-width": "max-inline-size", "min-height": "min-block-size" };
function familyOf(property: string): Family {
  const motion = /^(transition|animation)-(duration|timing-function)$/.exec(property);
  if (motion) return { same: new RegExp(`^${property}$`), shorthand: motion[1], property };
  if (property === "line-height" || property === "font-weight") return { same: new RegExp(`^${property}$`), shorthand: "font", property };
  if (/radius$/.test(property)) return { same: /radius$/, property };
  if (property === "border") return { same: /^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?(-(width|style|color))?$|^border-image/, property };
  if (/^text-decoration/.test(property)) return { same: /^text-decoration/, property };
  return { same: new RegExp(`^(${[property, LOGICAL[property]].filter(Boolean).join("|")})$`), property };
}
/** shorthand 선언에서 브리지 속성 값을 꺼낸다 */
function fromShorthand(d: Declaration, property: string): string {
  if (d.prop === "font") {
    if (/^(inherit|initial|unset|revert|revert-layer)$/.test(d.value)) return d.value;
    throw new Error(`font shorthand에서 ${property}를 꺼낼 수 없다: ${d.value}`);
  }
  return motionLonghand(d.value, property.endsWith("duration") ? "duration" : "timing-function").join(", ");
}

/** 선택자 하나의 우선순위 [id, 클래스·속성·가상 클래스, 태그·가상 요소]. :where()는 0, :not()·:is()·:has()는 인자 중 가장 큰 값 */
function specificity(selector: string): number[] {
  const s = [0, 0, 0];
  let i = 0;
  const ident = () => {
    const m = /^-?[\w-]+/.exec(selector.slice(i));
    i += m ? m[0].length : 0;
    return m?.[0] ?? "";
  };
  const args = () => {
    const start = i + 1;
    for (let depth = 0; i < selector.length; i++) {
      if (selector[i] === "(") depth++;
      else if (selector[i] === ")" && --depth === 0) break;
    }
    return selector.slice(start, i++);
  };
  while (i < selector.length) {
    const ch = selector[i];
    if (ch === "#" || ch === ".") {
      i++;
      ident();
      s[ch === "#" ? 0 : 1]++;
    } else if (ch === "[") {
      i = selector.indexOf("]", i) + 1;
      s[1]++;
    } else if (ch === ":") {
      const element = selector[i + 1] === ":";
      i += element ? 2 : 1;
      const name = ident();
      const inner = selector[i] === "(" ? args() : null;
      if (element || /^(before|after|first-line|first-letter)$/.test(name)) s[2]++;
      else if (/^(not|is|has|matches)$/.test(name) && inner !== null) {
        const top = list.comma(inner).map(specificity).reduce((a, b) => (a[0] - b[0] || a[1] - b[1] || a[2] - b[2]) >= 0 ? a : b, [0, 0, 0]);
        top.forEach((v, k) => (s[k] += v));
      } else if (name !== "where") s[1]++;
    } else if (/[\w-]/.test(ch)) {
      ident();
      s[2]++;
    } else i++;
  }
  return s;
}

const contextOf = (r: Rule) => {
  const chain: string[] = [];
  for (let p = r.parent; p && p.type !== "root"; p = p.parent) if (p.type === "atrule") chain.unshift(`@${(p as AtRule).name} ${(p as AtRule).params}`);
  return chain;
};
const wrap = (t: BridgeTarget, v: string) => (t.min ? `max(var(${t.varName}, ${v}), ${t.min})` : `var(${t.varName}, ${v})`);
function bridged(value: string, t: BridgeTarget): string {
  if (t.property.endsWith("-duration")) return list.comma(value).map((v) => (bucketOf(v) === t.varName ? wrap(t, v) : v)).join(", ");
  if (t.property.endsWith("-timing-function")) return list.comma(value).map((v) => (isSmoothEasing(v) ? wrap(t, v) : v)).join(", ");
  if (t.token) return value.replace(new RegExp(`(?<![\\w.-])${t.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w.-])`, "g"), wrap(t, t.token));
  return wrap(t, value);
}

export function generateBridge(sldsCss: string, targets: BridgeTarget[]): string {
  const rules: Rule[] = [];
  parse(sldsCss).walkRules((r) => {
    if (!(r.parent?.type === "atrule" && /keyframes$/i.test((r.parent as AtRule).name))) rules.push(r);
  });
  const byKey = Map.groupBy(rules, (r) => selectorKey(r.selector));
  // 규칙마다 넣을 선언. 키는 "원본 선언 순서|속성"이라 정렬하면 같은 규칙 안 순서를 지킨다
  const out = new Map<Rule, Map<string, { prop: string; value: string }>>();
  const slot = (index: number, prop: string) => `${String(index).padStart(4, "0")}|${prop}`;
  const put = (r: Rule, index: number, prop: string, value: string) => {
    const row = out.get(r) ?? new Map();
    out.set(r, row.set(slot(index, prop), { prop, value }));
  };
  const families = new Map<string, { family: Family; seeds: Set<Rule> }>();

  for (const t of targets) {
    const family = familyOf(t.property);
    const fkey = `${family.same.source}|${family.shorthand}|${family.property}`;
    const seeds = families.get(fkey)?.seeds ?? new Set<Rule>();
    families.set(fkey, { family, seeds });
    // 움직임 longhand 대상은 원본 transition·animation shorthand에서도 값을 꺼낸다
    const base = /^(transition|animation)-/.test(t.property) ? family.shorthand : undefined;
    for (const key of t.selectors) {
      const found = byKey.get(key);
      if (!found) throw new Error(`SLDS 2 CSS에 규칙이 없다: ${key} (${t.id})`);
      let hit = false;
      for (const r of found) {
        r.nodes.forEach((d, index) => {
          if (d.type !== "decl" || (d.prop !== t.property && d.prop !== base)) return;
          hit = true;
          const current = out.get(r)?.get(slot(index, t.property))?.value ?? (d.prop === t.property ? d.value : fromShorthand(d, t.property));
          const value = bridged(current, t);
          if (value === current) return;
          put(r, index, t.property, value);
          seeds.add(r);
        });
      }
      if (!hit && t.initial === undefined) throw new Error(`SLDS 2 CSS의 ${key}에 ${t.property}가 없다 (${t.id})`);
      if (!hit) {
        put(found[0], found[0].nodes.length, t.property, wrap(t, t.initial!));
        seeds.add(found[0]);
      }
    }
  }

  // 원래 이기던 같은 우선순위 규칙을 다시 넣는다. 문서 순서대로 지나가며, 이미 넣은 규칙과 우선순위가 같은 뒤 규칙을 더한다
  for (const { family, seeds } of families.values()) {
    const included = new Set<string>();
    for (const r of rules) {
      const decls = r.nodes.flatMap((d, index) => (d.type === "decl" && (family.same.test(d.prop) || d.prop === family.shorthand) ? [{ d, index }] : []));
      if (!decls.length) continue;
      const specs = r.selectors.map((s) => specificity(s).join(","));
      if (!seeds.has(r) && !specs.some((s) => included.has(s))) continue;
      specs.forEach((s) => included.add(s));
      for (const { d, index } of decls) {
        const prop = family.same.test(d.prop) ? d.prop : family.property;
        if (!out.get(r)?.has(slot(index, prop))) put(r, index, prop, prop === d.prop ? d.value : fromShorthand(d, prop));
      }
    }
  }

  // 맥락이 같은 이웃 규칙은 한 블록에 둔다
  const lines: string[] = [];
  const open: string[] = [];
  const enter = (context: string[]) => {
    let same = 0;
    while (same < open.length && same < context.length && open[same] === context[same]) same++;
    while (open.length > same) {
      open.pop();
      lines.push(`${"  ".repeat(open.length)}}`);
    }
    for (const c of context.slice(same)) {
      lines.push(`${"  ".repeat(open.length)}${c} {`);
      open.push(c);
    }
  };
  const rule = (selector: string, decls: string[]) => {
    const pad = "  ".repeat(open.length);
    lines.push(`${pad}${selector} {`, ...decls.map((d) => `${pad}  ${d};`), `${pad}}`);
  };
  for (const r of rules) {
    const row = out.get(r);
    if (!row) continue;
    enter(contextOf(r));
    rule(r.selectors.join(", "), [...row].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, { prop, value }]) => `${prop}: ${value}`));
  }
  const motion = [...new Set(rules.filter((r) => r.some((d) => d.type === "decl" && /^(transition|animation)/.test(d.prop))).map((r) => r.selectors.join(", ")))];
  if (motion.length) {
    enter(["@media (prefers-reduced-motion: reduce)"]);
    for (const selector of motion) rule(selector, REDUCED_MOTION);
  }
  enter([]);
  return `${HEADER}${lines.join("\n")}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const css = generateBridge(readSlds2Css(), BRIDGE_TARGETS);
  writeFileSync(fileURLToPath(new URL("../../templates/force-app/main/default/staticresources/milvusBridge.css", import.meta.url)), css);
  const vars = [...css.matchAll(/var\(--milvus-/g)].length;
  console.log(`milvusBridge.css를 썼다: 대상 ${BRIDGE_TARGETS.length}개, var(--milvus-*) ${vars}곳, ${css.length}바이트`);
}
