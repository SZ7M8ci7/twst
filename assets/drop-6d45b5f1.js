import{c as w}from"./common-99958998.js";import{V as _}from"./VContainer-07cb0f03.js";import{V as i,a as c}from"./VRow-0647dfcd.js";import{V as k,a as j}from"./VRadioGroup-070190f4.js";import{d as I,r as o,e as N,f as U,g as B,h as R,i as e,w as t,F as A,o as E,a as l,V as F,u as L,t as u,p as P,j as G,_ as M}from"./index-eb5fc1f5.js";import"./characters-74a742de.js";const s=r=>(P("data-v-75f9e9d5"),r=r(),G(),r),T={class:"text-h6"},q=s(()=>l("thead",null,[l("tr",null,[l("th",{class:"text-left"}," アイテム "),l("th",{class:"text-left"}," ドロップ数 ")])],-1)),z=s(()=>l("td",null,"魔導書",-1)),H={class:"text-right"},J=s(()=>l("td",null,"教科書",-1)),O={class:"text-right"},Q=s(()=>l("td",null,"メモ帳",-1)),W={class:"text-right"},X=s(()=>l("td",null,"キャンディ",-1)),Y={class:"text-right"},Z=s(()=>l("td",null,"ハーブティーS",-1)),$={class:"text-right"},ll=s(()=>l("td",null,"ハーブティーM",-1)),el={class:"text-right"},tl=s(()=>l("td",null,"ハーブティーL",-1)),al={class:"text-right"},ol=s(()=>l("td",null,"マドル",-1)),ul={class:"text-right"},sl=I({__name:"drop",setup(r){const v=o("normal"),m=o(0),f=o(0),p=o(0),a=N(()=>3*m.value+10*f.value+Number(p.value)),h=o(0),g=o(0),x=o(0),D=o(0),V=o(0),K=o(0),y=o(0),S=o(0),b=o(0);return U(()=>{v.value=="normal"?(h.value=a.value*.05,g.value=a.value*.28,x.value=a.value*.84,D.value=a.value*.66,V.value=a.value*.1,y.value=a.value*0,S.value=a.value*0,b.value=a.value*0):(h.value=a.value*.62,g.value=a.value*.54,x.value=a.value*.17,D.value=a.value*1.3,V.value=a.value*.09,y.value=a.value*.1,S.value=a.value*.2,b.value=a.value*.4),K.value=a.value*250}),(nl,n)=>{const C=B("v-simple-table");return E(),R(A,null,[e(_,null,{default:t(()=>[e(i,null,{default:t(()=>[e(c,{class:"d-flex justify-center"},{default:t(()=>[l("div",null,[e(i,null,{default:t(()=>[e(c,{cols:"12"},{default:t(()=>[e(k,{modelValue:v.value,"onUpdate:modelValue":n[0]||(n[0]=d=>v.value=d),inline:""},{default:t(()=>[e(j,{label:"通常",value:"normal"}),e(j,{label:"ドロップ率アップ",value:"up"})]),_:1},8,["modelValue"])]),_:1})]),_:1})])]),_:1})]),_:1})]),_:1}),e(_,null,{default:t(()=>[e(i,null,{default:t(()=>[e(c,{class:"d-inline-flex justify-center"},{default:t(()=>[l("div",null,[e(F,{modelValue:m.value,"onUpdate:modelValue":n[1]||(n[1]=d=>m.value=d),label:"かけらS",type:"number",onKeydown:L(w),"hide-details":""},null,8,["modelValue","onKeydown"]),e(F,{modelValue:f.value,"onUpdate:modelValue":n[2]||(n[2]=d=>f.value=d),label:"かけらL",type:"number",onKeydown:L(w),"hide-details":""},null,8,["modelValue","onKeydown"]),e(F,{modelValue:p.value,"onUpdate:modelValue":n[3]||(n[3]=d=>p.value=d),label:"AP調整",type:"number",onKeydown:L(w),"hide-details":""},null,8,["modelValue","onKeydown"])])]),_:1})]),_:1})]),_:1}),e(_,null,{default:t(()=>[e(i,null,{default:t(()=>[e(c,{class:"d-flex justify-center"},{default:t(()=>[l("div",null,[e(i,null,{default:t(()=>[e(c,{cols:"12"},{default:t(()=>[l("p",T,"合計AP: "+u(a.value.toLocaleString()),1)]),_:1})]),_:1})])]),_:1})]),_:1})]),_:1}),e(_,null,{default:t(()=>[e(i,null,{default:t(()=>[e(c,{class:"d-flex justify-center"},{default:t(()=>[l("div",null,[e(i,null,{default:t(()=>[e(c,{cols:"12"},{default:t(()=>[e(C,null,{default:t(()=>[q,l("tbody",null,[l("tr",null,[z,l("td",H,u(h.value.toLocaleString(void 0,{maximumFractionDigits:2})),1)]),l("tr",null,[J,l("td",O,u(g.value.toLocaleString(void 0,{maximumFractionDigits:2})),1)]),l("tr",null,[Q,l("td",W,u(x.value.toLocaleString(void 0,{maximumFractionDigits:2})),1)]),l("tr",null,[X,l("td",Y,u(V.value.toLocaleString(void 0,{maximumFractionDigits:2})),1)]),l("tr",null,[Z,l("td",$,u(y.value.toLocaleString(void 0,{maximumFractionDigits:2})),1)]),l("tr",null,[ll,l("td",el,u(S.value.toLocaleString(void 0,{maximumFractionDigits:2})),1)]),l("tr",null,[tl,l("td",al,u(b.value.toLocaleString(void 0,{maximumFractionDigits:2})),1)]),l("tr",null,[ol,l("td",ul,u(K.value.toLocaleString(void 0,{maximumFractionDigits:2})),1)])])]),_:1})]),_:1})]),_:1})])]),_:1})]),_:1})]),_:1})],64)}}});const ml=M(sl,[["__scopeId","data-v-75f9e9d5"]]);export{ml as default};