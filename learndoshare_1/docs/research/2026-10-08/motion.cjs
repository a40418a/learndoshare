const d=require(require("path").join(require("./paths.cjs").OUT,"decls.json"));
const isMotionProp=p=>/^(transition|animation)/.test(p)||/^(transform|translate|rotate|scale)$/.test(p)||p==="@keyframes";
const rel=d.filter(x=>(x.cat==="motion"||x.cat==="transform"));
const core=rel.filter(x=>isMotionProp(x.prop));
const out={};
for(const src of ["slds2","lbc"]){
  const all=new Set(d.filter(x=>x.src===src).map(x=>x.comp));
  const rs=core.filter(x=>x.src===src);
  const kinds={};rs.forEach(x=>kinds[x.kind]=(kinds[x.kind]||0)+1);
  const props={};rs.forEach(x=>{const k=x.prop+":"+x.kind;props[k]=(props[k]||0)+1});
  const by={};rs.forEach(x=>{(by[x.comp]=by[x.comp]||[]).push(x)});
  let full=[],part=[],none=[],kwOnly=[];
  for(const [c,xs] of Object.entries(by)){
    const nk=xs.filter(x=>x.kind!=="keyword");
    const hk=nk.filter(x=>x.kind==="g"||x.kind==="s");
    if(!nk.length) kwOnly.push(c); else if(hk.length===nk.length) full.push(c); else if(hk.length) part.push(c); else none.push(c);
  }
  console.log("==",src,"components total",all.size,"with motion decls",Object.keys(by).length,"decls",rs.length);
  console.log("kinds",kinds);
  console.log("props",props);
  console.log("full",full.length,full.join(","));
  console.log("partial",part.length,part.join(","));
  console.log("none",none.length,none.join(","));
  console.log("keywordOnly",kwOnly.length,kwOnly.join(","));
}
