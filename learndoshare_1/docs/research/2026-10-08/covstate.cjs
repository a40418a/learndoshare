// state.json의 상태 선언을 var() 해석으로 hook / mixed / literal / keyword로 나누고 컴포넌트별 커버리지를 낸다
const path = require("path");
const { OUT } = require("./paths.cjs");
const { rows, lbcVisual, slds2Folders } = require(path.join(OUT, "state.json"));
const H = require(path.join(OUT, "hookdefs.json"));
function parseVar(s, i) { // s[i..] starts with "var(" ; returns {name, fb, end}
  let depth = 0, j = i + 4, start = j, comma = -1;
  for (; j < s.length; j++) { const ch = s[j]; if (ch === "(") depth++; else if (ch === ")") { if (depth === 0) break; depth--; } else if (ch === "," && depth === 0 && comma < 0) comma = j; }
  const name = s.slice(start, comma < 0 ? j : comma).trim(); const fb = comma < 0 ? null : s.slice(comma + 1, j).trim();
  return { name, fb, end: j + 1 };
}
function resolve(s, toks) {
  let out = "", i = 0;
  while (i < s.length) {
    if (s.startsWith("var(", i)) { const { name, fb, end } = parseVar(s, i);
      if (/^--slds-[gs]-/.test(name) && name in H) { toks.push(name); out += " HOOK "; }
      else if (/^--lwc-/.test(name)) { toks.push(name); out += " HOOK "; }
      else if (fb != null) out += resolve(fb, toks);
      else out += " ";
      i = end; } else { out += s[i]; i++; }
  }
  return out;
}
const LIT = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|(^|[^\w-])-?\d*\.?\d*[1-9]\d*(\.\d+)?(px|rem|em|%|ms|s)\b|url\(|translate|scale\(|rotate|\b(ButtonText|Highlight)\b/i;
function cls(r) {
  if (r.prop === "cursor") return { k: "cursor", toks: [] };
  const toks = []; const res = resolve(r.value.replace(/!important/, ""), toks);
  if (/^(opacity)$/.test(r.prop) || /^text-decoration/.test(r.prop)) return { k: toks.length ? "hook" : "keyword", toks, res };
  const lit = LIT.test(res.replace(/\bHOOK\b/g, ""));
  return { k: toks.length ? (lit ? "mixed" : "hook") : (lit ? "literal" : "keyword"), toks, res };
}
const STATES = ["focus", "hover", "active", "disabled"];
const per = {}; // src:comp -> state -> {hook,mixed,literal}
const uniq = {};
for (const r of rows) {
  if (r.src === "lbcCommon") continue;
  const c = cls(r); r.k = c.k; r.toks = c.toks; r.res = c.res;
  const key = r.src + ":" + r.comp;
  for (const s of r.states) { if (!STATES.includes(s)) continue;
    const o = ((per[key] = per[key] || {})[s] = per[key][s] || { hook: 0, mixed: 0, literal: 0, keyword: 0, cursor: 0 }); o[c.k]++;
    const u = r.src + "|" + s + "|" + r.prop + "|" + r.value + "|" + r.sel; if (!uniq[u]) uniq[u] = { src: r.src, s, k: c.k }; }
}
// 고유 선언 기준 합계
const tot = {}; for (const u of Object.values(uniq)) { const k = u.src + "|" + u.s; (tot[k] = tot[k] || { hook: 0, mixed: 0, literal: 0, keyword: 0, cursor: 0 })[u.k]++; }
console.log("== 고유 상태 선언 (hook=전부 hook, mixed=hook+하드코딩 기하/색, literal=hook 없음)"); for (const [k, v] of Object.entries(tot).sort()) console.log(k.padEnd(16), JSON.stringify(v));
function status(o) { if (!o) return "na"; const real = o.hook + o.mixed + o.literal; if (!real) return "na"; if (o.literal === 0 && o.mixed === 0) return "full"; if (o.hook === 0 && o.mixed === 0) return "none"; return "partial"; }
const comps = [...slds2Folders.map((c) => "slds2:" + c), ...lbcVisual.map((c) => "lbc:" + c)];
const agg = {};
for (const src of ["slds2", "lbc"]) for (const s of [...STATES, "ALL"]) {
  const b = { full: [], partial: [], none: [], na: [] };
  for (const key of comps.filter((k) => k.startsWith(src + ":"))) {
    let st; if (s === "ALL") { const ss = STATES.map((x) => status(per[key] && per[key][x])).filter((x) => x !== "na"); st = !ss.length ? "na" : ss.every((x) => x === "full") ? "full" : ss.every((x) => x === "none") ? "none" : "partial"; }
    else st = status(per[key] && per[key][s]);
    b[st].push(key.split(":")[1]);
  }
  agg[src + "|" + s] = b;
  console.log(src.padEnd(6), s.padEnd(9), "full=" + b.full.length, "partial=" + b.partial.length, "none=" + b.none.length, "na=" + b.na.length);
}
require("fs").writeFileSync(path.join(OUT, "covstate.json"), JSON.stringify({ agg, per }));
if (process.env.V) for (const [k, b] of Object.entries(agg)) if (k.endsWith("ALL")) { console.log(k, "\n partial:", b.partial.join(","), "\n none:", b.none.join(","), "\n na:", b.na.join(",")); }
module.exports = { cls, rows };
