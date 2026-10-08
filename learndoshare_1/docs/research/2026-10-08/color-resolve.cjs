// 색 선언을 custom property 정의까지 따라가 끝에 닿는 값(global hook / s hook / 하드코딩)으로 분류한다 (읽기만 함)
const fs = require("fs"), path = require("path");
const { postcss, OUT, LBC, SLDS2_BUNDLE } = require("./paths.cjs");

const COLOR_PROP = /(^|-)color$|^background(-color|-image)?$|^fill$|^stroke$|^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?$|^caret-color$|^accent-color$/;
const NAMED = /\b(white|black|gray|grey|silver|red|blue|green|yellow|orange|purple|pink|navy|teal|maroon|olive|lime|aqua|fuchsia|whitesmoke|gainsboro|lightgray|darkgray|dimgray)\b/i;
const LIT = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(|\blab\(/i;

function splitVar(str) {
  // 최상위 var(...) 호출을 찾아 [name, fallback]과 나머지 문자열을 돌려준다
  const vars = []; let rest = ""; let i = 0;
  while (i < str.length) {
    const j = str.indexOf("var(", i);
    if (j < 0) { rest += str.slice(i); break; }
    rest += str.slice(i, j) + " ";
    let depth = 0, k = j + 3;
    for (; k < str.length; k++) { if (str[k] === "(") depth++; else if (str[k] === ")") { depth--; if (depth === 0) break; } }
    const inner = str.slice(j + 4, k);
    let d = 0, comma = -1;
    for (let m = 0; m < inner.length; m++) { const ch = inner[m]; if (ch === "(") d++; else if (ch === ")") d--; else if (ch === "," && d === 0) { comma = m; break; } }
    vars.push(comma < 0 ? [inner.trim(), null] : [inner.slice(0, comma).trim(), inner.slice(comma + 1).trim()]);
    i = k + 1;
  }
  return { vars, rest };
}

function makeAnalyzer(defs, hookDefs) {
  // defs: name -> [values] (컴포넌트 안 정의), hookDefs: :where(html)의 g/s hook 정의
  function analyze(value, seen = new Set(), depth = 0) {
    const out = { g: new Set(), s: new Set(), lit: new Set(), kw: new Set(), url: new Set(), undef: new Set() };
    const merge = (o) => { for (const k in out) for (const v of o[k]) out[k].add(v); };
    if (depth > 12) return out;
    const { vars, rest } = splitVar(value);
    for (const [name, fb] of vars) {
      if (name.startsWith("--slds-g-") || name.startsWith("--slds-r-")) { out.g.add(name); if (name.startsWith("--slds-g-") && !hookDefs[name]) { out.undef.add(name); if (fb != null) { const sub = analyze(fb, seen, depth + 1); for (const k of ["g","lit","url","undef"]) for (const v of sub[k]) out[k].add(v); } } continue; }
      if (name.startsWith("--slds-s-") && hookDefs[name]) {
        out.s.add(name);
        const sub = analyze(hookDefs[name], seen, depth + 1); for (const v of sub.g) out.g.add(v); for (const v of sub.lit) out.lit.add(v);
        continue;
      }
      if (defs[name] && !seen.has(name)) {
        const s2 = new Set(seen); s2.add(name);
        for (const v of defs[name]) merge(analyze(v, s2, depth + 1));
        continue;
      }
      if (fb != null) merge(analyze(fb, seen, depth + 1));
      else out.kw.add("unset:" + name);
    }
    let r = rest.replace(/url\([^)]*\)/g, (u) => { if (/%23[0-9a-f]{3,6}|#[0-9a-f]{3,6}|fill=/i.test(u)) out.url.add(u.slice(0, 60)); return " "; });
    r = r.replace(/linear-gradient|radial-gradient|color-mix|light-dark|in srgb|in oklab|to (top|bottom|left|right)/g, " ");
    const lits = r.match(/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch)\([^)]*\)/gi) || [];
    for (const l of lits) out.lit.add(l.toLowerCase().replace(/\s+/g, ""));
    const nm = r.match(NAMED); if (nm) out.lit.add(nm[0].toLowerCase());
    for (const w of r.match(/\b(transparent|currentcolor|inherit|none|unset|initial)\b/gi) || []) out.kw.add(w.toLowerCase());
    return out;
  }
  return analyze;
}

const rows = [];
function collect(root, src, compOf, defsOf, hookDefs, file) {
  root.walkDecls((d) => {
    if (d.prop.startsWith("--")) return;
    if (!COLOR_PROP.test(d.prop) || /radius$|-width$|^outline|^border-(style|collapse|spacing|image)/.test(d.prop)) return;
    let p = d.parent, inKf = false; while (p) { if (p.type === "atrule" && /keyframes/.test(p.name)) inKf = true; p = p.parent; }
    if (inKf) return; const sel = d.parent && d.parent.selector ? d.parent.selector : "";
    const comp = compOf(sel);
    const analyze = makeAnalyzer(defsOf(comp), hookDefs);
    const a = analyze(d.value);
    // box-shadow/outline은 색이 없을 수 있다: 색 관련 토큰이 하나도 없으면 건너뛴다
    if (/^(box-shadow|text-shadow|outline)$/.test(d.prop) && !a.g.size && !a.lit.size && !a.s.size) return;
    rows.push({ src, comp, prop: d.prop, value: d.value.replace(/\s+/g, " ").slice(0, 200), selector: sel.replace(/\s+/g, " ").slice(0, 120), file, inKf,
      g: [...a.g], s: [...a.s], lit: [...a.lit], kw: [...a.kw], url: [...a.url], undef: [...a.undef] });
  });
}

// SLDS 2
const sldsCss = fs.readFileSync(SLDS2_BUNDLE, "utf8");
const sroot = postcss.parse(sldsCss);
const hookDefs = {}; const sDefs = {};
sroot.walkDecls(/^--/, (d) => {
  const sel = d.parent.selector || "";
  if (/^:where\(html\)$/.test(sel.trim()) && /^--slds-[gs]-/.test(d.prop)) { hookDefs[d.prop] = d.value; return; }
  (sDefs[d.prop] = sDefs[d.prop] || []).push(d.value);
});
const sldsComp = (sel) => { const m = /\.slds-([a-z0-9]+(?:-[a-z0-9]+)*)/.exec(sel || ""); return m ? m[1].split(/__|_/)[0] : "(global)"; };
collect(sroot, "slds2", sldsComp, () => sDefs, hookDefs, "slds2.cosmos.css");

// LBC: 컴포넌트 폴더 안 정의 + sldsCommon
const lbcRoots = {};
for (const comp of fs.readdirSync(LBC)) {
  const dir = path.join(LBC, comp); if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".css")) {
    try { (lbcRoots[comp] = lbcRoots[comp] || []).push([f, postcss.parse(fs.readFileSync(path.join(dir, f), "utf8"))]); } catch (e) {}
  }
}
const lbcDefs = {};
for (const comp in lbcRoots) { const m = {}; for (const [, r] of lbcRoots[comp]) r.walkDecls(/^--/, (d) => (m[d.prop] = m[d.prop] || []).push(d.value)); lbcDefs[comp] = m; }
const common = lbcDefs["sldsCommon"] || {};
for (const comp in lbcRoots) for (const [f, r] of lbcRoots[comp]) collect(r, "lbc", () => comp, (c) => ({ ...common, ...lbcDefs[c] }), hookDefs, comp + "/" + f);

fs.writeFileSync(path.join(OUT, "color-rows.json"), JSON.stringify(rows));
fs.writeFileSync(path.join(OUT, "hookdefs.json"), JSON.stringify(hookDefs));
console.log("rows", rows.length, "slds2", rows.filter((r) => r.src === "slds2").length, "lbc", rows.filter((r) => r.src === "lbc").length);
