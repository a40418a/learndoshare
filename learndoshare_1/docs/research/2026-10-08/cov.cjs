const r = require("./post.cjs");
const path = require("path");
const { OUT, LBC_PKG } = require("./paths.cjs");
const nat = new Set(require(path.join(LBC_PKG, "package.json")).lwc.nativeShadowEnabledComponents);
const kebab = (s) => "lightning-" + s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
function cov(rows, label, kinds) {
  const by = new Map();
  for (const x of rows) { if (!kinds.includes(x.kind)) continue; if (!by.has(x.comp)) by.set(x.comp, []); by.get(x.comp).push(x.c2); }
  let full = [], part = [], none = [], neutral = [];
  for (const [c, cs] of by) { const rel = cs.filter((k) => k !== "N"); if (!rel.length) { neutral.push(c); continue; } const g = rel.filter((k) => k === "G").length; if (g === rel.length) full.push(c); else if (rel.some((k) => k === "G" || k === "GL")) part.push(c + "(" + rel.filter((k) => k !== "G").join("") + ")"); else none.push(c + "(" + rel.join("") + ")"); }
  console.log(`\n## ${label} [${kinds}] comps with decls=${by.size} full=${full.length} partial=${part.length} none=${none.length} neutralOnly=${neutral.length}`);
  console.log("partial:", part.join(" ")); console.log("none:", none.join(" "));
}
const s2 = r.filter((x) => x.src === "slds2");
const ln = r.filter((x) => x.src === "lbc" && x.native && nat.has(kebab(x.comp)));
const lnAll = r.filter((x) => x.src === "lbc" && x.native);
for (const k of [["radius"], ["width"], ["radius", "width"]]) { cov(s2, "SLDS2 synthetic", k); cov(ln, "LBC native(156 list)", k); }
const lbcFolders = new Set(r.filter((x) => x.src === "lbc").map((x) => x.comp));
console.log("\nLBC folders w/ shape decls", lbcFolders.size, "in native list", [...lbcFolders].filter((c) => nat.has(kebab(c))).length, "native-gated folders not in list:", [...new Set(lnAll.map((x) => x.comp))].filter((c) => !nat.has(kebab(c))).join(","));
console.log("SLDS2 comps total (any decl in decls.json):", new Set(require(path.join(OUT, "decls.json")).filter((x) => x.src === "slds2").map((x) => x.comp)).size, "LBC folders w/ css: 139");
