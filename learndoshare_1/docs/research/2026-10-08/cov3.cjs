const fs=require("fs"),path=require("path");const {postcss,OUT,LBC:L}=require("./paths.cjs");
const SP=/^(padding|margin|gap|row-gap|column-gap)(-.*)?$|^inset/, SZ=/^(width|height|min-width|min-height|max-width|max-height|block-size|inline-size|min-block-size|min-inline-size|max-block-size|max-inline-size)$/;
const KW=/^(inherit|initial|unset|none|0|auto|transparent|currentcolor|100%|50%|0%|normal|-1|1|fit-content|max-content|min-content)$/i;
function kind(v){const s=v.replace(/\s*!important/,"").trim(); if(/var\(--(slds-[gsc]|sds-c)-/.test(s)) return "hook"; if(/var\(--/.test(s)) return "otherVar"; if(KW.test(s)) return "keyword"; return "literal";}
function relevant(v){const s=v.replace(/\s*!important/,"").trim(); if(/^-?\d*\.?\d+%$/.test(s)) return false; if(/^-?[12]px$/.test(s)) return false; if(/^-?0\.0625rem$/.test(s)) return false; if(/v[wh]\b/.test(s)&&!/rem|px/.test(s)) return false; if(/^env\(/.test(s)) return false; return /\d/.test(s);}
function resolve(file,seen){ if(seen.has(file)||!fs.existsSync(file)) return ""; seen.add(file); let css=fs.readFileSync(file,"utf8"); return css.replace(/@import\s+['"]([^'"]+)['"];?/g,(m,p)=>{ let f; if(p.startsWith("lightning/")){const n=p.slice(10); f=path.join(L,n,n+".css");} else f=path.resolve(path.dirname(file),p); return resolve(f,seen);}); }
const res={};
for(const c of fs.readdirSync(L)){ const dir=path.join(L,c); if(!fs.statSync(dir).isDirectory())continue; const files=fs.readdirSync(dir);
  const htmls=files.filter(f=>f.endsWith(".html")).concat(fs.existsSync(path.join(dir,"templates"))?["templates/"]:[]);
  const main=path.join(dir,c+".css"); let css=""; if(fs.existsSync(main)) css=resolve(main,new Set()); else for(const f of files) if(f.endsWith(".css")) css+=resolve(path.join(dir,f),new Set());
  const rows=[]; try{ postcss.parse(css).walkDecls(d=>{ if(d.prop.startsWith("--"))return; if(!(SP.test(d.prop)||SZ.test(d.prop)))return; let p=d.parent,kf=false; while(p){if(p.type==="atrule"&&/keyframes/.test(p.name))kf=true;p=p.parent} if(kf)return; rows.push({prop:d.prop,value:d.value,sel:(d.parent.selector||"").replace(/\s+/g," "),kind:kind(d.value)}); }); }catch(e){}
  const h=rows.filter(r=>r.kind==="hook").length, rel=rows.filter(r=>r.kind==="literal"&&relevant(r.value)).length;
  const b=!htmls.length?"nonVisual":(!rows.length?"noOwnCss":(h===0&&rel===0?"minor":(rel===0?"full":(h>0?"partial":"none"))));
  res[c]={b,h,rel,html:htmls.length};
}
const B={}; for(const [c,v] of Object.entries(res)) (B[v.b]=B[v.b]||[]).push(c+(v.b==="partial"||v.b==="none"?`(${v.h}/${v.rel})`:""));
for(const [k,v] of Object.entries(B)) console.log(k,v.length,":",v.join(", "));
fs.writeFileSync(path.join(OUT,"cov3.json"),JSON.stringify(res));
