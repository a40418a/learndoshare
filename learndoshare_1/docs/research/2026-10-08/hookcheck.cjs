// 사용: node hookcheck.cjs <hook 이름...> → SLDS 2 번들(S)이나 LBC 소스(L) 중 한쪽에라도 없는 이름만 출력한다
const fs=require("fs"),path=require("path");
const {SLDS2_BUNDLE,LBC}=require("./paths.cjs");
const S=fs.readFileSync(SLDS2_BUNDLE,"utf8");
let L="";(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())w(p);else if(/\.(css|js|html)$/.test(e.name))L+=fs.readFileSync(p,"utf8")+"\n";}})(LBC);
const names=process.argv.slice(2);
for(const n of names){const re=new RegExp(n.replace(/[-]/g,"\\-")+"(?![\\w-])");const s=re.test(S),l=re.test(L);if(!s||!l)console.log((s?"S":"-")+(l?"L":"-"),n);}
console.log("checked",names.length);
