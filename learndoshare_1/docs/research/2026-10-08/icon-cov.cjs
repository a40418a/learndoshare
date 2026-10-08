const path=require("path");const {OUT}=require("./paths.cjs");
const d=require(path.join(OUT,"decls.json"));
const SEL=/icon|avatar|svg|\[part~?=.?icon|figure/i;
const PROPS=/^(width|height|min-width|min-height|max-width|max-height|block-size|inline-size|fill|stroke|color|background-color|background|border-radius)$/;
const rows=d.filter(x=>SEL.test(x.selector)&&PROPS.test(x.prop)&&x.kind!=="keyframes");
const by={};
for(const r of rows){const k=r.src+":"+r.comp;(by[k]=by[k]||{n:0,hook:0,kw:0,lit:0,other:0,lits:[]});const b=by[k];b.n++;
 if(r.kind==="g"||r.kind==="s"||r.kind==="c")b.hook++;else if(r.kind==="keyword")b.kw++;else if(r.kind==="literal"){b.lit++;b.lits.push(r.prop+":"+r.value+" @"+r.selector)}else b.other++;}
const res={full:[],partial:[],none:[]};
for(const [k,b] of Object.entries(by)){ if(b.lit===0) res.full.push(k); else if(b.hook+b.other>0) res.partial.push(k); else res.none.push(k);}
console.log("icon-related decls",rows.length,"comps",Object.keys(by).length);
for(const s of ["slds2","lbc"]){const f=x=>x.filter(k=>k.startsWith(s+":")).length;console.log(s,"full",f(res.full),"partial",f(res.partial),"none",f(res.none));}
const kinds={};rows.forEach(r=>{const k=r.src+"|"+r.kind;kinds[k]=(kinds[k]||0)+1});console.log(kinds);
console.log("NONE:",res.none.join(" "));
console.log("PARTIAL:",res.partial.join(" "));
require("fs").writeFileSync(path.join(OUT,"icon-cov.json"),JSON.stringify(by,null,1));
