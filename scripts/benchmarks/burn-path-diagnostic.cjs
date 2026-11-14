const fs=require('fs'),path=require('path'),vm=require('vm'),ts=require('typescript'),crypto=require('crypto');
const root=process.cwd(),cache=new Map();
function load(rel){if(cache.has(rel))return cache.get(rel);const m={exports:{}};cache.set(rel,m.exports);vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,rel),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText,{module:m,exports:m.exports,performance,require:id=>id.startsWith('@/')?load('src/'+id.slice(2)+'.ts'):require(id),setTimeout,setImmediate,MessageChannel});cache.set(rel,m.exports);return m.exports;}
const cards=require(path.join(root,'src/assets/chara.json')),catalog=Object.fromEntries(cards.map(c=>[c.name,c]));
const gen=load('src/domain/examSearch/candidateGenerator.ts');
const tag=process.argv[2]||'burn-development-v3';
const report=[];
for(const file of fs.readdirSync('artifacts/nrc19/'+tag+'-after').filter(f=>f.startsWith('case-'))){
 const r=JSON.parse(fs.readFileSync('artifacts/nrc19/'+tag+'-after/'+file));
 const checkpoint=JSON.parse(fs.readFileSync('artifacts/nrc19/'+tag+'-after/'+file.replace('case-','checkpoint-'))).checkpoint;
 const tasks=gen.buildTasks(r.input,catalog),seen=new Set(checkpoint.seen);
 const rows=tasks.flatMap((task,index)=>{if(task.style!==3)return[];
  const candidates=gen.generateCandidates(r.input,task,catalog);
  return[{index,anchor:task.anchor,support:task.supportAnchor,cost:task.cost,buddy:task.requiredCharacters,
   candidates:candidates.length,evaluated:candidates.filter(c=>seen.has(c.id)).length,
   finalist:candidates.filter(c=>r.topCandidates.some(x=>x.candidate.id===c.id)).length,
   teams:candidates.map(c=>c.cards.map(x=>[x.name,x.selectedMagic,x.support]))}];});
 report.push({profile:r.profile,cursor:checkpoint.cursor,rows});
}
console.log(JSON.stringify(report,null,2));
