import{I as p,as as k,L as V,O as f,i as a,P as n,at as y,au as A,J as C,av as O,S as c,aw as h,e as x,a5 as F,ax as U,ay as m,F as L,az as N,aA as _}from"./index-cab4b842.js";const w=p({...k({falseIcon:"$radioOff",trueIcon:"$radioOn"})},"VRadio"),T=V()({name:"VRadio",props:w(),setup(e,l){let{slots:s}=l;return f(()=>a(y,n(e,{class:["v-radio",e.class],style:e.style,type:"radio"}),s)),{}}});const z=p({height:{type:[Number,String],default:"auto"},...A(),...C(O(),["multiple"]),trueIcon:{type:c,default:"$radioOn"},falseIcon:{type:c,default:"$radioOff"},type:{type:String,default:"radio"}},"VRadioGroup"),j=V()({name:"VRadioGroup",inheritAttrs:!1,props:z(),emits:{"update:modelValue":e=>!0},setup(e,l){let{attrs:s,slots:t}=l;const v=h(),i=x(()=>e.id||`radio-group-${v}`),o=F(e,"modelValue");return f(()=>{const[b,I]=U(s),[P,D]=m.filterProps(e),[R,J]=y.filterProps(e),r=t.label?t.label({label:e.label,props:{for:i.value}}):e.label;return a(m,n({class:["v-radio-group",e.class],style:e.style},b,P,{modelValue:o.value,"onUpdate:modelValue":u=>o.value=u,id:i.value}),{...t,default:u=>{let{id:d,messagesId:g,isDisabled:G,isReadonly:S}=u;return a(L,null,[r&&a(N,{id:d.value},{default:()=>[r]}),a(_,n(R,{id:d.value,"aria-describedby":g.value,defaultsTarget:"VRadio",trueIcon:e.trueIcon,falseIcon:e.falseIcon,type:e.type,disabled:G.value,readonly:S.value,"aria-labelledby":r?d.value:void 0,multiple:!1},I,{modelValue:o.value,"onUpdate:modelValue":$=>o.value=$}),t)])}})}),{}}});export{j as V,T as a};
