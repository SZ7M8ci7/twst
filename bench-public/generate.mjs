import fs from 'node:fs';
import {createHash} from 'node:crypto';
const cards=JSON.parse(fs.readFileSync('src/assets/chara.json'));
const ranked=[...cards].sort((a,b)=>createHash('sha256').update('public-synthetic-v1:'+a.name).digest('hex').localeCompare(createHash('sha256').update('public-synthetic-v1:'+b.name).digest('hex')));
const roster=(list,totsu)=>list.map(c=>({name:c.name,level:(c.rare==='SSR'?80:c.rare==='SR'?60:40)+totsu*5,totsu,magicLevels:[10,10,10],buddyLevels:[10,10,10],allowUpgrade:true}));
const profiles={};
for(const [i,n,t,b] of [[1,120,2,4],[2,120,0,4],[3,200,1,4],[4,cards.length,4,0],[5,45,0,4]]) profiles['synthetic-'+i]={roster:roster(ranked.slice(0,n),t),budget:b,requiredCharacters:[],requiredCards:[],useHandCollection:true,favorableEffects:false};
fs.writeFileSync('bench-public/profiles.generated.json',JSON.stringify({provenance:'Algorithmically generated solely from public catalog; no user collection or private fixtures.',profiles,supports:roster(cards,4).map(c=>({...c,allowUpgrade:false}))}));
