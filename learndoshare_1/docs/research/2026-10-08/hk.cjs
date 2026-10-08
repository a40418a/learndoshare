// 사용: node hk.cjs <hook...>  → SLDS2 번들 정의/읽기 수, SLDS2 폴더 수, LBC 파일/컴포넌트 수
const fs=require("fs"),path=require("path");
const {SLDS2_BUNDLE,SLDS2_COMPONENTS:S,LBC:L}=require("./paths.cjs");
const B=fs.readFileSync(SLDS2_BUNDLE,"utf8");
const sf={}; for(const c of fs.readdirSync(S)){const d=path.join(S,c); if(!fs.statSync(d).isDirectory())continue; sf[c]=fs.readdirSync(d).filter(f=>f.endsWith(".css")&&!f.includes("deprecated")).map(f=>fs.readFileSync(path.join(d,f),"utf8")).join("\n");}
const lf={}; for(const c of fs.readdirSync(L)){const d=path.join(L,c); if(!fs.statSync(d).isDirectory())continue; lf[c]=fs.readdirSync(d).filter(f=>f.endsWith(".css")).map(f=>fs.readFileSync(path.join(d,f),"utf8")).join("\n");}
const esc=s=>s.replace(/[-]/g,"\\-");
for(const h of process.argv.slice(2)){ const def=new RegExp(esc(h)+"\\s*:","g"), rd=new RegExp("var\\(\\s*"+esc(h)+"\\s*[,)]","g");
 const n=(s,re)=>(s.match(re)||[]).length;
 const sc=Object.entries(sf).filter(([c,s])=>n(s,rd)).map(x=>x[0]); const lc=Object.entries(lf).filter(([c,s])=>n(s,rd)).map(x=>x[0]);
 console.log(h.padEnd(46),"def(slds2)="+n(B,def),"def(lbc)="+Object.values(lf).reduce((a,s)=>a+n(s,def),0),"read(slds2 bundle)="+n(B,rd),"slds2Folders="+sc.length,"lbcRead="+Object.values(lf).reduce((a,s)=>a+n(s,rd),0),"lbcComps="+lc.length, process.env.V? "\n   S:"+sc.join(",")+"\n   L:"+lc.join(","):""); }
