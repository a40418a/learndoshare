// 모양(반경·테두리 두께) 선언을 hook 경로까지 풀어서 분류한다 (읽기만 함)
const fs = require("fs"), path = require("path");
const { postcss, OUT, LBC, SLDS2_BUNDLE } = require("./paths.cjs");

const RADIUS = /^border(-(top|bottom)-(left|right)|-(start|end)-(start|end))?-radius$/;
const WIDTH = /^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?-width$/;
const SHORT = /^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?$/;
const OUTLINE = /^outline-(width|offset)$/;

// var(a, b) 파싱
function splitTop(s, sep) { const out = []; let d = 0, cur = ""; for (const ch of s) { if (ch === "(") d++; if (ch === ")") d--; if (d === 0 && sep.test(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ""; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
function parseVar(tok) { // tok = "var(...)" → {name, fb}
  const inner = tok.slice(4, -1); let d = 0;
  for (let i = 0; i < inner.length; i++) { const c = inner[i]; if (c === "(") d++; if (c === ")") d--; if (c === "," && d === 0) return { name: inner.slice(0, i).trim(), fb: inner.slice(i + 1).trim() }; }
  return { name: inner.trim(), fb: null };
}
function findVars(s) { const out = []; let i = 0; while ((i = s.indexOf("var(", i)) >= 0) { let d = 0, j = i + 3; for (; j < s.length; j++) { if (s[j] === "(") d++; if (s[j] === ")") { d--; if (d === 0) break; } } out.push(s.slice(i, j + 1)); i = j + 1; } return out; }

const KW = /^(0|0px|0rem|none|inherit|initial|unset|revert|50%|100%|auto|thin|medium|thick)$/i;
// 값 → 끝점 집합: G:name, S:name, LIT:x, KW:x, UNSET
function resolve(v, defs, seen = new Set(), depth = 0) {
  const out = new Set(); v = (v || "").trim();
  if (depth > 12) { out.add("DEEP"); return out; }
  const vars = findVars(v);
  let rest = v; for (const t of vars) rest = rest.replace(t, " ");
  rest = rest.replace(/calc\(|\)|[\/*+]|\b\d+(\.\d+)?\b(?![a-z%])/gi, " ").trim(); // calc 연산자와 단위 없는 수는 무시
  for (const t of rest.split(/\s+/).filter(Boolean)) out.add(KW.test(t) ? "KW:" + t : "LIT:" + t);
  for (const t of vars) {
    const { name, fb } = parseVar(t);
    if (name.startsWith("--slds-g-")) { out.add("G:" + name); continue; }
    if (name.startsWith("--slds-s-")) { out.add("S:" + name); if (!globalDefs.has(name) && fb) for (const x of resolve(fb, defs, seen, depth + 1)) out.add(x); continue; }
    if (defs.has(name) && !seen.has(name)) { const s2 = new Set(seen); s2.add(name); for (const dv of defs.get(name)) for (const x of resolve(dv, defs, s2, depth + 1)) out.add(x); out.add("C:" + name); if (fb) for (const x of resolve(fb, defs, seen, depth + 1)) out.add(x); }
    else if (fb) for (const x of resolve(fb, defs, seen, depth + 1)) out.add(x);
    else out.add("UNSET:" + name);
  }
  return out;
}
const isRadiusHook = (t) => /^(G:--slds-g-radius-border|S:--slds-s-[a-z-]*radius)/.test(t);
const isWidthHook = (t) => /^(G:--slds-g-sizing-border|S:--slds-s-[a-z-]*sizing-border)/.test(t);
function classify(prop, value, defs) {
  let v = value, kind = RADIUS.test(prop) ? "radius" : OUTLINE.test(prop) ? "outline" : "width";
  if (SHORT.test(prop)) { // 단축 속성에서 두께 토큰만
    const toks = splitTop(value, /\s/);
    if (toks.length === 1 && KW.test(toks[0])) return { kind, cls: "N", terms: ["KW:" + toks[0]] };
    const wt = toks.filter((t) => /^(\d*\.?\d+(px|rem|em)|thin|medium|thick)$/.test(t) || (/^var\(/.test(t) && /sizing|width/.test(parseVar(t).name)));
    if (!wt.length) return { kind, cls: "N", terms: ["noWidthToken"] }; // 색만 / 스타일만
    v = wt.join(" ");
  }
  const terms = [...resolve(v, defs)];
  const hookOK = kind === "radius" ? terms.some(isRadiusHook) : terms.some(isWidthHook);
  const otherHook = terms.some((t) => /^G:|^S:/.test(t)) && !hookOK;
  const lit = terms.some((t) => /^LIT:|^UNSET|^SFB>LIT/.test(t));
  const onlyKW = terms.every((t) => /^KW:|^C:/.test(t));
  let cls = hookOK ? (lit ? "HL" : "H") : otherHook ? "W" : onlyKW ? "N" : "L";
  return { kind, cls, terms };
}

const rows = [];
function collectDefs(root, defs) { root.walkDecls((d) => { if (d.prop.startsWith("--")) { if (!defs.has(d.prop)) defs.set(d.prop, []); defs.get(d.prop).push(d.value); } }); }
function scan(root, src, compOf, defs, file) {
  root.walkDecls((d) => {
    const p = d.prop; if (!(RADIUS.test(p) || WIDTH.test(p) || SHORT.test(p) || OUTLINE.test(p))) return;
    let par = d.parent, kf = false; while (par) { if (par.type === "atrule" && /keyframes/.test(par.name)) kf = true; par = par.parent; }
    if (kf) return;
    const sel = d.parent && d.parent.selector ? d.parent.selector : "";
    const r = classify(p, d.value, defs);
    rows.push({ src, comp: compOf(sel), file, native: /data-render-mode/.test(sel), prop: p, value: d.value.replace(/\s+/g, " ").slice(0, 160), selector: sel.replace(/\s+/g, " ").slice(0, 120), ...r });
  });
}
const sldsCss = fs.readFileSync(SLDS2_BUNDLE, "utf8");
const sroot = postcss.parse(sldsCss);
const globalDefs = new Map(); collectDefs(sroot, globalDefs);
scan(sroot, "slds2", (sel) => { const m = /\.slds-([a-z0-9]+(?:-[a-z0-9]+)*)/.exec(sel || ""); return m ? m[1].split(/__|_/)[0] : "(global)"; }, globalDefs, "slds2.cosmos.css");
for (const comp of fs.readdirSync(LBC)) {
  const dir = path.join(LBC, comp); if (!fs.statSync(dir).isDirectory()) continue;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".css")); if (!files.length) continue;
  const roots = files.map((f) => [f, postcss.parse(fs.readFileSync(path.join(dir, f), "utf8"))]);
  const defs = new Map(); for (const [, r] of roots) collectDefs(r, defs);
  for (const [f, r] of roots) scan(r, "lbc", () => comp, defs, f);
}
fs.writeFileSync(path.join(OUT, "shape.json"), JSON.stringify(rows));
console.log("rows", rows.length);
