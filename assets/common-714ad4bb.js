import{u as T}from"./characters-3743ee29.js";import{aB as D,z as S}from"./index-6cb60019.js";const L=D("searchSettings",{state:()=>({minEHP:6e4,minHP:5e4,minHPBuddy:0,minEvasion:0,maxResult:10,sortOptions:[{prop:"実質HP",order:"降順"}],allowSameCharacter:!0}),actions:{updateSearchSettings(t){Object.assign(this,t)}}}),C=D("searchResult",{state:()=>({totalResults:0,nowResults:0,results:[],isSearching:!1,errorMessage:""})}),O=L(),{minEHP:A,minHP:j,minHPBuddy:E,minEvasion:M,maxResult:y,sortOptions:U,allowSameCharacter:x}=S(O),_=T(),{characters:q}=S(_),F=C(),{totalResults:b,nowResults:g,results:d,isSearching:k,errorMessage:K}=S(F);function I(t){(t.key==="e"||t.key==="+")&&t.preventDefault()}const B=["実質HP","実HP","HPバディ数","HPバディが存在しないキャラ数","バディ数","回避数"],N=["ehp","hp","hpBuudy","noHpBuddy","buddy","evasion"];function w(t){return t=="HPUP(小)"||t=="HP&ATKUP(小)"?.2:t=="HPUP(中)"||t=="HP&ATKUP(中)"?.3:0}function H(t){return t=="回復(小)"||t=="回復&継続回復(小)"?1.1:t=="回復(中)"||t=="回復&継続回復(中)"?1.7:0}function R(t){return t=="継続回復(小)"||t=="回復&継続回復(小)"?.15*3:t=="継続回復(中)"||t=="回復&継続回復(中)"?.25*3:0}function z(t){const a=new Set;for(const e of t)a.add(e.chara);let s=0,i=0,h=0,n=0,o=0,u=0;const l=[];for(const e of t){l.push(e.imgUrl);let c=110;e.rare=="SR"?c=90:e.rare=="R"&&(c=70);const f=e.level/c,r=(e.hp-e.base_hp)*f+e.base_hp,v=(e.atk-e.base_atk)*f+e.base_atk;s+=r;let p=!1;if(a.has(e.buddy1c)){o+=1;const m=w(e.buddy1s);m!=0&&(n+=1,p=!0,s+=r*m)}if(a.has(e.buddy2c)){o+=1;const m=w(e.buddy2s);m!=0&&(n+=1,p=!0,s+=r*m)}if(a.has(e.buddy3c)){o+=1;const m=w(e.buddy3s);m!=0&&(n+=1,p=!0,s+=r*m)}i+=H(e.magic1heal)*v,i+=H(e.magic2heal)*v,i+=H(e.magic3heal)*v,i+=R(e.magic1heal)*r,i+=R(e.magic2heal)*r,i+=R(e.magic3heal)*r,h+=e.evasion,p||(u+=1)}if(!(s<j.value)&&!(s+i<A.value)&&!(n<E.value)&&!(h<M.value))return l.sort(),[s,s+i,h,n,o,u,...l]}function P(t){return function(a,s){for(let i=0;i<t.length;i++){const{key:h,order:n}=t[i];if(!Object.prototype.hasOwnProperty.call(a,h)||!Object.prototype.hasOwnProperty.call(s,h))continue;let o=0;if(a[h]<s[h]?o=-1:a[h]>s[h]&&(o=1),o!==0)return n==="降順"?o*-1:o}return 0}}async function J(){const t=q.value.filter(n=>n.level>0),a=t.length;if(a<5){K.value="レベル設定されたキャラが少なすぎます";return}g.value=0;const s=[];for(const n of U.value)for(let o=0;o<B.length;o++)B[o]==n.prop&&s.push({key:N[o],order:n.order});d.value=[];const i=async(n,o,u,l,e)=>new Promise(c=>{const f=[t[n],t[o],t[u],t[l],t[e]],r=z(f);if(r){const v={hp:Math.round(r[0]),ehp:Math.round(r[1]),evasion:r[2],hpBuudy:r[3],buddy:r[4],noHpBuddy:r[5],chara1:r[6],chara2:r[7],chara3:r[8],chara4:r[9],chara5:r[10]};d.value.push(v)}g.value+=1,c()});if(x.value){const n=a*(a-1)*(a-2)*(a-3);b.value=n*(a-4)/120+n*4/24;let o=Date.now();for(let u=0;u<a;u++)for(let l=u+1;l<a;l++)for(let e=l+1;e<a;e++)for(let c=e+1;c<a;c++){for(let f=c+1;f<a;f++){if(!k.value)return;if(await i(u,l,e,c,f),Date.now()-o>500){o=Date.now(),d.value.sort(P(s));const r=d.value.slice(0,y.value);d.value=[...r],await new Promise(requestAnimationFrame)}}for(const f of[u,l,e,c])if(await i(u,l,e,c,f),Date.now()-o>500){o=Date.now(),d.value.sort(P(s));const r=d.value.slice(0,y.value);d.value=[...r],await new Promise(requestAnimationFrame)}}}else{const n=a*(a-1)*(a-2)*(a-3);b.value=n*(a-4)/120;let o=Date.now();for(let u=0;u<a;u++)for(let l=u+1;l<a;l++)for(let e=l+1;e<a;e++)for(let c=e+1;c<a;c++)for(let f=c+1;f<a;f++){if(!k.value)return;if(await i(u,l,e,c,f),Date.now()-o>1e3){o=Date.now(),d.value.sort(P(s));const r=d.value.slice(0,y.value);d.value=[...r],await new Promise(requestAnimationFrame)}}}d.value.sort(P(s));const h=d.value.slice(0,y.value);d.value=[...h]}export{B as a,C as b,I as c,J as d,L as u};
