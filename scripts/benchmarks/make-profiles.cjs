// Usage: node make-profiles.cjs current-sets.json provided-v3.json output.json
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto');
const [currentPath,providedPath,out]=process.argv.slice(2);
const current=JSON.parse(fs.readFileSync(currentPath)),provided=JSON.parse(fs.readFileSync(providedPath));
if(current.format!=='twst-hand-collection-sets-v1'||provided.format!=='twst-hand-collection-v3')throw Error('Unsupported export');
const cards=require('../../src/assets/chara.json'),catalog=Object.fromEntries(cards.map(c=>[c.name,c]));
const historical=JSON.parse(cp.execFileSync('git',['show','8dda02ba:src/assets/chara.json'],{encoding:'utf8',maxBuffer:10e6}));
if(historical.length!==518)throw Error('Historical catalog mismatch');
const trained=(c,support=false)=>({name:c.name,level:c.level,totsu:c.totsu,magicLevels:[10,10,10],buddyLevels:[10,10,10],allowUpgrade:!support});
const owned=Object.entries(provided.cards).filter(([,c])=>c.isOwned&&c.level>0).map(([name,c])=>({name,...c})).sort((a,b)=>a.name.localeCompare(b.name));
const sparse=[];for(const chara of ['イデア','アズール'])sparse.push(...owned.filter(c=>c.chara===chara).slice(0,3));
const selected=new Set(sparse.map(c=>c.name)),groups=new Map();for(const c of owned.filter(c=>!selected.has(c.name))){const g=groups.get(c.chara)??[];g.push(c);groups.set(c.chara,g);}const characters=[...groups.keys()].sort((a,b)=>a.localeCompare(b));
for(let i=0;sparse.length<24&&i<owned.length;i++)for(const chara of characters){const c=groups.get(chara)[i];if(c&&sparse.length<24)sparse.push(c);}
const set=current.sets[0];const original=Object.entries(set.data).filter(([,c])=>c.isOwned&&c.level>0).map(([name,c])=>trained({name,...c}));
for(const c of [...original,...owned])if(!catalog[c.name])throw Error('Unknown card '+c.name);
const normalize=(c,support=false)=>trained({name:c.name,level:c.rare==='SSR'?(support?120:110):c.rare==='SR'?90:70,totsu:4},support);
const profiles={original:{roster:original,budget:3,requiredCharacters:[]},'original-zero':{roster:original,budget:0,requiredCharacters:[]},provided:{roster:owned.map(c=>trained(c)),budget:0,requiredCharacters:['イデア','アズール']},'all-owned':{roster:historical.map(c=>normalize(c)),budget:0,requiredCharacters:['イデア','アズール']},sparse:{roster:sparse.map(c=>trained(c)),budget:0,requiredCharacters:['イデア','アズール']}};
const data={schema:1,source:{currentPath,providedPath,set:{slot:1,id:set.id,name:set.name},currentSha256:crypto.createHash('sha256').update(fs.readFileSync(currentPath)).digest('hex'),providedSha256:crypto.createHash('sha256').update(fs.readFileSync(providedPath)).digest('hex'),historicalCatalogRef:'8dda02ba',note:'Current set1 replaces only original/original-zero; other roster selection and 518 maximum-trained support identities follow the historical procedure.'},profiles,supports:historical.map(c=>normalize(c,true))};fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');console.log(Object.fromEntries(Object.entries(profiles).map(([k,v])=>[k,v.roster.length])));
