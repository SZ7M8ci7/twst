import{C as q,r as B,V as U,D as T}from"./VTooltip-2deb44c1.js";import{d as E,i as O,r as g,e as d,o as R,c as G,w as e,h as a,a as t,t as r,V as b,au as M,b as w,p as H,n as j,_ as z}from"./index-2eaa4d50.js";import{V as n,a as _}from"./VRow-00cd7243.js";import{V as J,a as h}from"./VRadioGroup-a5e42b96.js";import{V as K}from"./VContainer-facbfcd5.js";const L=f=>(H("data-v-f17fc930"),f=f(),j(),f),P={class:"ma-1"},Q={class:"ma-1"},W={class:"ma-1"},X=L(()=>t("th",null,null,-1)),Y={class:"pa-1"},Z={class:"pa-1"},aa={class:"pa-1"},ea={class:"text-nowrap wide-cell"},la={class:"mdi mdi-help-circle-outline"},ta={class:"pa-1"},sa={class:"pa-1"},oa={class:"pa-1"},ua=E({__name:"calcBASIC",setup(f){q.register(...B);const{t:m}=O(),i=[.144,.138,.132,.126,.1],N=g(0),C=g(0),c=g(1.5),o=g({advantage:0,equal:0,disadvantage:0}),F=d(()=>Number(o.value.advantage)+Number(o.value.equal)+Number(o.value.disadvantage)),v=d(()=>Math.max(0,Number(Math.floor((F.value-1)/2+.001).toFixed()))),y=d(()=>Number(N.value)-F.value*4.5),S=d(()=>C.value*3e3),x=d(()=>Number(o.value.advantage)*2e3),D=d(()=>Number(o.value.equal)*500),A=d(()=>Number(o.value.disadvantage)*-1e3),I=d(()=>y.value+S.value+x.value+D.value+A.value),$=d(()=>(I.value*c.value*i[v.value]).toFixed()),p=["#FAD9C8","#FAF2C8","#E9FAC8","#D0FAC8","#C8FAD9"],V=d(()=>[{label:m("basic.damage"),value:Number((y.value*c.value*i[v.value]).toFixed()),color:p[0]},{label:m("basic.duo"),value:Number((S.value*c.value*i[v.value]).toFixed()),color:p[1]},{label:m("basic.numberOfAdvantage"),value:Number((x.value*c.value*i[v.value]).toFixed()),color:p[2]},{label:m("basic.numberOfNeutral"),value:Number((D.value*c.value*i[v.value]).toFixed()),color:p[3]},{label:m("basic.numberOfDisadvantage"),value:Number((A.value*c.value*i[v.value]).toFixed()),color:p[4]}].sort((l,s)=>s.value-l.value)),k=d(()=>({labels:V.value.map(l=>l.label),datasets:[{data:V.value.map(l=>l.value),backgroundColor:V.value.map(l=>l.color)}]}));return(l,s)=>(R(),G(K,null,{default:e(()=>[a(_,null,{default:e(()=>[a(n,{cols:"1"}),a(n,{cols:"11"},{default:e(()=>[a(_,{align:"center"},{default:e(()=>[a(n,{cols:"3",class:"pa-1 text-center"},{default:e(()=>[t("span",P,r(l.$t("basic.difficulty")),1)]),_:1}),a(n,{cols:"9",class:"pa-1"},{default:e(()=>[a(J,{modelValue:c.value,"onUpdate:modelValue":s[0]||(s[0]=u=>c.value=u),"hide-details":"",inline:""},{default:e(()=>[a(h,{label:"Easy",value:"0.8"}),a(h,{label:"Normal",value:"1"}),a(h,{label:"Hard",value:"1.2"}),a(h,{label:"Extra",value:1.5,checked:""})]),_:1},8,["modelValue"])]),_:1})]),_:1}),a(_,{align:"center"},{default:e(()=>[a(n,{cols:"3",class:"pa-1 text-center"},{default:e(()=>[t("span",Q,r(l.$t("basic.totalDamageDealt")),1)]),_:1}),a(n,{cols:"9",class:"pa-1"},{default:e(()=>[a(b,{type:"number",modelValue:N.value,"onUpdate:modelValue":s[1]||(s[1]=u=>N.value=u),class:"mt-0 pt-0","hide-details":"auto",dense:"",solo:"",min:0},null,8,["modelValue"])]),_:1})]),_:1}),a(_,{align:"center"},{default:e(()=>[a(n,{cols:"3",class:"pa-1 text-center"},{default:e(()=>[t("span",W,r(l.$t("basic.duo")),1)]),_:1}),a(n,{cols:"9",class:"pa-1"},{default:e(()=>[a(b,{type:"number",modelValue:C.value,"onUpdate:modelValue":s[2]||(s[2]=u=>C.value=u),class:"mt-0 pt-0","hide-details":"auto",dense:"",solo:"",min:0},null,8,["modelValue"])]),_:1})]),_:1}),a(_,null,{default:e(()=>[a(n,{class:"pa-1"},{default:e(()=>[a(M,null,{default:e(()=>[t("thead",null,[t("tr",null,[X,t("th",Y,r(l.$t("basic.advantage")),1),t("th",Z,r(l.$t("basic.neutral")),1),t("th",aa,r(l.$t("basic.disadvantage")),1)])]),t("tbody",null,[t("tr",null,[t("th",ea,[w(r(l.$t("basic.attack"))+" ",1),t("span",la,[a(U,{style:{"white-space":"nowrap"},activator:"parent","open-on-click":""},{default:e(()=>[w(r(l.$t("basic.attackDetail")),1)]),_:1})])]),t("td",ta,[a(b,{type:"number",modelValue:o.value.advantage,"onUpdate:modelValue":s[3]||(s[3]=u=>o.value.advantage=u),"hide-details":"",dense:"",solo:""},null,8,["modelValue"])]),t("td",sa,[a(b,{type:"number",modelValue:o.value.equal,"onUpdate:modelValue":s[4]||(s[4]=u=>o.value.equal=u),"hide-details":"",dense:"",solo:""},null,8,["modelValue"])]),t("td",oa,[a(b,{type:"number",modelValue:o.value.disadvantage,"onUpdate:modelValue":s[5]||(s[5]=u=>o.value.disadvantage=u),"hide-details":"",dense:"",solo:""},null,8,["modelValue"])])])])]),_:1})]),_:1})]),_:1}),a(T,{data:k.value,scores:V.value,score:$.value},null,8,["data","scores","score"])]),_:1})]),_:1})]),_:1}))}});const va=z(ua,[["__scopeId","data-v-f17fc930"]]);export{va as default};
