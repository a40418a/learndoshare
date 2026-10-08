const fs=require("fs"),path=require("path");
const {postcss,OUT,LBC:L,SLDS2_BUNDLE}=require("./paths.cjs");
const RE=/^--_?(slds-c|sds-c)-(icon|avatar|buttonicon)/;
const out={};
function scan(css,src,comp){let root;try{root=postcss.parse(css)}catch(e){return}
 root.walkDecls(RE,d=>{const sel=(d.parent.selector||"").replace(/\s+/g," ");
  const fam=/\.slds-icon-(standard|custom|action)-/.test(sel)?"objectColor":"other";
  const lit=!/var\(/.test(d.value)&&!/^(currentcolor|transparent|none|0|inherit)$/i.test(d.value.trim());
  const k=src+"|"+(fam==="objectColor"?"objectColor":comp)+"|"+d.prop+"|"+(lit?"LIT":"var");
  (out[k]=out[k]||{n:0,ex:[]}).n++; if(lit&&out[k].ex.length<3)out[k].ex.push(d.value+" @"+sel.slice(0,90));});}
scan(fs.readFileSync(SLDS2_BUNDLE,"utf8"),"slds2","*");
for(const c of fs.readdirSync(L)){const dir=path.join(L,c);if(!fs.statSync(dir).isDirectory())continue;for(const f of fs.readdirSync(dir))if(f.endsWith(".css"))scan(fs.readFileSync(path.join(dir,f),"utf8"),"lbc",c);}
for(const [k,v] of Object.entries(out).sort()) if(k.endsWith("LIT")) console.log(v.n,k,JSON.stringify(v.ex));
// combine with decls coverage
const by=require(path.join(OUT,"icon-cov.json"));
const add={};for(const [k,v] of Object.entries(out)){if(!k.endsWith("LIT"))continue;const [src,comp]=k.split("|");const key=src==="slds2"?"slds2:icon":src+":"+comp;add[key]=(add[key]||0)+v.n;}
// JS hardcodes: lightning-icon inline bg (iconColors.js 966), avatar initials fallback #0176d3 + iconColors
add["lbc:icon"]=(add["lbc:icon"]||0)+1; add["lbc:avatar"]=(add["lbc:avatar"]||0)+1;
const all=new Set([...Object.keys(by),...Object.keys(add)]);const res={full:[],partial:[],none:[]};
for(const k of all){const b=by[k]||{hook:0,other:0,lit:0,kw:0};const lit=b.lit+(add[k]||0);const hook=b.hook+b.other;
 if(lit===0)res.full.push(k);else if(hook>0)res.partial.push(k);else res.none.push(k);}
for(const s of ["slds2","lbc"]){const f=x=>x.filter(k=>k.startsWith(s+":"));console.log(s,"total",[...all].filter(k=>k.startsWith(s)).length,"full",f(res.full).length,"partial",f(res.partial).length,"none",f(res.none).length);console.log("  partial:",f(res.partial).join(" "));console.log("  none:",f(res.none).join(" "));}
