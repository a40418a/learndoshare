// SLDS 2 CSS와 lightning-base-components CSS의 모든 선언을 "항목 × 값 종류"로 분류한다 (읽기만 함)
const fs = require("fs"), path = require("path");
const { postcss, OUT, LBC, SLDS2_BUNDLE } = require("./paths.cjs");

const CAT = [
  ["motion", /^(transition|animation)/],
  ["transform", /^(transform|translate|rotate|scale)$/],
  ["shadow", /^(box-shadow|text-shadow)$/],
  ["radius", /radius$/],
  ["borderWidth", /^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?-width$|^outline-width$|^outline-offset$/],
  ["focusOutline", /^outline(-style|-color)?$/],
  ["color", /(^|-)color$|^background(-color|-image)?$|^fill$|^stroke$|^border(-(top|right|bottom|left|block|inline)(-(start|end))?)?$|^caret-color$|^accent-color$/],
  ["typography", /^(font|font-size|font-weight|font-family|line-height|letter-spacing|text-transform|text-decoration.*)$/],
  ["spacing", /^(padding|margin|gap|row-gap|column-gap)(-.*)?$|^inset/],
  ["sizing", /^(width|height|min-width|min-height|max-width|max-height|block-size|inline-size|min-block-size|min-inline-size|max-block-size|max-inline-size)$/],
  ["opacity", /^opacity$/],
  ["zIndex", /^z-index$/],
];
const KEYWORD = /^(inherit|initial|unset|none|0|auto|transparent|currentcolor|100%|50%|0%|normal|-1|1|bold|inherit !important|none !important|0 !important|transparent !important)$/i;
function kind(v) {
  const s = v.trim();
  if (/var\(--slds-g-/.test(s)) return "g";
  if (/var\(--slds-s-/.test(s)) return "s";
  if (/var\(--(slds-c|sds-c)-/.test(s)) return "c";
  if (/var\(--slds-r-/.test(s)) return "r";
  if (/var\(--/.test(s)) return "otherVar";
  if (KEYWORD.test(s)) return "keyword";
  return "literal";
}
function catOf(prop) { for (const [c, re] of CAT) if (re.test(prop)) return c; return null; }

const rows = []; // {src, comp, cat, kind, prop, value, selector}
function scan(css, src, compOf) {
  let root; try { root = postcss.parse(css); } catch (e) { return; }
  root.walkDecls((d) => {
    if (d.prop.startsWith("--")) return; // hook 정의 자체는 제외
    const cat = catOf(d.prop); if (!cat) return;
    const rule = d.parent && d.parent.selector ? d.parent.selector : (d.parent && d.parent.type === "atrule" ? "@" + d.parent.name : "");
    const inKeyframes = (() => { let p = d.parent; while (p) { if (p.type === "atrule" && /keyframes/.test(p.name)) return true; p = p.parent; } return false; })();
    rows.push({ src, comp: compOf(rule), cat: inKeyframes ? "motion" : cat, kind: kind(d.value), prop: d.prop, value: d.value.slice(0, 80), selector: (rule || "").slice(0, 80) });
  });
  root.walkAtRules(/keyframes/, (a) => rows.push({ src, comp: compOf(a.params), cat: "motion", kind: "keyframes", prop: "@keyframes", value: a.params, selector: "@keyframes" }));
}
// 1) SLDS 2 번들: 선택자의 첫 .slds-<이름>을 컴포넌트로 본다
const sldsCss = fs.readFileSync(SLDS2_BUNDLE, "utf8");
scan(sldsCss, "slds2", (sel) => { const m = /\.slds-([a-z0-9]+(?:-[a-z0-9]+)*)/.exec(sel || ""); return m ? m[1].split(/__|_/)[0] : "(global)"; });
// 2) lightning-base-components: 폴더 이름이 컴포넌트
for (const comp of fs.readdirSync(LBC)) {
  const dir = path.join(LBC, comp);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".css")) scan(fs.readFileSync(path.join(dir, f), "utf8"), "lbc", () => comp);
}
fs.writeFileSync(path.join(OUT, "decls.json"), JSON.stringify(rows));

// 요약: 항목별 값 종류 비율, 항목별로 하드코딩이 있는 컴포넌트 수
const cats = [...new Set(rows.map((r) => r.cat))];
const lines = ["# 선언 분류 요약 (SLDS 2 번들 + lightning-base-components CSS)", "", "| 항목 | 출처 | 전체 | global hook | 컴포넌트 hook(s) | c/sds-c hook | r(팔레트) | 기타 변수 | 키워드 | **하드코딩** | 하드코딩 있는 컴포넌트 수 |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"];
for (const c of cats) for (const src of ["slds2", "lbc"]) {
  const rs = rows.filter((r) => r.cat === c && r.src === src); if (!rs.length) continue;
  const n = (k) => rs.filter((r) => r.kind === k).length;
  const hc = new Set(rs.filter((r) => r.kind === "literal" || r.kind === "keyframes").map((r) => r.comp));
  lines.push(`| ${c} | ${src} | ${rs.length} | ${n("g")} | ${n("s")} | ${n("c")} | ${n("r")} | ${n("otherVar")} | ${n("keyword")} | **${n("literal") + n("keyframes")}** | ${hc.size} |`);
}
// 움직임 상세: 하드코딩된 시간과 곡선
const motion = rows.filter((r) => r.cat === "motion" && (r.kind === "literal" || r.kind === "keyframes"));
const dur = {}; for (const r of motion) for (const m of r.value.matchAll(/(\d*\.?\d+m?s)\b/g)) dur[m[1]] = (dur[m[1]] || 0) + 1;
lines.push("", "## 움직임: 하드코딩된 시간 값 빈도", Object.entries(dur).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${k}×${v}`).join(", "));
lines.push("", "## 움직임: @keyframes 이름", [...new Set(rows.filter((r) => r.kind === "keyframes").map((r) => `${r.src}:${r.value}`))].slice(0, 40).join(", "));
fs.writeFileSync(path.join(OUT, "summary.md"), lines.join("\n"));
console.log(lines.join("\n"));
console.log("\n선언 수:", rows.length, "| SLDS 2 컴포넌트 수:", new Set(rows.filter(r=>r.src==="slds2").map(r=>r.comp)).size, "| LBC 컴포넌트 수:", new Set(rows.filter(r=>r.src==="lbc").map(r=>r.comp)).size);
