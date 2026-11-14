// Fixed-work microbenchmark, not an end-to-end search speed claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const roots=process.argv.slice(2).map(p=>path.resolve(p));
if(roots.length!==2)throw Error('Usage: node dead-logic-compare.cjs BASELINE CURRENT');
function loader(root){const cache=new Map();return function load(file){if(cache.has(file))return cache.get(file);const module={exports:{}};cache.set(file,module.exports);const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{module,exports:module.exports,require:id=>id.startsWith('@/')?load(`src/${id.slice(2)}.ts`):require(id),performance,setTimeout,setImmediate,MessageChannel});cache.set(file,module.exports);return module.exports;};}
const modules=roots.map(loader).map(load=>({stats:load('src/domain/examSearch/statistics.ts'),Session:load('src/domain/examSearch/scheduler.ts').SearchSession}));
const clone=x=>JSON.parse(JSON.stringify(x));
const samples=i=>({scores:Array.from({length:500},(_,j)=>((j*7919+i*104729)%17<4?0:20000+(j*7919+i*104729)%60000)),retired:0,turns:0});
const rows=Array.from({length:48},(_,i)=>({candidate:{id:`r${i}`,cost:i%4,cards:Array.from({length:5},(_,j)=>({name:`c${i}-${j}`,selectedMagic:[1,2]})),challengeIds:[],policy:'effects'},development:samples(i),validation:samples(i+3),validationTarget:500}));
const progress={phase:'done',generated:48,evaluated:48,tasksDone:48,tasksTotal:48,elapsedMs:0,results:rows};
function packet(k,n){return k===0?modules[k].stats.displayProgress(progress,0,n,.05):modules[k].stats.displayProgress(progress,n,.05);}
function ranking(k,n){return (k===0?modules[k].stats.rankedResults(rows,0,n,.05):modules[k].stats.rankedResults(rows,n,.05)).map(r=>r.candidate.id);}
function finalists(k,n){const session=new modules[k].Session({target:0,tolerance:0,attempts:n,desiredProbability:.05},{},{},'fixed');session.pool=rows;session.selectFinalists();return session.finalists.map(r=>r.candidate.id);}
for(const n of [1,30,100]){
 assert.deepEqual(clone(ranking(0,n)),clone(ranking(1,n)));
 assert.deepEqual(clone(finalists(0,n)),clone(finalists(1,n)));
 const a=clone(packet(0,n)),b=clone(packet(1,n));for(const row of a.results){delete row.validationSummary.target;delete row.validationSummary.metrics;}assert.deepEqual(a,b);
 for(const row of rows)assert.equal(modules[0].stats.searchDevelopmentQuality(row.development,{target:0,tolerance:0,attempts:n,desiredProbability:.05}),modules[1].stats.searchDevelopmentQuality(row.development,{attempts:n,desiredProbability:.05}));
}
const workloads={display:k=>packet(k,30),ranking:k=>ranking(k,30),finalistSelection:k=>finalists(k,30)};
const report={scope:'48 synthetic candidates, 500 fixed ordinary samples each; no battle simulation, not full benchmark',equivalence:{attempts:[1,30,100],ranking:true,finalists:true,developmentQuality:true,displayExceptRemovedMetadata:true},timings:{}};
for(const [name,fn] of Object.entries(workloads)){
 for(let i=0;i<10;i++){fn(0);fn(1);}const batches=[[],[]],count=20;
 for(let pair=0;pair<11;pair++)for(const k of pair%2?[1,0]:[0,1]){const start=performance.now();for(let i=0;i<count;i++)fn(k);batches[k].push((performance.now()-start)/count);}
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];const before=median(batches[0]),after=median(batches[1]);report.timings[name]={unit:'ms/call',before,after,percentChange:(after/before-1)*100,batches};
}
report.packetBytes={before:Buffer.byteLength(JSON.stringify(packet(0,30))),after:Buffer.byteLength(JSON.stringify(packet(1,30)))};
console.log(JSON.stringify(report,null,2));
