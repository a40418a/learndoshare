const fs=require("fs"),path=require("path");const {postcss,LBC,SLDS2_COMPONENTS}=require("./paths.cjs");
const SP=/^(padding|margin|gap|row-gap|column-gap)(-.*)?$|^inset/, SZ=/^(width|height|min-width|min-height|max-width|max-height|block-size|inline-size|min-block-size|min-inline-size|max-block-size|max-inline-size)$/, LH=/^line-height$/;
const H={};
function add(src,comp,prop,value){ for(const m of value.matchAll(/--slds-[gs]-[a-z0-9-]+/g)){ const k=m[0]; const h=H[k]=H[k]||{slds2:0,lbc:0,cs:new Set(),cl:new Set(),props:{}}; h[src]++; (src==="slds2"?h.cs:h.cl).add(comp); h.props[prop]=(h.props[prop]||0)+1; } }
function scan(css,src,compOf){ const r=postcss.parse(css); r.walkDecls(d=>{ const sel=d.parent.selector||""; // include custom-prop defs of c-hooks that feed spacing (e.g. --slds-c-card-body-spacing-inline-start)
  if(d.prop.startsWith("--")){ if(/^--(slds-c|sds-c|_slds-c)-.*(spacing|sizing)/.test(d.prop)) add(src,compOf(sel),d.prop.replace(/^--.*-(spacing|sizing).*$/,"via-c-hook"),d.value); return; }
  if(SP.test(d.prop)||SZ.test(d.prop)||LH.test(d.prop)) add(src,compOf(sel),d.prop.replace(/-(block|inline|top|right|bottom|left)(-(start|end))?$/,""),d.value); }); }
const S=SLDS2_COMPONENTS;
for(const c of fs.readdirSync(S)){ const dir=path.join(S,c); if(!fs.statSync(dir).isDirectory())continue; for(const f of fs.readdirSync(dir)) if(f.endsWith(".css")&&!f.includes("deprecated")) scan(fs.readFileSync(path.join(dir,f),"utf8"),"slds2",()=>c); }
const L=LBC;
for(const c of fs.readdirSync(L)){ const dir=path.join(L,c); if(!fs.statSync(dir).isDirectory())continue; for(const f of fs.readdirSync(dir)) if(f.endsWith(".css")) scan(fs.readFileSync(path.join(dir,f),"utf8"),"lbc",()=>c); }
const rows=Object.entries(H).filter(([k])=>/(spacing|sizing|lineheight)/.test(k)).sort((a,b)=>(b[1].slds2+b[1].lbc)-(a[1].slds2+a[1].lbc));
for(const [k,v] of rows) console.log(k.padEnd(48),"slds2 decl="+v.slds2,"comps="+v.cs.size," | lbc decl="+v.lbc,"comps="+v.cl.size," |",Object.entries(v.props).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0]+":"+x[1]).join(","));
