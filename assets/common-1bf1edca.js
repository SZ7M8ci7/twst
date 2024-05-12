import{u as se}from"./characters-396b70ee.js";import{as as Z,y as F}from"./index-7dc8544d.js";const ie=Z("searchSettings",{state:()=>({minEHP:3e4,minHP:3e4,minHPBuddy:0,minEvasion:0,minDuo:0,minReferenceDamage:0,minReferenceAdvantageDamage:0,minReferenceVsHiDamage:0,minReferenceVsMizuDamage:0,minReferenceVsKiDamage:0,maxResult:10,sortOptions:[{prop:"HP",order:"降順"}],allowSameCharacter:!0}),actions:{updateSearchSettings(a){Object.assign(this,a)}}}),ce=Z("searchResult",{state:()=>({totalResults:0,nowResults:0,results:[],isSearching:!1,errorMessage:""})}),le=ie(),{minEHP:ue,minHP:me,minHPBuddy:fe,minEvasion:ge,minDuo:de,minReferenceDamage:ve,minReferenceAdvantageDamage:pe,minReferenceVsHiDamage:De,minReferenceVsKiDamage:ke,minReferenceVsMizuDamage:He,maxResult:_,sortOptions:ye,allowSameCharacter:Pe}=F(le),he=se(),{characters:$}=F(he),Re=ce(),{totalResults:U,nowResults:N,results:D,isSearching:I,errorMessage:q}=F(Re);function Ve(a){(a.key==="e"||a.key==="+")&&a.preventDefault()}function Ae(a){return[a("commonts.HP"),a("commonts.effectiveHP"),a("commonts.HPBuddy"),a("commonts.noHPBuddy"),a("commonts.buddy"),a("commonts.evasion"),a("commonts.duo"),a("commonts.neutralDamage"),a("commonts.advantageDamage"),a("commonts.damageAgainstFire"),a("commonts.damageAgainstWater"),a("commonts.damageAgainstFlora")]}const be=["hp","ehp","hpBuudy","noHpBuddy","buddy","evasion","duo","referenceDamage","referenceAdvantageDamage","referenceVsHiDamage","referenceVsMizuDamage","referenceVsKiDamage"],V={"HPUP(小)":{hp:.2,atk:0,heal:0,conHeal:0},"HP&ATKUP(小)":{hp:.2,atk:.2,heal:0,conHeal:0},"HPUP(中)":{hp:.3,atk:0,heal:0,conHeal:0},"HP&ATKUP(中)":{hp:.3,atk:.35,heal:0,conHeal:0},"ATKUP(小)":{hp:0,atk:.2,heal:0,conHeal:0},"ATKUP(中)":{hp:0,atk:.35,heal:0,conHeal:0},"回復(小)":{hp:0,atk:0,heal:1.1,conHeal:0},"回復&継続回復(小)":{hp:0,atk:0,heal:1.1,conHeal:.15*3},"回復(中)":{hp:0,atk:0,heal:1.7,conHeal:0},"回復&継続回復(中)":{hp:0,atk:0,heal:1.7,conHeal:.25*3},"継続回復(小)":{hp:0,atk:0,heal:0,conHeal:.15*3},"継続回復(中)":{hp:0,atk:0,heal:0,conHeal:.25*3}};function C(a){var n;return((n=V[a])==null?void 0:n.hp)||0}function z(a){var n;return((n=V[a])==null?void 0:n.atk)||0}function E(a){var n;return((n=V[a])==null?void 0:n.heal)||0}function L(a){var n;return((n=V[a])==null?void 0:n.conHeal)||0}const we={"ATKUP(極小)":1.1,"ATKUP(小)":1.2,"ATKUP(中)":1.35,"ATKUP(大)":1.5,"ATKUP(極大)":2},Se={"ダメUP(極小)":.025,"ダメUP(小)":.05,"ダメUP(中)":.0875,"ダメUP(大)":.125,"ダメUP(極大)":.25,"属性ダメUP(極小)":.03,"属性ダメUP(小)":.06,"属性ダメUP(中)":.1005,"属性ダメUP(大)":.15,"属性ダメUP(極大)":.3},O={};function Be(a,n,u,c){const s=`${a},${n},${u},${c}`;if(s in O)return O[s];let v=n.includes("弱")?.75:1;v*=u==="無"?1.1:1,v+=Se[a]||0;let g=1;n.includes("連撃")?g=1.8:n.includes("デュオ")&&(g=2.4);const R=c*v*g;return O[s]=R,R}function j(a,n,u,c,s){return c=(we[a]||1)*c+c*s,Be(a,n,u=="無"?"無":"無以外",c)}function T(a,n,u){const c=[a,n,u];return c.sort((s,v)=>v-s),c[0]+c[1]}function Ke(a){const n=new Set;for(const e of a)n.add(e.chara);let u=0,c=0,s=0,v=0,g=0,R=0,k=0,y=0,H=0,i=0,A=0,t=0;const r={},m={},l={},p=[];if(a.sort((e,o)=>o.calcBaseATK-e.calcBaseATK),a.forEach((e,o)=>{r[o]=!1,m[o]=!1,l[o]=!1}),a.forEach((e,o)=>{p.push(e.imgUrl),u+=e.calcBaseHP;let f=!1,P=0;if(n.has(e.buddy1c)){g+=1;const d=C(e.buddy1s);P+=z(e.buddy1s),d!=0&&(v+=1,f=!0,u+=e.calcBaseHP*d)}if(n.has(e.buddy2c)){g+=1;const d=C(e.buddy2s);P+=z(e.buddy2s),d!=0&&(v+=1,f=!0,u+=e.calcBaseHP*d)}if(n.has(e.buddy3c)){g+=1;const d=C(e.buddy3s);P+=z(e.buddy3s),d!=0&&(v+=1,f=!0,u+=e.calcBaseHP*d)}c+=(E(e.magic1heal)+E(e.magic2heal)+E(e.magic3heal))*e.calcBaseATK,c+=(L(e.magic1heal)+L(e.magic2heal)+L(e.magic3heal))*e.calcBaseHP,s+=e.evasion,f||(R+=1);let b=e.magic2pow;if(l[o])b="デュオ",k+=1;else{if(!l[o]){for(const[d,K]of a.entries())if(K.duo==e.chara&&e.duo==K.chara&&!l[o]&&!l[d]){l[o]=!0,l[d]=!0,r[o]=!0,r[d]=!0;break}if(!r[o]){for(const[d,K]of a.entries())if(e.duo==K.chara&&!l[o]&&!r[o]&&!m[d]){l[o]=!0,r[o]=!0,m[d]=!0;break}}if(!r[o]){for(const[d,K]of a.entries())if(e.duo==K.chara&&!l[o]&&!r[o]&&!r[d]){l[o]=!0,r[o]=!0,r[d]=!0;break}}}l[o]&&(b="デュオ",k+=1)}const w=j(e.magic1buf,e.magic1pow,e.magic1atr,e.calcBaseATK,P),S=j(e.magic2buf,b,e.magic2atr,e.calcBaseATK,P),B=j(e.magic3buf,e.magic3pow,e.magic3atr,e.calcBaseATK,P);y+=T(w,S,B);const G=e.magic1atr=="無"?w:w*1.5,J=e.magic2atr=="無"?S:S*1.5,Q=e.magic3atr=="無"?B:B*1.5;H+=T(G,J,Q);const X=h(e.magic1atr,"火",w),Y=h(e.magic2atr,"火",S),x=h(e.magic3atr,"火",B);i+=T(X,Y,x);const ee=h(e.magic1atr,"水",w),ae=h(e.magic2atr,"水",S),te=h(e.magic3atr,"水",B);A+=T(ee,ae,te);const ne=h(e.magic1atr,"木",w),re=h(e.magic2atr,"木",S),oe=h(e.magic3atr,"木",B);t+=T(ne,re,oe)}),!(u<me.value)&&!(u+c<ue.value)&&!(v<fe.value)&&!(s<ge.value)&&!(k<de.value)&&!(y<ve.value)&&!(H<pe.value)&&!(i<De.value)&&!(A<He.value)&&!(t<ke.value))return y=Math.floor(y),H=Math.floor(H),i=Math.floor(i),A=Math.floor(A),t=Math.floor(t),[u,u+c,s,v,g,R,k,y,H,i,A,t,...p]}const Te={水:{火:1.5,木:.5},木:{水:1.5,火:.5},火:{木:1.5,水:.5}};function h(a,n,u){var s;const c=(s=Te[a])==null?void 0:s[n];return c?u*c:u}function W(a){return function(n,u){for(let c=0;c<a.length;c++){const{key:s,order:v}=a[c];if(!Object.prototype.hasOwnProperty.call(n,s)||!Object.prototype.hasOwnProperty.call(u,s))continue;let g=0;if(n[s]<u[s]?g=-1:n[s]>u[s]&&(g=1),g!==0)return v==="降順"?g*-1:g}return 0}}function M(a){return a<=0?1:a*M(a-1)}async function qe(a){for(const t of $.value)if(t.required&&t.level==0){q.value=a("error.requiredCharacter");return}const n=$.value.filter(t=>t.level>0),u=n.length;if(u<5){q.value=a("error.fewCharacter");return}N.value=0;const c=Ae(a),s=[];for(const t of ye.value)for(let r=0;r<c.length;r++)if(c[r]==t.prop){let m="降順";switch(t.order){case"ASC":m="昇順";break;case"DESC":m="降順";break;case"昇順":case"降順":m=t.order;break;default:continue}s.push({key:be[r],order:m})}const v=s[0].order==="昇順";async function g(){D.value.sort(W(s));const t=D.value.slice(0,_.value);D.value=[...t],D.value.length>0&&(y=D.value[D.value.length-1][s[0].key]),await new Promise(requestAnimationFrame)}const R=new Set(["referenceDamage","referenceAdvantageDamage","referenceVsHiDamage","referenceVsMizuDamage","referenceVsKiDamage"]);s[0].key in R?n.sort((t,r)=>t.required&&!r.required?-1:!t.required&&r.required?1:r.atk-t.atk):n.sort((t,r)=>t.required&&!r.required?-1:!t.required&&r.required?1:r.hp-t.hp);const k=n.filter(t=>t.required).length;if(k>5){q.value="必須設定されたキャラが多すぎます";return}D.value=[],n.forEach(t=>{let r=110;t.rare=="SR"?r=90:t.rare=="R"&&(r=70);const m=t.level/r;t.calcBaseHP=(t.hp-t.base_hp)*m+t.base_hp,t.calcBaseATK=(t.atk-t.base_atk)*m+t.base_atk});let y=s[0].order==="昇順"?1/0:-1/0;const H=async(t,r,m,l,p)=>new Promise(e=>{const o=[n[t],n[r],n[m],n[l],n[p]],f=Ke(o);if(f){const P={hp:Math.round(f[0]),ehp:Math.round(f[1]),evasion:f[2],hpBuudy:f[3],buddy:f[4],noHpBuddy:f[5],duo:f[6],referenceDamage:f[7],referenceAdvantageDamage:f[8],referenceVsHiDamage:f[9],referenceVsMizuDamage:f[10],referenceVsKiDamage:f[11],chara1:f[12],chara2:f[13],chara3:f[14],chara4:f[15],chara5:f[16]},b=P[s[0].key];(v&&b<y||!v&&b>y)&&D.value.push(P)}N.value+=1,e()}),i=new Array(5).fill(u);for(let t=0;t<k;t++)i[t]=t+1;if(Pe.value){let t=Date.now();const r=i[0]*(i[1]-1)*(i[2]-2)*(i[3]-3);if(U.value=r*(i[4]-4)/M(5-k)+r*4/M(4-k),k==5){U.value=1,await H(0,1,2,3,4),await new Promise(requestAnimationFrame);return}for(let m=0;m<i[0];m++)for(let l=m+1;l<i[1];l++)for(let p=l+1;p<i[2];p++){if(!I.value)return;for(let e=p+1;e<i[3];e++){for(let o=e+1;o<i[4];o++)await H(m,l,p,e,o),Date.now()-t>2e3&&(t=Date.now(),await g());for(const o of[m,l,p,e])await H(m,l,p,e,o),Date.now()-t>2e3&&(t=Date.now(),await g())}}}else{const t=i[0]*(i[1]-1)*(i[2]-2)*(i[3]-3);if(U.value=t*(i[4]-4)/M(5-k),k==5){U.value=1,await H(0,1,2,3,4),await new Promise(requestAnimationFrame);return}let r=Date.now();for(let m=0;m<i[0];m++)for(let l=m+1;l<i[1];l++)for(let p=l+1;p<i[2];p++){if(!I.value)return;for(let e=p+1;e<i[3];e++)for(let o=e+1;o<i[4];o++)await H(m,l,p,e,o),Date.now()-r>2e3&&(r=Date.now(),await g())}}D.value.sort(W(s));const A=D.value.slice(0,_.value);D.value=[...A],D.value.length>0&&(y=D.value[D.value.length-1][s[0].key])}export{ce as a,qe as b,Ve as c,Ae as g,ie as u};
