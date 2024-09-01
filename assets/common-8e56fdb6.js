import{u as de}from"./characters-63e7b978.js";import{as as te,y as G}from"./index-b44949cb.js";const ve=te("searchSettings",{state:()=>({minEHP:3e4,minHP:3e4,minHPBuddy:0,minEvasion:0,minDuo:0,minBuff:0,minDebuff:0,minReferenceDamage:0,minReferenceAdvantageDamage:0,minReferenceVsHiDamage:0,minReferenceVsMizuDamage:0,minReferenceVsKiDamage:0,maxResult:10,attackNum:10,sortOptions:[{prop:"HP",order:"降順"}],allowSameCharacter:!0}),actions:{updateSearchSettings(t){Object.assign(this,t)}}}),pe=te("searchResult",{state:()=>({totalResults:0,nowResults:0,results:[],isSearching:!1,errorMessage:""})}),De=ve(),{minEHP:ke,minHP:He,minDebuff:ye,minBuff:Pe,minHPBuddy:Re,minEvasion:he,minDuo:be,minReferenceDamage:Ae,minReferenceAdvantageDamage:we,minReferenceVsHiDamage:Be,minReferenceVsKiDamage:Se,minReferenceVsMizuDamage:Ke,maxResult:Q,sortOptions:Me,allowSameCharacter:Te,attackNum:V}=G(De),Ue=de(),{characters:X}=G(Ue),Ve=pe(),{totalResults:z,nowResults:Y,results:y,isSearching:x,errorMessage:j}=G(Ve);function Ne(t){(t.key==="e"||t.key==="+")&&t.preventDefault()}function qe(t){return[t("comments.HP"),t("comments.effectiveHP"),t("comments.HPBuddy"),t("comments.noHPBuddy"),t("comments.buddy"),t("comments.evasion"),t("comments.duo"),t("comments.buff"),t("comments.debuff"),t("comments.neutralDamage"),t("comments.advantageDamage"),t("comments.damageAgainstFire"),t("comments.damageAgainstWater"),t("comments.damageAgainstFlora")]}const Ce=["hp","ehp","hpBuudy","noHpBuddy","buddy","evasion","duo","referenceDamage","referenceAdvantageDamage","referenceVsHiDamage","referenceVsMizuDamage","referenceVsKiDamage"],O={"HPUP(小)":{hp:.2,atk:0,heal:0,conHeal:0},"HP&ATKUP(小)":{hp:.2,atk:.2,heal:0,conHeal:0},"HPUP(中)":{hp:.3,atk:0,heal:0,conHeal:0},"HP&ATKUP(中)":{hp:.3,atk:.35,heal:0,conHeal:0},"ATKUP(小)":{hp:0,atk:.2,heal:0,conHeal:0},"ATKUP(中)":{hp:0,atk:.35,heal:0,conHeal:0},"回復(小)":{hp:0,atk:0,heal:1.1,conHeal:0},"回復&継続回復(小)":{hp:0,atk:0,heal:1.1,conHeal:.15*3},"回復(中)":{hp:0,atk:0,heal:1.7,conHeal:0},"回復&継続回復(中)":{hp:0,atk:0,heal:1.7,conHeal:.25*3},"継続回復(小)":{hp:0,atk:0,heal:0,conHeal:.15*3},"継続回復(中)":{hp:0,atk:0,heal:0,conHeal:.25*3}};function F(t){var n;return((n=O[t])==null?void 0:n.hp)||0}function N(t){var n;return((n=O[t])==null?void 0:n.atk)||0}function $(t){var n;return((n=O[t])==null?void 0:n.heal)||0}function I(t){var n;return((n=O[t])==null?void 0:n.conHeal)||0}const Le={"ATKUP(極小)":1.1,"ATKUP(小)":1.2,"ATKUP(中)":1.35,"ATKUP(大)":1.5,"ATKUP(極大)":1.8},ze={"ダメUP(極小)":.025,"ダメUP(小)":.05,"ダメUP(中)":.0875,"ダメUP(大)":.125,"ダメUP(極大)":.1875,"属性ダメUP(極小)":.03,"属性ダメUP(小)":.06,"属性ダメUP(中)":.1005,"属性ダメUP(大)":.15,"属性ダメUP(極大)":.27},W={};function Ee(t,n,u,i){const s=`${t},${n},${u},${i}`;if(s in W)return W[s];let k=n.includes("弱")?.75:1;k*=u==="無"?1.1:1,k+=ze[t]||0;let v=1;n.includes("連撃")?v=1.8:n.includes("デュオ")&&(v=2.4);const w=i*k*v;return W[s]=w,w}function Z(t,n,u,i,s){return i=(Le[t]||1)*i+i*s,Ee(t,n,u=="無"?"無":"無以外",i)}function q(t,n,u){const i=[t,n,u];return i.sort((s,k)=>k-s),[i[0],i[1]]}function Oe(t){const n=new Set;for(const e of t)n.add(e.chara);let u=0,i=0,s=0,k=0,v=0,w=0,R=0,A=0,h=0;const l=[],C=[],a=[],o=[],f=[];let m=0,g=0,d=0,D=0,c=0;const H={},B={},P={},J=[];if(t.sort((e,r)=>r.calcBaseATK-e.calcBaseATK),t.forEach((e,r)=>{H[r]=!1,B[r]=!1,P[r]=!1}),t.forEach((e,r)=>{J.push(e.imgUrl),u+=e.calcBaseHP,R+=e.buff_count,A+=e.debuff_count;let L=!1,S=0;if(n.has(e.buddy1c)){v+=1;const p=F(e.buddy1s);S+=N(e.buddy1s),p!=0&&(k+=1,L=!0,u+=e.calcBaseHP*p)}if(n.has(e.buddy2c)){v+=1;const p=F(e.buddy2s);S+=N(e.buddy2s),p!=0&&(k+=1,L=!0,u+=e.calcBaseHP*p)}if(n.has(e.buddy3c)){v+=1;const p=F(e.buddy3s);S+=N(e.buddy3s),p!=0&&(k+=1,L=!0,u+=e.calcBaseHP*p)}i+=($(e.magic1heal)+$(e.magic2heal)+(e.hasM3?$(e.magic3heal):0))*e.calcBaseATK,i+=(I(e.magic1heal)+I(e.magic2heal)+(e.hasM3?I(e.magic3heal):0))*e.calcBaseHP,s+=e.evasion,L||(w+=1);let _=e.magic2pow;if(P[r])_="デュオ",h+=1;else{if(!P[r]){for(const[p,U]of t.entries())if(U.duo==e.chara&&e.duo==U.chara&&!P[r]&&!P[p]){P[r]=!0,P[p]=!0,H[r]=!0,H[p]=!0;break}if(!H[r]){for(const[p,U]of t.entries())if(e.duo==U.chara&&!P[r]&&!H[r]&&!B[p]){P[r]=!0,H[r]=!0,B[p]=!0;break}}if(!H[r]){for(const[p,U]of t.entries())if(e.duo==U.chara&&!P[r]&&!H[r]&&!H[p]){P[r]=!0,H[r]=!0,H[p]=!0;break}}}P[r]&&(_="デュオ",h+=1)}const K=Z(e.magic1buf,e.magic1pow,e.magic1atr,e.calcBaseATK,S),M=Z(e.magic2buf,_,e.magic2atr,e.calcBaseATK,S),T=e.hasM3?Z(e.magic3buf,e.magic3pow,e.magic3atr,e.calcBaseATK,S):0,ae=e.magic1atr=="無"?K:K*1.5,ne=e.magic2atr=="無"?M:M*1.5,re=e.magic3atr=="無"?T:T*1.5,se=b(e.magic1atr,"火",K),oe=b(e.magic2atr,"火",M),ie=b(e.magic3atr,"火",T),ce=b(e.magic1atr,"水",K),ue=b(e.magic2atr,"水",M),le=b(e.magic3atr,"水",T),fe=b(e.magic1atr,"木",K),me=b(e.magic2atr,"木",M),ge=b(e.magic3atr,"木",T);l.push(...q(K,M,T)),C.push(...q(ae,ne,re)),a.push(...q(se,oe,ie)),o.push(...q(ce,ue,le)),f.push(...q(fe,me,ge))}),m=l.sort((e,r)=>r-e).slice(0,V.value).reduce((e,r)=>e+r,0),g=C.sort((e,r)=>r-e).slice(0,V.value).reduce((e,r)=>e+r,0),d=a.sort((e,r)=>r-e).slice(0,V.value).reduce((e,r)=>e+r,0),D=o.sort((e,r)=>r-e).slice(0,V.value).reduce((e,r)=>e+r,0),c=f.sort((e,r)=>r-e).slice(0,V.value).reduce((e,r)=>e+r,0),!(u<He.value)&&!(u+i<ke.value)&&!(k<Re.value)&&!(s<he.value)&&!(h<be.value)&&!(R<Pe.value)&&!(A<ye.value)&&!(m<Ae.value)&&!(g<we.value)&&!(d<Be.value)&&!(D<Ke.value)&&!(c<Se.value))return m=Math.floor(m),g=Math.floor(g),d=Math.floor(d),D=Math.floor(D),c=Math.floor(c),[u,u+i,s,k,v,w,h,R,A,m,g,d,D,c,...J]}const _e={水:{火:1.5,木:.5},木:{水:1.5,火:.5},火:{木:1.5,水:.5}};function b(t,n,u){var s;const i=(s=_e[t])==null?void 0:s[n];return i?u*i:u}function ee(t){return function(n,u){for(let i=0;i<t.length;i++){const{key:s,order:k}=t[i];if(!Object.prototype.hasOwnProperty.call(n,s)||!Object.prototype.hasOwnProperty.call(u,s))continue;let v=0;if(n[s]<u[s]?v=-1:n[s]>u[s]&&(v=1),v!==0)return k==="降順"?v*-1:v}return 0}}function E(t){return t<=0?1:t*E(t-1)}async function $e(t){for(const a of X.value)if(a.required&&a.level==0){j.value=t("error.requiredCharacter");return}const n=X.value.filter(a=>a.level>0),u=n.length;if(u<5){j.value=t("error.fewCharacter");return}Y.value=0;const i=qe(t),s=[];for(const a of Me.value)for(let o=0;o<i.length;o++)if(i[o]==a.prop){let f="降順";switch(a.order){case"ASC":f="昇順";break;case"DESC":f="降順";break;case"昇順":case"降順":f=a.order;break;default:continue}s.push({key:Ce[o],order:f})}const k=s[0].order==="昇順";async function v(){y.value.sort(ee(s));const a=y.value.slice(0,Q.value);y.value=[...a],y.value.length>0&&(A=y.value[y.value.length-1][s[0].key]),await new Promise(requestAnimationFrame)}const w=new Set(["referenceDamage","referenceAdvantageDamage","referenceVsHiDamage","referenceVsMizuDamage","referenceVsKiDamage"]);s[0].key in w?n.sort((a,o)=>a.required&&!o.required?-1:!a.required&&o.required?1:o.atk-a.atk):n.sort((a,o)=>a.required&&!o.required?-1:!a.required&&o.required?1:o.hp-a.hp);const R=n.filter(a=>a.required).length;if(R>5){j.value="必須設定されたキャラが多すぎます";return}y.value=[],n.forEach(a=>{let o=110;a.rare=="SR"?o=90:a.rare=="R"&&(o=70);const f=a.level/o;a.calcBaseHP=(a.hp-a.base_hp)*f+a.base_hp,a.calcBaseATK=(a.atk-a.base_atk)*f+a.base_atk});let A=s[0].order==="昇順"?1/0:-1/0;const h=async(a,o,f,m,g)=>new Promise(d=>{const D=[n[a],n[o],n[f],n[m],n[g]],c=Oe(D);if(c){const H={hp:Math.round(c[0]),ehp:Math.round(c[1]),evasion:c[2],hpBuudy:c[3],buddy:c[4],noHpBuddy:c[5],duo:c[6],buff:c[7],debuff:c[8],referenceDamage:c[9],referenceAdvantageDamage:c[10],referenceVsHiDamage:c[11],referenceVsMizuDamage:c[12],referenceVsKiDamage:c[13],chara1:c[14],chara2:c[15],chara3:c[16],chara4:c[17],chara5:c[18]},B=H[s[0].key];(k&&B<A||!k&&B>A)&&y.value.push(H)}Y.value+=1,d()}),l=new Array(5).fill(u);for(let a=0;a<R;a++)l[a]=a+1;if(Te.value){let a=Date.now();const o=l[0]*(l[1]-1)*(l[2]-2)*(l[3]-3);if(z.value=o*(l[4]-4)/E(5-R)+o*4/E(4-R),R==5){z.value=1,await h(0,1,2,3,4),await new Promise(requestAnimationFrame);return}for(let f=0;f<l[0];f++)for(let m=f+1;m<l[1];m++)for(let g=m+1;g<l[2];g++){if(!x.value)return;for(let d=g+1;d<l[3];d++){for(let D=d+1;D<l[4];D++)await h(f,m,g,d,D),Date.now()-a>2e3&&(a=Date.now(),await v());for(const D of[f,m,g,d])await h(f,m,g,d,D),Date.now()-a>2e3&&(a=Date.now(),await v())}}}else{const a=l[0]*(l[1]-1)*(l[2]-2)*(l[3]-3);if(z.value=a*(l[4]-4)/E(5-R),R==5){z.value=1,await h(0,1,2,3,4),await new Promise(requestAnimationFrame);return}let o=Date.now();for(let f=0;f<l[0];f++)for(let m=f+1;m<l[1];m++)for(let g=m+1;g<l[2];g++){if(!x.value)return;for(let d=g+1;d<l[3];d++)for(let D=d+1;D<l[4];D++)await h(f,m,g,d,D),Date.now()-o>2e3&&(o=Date.now(),await v())}}y.value.sort(ee(s));const C=y.value.slice(0,Q.value);y.value=[...C],y.value.length>0&&(A=y.value[y.value.length-1][s[0].key])}export{pe as a,$e as b,Ne as c,qe as g,ve as u};
