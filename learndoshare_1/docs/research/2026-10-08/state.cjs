// 포커스·상호작용 상태(focus/hover/active/disabled/cursor) 선언을 다시 뽑는다 (decls.json은 선택자 80자 잘림, cursor·커스텀 속성 대입 누락)
const fs = require("fs"), path = require("path"); const { postcss, OUT, LBC: L, SLDS2_COMPONENTS: S } = require("./paths.cjs");
const STATE = [
  ["focus", /:focus(-visible|-within)?\b|has-focus|is-focused|\.slds-focus/],
  ["hover", /:hover\b|is-hovered/],
  ["active", /:active\b|is-pressed/],
  ["disabled", /:disabled\b|\[disabled|\[aria-disabled=["']?true|is-disabled|-disabled\b/],
];
const VIS = /^(box-shadow|outline(-color|-style|-width|-offset)?|color|background(-color|-image)?|border(-[a-z-]+)?|text-decoration.*|fill|opacity|transform|cursor|filter|font-weight|--.*)$/;
function kind(v) {
  const s = v.replace(/\s*!important/, "").trim();
  if (/var\(--slds-g-/.test(s)) return "g";
  if (/var\(--slds-s-/.test(s)) return "s";
  if (/var\(--(slds-c|sds-c)-/.test(s)) return "c";
  if (/var\(--_slds/.test(s)) return "private";
  if (/var\(--/.test(s)) return "otherVar";
  if (/^(inherit|initial|unset|revert|none|0|auto|transparent|currentcolor|normal|0 none|none !important)$/i.test(s)) return "keyword";
  return "literal";
}
function resolve(file, seen, skipCommon) {
  if (seen.has(file) || !fs.existsSync(file)) return ""; seen.add(file);
  return fs.readFileSync(file, "utf8").replace(/@import\s+['"]([^'"]+)['"];?/g, (m, p) => {
    if (skipCommon && p === "lightning/sldsCommon") return "";
    let f; if (p.startsWith("lightning/")) { const n = p.slice(10); f = path.join(L, n, n + ".css"); } else f = path.resolve(path.dirname(file), p);
    return resolve(f, seen, skipCommon);
  });
}
const rows = [];
function scan(css, src, comp) {
  let root; try { root = postcss.parse(css); } catch (e) { return; }
  root.walkDecls((d) => {
    if (!d.parent || !d.parent.selector) return;
    let p = d.parent, kf = false; while (p) { if (p.type === "atrule" && /keyframes/.test(p.name)) kf = true; p = p.parent; } if (kf) return;
    const chain = []; let q = d.parent; while (q && q.type !== "root") { if (q.type === "rule") chain.push(q.selector); q = q.parent; }
    const full = chain.reverse().join(" >> ");
    const states = new Set();
    for (const [n, re] of STATE) if (re.test(full)) states.add(n);
    if (d.prop === "cursor") states.add("cursor");
    if (!states.size) return;
    if (!VIS.test(d.prop)) return;
    const hooks = [...d.value.matchAll(/--(slds-[gsc]|sds-c|_slds-[a-z])-[a-z0-9-]*/g)].map((m) => m[0]);
    rows.push({ src, comp, states: [...states], prop: d.prop, value: d.value.replace(/\s+/g, " "), kind: kind(d.value), hooks, sel: full.replace(/\s+/g, " ").slice(0, 240), native: /data-render-mode/.test(d.parent.selector) });
  });
}
for (const c of fs.readdirSync(S)) {
  const dir = path.join(S, c); if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".css") && !f.includes("deprecated")) scan(fs.readFileSync(path.join(dir, f), "utf8"), "slds2", c);
}
const lbcVisual = [];
for (const c of fs.readdirSync(L)) {
  const dir = path.join(L, c); if (!fs.statSync(dir).isDirectory()) continue;
  const files = fs.readdirSync(dir);
  const visual = files.some((f) => f.endsWith(".html")) || fs.existsSync(path.join(dir, "templates"));
  if (!visual) continue; lbcVisual.push(c);
  const main = path.join(dir, c + ".css");
  const css = fs.existsSync(main) ? resolve(main, new Set(), true) : files.filter((f) => f.endsWith(".css")).map((f) => resolve(path.join(dir, f), new Set(), true)).join("\n");
  scan(css, "lbc", c);
}
scan(fs.readFileSync(path.join(L, "sldsCommon/sldsCommon.css"), "utf8"), "lbcCommon", "sldsCommon");
fs.writeFileSync(path.join(OUT, "state.json"), JSON.stringify({ rows, lbcVisual, slds2Folders: fs.readdirSync(S).filter((c) => fs.statSync(path.join(S, c)).isDirectory()) }));
console.log("rows", rows.length, "lbcVisual", lbcVisual.length);
