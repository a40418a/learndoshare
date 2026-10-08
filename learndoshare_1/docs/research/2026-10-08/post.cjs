const r = require(require("path").join(require("./paths.cjs").OUT, "shape.json"));
const SDEF = { "--slds-s-avatar-radius-border": "--slds-g-radius-border-circle", "--slds-s-button-radius-border": "--slds-g-radius-border-pill", "--slds-s-container-footer-sizing-border": "--slds-g-sizing-border-1", "--slds-s-container-sizing-border": "0", "--slds-s-container-radius-border": "--slds-g-radius-border-4", "--slds-s-icon-radius-border": "--slds-g-radius-border-circle", "--slds-s-input-radius-border": "--slds-g-radius-border-2", "--slds-s-navigation-sizing-border-hover": "3px", "--slds-s-navigation-sizing-border-active": "3px", "--slds-s-pageheader-radius-border": "0", "--slds-s-pageheader-sizing-border": "0" };
const fam = (k) => k === "radius" ? /^(--slds-g-radius-border|--slds-s-[a-z-]*radius)/ : /^(--slds-g-sizing-border|--slds-s-[a-z-]*sizing-border)/;
for (const x of r) {
  if (x.kind === "outline") { x.c2 = x.cls === "N" ? "N" : "O"; continue; }
  const hooks = x.terms.filter((t) => /^(G|S):/.test(t)).map((t) => t.slice(2));
  const right = hooks.filter((h) => fam(x.kind).test(h));
  const g = right.filter((h) => h.startsWith("--slds-g-") || SDEF[h]);
  const s0 = right.filter((h) => h.startsWith("--slds-s-") && !SDEF[h]);
  const lit = x.terms.some((t) => /^LIT:|^UNSET|^SFB>LIT/.test(t)) && !/calc\(/.test(x.value);
  x.c2 = g.length ? (lit ? "GL" : "G") : s0.length ? "S0" : hooks.length ? "W" : x.cls === "N" ? "N" : "L";
  x.right = right;
}
module.exports = r;
if (require.main === module) {
  const t = {}; for (const x of r) { const k = (x.src === "lbc" ? (x.native ? "lbcN" : "lbcB") : "slds2") + " " + x.kind + " " + x.c2; t[k] = (t[k] || 0) + 1; } console.log(t);
  // lever 표: hook별 직접 읽는 선언 수 / 컴포넌트 수
  const L = {}; for (const x of r) for (const h of new Set(x.right || [])) { const k = h; L[k] = L[k] || { slds2: 0, s2c: new Set(), lbc: 0, lc: new Set() }; if (x.src === "slds2") { L[k].slds2++; L[k].s2c.add(x.comp); } else { L[k].lbc++; L[k].lc.add(x.comp); } }
  for (const [k, v] of Object.entries(L).sort((a, b) => (b[1].slds2 + b[1].lbc) - (a[1].slds2 + a[1].lbc))) console.log(k, "slds2", v.slds2, "decl", v.s2c.size, "comp | lbc", v.lbc, "decl", v.lc.size, "comp |", [...v.s2c].slice(0, 14).join(","), "||", [...v.lc].slice(0, 14).join(","));
}
