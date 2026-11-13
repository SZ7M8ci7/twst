const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
const storedValues=new Map();
const localStorage={getItem:key=>storedValues.get(key)??null,setItem:(key,value)=>storedValues.set(key,value)};
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const module = { exports: {} };
  cache.set(relative, module.exports);
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText;
  const localRequire = id => id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`) : require(id);
  vm.runInNewContext(code, { module, exports: module.exports, require: localRequire, performance, setTimeout, setImmediate, MessageChannel, localStorage }, { filename: relative });
  cache.set(relative, module.exports);
  return module.exports;
}
const variants = load('src/domain/examSearch/variants.ts');
const stats = load('src/domain/examSearch/statistics.ts');
const policy = load('src/domain/examSearch/policy.ts');
const pairedMean = load('src/domain/examSearch/pairedMean.ts');
const importance = load('src/domain/examSearch/importance.ts');
const islands = load('src/domain/examSearch/islands.ts');
const { runSessionWithinBudget } = load('src/workers/examSearchRun.ts');
const generation = load('src/domain/examSearch/candidateGenerator.ts');
const {diversifyBeam}=load('src/domain/examSearch/beam.ts');
const { SearchSession, partitionGenerationTasks, validateTaskPartition, usesWideInitialScreen, interleaveWideCostTasks, prepareGenerationTasks } = load('src/domain/examSearch/scheduler.ts');
const catalog = Object.fromEntries(require('../src/assets/chara.json').map(c => [c.name, c]));
const { examPresetDefinitions } = load('src/utils/examPresets.ts');
const clone = x => JSON.parse(JSON.stringify(x));

test('partial beams preserve different card compositions without losing the strongest branch',()=>{
  const card=(name,magic,totsu=4)=>({name,level:110,totsu,support:false,selectedMagic:magic,
    magicLevels:[10,10,10],buddyLevels:[10,10,10]});
  const pairs=[[1,2],[1,3],[2,3]],ranked=[];
  for(const left of pairs)for(const right of pairs)ranked.push({cards:[card('root',left),card('a',right)],value:100-ranked.length});
  for(const name of ['b','c','d','e'])for(const pair of pairs.slice(0,2))ranked.push({cards:[card('root',pair),card(name,[1,2])],value:100-ranked.length});
  const selected=diversifyBeam(ranked,ranked.slice(0,8),8,[],{});
  assert.equal(selected.length,8);assert.equal(selected[0],ranked[0]);
  const identities=selected.map(row=>row.cards.map(card=>card.name).join('|'));
  assert.ok(new Set(identities).size>=4);
  for(const identity of new Set(identities))assert.ok(identities.filter(value=>value===identity).length<=2);
  const fixed=ranked.slice(0,9);
  assert.equal(diversifyBeam(fixed,fixed.slice(0,8),8,[],{}).length,8,'fixed identities can fill spare slots with spell variants');
});

test('partial beams reserve distinct mandatory-character coverage while preserving width',()=>{
  const card=name=>({name,level:100,totsu:4,support:false,selectedMagic:[1,2],magicLevels:[10,10,10],buddyLevels:[10,10,10]});
  const ranked=Array.from({length:20},(_,index)=>({cards:[card('root'),card(`f${index}`)],value:100-index}));
  ranked.push({cards:[card('root'),card('a')],value:20},{cards:[card('root'),card('b')],value:19},{cards:[card('a'),card('b')],value:18});
  const data={a:{chara:'A'},b:{chara:'B'}};
  const selected=diversifyBeam(ranked,ranked.slice(0,8),8,['A','B'],data);
  assert.equal(selected.length,8);assert.equal(selected[0],ranked[0]);
  for(const mask of [0,1,2,3])assert.ok(selected.some(row=>
    row.cards.reduce((value,card)=>value|(card.name==='a'?1:card.name==='b'?2:0),0)===mask));
});


test('five required owned identities can assign one identity to unified support',()=>{
  const input=fixture(); input.budget=0;
  input.roster=Object.values(catalog).filter(c=>c.rare==='SSR').slice(0,5).map(c=>({...clone(input.roster[0]),name:c.name}));
  input.requiredCards=input.roster.map(c=>c.name);
  input.supports=[{...clone(input.roster[2]),level:120,totsu:4}];
  assert.equal(variants.validateInput(input,catalog),null);
  const tasks=generation.buildTasks(input,catalog);
  const candidates=generation.generateCandidates(input,tasks[0],catalog);
  assert.ok(candidates.length);
  for(const candidate of candidates){
    assert.equal(candidate.cards.length,5);
    assert.equal(candidate.cards.filter(c=>c.support).length,1);
    assert.ok(variants.candidateIncludesRequired(input,candidate));
    assert.equal(candidate.cost,0);
  }
});

test('required owned card retains a task-fixed support through generation and refinement',async()=>{
  const input=fixture();input.budget=0;
  input.requiredCards=[input.roster[1].name];
  input.requiredCharacters=[catalog[input.roster[1].name].chara];
  const task={anchor:input.roster[0].name,totsu:0,cost:0,challenges:[],style:0,
    supportAnchor:input.supports[0].name,supportFirst:true};
  const candidates=generation.generateCandidates(input,task,catalog);
  assert.ok(candidates.length);
  for(const candidate of candidates){
    assert.equal(candidate.cards.length,5);
    assert.equal(candidate.cards.filter(card=>card.support).length,1);
    assert.equal(candidate.cards.find(card=>card.support).name,task.supportAnchor);
    assert.ok(candidate.cards.some(card=>!card.support&&card.name===input.requiredCards[0]));
  }
  const neighbors=await generation.generateNeighbors(input,candidates[0],catalog,new Set(),()=>false);
  assert.ok(neighbors.every(candidate=>candidate.cards.length===5&&candidate.cards.filter(card=>card.support).length===1));
});

test('required cards preserve an upgraded nonrequired anchor within the shared budget',()=>{
  const input=fixture(); input.budget=1;
  input.preset.title='通常試験';input.preset.specialChallenges=[];input.supports=[];
  input.roster=Object.values(catalog).filter(c=>c.rare==='SSR').slice(0,5).map(c=>({...clone(input.roster[0]),name:c.name,totsu:2}));
  input.requiredCards=[input.roster[0].name];
  const task={anchor:input.roster[1].name,totsu:3,cost:1,challenges:[],style:0};
  const candidates=generation.generateCandidates(input,task,catalog);
  assert.ok(candidates.length);
  for(const candidate of candidates){
    assert.ok(candidate.cards.some(c=>c.name===task.anchor&&c.totsu===3));
    assert.ok(variants.candidateIncludesRequired(input,candidate));
    assert.equal(candidate.cost,1);
    assert.equal(candidate.cards.length,5);
  }
});

test('required characters are satisfied during normal construction',()=>{
  const input=fixture(); input.preset.title='通常試験'; input.preset.specialChallenges=[]; input.supports=[];
  const cards=[...new Map(Object.values(catalog).filter(c=>c.rare==='SSR').map(c=>[c.chara,c])).values()].slice(0,5);
  input.roster=cards.map(c=>({...clone(input.roster[0]),name:c.name}));
  input.requiredCharacters=cards.map(c=>c.chara);
  assert.equal(variants.validateInput(input,catalog),null);
  const tasks=generation.buildTasks(input,catalog);
  const candidates=tasks.flatMap(task=>generation.generateCandidates(input,task,catalog));
  assert.ok(candidates.length);
  assert.ok(candidates.every(candidate=>variants.candidateIncludesRequired(input,candidate,catalog)));
});

test('required characters may be supplied by the unified support slot',()=>{
  const input=fixture();
  const ownedNames=new Set(input.roster.map(c=>c.name));
  const ownedCharacters=new Set(input.roster.map(c=>catalog[c.name].chara));
  const supportRaw=Object.values(catalog).find(c=>c.rare==='SSR'&&!ownedNames.has(c.name)&&!ownedCharacters.has(c.chara));
  input.supports=[{...clone(input.roster[0]),name:supportRaw.name}];
  input.requiredCharacters=[supportRaw.chara];
  assert.equal(variants.validateInput(input,catalog),null);
  const tasks=generation.buildTasks(input,catalog);
  const candidates=tasks.flatMap(task=>generation.generateCandidates(input,task,catalog));
  assert.ok(candidates.length);
  assert.ok(candidates.every(candidate=>candidate.cards.some(card=>card.support&&catalog[card.name].chara===supportRaw.chara)));
});

test('required characters accept any costume and reject incompatible fixed cards',()=>{
  const input=fixture();
  const byCharacter=new Map();
  for(const card of Object.values(catalog)) if(card.rare==='SSR') {
    const list=byCharacter.get(card.chara)??[]; list.push(card); byCharacter.set(card.chara,list);
  }
  const costumes=[...byCharacter.values()].find(list=>list.length>=2);
  assert.ok(costumes);
  input.requiredCharacters=[costumes[0].chara];
  input.roster=costumes.slice(0,2).map(card=>({...clone(input.roster[0]),name:card.name}));
  input.roster.push(...Object.values(catalog).filter(c=>c.rare==='SSR'&&!input.roster.some(r=>r.name===c.name)).slice(0,3)
    .map(card=>({...clone(input.roster[0]),name:card.name})));
  input.preset.title='通常試験'; input.preset.specialChallenges=[]; input.supports=[];
  assert.equal(variants.validateInput(input,catalog),null);
  assert.ok(generation.generateCandidates(input,generation.buildTasks(input,catalog)[0],catalog)
    .every(candidate=>variants.candidateIncludesRequired(input,candidate,catalog)));
  input.requiredCards=input.roster.map(card=>card.name);
  const incompatible=Object.values(catalog).find(card=>card.rare==='SSR'&&card.chara!==costumes[0].chara
    &&!input.roster.some(roster=>roster.name===card.name));
  input.requiredCharacters=[incompatible.chara];
  input.roster.push({...clone(input.roster[0]),name:incompatible.name});
  assert.equal(variants.validateInput(input,catalog),'required-characters-impossible');
});

test('coordinator sanitizes all restored islands before publishing fixed-card results',()=>{
  const {constrainCheckpoint}=load('src/domain/examSearch/requiredCheckpoint.ts');
  const input=fixture();input.requiredCards=[input.roster[0].name];
  const valid={candidate:{id:'valid',cards:[{name:input.requiredCards[0]}]}};
  const invalid={candidate:{id:'invalid',cards:[{name:'other'}]}};
  const child={pool:[invalid,valid],pending:[invalid,valid],finalists:[invalid,valid]};
  const checkpoint={...child,parallel:{baseNonce:'test',checkpoints:[child],owners:{valid:0,invalid:0}}};
  const sanitized=constrainCheckpoint(input,checkpoint);
  for(const state of [sanitized,...sanitized.parallel.checkpoints]){
    for(const field of ['pool','pending','finalists'])assert.deepEqual(state[field].map(r=>r.candidate.id),['valid']);
  }
  assert.deepEqual(clone(sanitized.parallel.owners),{valid:0});
  assert.deepEqual(clone(constrainCheckpoint({...input,requiredCards:[]},checkpoint)),clone(checkpoint));
});

test('coordinator enforces the level budget without fixed-card requirements in every restored island',()=>{
  const {constrainCheckpoint}=load('src/domain/examSearch/requiredCheckpoint.ts');
  const input={...fixture(),requiredCards:[],additionalLevelCap:5};
  const card=clone(variants.cardVariants(input.roster[0],'SSR')[0]);
  const result=(id,additionalLevels)=>({candidate:{id,cards:[{...card,level:card.level+additionalLevels,additionalLevels}]}});
  const valid=result('valid',5),overBudget=result('over-budget',10);
  const child={pool:[overBudget,valid],pending:[overBudget,valid],finalists:[overBudget,valid]};
  const checkpoint={...child,parallel:{baseNonce:'test',checkpoints:[child],owners:{valid:0,'over-budget':0}}};
  const before=clone(checkpoint);
  const sanitized=constrainCheckpoint(input,checkpoint,catalog);
  for(const state of [sanitized,...sanitized.parallel.checkpoints]){
    for(const field of ['pool','pending','finalists'])assert.deepEqual(clone(state[field]),[valid]);
  }
  assert.deepEqual(clone(sanitized.parallel.owners),{valid:0});
  assert.deepEqual(checkpoint,before);
});

const runProgress = phase => ({phase,generated:1,evaluated:1,tasksDone:1,tasksTotal:1,elapsedMs:1,results:[]});

test('session budget helper uses one idle continuation and publishes one final done',async()=>{
  let now=0;const calls=[],published=[];
  const session={run:async(duration,publish)=>{calls.push(duration);now+=1000;publish(runProgress('done'));}};
  const result=await runSessionWithinBudget(session,50000,p=>published.push(p),{now:()=>now,allowRepeat:true});
  assert.equal(result.passes,2);
  assert.deepEqual(calls,[50000,49000]);
  assert.deepEqual(published.map(p=>p.phase),['generate','done']);
});

test('session budget helper skips continuation when time is short or stop is requested',async()=>{
  for(const mode of ['short','stop']){
    let now=0,stopped=false,calls=0;const published=[];
    const session={run:async(_duration,publish)=>{calls++;now+=mode==='short'?6000:1000;if(mode==='stop')stopped=true;publish(runProgress('done'));}};
    const result=await runSessionWithinBudget(session,20000,p=>published.push(p),{
      now:()=>now,shouldStop:()=>stopped,allowRepeat:true,
    });
    assert.equal(result.passes,1,`${mode} must not restart`);
    assert.equal(calls,1);
    assert.deepEqual(published.map(p=>p.phase),['done']);
  }
});

test('session budget helper never repeats evaluation and keeps one pass',async()=>{
  let now=0,calls=0;const evaluatePublished=[];
  const session={run:async(_duration,publish)=>{calls++;now+=1000;publish(runProgress('done'));}};
  const evaluation=await runSessionWithinBudget(session,50000,p=>evaluatePublished.push(p),{
    now:()=>now,allowRepeat:false,
  });
  assert.equal(evaluation.passes,1);
  assert.equal(calls,1);
  assert.deepEqual(evaluatePublished.map(p=>p.phase),['done']);

  now=0;calls=0;const progressedPublished=[];
  const progressedSession={run:async(_duration,publish)=>{calls++;now+=1000;publish({...runProgress('done'),generated:calls,evaluated:calls});}};
  const progressed=await runSessionWithinBudget(progressedSession,50000,p=>progressedPublished.push(p),{now:()=>now,allowRepeat:true});
  assert.equal(progressed.passes,4,'progressing continuations use the finite deadline-derived cap');
  assert.equal(calls,4);
  assert.deepEqual(progressedPublished.map(p=>p.phase),['generate','generate','generate','done']);
});

test('session budget helper stops later continuations when terminal progress is unchanged',async()=>{
  let now=0,calls=0;const published=[];
  const session={run:async(_duration,publish)=>{calls++;now+=1000;publish({...runProgress('done'),generated:1,evaluated:1});}};
  const result=await runSessionWithinBudget(session,50000,p=>published.push(p),{now:()=>now,allowRepeat:true});
  assert.equal(result.passes,2,'the first continuation remains allowed, later stagnant passes stop');
  assert.equal(calls,2);
  assert.deepEqual(published.map(p=>p.phase),['generate','done']);
  assert.equal(published.filter(p=>p.phase==='done').length,1,'only one terminal is published');
});

test('session budget helper snapshots terminal progress across reused progress objects',async()=>{
  let now=0,calls=0;const published=[];const shared=runProgress('done');
  const session={run:async(duration,publish)=>{
    calls++;
    assert.equal(now+duration,70000,'every pass must use the same absolute deadline');
    now+=20000;
    shared.generated=4;
    shared.evaluated=calls;
    publish(shared);
  }};
  const result=await runSessionWithinBudget(session,70000,p=>published.push(p),{
    now:()=>now,allowRepeat:true,minimumRemainingMs:15000,
  });
  assert.equal(result.passes,3,'two progressing continuations fit before the 15 second threshold');
  assert.deepEqual(published.map(p=>p.phase),['generate','generate','done']);
  assert.equal(calls,3);
  assert.equal(published.filter(p=>p.phase==='done').length,1,'only the final terminal is published');
});

test('session budget helper does not restart when stop arrives during continuation publication',async()=>{
  let now=0,calls=0,stopped=false;const published=[];
  const session={run:async(_duration,publish)=>{calls++;now+=1000;publish(runProgress('done'));}};
  const result=await runSessionWithinBudget(session,50000,p=>{
    published.push(p);
    if(p.phase==='generate')stopped=true;
  },{now:()=>now,shouldStop:()=>stopped,allowRepeat:true});
  assert.equal(result.passes,1);
  assert.equal(calls,1);
  assert.deepEqual(published.map(p=>p.phase),['generate','done']);
});

const islandResult = (id, score, weight = 0) => ({
  candidate: { id, cards: [], challengeIds: [], cost: 0, policy: 'effects-tail', estimate: 0 },
  development: { scores: [score], retired: 0, turns: 1 },
  importance: { n: 1, successWeight: weight, observations: [{ score, weight }], upperScore: score },
  validation: { scores: [], retired: 0, turns: 0 }, validationTarget: 2048,
});

test('island count selection respects conservative core and memory caps',()=>{
  assert.equal(islands.chooseIslandCount(),1);
  assert.equal(islands.chooseIslandCount(2,32),1);
  assert.equal(islands.chooseIslandCount(4,4),2);
  assert.equal(islands.chooseIslandCount(8),3);
  assert.equal(islands.chooseIslandCount(8,7.9),2);
  assert.equal(islands.chooseIslandCount(8,2),1);
  assert.equal(islands.chooseIslandCount(16,15.9),3,'high cores alone retain the three-island path');
  assert.equal(islands.chooseIslandCount(16,16),6);
  assert.equal(islands.chooseIslandCount(32,32),6);
  assert.equal(islands.chooseIslandCount(undefined,32),1,'unknown cores do not opt into six islands');
  assert.equal(islands.chooseIslandCount(16,undefined),3,'unknown memory does not opt into six islands');
});

test('per-cost task partitions keep non-seed paths disjoint while covering each budget band',()=>{
  const tasks=[];
  for(const cost of [0,1,2])for(let ordinal=0;ordinal<3;ordinal++)
    tasks.push({anchor:`${cost}-${ordinal}`,totsu:0,cost,challenges:[],style:ordinal});
  tasks.push({anchor:'saved',totsu:0,cost:0,challenges:[],style:0,seedTeam:['a','b','c','d','e']});
  const parts=[0,1,2].map(islandIndex=>partitionGenerationTasks(tasks,{islandIndex,islandCount:3}));
  const ordinary=tasks.filter(task=>!task.seedTeam).map(task=>task.anchor);
  const union=parts.flatMap(rows=>rows.filter(task=>!task.seedTeam).map(task=>task.anchor));
  assert.deepEqual([...new Set(union)].sort(),ordinary.sort());
  assert.equal(union.length,ordinary.length,'non-seed tasks are assigned exactly once');
  for(const cost of [0,1,2])assert.deepEqual(parts.map(rows=>rows.filter(task=>task.cost===cost&&!task.seedTeam).length),[1,1,1]);
  assert.ok(parts.every(rows=>rows.some(task=>task.seedTeam&&task.anchor==='saved')),'explicit seed paths remain on every island');
});

test('six-island task partitions remain disjoint and complete by cost band',()=>{
  const tasks=[];
  for(const cost of [0,1,2,3])for(let ordinal=0;ordinal<12;ordinal++)
    tasks.push({anchor:`six-${cost}-${ordinal}`,totsu:0,cost,challenges:[],style:ordinal});
  const parts=Array.from({length:6},(_,islandIndex)=>partitionGenerationTasks(tasks,{islandIndex,islandCount:6}));
  const ordinary=tasks.map(task=>task.anchor).sort();
  const union=parts.flatMap(rows=>rows.map(task=>task.anchor));
  assert.deepEqual([...new Set(union)].sort(),ordinary);
  assert.equal(union.length,ordinary.length,'six islands assign each generated path exactly once');
  for(const cost of [0,1,2,3])assert.deepEqual(parts.map(rows=>rows.filter(task=>task.cost===cost).length),[2,2,2,2,2,2]);
});

test('count-one task partition preserves the original order and checkpoint partition wins on resume',()=>{
  const tasks=[{anchor:'a',totsu:0,cost:2,challenges:[],style:0},{anchor:'b',totsu:0,cost:0,challenges:[],style:1}];
  assert.deepEqual(clone(partitionGenerationTasks(tasks,{islandIndex:0,islandCount:1})),tasks);
  const checkpoint={cursor:0,seen:[],pool:[],finalists:[],pending:[],round:0,elapsed:0,trialSerial:0,nonce:'saved',partition:{islandIndex:2,islandCount:3}};
  const input=fixture();
  const engine={prepare:async()=>{},trial:()=>({score:0,retired:false,finishTurn:1})};
  const resumed=new SearchSession(input,catalog,engine,'new',checkpoint,{islandIndex:0,islandCount:1});
  assert.deepEqual(clone(resumed.checkpoint().partition),{islandIndex:2,islandCount:3});
  const single=new SearchSession(input,catalog,engine,'single',undefined,{islandIndex:0,islandCount:1});
  assert.deepEqual(clone(single.checkpoint().partition),{islandIndex:0,islandCount:1});
});

test('invalid task partitions are rejected before task generation',()=>{
  for(const partition of [{islandIndex:-1,islandCount:2},{islandIndex:2,islandCount:2},{islandIndex:0,islandCount:0},{islandIndex:0,islandCount:7},{islandIndex:1.5,islandCount:2}])
    assert.throws(()=>validateTaskPartition(partition),/Invalid task partition/);
});

test('wide initial screening is limited to the selected ATTACK island roles',()=>{
  const attack=fixture();attack.preset.kind='ATTACK';
  const basic=fixture();basic.preset.kind='BASIC';
  assert.equal(usesWideInitialScreen(attack,{islandIndex:2,islandCount:6}),true);
  assert.equal(usesWideInitialScreen(attack,{islandIndex:5,islandCount:6}),true);
  for(const islandIndex of [0,1,3,4])assert.equal(usesWideInitialScreen(attack,{islandIndex,islandCount:6}),false);
  assert.equal(usesWideInitialScreen(attack,{islandIndex:2,islandCount:3}),true);
  assert.equal(usesWideInitialScreen(attack,{islandIndex:0,islandCount:3}),false);
  assert.equal(usesWideInitialScreen(attack,{islandIndex:1,islandCount:2}),true);
  assert.equal(usesWideInitialScreen(attack,{islandIndex:0,islandCount:2}),false);
  assert.equal(usesWideInitialScreen(attack,{islandIndex:0,islandCount:1}),false);
  assert.equal(usesWideInitialScreen(basic,{islandIndex:2,islandCount:6}),false);
  basic.preset.kind='DEFENCE';
  assert.equal(usesWideInitialScreen(basic,{islandIndex:2,islandCount:6}),false);
});

test('wide ATTACK resumes pending discovery at eight ordinary trials without resetting it',async()=>{
  const runPending=async(kind,partition,constructorPartition=partition)=>{
    const input=fixture();input.preset.kind=kind;input.preset.specialChallenges=[];
    const wide=kind==='ATTACK'&&usesWideInitialScreen(input,partition),target=wide?8:32;
    const candidate={id:`pending-${kind}-${partition.islandIndex}`,cards:Array.from({length:5},(_,index)=>({name:`pending-card-${index}`,selectedMagic:[1,2]})),challengeIds:[],cost:0,policy:'effects-tail',estimate:0};
    const result={candidate,development:{scores:[1,2,3,4],retired:0,turns:4},validation:{scores:[],retired:0,turns:0},validationTarget:2048};
    if(wide) {
      result.criticalScout={attempted:4,score:0};
      result.importance={n:8,successWeight:0,observations:Array.from({length:8},()=>({score:0,weight:1})),upperScore:0};
    }
    let session,ordinary=0,scoutCalls=0,importanceCalls=0;
    const engine={prepare:async()=>{},scout:()=>{scoutCalls++;return {score:0,retired:false,finishTurn:4,forcedHits:0};},
      importanceTrial:()=>{importanceCalls++;return {score:0,weight:1};},
      trial:()=>{ordinary++;if(ordinary===target-4)session.stop();return {score:42000,retired:false,finishTurn:4};}};
    session=new SearchSession(input,catalog,engine,`pending-${kind}`,{
      cursor:0,seen:[candidate.id],pool:[],finalists:[],pending:[result],round:0,elapsed:0,trialSerial:0,nonce:`pending-${kind}`,partition,
    },constructorPartition);
    session.tasksReady=true;session.tasks=[];
    await session.run(1000,()=>{});
    return {checkpoint:session.checkpoint(),ordinary,scoutCalls,importanceCalls,target};
  };
  const wide=await runPending('ATTACK',{islandIndex:2,islandCount:6},{islandIndex:0,islandCount:1});
  assert.equal(wide.checkpoint.pending.length,0);
  assert.equal(wide.checkpoint.pool[0].development.scores.length,8,'wide completion must not wait for 32 ordinary scores');
  assert.equal(wide.ordinary,4,'resuming four pending scores adds exactly four ordinary trials');
  assert.equal(wide.scoutCalls,4,'wide resume adds only the four missing scout calls');
  assert.equal(wide.importanceCalls,8,'wide resume adds only the eight missing importance calls');
  assert.equal(wide.checkpoint.pool[0].criticalScout.attempted,8);
  assert.equal(wide.checkpoint.pool[0].importance.n,16);
  for(const kind of ['ATTACK','BASIC','DEFENCE']) {
    const regular=await runPending(kind,{islandIndex:0,islandCount:1});
    assert.equal(regular.checkpoint.pool[0].development.scores.length,32,`${kind} keeps the 32-trial initial completion`);
    assert.equal(regular.ordinary,28);
    if(kind==='DEFENCE')assert.equal(regular.scoutCalls,0);
    else assert.equal(regular.scoutCalls,32);
  }
});

test('wide task interleave spreads each cost quartile without moving seeds or changing costs',()=>{
  const tasks=[
    {anchor:'zero-0',totsu:0,cost:0,challenges:[],style:0},
    {anchor:'one-0',totsu:0,cost:1,challenges:[],style:0},
    {anchor:'seed',totsu:0,cost:0,challenges:[],style:0,seedTeam:['seed']},
    {anchor:'zero-1',totsu:0,cost:0,challenges:[],style:1},
    {anchor:'two-0',totsu:0,cost:2,challenges:[],style:0},
    {anchor:'zero-2',totsu:0,cost:0,challenges:[],style:2},
    {anchor:'seed-one',totsu:0,cost:1,challenges:[],style:0,seedTeam:['seed-one']},
    {anchor:'one-1',totsu:0,cost:1,challenges:[],style:1},
    {anchor:'zero-3',totsu:0,cost:0,challenges:[],style:3},
    {anchor:'zero-4',totsu:0,cost:0,challenges:[],style:4},
    {anchor:'one-2',totsu:0,cost:1,challenges:[],style:2},
    {anchor:'zero-5',totsu:0,cost:0,challenges:[],style:5},
    {anchor:'zero-6',totsu:0,cost:0,challenges:[],style:6},
  ];
  const snapshot=clone(tasks);
  const interleaved=interleaveWideCostTasks(tasks);
  assert.deepEqual(Array.from(interleaved,task=>task.cost),tasks.map(task=>task.cost));
  for(const index of [2,6])assert.strictEqual(interleaved[index],tasks[index],'seed positions stay fixed');
  assert.deepEqual(clone(tasks),snapshot,'helper must not mutate the input');
  assert.deepEqual([...new Set(Array.from(interleaved,task=>task.anchor))].sort(),[...new Set(tasks.map(task=>task.anchor))].sort());
  for(const task of tasks)assert.ok(interleaved.includes(task),'every output task must be an original object');
  assert.deepEqual(Array.from(interleaved,task=>task.anchor),Array.from(interleaveWideCostTasks(tasks),task=>task.anchor),'interleave is deterministic');
  const zero=Array.from(interleaved.filter(task=>task.cost===0&&!task.seedTeam),task=>task.anchor);
  assert.deepEqual(zero,['zero-0','zero-1','zero-3','zero-5','zero-2','zero-4','zero-6']);
  for(const length of [0,1,2,3]) {
    const short=Array.from({length},(_,index)=>({anchor:`short-${index}`,totsu:0,cost:3,challenges:[],style:index}));
    assert.deepEqual(Array.from(interleaveWideCostTasks(short),task=>task.anchor),short.map(task=>task.anchor));
  }
  assert.deepEqual(Array.from(interleaveWideCostTasks(tasks.map(task=>({...task,cost:task.cost+10}))),task=>task.anchor),
    Array.from(interleaveWideCostTasks(tasks),task=>task.anchor),'cost labels do not affect within-group order');
});

test('partition-aware task preparation uses the checkpoint partition for wide ordering',()=>{
  const input=fixture();input.preset.kind='ATTACK';
  const tasks=Array.from({length:8},(_,index)=>({anchor:`task-${index}`,totsu:0,cost:index%2,challenges:[],style:index}));
  const checkpoint={cursor:0,seen:[],pool:[],pending:[],finalists:[],round:0,elapsed:0,trialSerial:0,nonce:'wide-order',partition:{islandIndex:2,islandCount:6}};
  const restored=new SearchSession(input,catalog,{prepare:async()=>{},trial:()=>({score:0,retired:false,finishTurn:1})},'ignored',checkpoint,{islandIndex:0,islandCount:1});
  const rebuilt=prepareGenerationTasks(input,tasks,restored.checkpoint().partition);
  const deep=prepareGenerationTasks(input,tasks,{islandIndex:0,islandCount:1});
  assert.notDeepEqual(Array.from(rebuilt,task=>task.anchor),Array.from(deep,task=>task.anchor),'checkpoint island remains wide after resume');
  assert.deepEqual(Array.from(deep,task=>task.anchor),tasks.map(task=>task.anchor),'deep partition preserves original order');
});

test('island result merging chooses a stable owner without pooling scores or weights',()=>{
  const left=islandResult('same',41000,.1), right=islandResult('same',52000,.9);
  const merged=islands.mergeIslandResults([[left,islandResult('left',1)],[right,islandResult('right',2)]],{same:1});
  assert.equal(merged.results.find(r=>r.candidate.id==='same'),right);
  assert.deepEqual(clone(merged.owners),{same:1,left:0,right:1});
  assert.deepEqual(merged.results.find(r=>r.candidate.id==='same').development.scores,[52000]);
  const capped=islands.mergeIslandResults(Array.from({length:6},(_,island)=>Array.from({length:10},(_,index)=>islandResult(`${island}-${index}`,index))),{});
  assert.equal(capped.results.length,48,'six islands retain at most eight results each');
  const owner5=islands.mergeIslandResults(Array.from({length:6},(_,island)=>[islandResult('shared',100+island),islandResult(`owned-${island}`,island)]),{shared:5});
  assert.equal(owner5.results.find(result=>result.candidate.id==='shared').development.scores[0],105);
  assert.equal(owner5.owners.shared,5,'owner five survives six-island merging');
});

test('island progress aggregates counts and orders generate before validate or stop',()=>{
  const a={phase:'validate',generated:4,evaluated:3,tasksDone:2,tasksTotal:8,elapsedMs:90,results:[islandResult('same',1)]};
  const b={phase:'generate',generated:5,evaluated:6,tasksDone:1,tasksTotal:7,elapsedMs:120,results:[islandResult('same',2),islandResult('b',3)]};
  const aggregate=islands.aggregateIslandProgress([a,b],{same:0});
  assert.equal(aggregate.progress.phase,'generate');
  assert.deepEqual(clone(aggregate.progress),{phase:'generate',generated:9,evaluated:9,tasksDone:3,tasksTotal:15,elapsedMs:120,results:[a.results[0],b.results[1]]});
  assert.deepEqual(clone(aggregate.owners),{same:0,b:1});
  assert.equal(islands.aggregateIslandProgress([{...a,phase:'stopped'},undefined]).progress.phase,'stopped');
  const physical=islands.aggregateIslandProgress([undefined,undefined,{...b,phase:'validate'},a],{same:2});
  assert.equal(physical.owners.same,2,'undefined island slots retain physical owner indices');
  assert.equal(physical.progress.generated,9,'physical island slots are preserved through aggregation');
  const sixProgress=islands.aggregateIslandProgress(Array.from({length:7},(_,index)=>({...a,generated:index+1,results:[]})));
  assert.equal(sixProgress.progress.generated,21,'a seventh island is capped after the six-island limit');
  assert.equal(islands.aggregateIslandProgress([]).progress.phase,'generate');
});

test('parallel checkpoints flatten UI fields while preserving full island checkpoints',()=>{
  const child=(index,id)=>({cursor:index+1,seen:[`seen-${index}`,id],pool:[islandResult(`pool-${index}`,index)],finalists:[islandResult(id,100+index)],pending:[islandResult(`pending-${index}`,index)],round:index+1,elapsed:100+index,trialSerial:10+index,nonce:`island-${index}`,evaluatedCount:3+index,tasksTotal:8,mutationRound:index});
  const first=child(0,'same'),second=child(1,'same'),third=child(2,'third');
  const checkpoint=islands.createParallelCheckpoint([first,second,third],'base',{same:1},999);
  assert.equal(checkpoint.nonce,'base');
  assert.equal(checkpoint.cursor,6);assert.equal(checkpoint.trialSerial,33);assert.equal(checkpoint.evaluatedCount,12);assert.equal(checkpoint.tasksTotal,24);
  assert.equal(checkpoint.round,3);assert.equal(checkpoint.mutationRound,2);assert.equal(checkpoint.elapsed,999);
  assert.deepEqual(clone(checkpoint.pool),[]);assert.deepEqual(clone(checkpoint.pending),[]);assert.deepEqual(clone(checkpoint.seen),['seen-0','same','seen-1','seen-2','third']);
  assert.equal(checkpoint.finalists.find(r=>r.candidate.id==='same').development.scores[0],101,'previous owner result is retained whole');
  assert.equal(checkpoint.parallel.baseNonce,'base');assert.equal(checkpoint.parallel.checkpoints.length,3);assert.deepEqual(clone(checkpoint.parallel.owners),{same:1,third:2});
  assert.ok(checkpoint.parallel.checkpoints.every(child=>child.parallel===undefined),'children never contain nested parallel state');
});

test('six-island checkpoints preserve owner five and aggregate counters without pooling',()=>{
  const child=(index,id)=>({cursor:index+1,seen:[`six-seen-${index}`],pool:[],finalists:[islandResult(id,100+index)],pending:[],round:1,elapsed:10+index,trialSerial:2+index,nonce:`six-${index}`,evaluatedCount:4,tasksTotal:9,mutationRound:0,partition:{islandIndex:index,islandCount:6}});
  const children=Array.from({length:6},(_,index)=>child(index,index===5?'shared':`six-${index}`));
  const checkpoint=islands.createParallelCheckpoint(children,'six-base',{shared:5},77);
  assert.equal(checkpoint.cursor,21);assert.equal(checkpoint.trialSerial,27);assert.equal(checkpoint.evaluatedCount,24);assert.equal(checkpoint.tasksTotal,54);
  assert.equal(checkpoint.parallel.checkpoints.length,6);assert.equal(checkpoint.parallel.owners.shared,5);
  assert.equal(checkpoint.finalists.length,6);assert.equal(checkpoint.finalists.find(result=>result.candidate.id==='shared').development.scores[0],105);
});

test('importance upper quantile selects the largest score at the requested proposal probability',()=>{
  const observations=[{score:100,weight:.9},{score:90,weight:.8},{score:80,weight:.4},{score:70,weight:.1}];
  assert.equal(importance.importanceUpperQuantile(observations,.5),80);
});

test('importance upper quantile aggregates duplicate scores and keeps the proposal denominator',()=>{
  const observations=[{score:100,weight:.2},{score:100,weight:.3},{score:90,weight:.4}];
  assert.equal(importance.importanceUpperQuantile(observations,.15),100);
  assert.equal(importance.importanceUpperQuantile(observations,.2),90);
  assert.equal(importance.importanceUpperQuantile([{score:100,weight:.4},{score:50,weight:.8}],.3),50,
    'normalizing by total weight would incorrectly retain the rare high score');
});

test('importance upper quantile returns zero when no observed tail reaches the threshold and does not mutate input',()=>{
  const observations=[{score:100,weight:.1},{score:80,weight:.2}];
  const before=clone(observations);
  assert.equal(importance.importanceUpperQuantile(observations,.2),0);
  assert.deepEqual(observations,before);
  assert.equal(importance.importanceUpperQuantile([],Number.NaN),0);
  assert.equal(importance.importanceUpperQuantile([{score:100,weight:1}],Number.NaN),0);
  assert.equal(importance.importanceUpperQuantile([{score:100,weight:Number.NaN}],.1),0);
});

test('critical importance weights recover every adaptive path including early finishes',()=>{
  const {criticalProposal}=load('src/utils/criticalRates.ts');
  let total=0,success=0;
  const visit=(path,proposalMass,weight)=>{
    if(path.length===3||path.filter(Boolean).length===2){
      total+=proposalMass*weight;
      if(path.filter(Boolean).length===2)success+=proposalMass*weight;
      return;
    }
    const p=path.length===0?.191:path[0]?.333:.5;
    const q=criticalProposal(p);
    for(const hit of [false,true])visit([...path,hit],proposalMass*(hit?q.proposal:1-q.proposal),weight*q.weight(hit));
  };
  visit([],1,1);
  assert.ok(Math.abs(total-1)<1e-12);
  const expected=.191*(1-(1-.333)**2)+(1-.191)*.5**2;
  assert.ok(Math.abs(success-expected)<1e-12);
  for(const p of [0,1])assert.equal(criticalProposal(p).weight(p===1),1);
});

test('pair spending includes attacks used now and future partners lost',()=>{
  const spells=['a1','a2','b1','b2','c1','c2'];
  const edges=new Set(['a2|b1','a2|b2','b2|c1','b2|c2','a1|c2','a2|c2']);
  const opportunity=policy.createPairSpend(spells,(a,b)=>Number(edges.has([a,b].sort().join('|'))));
  const full=opportunity(spells);
  assert.equal(full(['a2','b1']),1);
  assert.equal(full(['a1','b1']),1,'another matching can still recover two DUOs');
  assert.equal(full(['a2','b2']),2);
  assert.equal(opportunity(['a1','b2','c1','c2'])(['b2','c1']),1);
  assert.equal(full(['a2','b1']),1,'cached subsets do not change another observation');
  const mutual=policy.createPairSpend(['a','b','c','d'],(a,b)=>a!==b&&['a','b'].includes(a)&&['a','b'].includes(b)?2:0);
  assert.equal(mutual(['a','b','c','d'])(['a','c']),2);
});

test('pairing value finds a disjoint maximum matching across ten distinct magic ids',()=>{
  const greedyTrap=new Map([
    ['a|b',10],['c|d',1],['a|c',6],['b|d',6],
  ]);
  const value=policy.createPairingValue(['a','b','c','d'],(a,b)=>greedyTrap.get(`${a}|${b}`)??0);
  assert.equal(value(['a','b','c','d']),12,'the DP must choose a-c plus b-d instead of greedy a-b plus c-d');

  const sameCardMagic=['0-M1','0-M2','1-M1','1-M2'];
  const noReuse=policy.createPairingValue(sameCardMagic,(a,b)=>new Set(['0-M1|0-M2','0-M1|1-M1','0-M2|1-M1']).has(`${a}|${b}`)?9:0);
  assert.equal(noReuse(sameCardMagic),9,'one magic id cannot contribute to two pairs');

  const ten=Array.from({length:10},(_,i)=>String(i));
  assert.equal(policy.createPairingValue(ten,()=>1)(ten),5,'ten magic ids must be consumed by five disjoint pairs');
  assert.equal(policy.createPairingValue(['a','b','c'],()=>4)(['a','b','c'],1),4,'odd partial inputs remain legal for the existing DP API');
});

test('paired mean applies current-pair immunity before critical and matches both orientations',()=>{
  const damage=(_spell,_partner,stats)=>stats.atkRate+stats.damageRate+stats.critical;
  const spells=[
    {id:'0-M3',owner:0,effects:[{kind:'immunity',target:'self'}]},
    {id:'1-M3',owner:1,critical:.5,effects:[{kind:'critical',value:.5,target:'allySelected'}]},
  ];
  assert.equal(pairedMean.orderedPairMean(spells,'0-M3','1-M3',true,damage),1);
  assert.equal(pairedMean.orderedPairMean(spells,'1-M3','0-M3',true,damage),.5);
  assert.equal(pairedMean.maxPairedMean(spells,true,damage),1);
});

test('paired mean keeps same-owner magic rows separate while matching each spell once',()=>{
  const spells=Array.from({length:10},(_,i)=>({id:`${Math.floor(i/2)}-M${i%2+1}`,owner:Math.floor(i/2)}));
  const value=pairedMean.maxPairedMean(spells,false,(spell,partner)=>spell.id===partner.id?100:1);
  assert.equal(value,10,'ten distinct magic ids form five disjoint pairs without self-reuse');
  const sameOwner=pairedMean.orderedPairMean(
    [{id:'0-M1',owner:0,effects:[{kind:'atk',value:10,target:'allySelected'}]},{id:'0-M2',owner:0}],
    '0-M1','0-M2',false,(_spell,_partner,stats)=>stats.atkRate,
  );
  assert.equal(sameOwner,20,'ally-selected effects are deduplicated by owner for same-card magic pairs');
});

test('paired mean ignores an unselected immunity magic and applies selected long effects only in the pair',()=>{
  const damage=(_spell,_partner,stats)=>stats.damageRate+stats.critical;
  const spells=[
    {id:'0-M2',owner:0,effects:[]},
    {id:'0-M3',owner:0,effects:[{kind:'immunity',target:'self'}]},
    {id:'1-M3',owner:1,effects:[{kind:'critical',value:1,target:'allySelected'}]},
    {id:'2-M1',owner:2,effects:[{kind:'damage',value:4,duration:3,target:'self'}]},
  ];
  assert.equal(pairedMean.orderedPairMean(spells,'0-M2','1-M3',true,damage),0,
    'an unselected M3 immunity cannot protect the selected M2/partner pair');
  assert.equal(pairedMean.orderedPairMean(spells,'0-M3','1-M3',true,damage),1,
    'a selected immunity spell protects the paired critical effect');
  assert.equal(pairedMean.orderedPairMean(spells,'2-M1','1-M3',false,damage),6,
    'a duration-three effect applies to the current pair without being carried elsewhere');
});

test('attack DUO policy preserves future partners but still takes the best scored finish',()=>{
  const pair=(ids,damage,futureDamageSpent,projectedScore)=>({ids,damage,firstDamage:damage/2,duo:0,heal:0,utility:0,defense:0,finisherUsed:false,futureDamageSpent,projectedScore});
  const observation={turn:2,kind:'ATTACK',enemyHp:100000,playerHp:50000,maxHp:60000,
    pairs:[pair(['a','b'],45000,60000),pair(['c','d'],30000,31000)]};
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects-duo')),['c','d']);
  observation.enemyHp=20000;observation.pairs[0].projectedScore=49000;observation.pairs[1].projectedScore=48000;
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects-duo')),['a','b']);
});

test('a four-turn pair budget can leave the two weakest spells unused',()=>{
  const spells=Array.from({length:10},(_,i)=>String(i));
  const spend=policy.createPairSpend(spells,(a,b)=>a===b?0:20-Number(a)-Number(b))(spells,4);
  assert.equal(spend(['8','9']),7,'using weak spells also consumes a turn needed by stronger ones');
  assert.equal(spend(['0','1']),19);
});

test('neutral magic base damage uses the same 1.1 power adjustment as the battle engine',()=>{
  const input=fixture();input.preset.kind='ATTACK';input.preset.enemyElement='無';input.preset.specialChallenges=[];
  const card=variants.cardVariants(input.roster[0],'SSR')[0],data=clone(catalog),raw=data[card.name];
  raw.duo='';raw.etc='';
  for(const i of [1,2,3]) {
    raw['buddy'+i+'c']='';raw['buddy'+i+'s']='';raw['buddy'+i+'s_totsu']='';
    for(const key of ['buf','heal','etc'])raw['magic'+i+key]='';
    raw['magic'+i+'pow']='単発(強)';raw['magic'+i+'atr']='火';
  }
  const task={anchor:card.name,totsu:card.totsu,cost:0,challenges:[],style:0};
  const calc=load('src/utils/calculations.ts');
  const attack=calc.recalculateATK(raw,card.level,card.totsu===4);
  const hp=calc.recalculateHP(raw,card.level,card.totsu===4);
  const damage=card.selectedMagic.reduce((sum,m)=>sum+attack*calc.magicDict['単発(強)Lv'+card.magicLevels[m-1]],0);
  assert.ok(Math.abs(generation.createEstimator(input,task,data)([card])-(damage+hp*.15))<1e-6);
  for(const i of [1,2,3])raw['magic'+i+'atr']='無';
  assert.ok(Math.abs(generation.createEstimator(input,task,data)([card])-(damage*1.1+hp*.15))<1e-6);
});

test('DF preparation credits only healing ticks before the fifth-turn finish and after curse removal',()=>{
  const entries=[{cardIndex:0,rate:.25,turns:3}];
  assert.equal(policy.remainingContinuousHealing(entries,2,()=>16000,()=>false),12000);
  assert.equal(policy.remainingContinuousHealing(entries,4,()=>16000,()=>false),4000);
  assert.equal(policy.remainingContinuousHealing(entries,5,()=>16000,()=>false),0);
  assert.equal(policy.remainingContinuousHealing(entries,2,()=>16000,()=>true),0);
});

test('critical-tail forecasts respect attainable hit probabilities without inventing guaranteed criticals',()=>{
  const {criticalTailMultiplier:factor}=load('src/utils/criticalRates.ts');
  assert.equal(factor(0,3,.0017),1);
  assert.equal(factor(1,3,.99),1.25);
  assert.equal(factor(.191,3,.0017),1.25);
  assert.equal(factor(.191,3,.01),1+0.25*2/3);
  assert.equal(factor(.1,3,.0017),1+0.25*2/3);
  assert.equal(factor(.1,1,.11),1);
});

test('previous search seeds reuse only card names for the same exam, including after engine updates', () => {
  const storage=load('src/storage/examSearchStorage.ts');
  const key='twst-exam-resource-search-v1-session',names=['a','b','c','d','e'];
  const candidate={cards:names.map(name=>({name,level:120,totsu:4})),preferredPlan:[['0-M1','1-M1']]};
  localStorage.setItem(key,JSON.stringify({version:'old-engine',input:{preset:{id:'exam-a'}},checkpoint:{finalists:[{candidate},{candidate},{candidate:{cards:[{name:null}]}}]}}));
  assert.equal(storage.loadSearchSession(),null,'old statistical checkpoints must stay invalid');
  assert.deepEqual(clone(storage.loadSearchSeedTeams('exam-a')),[names]);
  assert.deepEqual(clone(storage.loadSearchSeedTeams('exam-b')),[]);
  storedValues.delete(key);
});
function fixture() {
  const names = Object.values(catalog).filter(c => c.rare === 'SSR').slice(0, 5).map(c => c.name);
  const card = name => ({ name, totsu: 0, level: 80, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true });
  const preset = clone(examPresetDefinitions.find(p => p.specialChallenges?.length));
  preset.difficulty = 1.5;
  return { preset, roster: names.slice(0, 4).map(card), supports: [card(names[0])], budget: 3, itemsPerLimitBreak: 1,
    target: 45000, attempts: 30, desiredProbability: .8, tolerance: 500, challengeLocks: {}, maxRemoved: 1 };
}
test('challenge sets preserve locks and allow no special challenges', () => {
  const input = fixture(), ids = input.preset.specialChallenges.map(c => c.id);
  assert.equal(variants.challengeVariants(input).length, 7);
  input.maxRemoved = 2;
  assert.equal(variants.challengeVariants(input).length, 22);
  input.challengeLocks = { [ids[0]]: 'on', [ids[1]]: 'off' };
  for (const set of variants.challengeVariants(input)) { assert.ok(set.includes(ids[0])); assert.ok(!set.includes(ids[1])); }
  input.challengeLocks = Object.fromEntries(ids.slice(1).map(id => [id, 'off']));
  assert.deepEqual(clone(variants.challengeVariants(input)), [[ids[0]], []]);
  input.challengeLocks[ids[0]] = 'off';
  assert.deepEqual(clone(variants.challengeVariants(input)), [[]]);
  assert.equal(variants.validateInput(input, catalog), null);
  const tasks = generation.buildTasks(input, catalog);
  assert.ok(tasks.length > 0);
  assert.ok(tasks.every(task => task.challenges.length === 0));
  const candidates = generation.generateCandidates(input, tasks[0], catalog);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.every(candidate => candidate.cards.length === 5));
});
test('0 -> 3 is directly enumerated; costs and M3 unlocking are enforced', () => {
  const input = fixture(), card = input.roster[0];
  assert.deepEqual(clone(variants.upgradeTargets(card, 'SSR', 6, 2)), [1, 2, 3]);
  assert.equal(variants.cardVariants(card, 'SSR', false, 2).length, 1);
  assert.equal(variants.cardVariants(card, 'SSR', false, 3).length, 3);
  assert.equal(variants.cardVariants(card, 'SR', false, 3).length, 1);
  const tasks = generation.buildTasks(input, catalog);
  assert.deepEqual(clone(tasks.slice(0, 4).map(t => t.cost)), [0, 1, 2, 3]);
});
test('generated decks preserve roster, budget, support role and legal spells', () => {
  const input = fixture(), before = JSON.stringify(input);
  const task = generation.buildTasks(input, catalog).find(t => t.cost === 3);
  const candidates = generation.generateCandidates(input, task, catalog);
  assert.ok(candidates.length);
  for (const c of candidates) {
    assert.equal(c.cards.length, 5);
    const own = c.cards.filter(c => !c.support), support = c.cards.filter(c => c.support);
    assert.equal(new Set(own.map(c => c.name)).size, 4);
    assert.equal(support.length, 1);
    assert.equal(support[0].totsu, 0);
    assert.equal(c.cost, 3);
    assert.equal(own.filter(c => c.totsu !== c.originalTotsu).length, 1);
    for (const card of c.cards) {
      assert.equal(card.selectedMagic.length, 2);
      if (card.selectedMagic.includes(3)) assert.ok(card.totsu >= 3);
    }
  }
  assert.equal(JSON.stringify(input), before);
});
test('probability includes zero-score attempts and keeps uncertain intervals', () => {
  const m = stats.metrics({ scores: [0, 50000, 0, 40000], retired: 2, turns: 8 }, 45000, 1);
  assert.equal(m.p, .25);
  assert.ok(m.low < .25 && m.high > .25);
  assert.ok(Math.abs(stats.reachProbability(.1, 30) - .9576088417247838) < 1e-12);
  const zero = stats.metrics({ scores: Array(64).fill(0) }, 45000, 30);
  assert.ok(zero.high > 0);
});
test('equivalent results prefer fewer items, and incomplete samples are not certified', () => {
  const base = { development: { scores: [50000] }, validation: { scores: Array(512).fill(50000) }, validationTarget: 512 };
  const result = cost => ({ ...base, candidate: { cost } });
  assert.deepEqual(clone(stats.rankedResults([result(3), result(1), result(0)], 45000, 30, .8).map(r => r.candidate.cost)), [0, 1, 3]);
  const incomplete = { ...result(1), validation: { scores: [50000] } };
  assert.equal(stats.rankedResults([incomplete, result(3)], 45000, 30, .8)[0].candidate.cost, 3);
});
test('new M3 can enter the generated team directly without incremental success', () => {
  const input = fixture(), custom = clone(catalog), anchor = input.roster[0];
  input.preset.enemyElement = '木'; input.preset.kind = 'ATTACK';
  Object.assign(custom[anchor.name], { magic1atr: '水', magic2atr: '水', magic3atr: '火', magic3pow: '3連撃(強)' });
  const task = generation.buildTasks(input, custom).find(t => t.anchor === anchor.name && t.totsu === 3);
  const candidates = generation.generateCandidates(input, task, custom);
  assert.ok(candidates.some(c => c.cards.some(card => !card.support && card.name === anchor.name && card.selectedMagic.includes(3))));
});

test('automatic challenges keep full-challenge exploration alongside easier variants',()=>{
  const input=fixture();
  const tasks=generation.buildTasks(input,catalog);
  const regular=tasks.filter(task=>!task.duoChain);
  const ids=input.preset.specialChallenges.map(c=>c.id);
  for(const cost of new Set(regular.map(task=>task.cost))) {
    const lane=regular.filter(task=>task.cost===cost&&!task.supportAnchor);
    for(let i=0;i<Math.min(8,lane.length);i+=2)assert.deepEqual(clone(lane[i].challenges),ids);
    assert.ok(lane.some(task=>task.challenges.length<ids.length));
  }
  const expected=input.roster.reduce((sum,card)=>sum+1+variants.upgradeTargets(card,catalog[card.name].rare,input.budget,input.itemsPerLimitBreak).length,0)
    *variants.challengeVariants(input).length*2;
  assert.equal(regular.filter(task=>!task.supportAnchor).length,expected,'support paths must not remove legal owned-anchor tasks');
  assert.ok(tasks.filter(task=>task.supportAnchor).every(task=>task.challenges.length===ids.length));
  assert.equal(new Set(tasks.map(task=>JSON.stringify(task))).size,tasks.length);
});

test('task preparation yields for cancellation and preserves the synchronous task order', async () => {
  const input=fixture();
  assert.deepEqual(clone(await generation.buildTasksAsync(input,catalog,()=>false)),clone(generation.buildTasks(input,catalog)));
  const large=fixture();
  large.roster=Object.values(catalog).filter(card=>card.rare==='SSR').slice(0,100)
    .map(card=>({...large.roster[0],name:card.name}));
  let stopped=false;
  const timer=setTimeout(()=>{stopped=true;},0);
  try {
    const result=await generation.buildTasksAsync(large,catalog,()=>stopped);
    assert.equal(result,undefined,'a queued stop must run before preparation completes');
  } finally {clearTimeout(timer);}
});

test('saved teams seed exploration using registered training without restricting the full pool', () => {
  const input=fixture();
  input.seedTeams=[[...input.roster.map(c=>c.name),input.supports[0].name],['unknown','b','c','d','e']];
  const tasks=generation.buildTasks(input,catalog);
  assert.ok(tasks.some(t=>!t.seedTeam));
  assert.ok(tasks.some(t=>t.seedTeam&&t.cost===3));
  assert.deepEqual([...new Set(tasks.filter(t=>t.seedTeam).slice(0,4).map(t=>t.cost))].sort(),[0,1,2,3],
    'cached teams must try the M3 unlock before exhausting cheaper upgrades');
  const task=tasks.find(t=>t.seedTeam&&t.cost===0);
  const result=generation.generateCandidates(input,task,catalog);
  assert.ok(result.length);
  for(const candidate of result)for(const card of candidate.cards) {
    const source=(card.support?input.supports:input.roster).find(c=>c.name===card.name);
    assert.equal(card.level,source.level);
    assert.equal(card.totsu,source.totsu);
  }
});

test('a discovered upgrade is checked at lower cost with only legal spells and plans', () => {
  const input=fixture();
  const cards=input.roster.map(c=>variants.cardVariants(c,'SSR')[0]);
  cards[0]=variants.cardVariants(input.roster[0],'SSR',false,3)[1];
  cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const parent={id:'upgrade',cards,cost:3,policy:'effects',estimate:1,challengeIds:[],preferredPlan:[['0-M3','1-M1']]};
  const reduced=variants.lowerCostCandidates(input,parent,catalog);
  assert.deepEqual(clone(reduced.map(c=>c.cost)),[0,1,2]);
  assert.ok(reduced.every(c=>!c.cards[0].selectedMagic.includes(3)&&!c.preferredPlan));
  assert.ok(reduced.every(c=>JSON.parse(c.id).length===3&&!c.id.includes('null')),
    'an illegal plan must use the same canonical ID as an ordinary no-plan candidate');
  parent.preferredPlan=[['0-M1','1-M1']];
  parent.preferredPlanMode='priority';
  const unusedM3=variants.lowerCostCandidates(input,parent,catalog);
  assert.ok(unusedM3.every(c=>c.preferredPlanMode==='priority'));
  assert.ok(unusedM3.every(c=>JSON.stringify(c.preferredPlan)===JSON.stringify(parent.preferredPlan)),
    'removing M3 preserves a plan that only uses the remaining spells');
  assert.ok(unusedM3.every(c=>JSON.parse(c.id).length===5&&!c.id.includes('null')),
    'a legal plan keeps its plan and mode in the candidate ID');
  parent.preferredPlan=[['0-M3','1-M1']];
  input.roster[0].totsu=3;
  parent.cards[0]=variants.cardVariants(input.roster[0],'SSR',false,4)[1];
  parent.cost=1;
  const unchangedSpells=variants.lowerCostCandidates(input,parent,catalog).find(c=>c.cards[0].selectedMagic.includes(3)&&c.cards[0].selectedMagic.includes(1));
  assert.equal(unchangedSpells.cost,0);
  assert.deepEqual(clone(unchangedSpells.preferredPlan),parent.preferredPlan);
});

test('every additional limit break raises the proposed level without altering the registered card', () => {
  const card=fixture().roster[0];
  assert.ok(variants.upgradeTargets(card,'SSR',3,1).includes(1));
  assert.equal(variants.cardVariants(card,'SSR',false,1)[0].level,85);
  assert.equal(card.level,80);
  assert.ok(variants.searchCardVariants(card,'SSR',false,3).some(c=>!c.selectedMagic.includes(3)&&c.level===95));
  assert.equal(variants.cardVariants({...card,level:118,totsu:3},'SSR',false,4)[0].level,120);
  assert.equal(variants.cardVariants(card,'SSR',true,4)[0].level,80);
  assert.equal(variants.searchCardVariants({...card,totsu:3},'SSR').length,3,'existing 3-break cards retain all legal spell pairs');
});

test('an M3 breakthrough gets an early task even below the strongest card in absolute power',()=>{
  const input=fixture(),custom=clone(catalog),[strong,breakthrough]=input.roster;
  input.preset={...input.preset,title:'通常試験',kind:'ATTACK',enemyElement:'無',specialChallenges:[]};
  input.supports=[];input.roster=[{...strong,level:110,totsu:1},{...breakthrough,level:80,totsu:1}];
  input.budget=2;input.challengeLocks={};
  for(const [index,card] of input.roster.entries()){
    const raw=custom[card.name];raw.originalMaxATK=index?12000:40000;raw.base_atk=0;raw.etc='';raw.duo='';
    for(const m of [1,2,3]){raw[`magic${m}atr`]='無';raw[`magic${m}pow`]='単発(弱)';raw[`magic${m}buf`]='';raw[`magic${m}heal`]='';
      raw[`buddy${m}c`]='';raw[`buddy${m}s`]='';raw[`buddy${m}s_totsu`]='';}
  }
  custom[breakthrough.name].magic3pow='3連撃(弱)';
  custom[breakthrough.name].etc='ATKUP(大)(自/1T)(M3)';
  const task={anchor:strong.name,totsu:3,cost:2,challenges:[],style:0};
  const estimate=generation.createEstimator(input,task,custom);
  const strength=c=>Math.max(...variants.cardVariants(c,'SSR',false,3).map(v=>estimate([v])));
  assert.ok(strength(input.roster[0])>strength(input.roster[1]));
  assert.equal(generation.buildTasks(input,custom).find(t=>t.cost===2).anchor,breakthrough.name);
});

test('large confirmations save losslessly within a storage quota and keep legacy sessions readable',async()=>{
  const storage=load('src/storage/examSearchStorage.ts'),input=fixture();
  const {ENGINE_VERSION}=load('src/domain/examSearch/types.ts');
  const candidate=generation.generateCandidates(input,generation.buildTasks(input,catalog)[0],catalog)[0];
  let random=1729;
  const finalists=Array.from({length:8},(_,index)=>({candidate:{...clone(candidate),id:'saved-'+index},
    development:{scores:[0,45000],retired:1,turns:9},validationTarget:131072,
    validationBest:{seed:'独立検証:'+index,score:71999},
    validation:{scores:Array.from({length:131072},()=>{
      random^=random<<13;random^=random>>>17;random^=random<<5;
      return 40000+(random>>>0)%32000;
    }),retired:0,turns:524288}}));
  const value={input,version:ENGINE_VERSION,catalogVersion:'test-catalog',checkpoint:{cursor:12,seen:[],pool:[],pending:[],finalists,
    round:2,elapsed:180000,trialSerial:900000,nonce:'保存テスト'}};
  const raw=JSON.stringify(value),serialized=storage.serializeSearchSession(value);
  assert.ok(raw.length>5*1024*1024,'uncompressed confirmations exceed ordinary storage limits');
  assert.ok(serialized.length<2.5*1024*1024,'leave capacity for the separate hand collection');
  const set=localStorage.setItem;
  try {
    localStorage.setItem=(key,text)=>{if(text.length>2.5*1024*1024)throw Error('quota');set(key,text);};
    assert.equal(await storage.saveSearchSession(value,serialized),true);
    assert.deepEqual(clone(storage.loadSearchSession()),value,'all score order, plans and replay seeds survive compression');
    assert.ok(storage.loadSearchSeedTeams(input.preset.id).length>0);
    const saved=storedValues.get('twst-exam-resource-search-v1-session');
    localStorage.setItem=()=>{throw Error('quota');};
    assert.equal(await storage.saveSearchSession(value,serialized),false);
    assert.equal(storedValues.get('twst-exam-resource-search-v1-session'),saved,'failed saves preserve the previous checkpoint');
  }finally{localStorage.setItem=set;}
  storedValues.set('twst-exam-resource-search-v1-session',JSON.stringify({...value,checkpoint:{...value.checkpoint,finalists:[]}}));
  assert.equal(storage.loadSearchSession().checkpoint.cursor,12,'old uncompressed checkpoints remain readable');
  storedValues.set('twst-exam-resource-search-v1-session',JSON.stringify({version:ENGINE_VERSION,checkpointEncoding:'lz-utf16-v1',checkpointLz:'broken'}));
  assert.equal(storage.loadSearchSession(),null,'corrupt compressed data must not be resumed');
});

test('parallel checkpoints survive compressed session serialization with stable owners',()=>{
  const storage=load('src/storage/examSearchStorage.ts'),input=fixture();
  const result=islandResult('parallel-card',47000,.25);
  const child=(index)=>({cursor:index,seen:[`seen-${index}`],pool:[],finalists:[{...clone(result),candidate:{...clone(result.candidate),id:index?'parallel-card':`island-${index}`}}],pending:[],round:index,elapsed:index*10,trialSerial:index,nonce:`island-${index}`,evaluatedCount:index,tasksTotal:4});
  const checkpoint=islands.createParallelCheckpoint([child(0),child(1)],'parallel-base');
  const value={input,version:load('src/domain/examSearch/types.ts').ENGINE_VERSION,catalogVersion:'test-catalog',checkpoint};
  const serialized=storage.serializeSearchSession(value);
  storedValues.set('twst-exam-resource-search-v1-session',serialized);
  const loaded=storage.loadSearchSession();
  assert.deepEqual(clone(loaded.checkpoint.parallel),clone(checkpoint.parallel));
  assert.equal(loaded.checkpoint.finalists.find(r=>r.candidate.id==='parallel-card').development.scores[0],47000);
  assert.ok(loaded.checkpoint.parallel.checkpoints.every(child=>child.parallel===undefined));
});

test('real 109, 110 and 114 checkpoints report UTF-16 serialization size without truncation',()=>{
  const storage=load('src/storage/examSearchStorage.ts'),version=load('src/domain/examSearch/types.ts').ENGINE_VERSION;
  const files=['109','110','114'].map(version=>path.join(root,`tests/fixtures/exam18-inflight-exam-resource-search-${version}-BASIC-木.json`));
  if(!files.every(file=>fs.existsSync(file)))return;
  const serializedSizes=files.map(file=>{
    const source=JSON.parse(fs.readFileSync(file,'utf8'));
    const serialized=storage.serializeSearchSession({input:source.input,version,catalogVersion:`diagnostic-${path.basename(file)}`,checkpoint:source.checkpoint});
    return serialized.length*2;
  });
  assert.equal(new Set(serializedSizes).size,3,'each real checkpoint remains a distinct diagnostic input');
  const largest=Math.max(...serializedSizes);
  if(largest>4*1024*1024)console.warn(`Parallel checkpoint diagnostic exceeds 4 MiB UTF-16: ${largest}`);
  assert.ok(largest>0);
});

test('saved BASIC teams retain both critical setup and direct-damage spell configurations',()=>{
  const input=fixture();input.preset=clone(examPresetDefinitions.find(p=>p.title.includes('18')&&p.kind==='BASIC'&&p.enemyElement==='木'));
  input.roster=[['rook_dormitory',110,4],['epel_dormitory',110,4],['lilia_birth4',84,0],['vil_scary',87,0]]
    .map(([name,level,totsu])=>({...input.roster[0],name,level,totsu}));
  input.supports=[{...input.roster[0],name:'idia_Guardian_of_the_Underworld',level:120,totsu:4}];
  const task={anchor:'lilia_birth4',totsu:3,cost:3,style:0,challenges:input.preset.specialChallenges.map(c=>c.id),
    seedTeam:[...input.roster.map(c=>c.name),input.supports[0].name]};
  const candidates=generation.generateCandidates(input,task,catalog);
  assert.ok(candidates.every(c=>c.policy==='effects-tail'));
  assert.ok(candidates.some(c=>c.cards.at(-1).selectedMagic.includes(1)));
  assert.ok(candidates.some(c=>c.cards.at(-1).selectedMagic.includes(3)),JSON.stringify(candidates.map(c=>c.cards.map(c=>[c.name,c.selectedMagic]))));
  assert.ok(candidates.every(c=>c.cards.find(c=>c.name==='lilia_birth4').level===99));
});

test('saved DF loadouts retain advantageous spells alongside speculative evasion configurations',()=>{
  const regression=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/exam-search-level-replay-regressions.json'),'utf8')).find(r=>r.input.preset.kind==='DEFENCE');
  const upgraded=regression.candidate.cards.find(c=>!c.support&&c.totsu>c.originalTotsu);
  const task={anchor:upgraded.name,totsu:upgraded.totsu,cost:regression.candidate.cost,style:0,
    challenges:regression.candidate.challengeIds,seedTeam:regression.candidate.cards.map(c=>c.name)};
  const input={...fixture(),...regression.input,
    roster:regression.candidate.cards.filter(c=>!c.support).map(c=>({...c,level:c.level-5*(c.totsu-c.originalTotsu),totsu:c.originalTotsu})),
    supports:regression.candidate.cards.filter(c=>c.support)};
  const candidates=generation.generateCandidates(input,task,catalog);
  const key=cards=>cards.map(c=>`${c.name}:${c.selectedMagic.join(',')}`).sort().join('|');
  assert.ok(candidates.some(c=>key(c.cards)===key(regression.candidate.cards)),
    JSON.stringify(candidates.map(c=>c.cards.map(c=>[c.name,c.selectedMagic]))));
});

test('anchor ordering is independent of collection display order and preserves every upgrade target', () => {
  const input = fixture();
  const tasks = clone(generation.buildTasks(input,catalog));
  const reversed = clone(generation.buildTasks({...input,roster:[...input.roster].reverse()},catalog));
  assert.deepEqual(tasks,reversed);
  assert.deepEqual([...new Set(tasks.slice(0,4).map(t=>t.cost))].sort(),[0,1,2,3]);
  for(const card of input.roster) for(const totsu of [card.totsu,...variants.upgradeTargets(card,catalog[card.name].rare,input.budget,input.itemsPerLimitBreak)]) {
    assert.ok(tasks.some(t=>t.anchor===card.name&&t.totsu===totsu));
  }
  for(const cost of new Set(tasks.map(t=>t.cost))) {
    const band=tasks.filter(t=>t.cost===cost&&!t.supportAnchor&&!t.duoChain),firstPass=band.slice(0,band.length/2);
    assert.equal(new Set(firstPass.map(t=>JSON.stringify([t.anchor,t.totsu,t.challenges]))).size,firstPass.length,
      'try distinct anchors before repeating their other support-order path');
    const paths=new Map();
    for(const task of band){
      const key=JSON.stringify([task.anchor,task.totsu,task.challenges]);
      paths.set(key,[...(paths.get(key)??[]),task.supportFirst]);
    }
    for(const orders of paths.values())assert.deepEqual(orders.sort(),[false,true]);
  }
});

test('initial candidates include distinct teams instead of filling the beam with magic variations', () => {
  const input=fixture();
  input.supports=input.roster.slice(0,3).map(c=>({...c,totsu:4,level:120}));
  const candidates=generation.generateCandidates(input,generation.buildTasks(input,catalog)[0],catalog);
  assert.ok(new Set(candidates.map(c=>c.cards.map(card=>card.name).join('|'))).size>=2);
});

test('BASIC generation retains a setup spell that strengthens a later DUO finisher', () => {
  const input=fixture();
  input.preset=clone(examPresetDefinitions.find(p=>p.id==='第18回統一木BS'));
  const train=name=>({...input.roster[0],name,level:120,totsu:4});
  input.roster=['rook_dormitory','epel_dormitory','lilia_birth4','vil_scary'].map(train);
  input.supports=[train('idia_Guardian_of_the_Underworld')];
  input.budget=0;input.challengeLocks=Object.fromEntries(input.preset.specialChallenges.map(c=>[c.id,'on']));
  const task={anchor:'rook_dormitory',totsu:4,cost:0,challenges:input.preset.specialChallenges.map(c=>c.id),style:0};
  const candidates=generation.generateCandidates(input,task,catalog);
  assert.ok(candidates.some(c=>c.cards.at(-1).selectedMagic.includes(1)&&c.cards.at(-1).selectedMagic.includes(2)));
});

test('ally-selected buffs also benefit their caster in candidate estimates', () => {
  const input=fixture();input.preset.kind='BASIC';input.preset.specialChallenges=[];
  const card=variants.cardVariants(input.roster[0],'SSR')[0];
  const task={anchor:card.name,totsu:0,cost:0,challenges:[],style:0};
  const self=clone(catalog),ally=clone(catalog);
  self[card.name].etc='クリティカル(極大)(自/3T)(M1)';
  ally[card.name].etc='クリティカル(極大)(味方選択/3T)(M1)';
  assert.equal(generation.createEstimator(input,task,self)([card]),generation.createEstimator(input,task,ally)([card]));
});

test('DF evasion upper tails account for hit counts and lost advantageous-damage points',()=>{
  const {defenceEvasionValue:value}=load('src/utils/evasionRates.ts');
  assert.equal(value(10000,1,2,0,.001),0);
  const guaranteed=value(10000,1,2,1,.9);
  assert.ok(Math.abs(guaranteed-(10000*.1275+1200)/.19)<1e-6);
  assert.ok(value(10000,1,2,.237,.001)>value(10000,1.5,2,.237,.001));
  assert.ok(value(10000,1,2,.237,.001)>value(10000,1,2,.237,.9));
  assert.ok(value(10000,1,2,.092,.1)<value(10000,1,2,.61,.1));
});

test('partial teams retain reachable buddies without adding phantom full-team stats',()=>{
  for(const kind of ['DEFENCE','BASIC','ATTACK']) {
  const input=fixture();input.preset.kind=kind;input.preset.specialChallenges=[];input.supports=[];
  const card=variants.cardVariants(input.roster[0],'SSR')[0],raw=clone(catalog);
  raw[card.name].buddy1c='future-character';raw[card.name].buddy1s='HPUP(中)';
  raw[card.name].buddy1s_totsu='HPUP(中)';
  input.roster=[input.roster[0]];
  const reachable=clone(input),future=Object.keys(raw).find(name=>name!==card.name);
  raw[future].chara='future-character';reachable.roster.push({...input.roster[0],name:future});
  const task={anchor:card.name,totsu:0,cost:0,challenges:[],style:0};
  const without=generation.createEstimator(input,task,raw),withBuddy=generation.createEstimator(reachable,task,raw);
  assert.ok(withBuddy([card,card])>without([card,card]));
  assert.equal(withBuddy(Array(5).fill(card)),without(Array(5).fill(card)));
  }
});

test('DF does not reward redundant immunity when it unlocks no healing',()=>{
  const input=fixture();input.preset.kind='DEFENCE';
  input.preset.specialChallenges=[{id:'curse',effects:[{kind:'playerCurse',duration:5}]}];
  const card=variants.cardVariants(input.roster[0],'SSR')[0],plain=clone(catalog);
  for(const m of [1,2,3]){plain[card.name][`magic${m}etc`]='';plain[card.name][`magic${m}heal`]='';plain[card.name][`magic${m}buf`]='';}
  plain[card.name].etc='';
  const protectedCard=clone(plain);protectedCard[card.name].etc='呪い無効(自/5T)(M1)';
  const task={anchor:card.name,totsu:0,cost:0,challenges:['curse'],style:0};
  assert.equal(generation.createEstimator(input,task,plain)([card]),generation.createEstimator(input,task,protectedCard)([card]));
});

test('DF continuous healing uses the shared HP rate for every potential tick',()=>{
  const input=fixture();input.preset.kind='DEFENCE';input.preset.specialChallenges=[];
  const card=variants.cardVariants(input.roster[0],'SSR')[0],one=clone(catalog);
  one[card.name].etc='HP継続回復(中)(自/1T)(M1)';
  const three=clone(one);three[card.name].etc=three[card.name].etc.replace('1T','3T');
  const task={anchor:card.name,totsu:0,cost:0,challenges:[],style:0};
  const difference=generation.createEstimator(input,task,three)([card])-generation.createEstimator(input,task,one)([card]);
  const {recalculateHP,healContinueDict}=load('src/utils/calculations.ts');
  const expected=recalculateHP(one[card.name],card.level,false)*healContinueDict['継続回復(中)10']*2;
  assert.ok(Math.abs(difference-expected)<1e-6);
});

test('one selected-ally cleanse cannot receive credit for cleansing every healer',()=>{
  const input=fixture();input.preset.kind='DEFENCE';input.preset.specialChallenges=[{id:'curse',effects:[{kind:'playerCurse',duration:5}]}];
  const names=Object.values(catalog).filter(c=>c.rare==='SSR').slice(0,5).map(c=>c.name);
  const cards=names.map(name=>variants.cardVariants({...input.roster[0],name},'SSR')[0]);
  const selected=clone(catalog);
  for(const name of names){const raw=selected[name];raw.etc='HP回復(中)(M1)';
    for(const m of [1,2,3]){raw[`magic${m}etc`]='';raw[`magic${m}heal`]='';raw[`magic${m}buf`]='';raw[`buddy${m}s`]='';raw[`buddy${m}s_totsu`]='';}}
  selected[names[0]].etc+='<br>デバフ解除(味方選択)(M2)';
  const all=clone(selected);all[names[0]].etc=all[names[0]].etc.replace('味方選択','味方全体');
  const task={anchor:names[0],totsu:0,cost:0,challenges:['curse'],style:0};
  const limited=generation.createEstimator(input,task,selected),unlimited=generation.createEstimator(input,task,all);
  assert.ok(unlimited(cards)>limited(cards));
  assert.equal(unlimited(cards.slice(0,4)),limited(cards.slice(0,4)),
    'partial teams retain potential for a later cleansing card');
});

test('DF candidate ordering accounts for incoming elemental compatibility',()=>{
  const input=fixture();input.preset.kind='DEFENCE';input.preset.specialChallenges=[];
  input.preset.enemies=[{actions:[{element:'火',estimatedDamage:1000}]}];
  const card=variants.cardVariants(input.roster[0],'SSR')[0];
  const task={anchor:card.name,totsu:0,cost:0,challenges:[],style:0};
  const good=clone(catalog),bad=clone(catalog);
  for(const m of [1,2,3]){good[card.name]['magic'+m+'atr']='水';bad[card.name]['magic'+m+'atr']='木';}
  const difference=value=>generation.createEstimator(value,task,good)([card])-generation.createEstimator(value,task,bad)([card]);
  const small=difference(input),heavy=clone(input);heavy.preset.enemies[0].actions[0].estimatedDamage=20000;
  assert.ok(Math.abs(difference(heavy)-small-38000)<1e-6,
    'two spells each avoid one equal-damage unit compared with disadvantage');
  const neutral=clone(heavy);neutral.preset.enemies[0].actions[0].element='無';
  const neutralLow=clone(neutral);neutralLow.preset.enemies[0].actions[0].estimatedDamage=1000;
  assert.equal(difference(neutral),difference(neutralLow));
});

test('candidate ordering retains critical ceilings reachable under the retry budget', () => {
  const input=fixture();input.preset.kind='ATTACK';input.preset.specialChallenges=[];
  input.attempts=30;input.desiredProbability=.05;
  const card=variants.cardVariants(input.roster[0],'SSR')[0];
  const task={anchor:card.name,totsu:0,cost:0,challenges:[],style:0};
  const small=clone(catalog),guaranteed=clone(catalog);
  small[card.name].etc='クリティカル(小)(自/3T)(M1)';
  guaranteed[card.name].etc='クリティカル(極大)(自/3T)(M1)';
  const rare=generation.createEstimator(input,task,small)([card]);
  assert.equal(rare,generation.createEstimator(input,task,guaranteed)([card]),
    'a reachable all-critical ceiling must survive candidate ordering');
  const strict={...input,attempts:1,desiredProbability:.99};
  assert.ok(generation.createEstimator(strict,task,small)([card])<rare);
});

test('ATTACK style1 distinguishes critical probabilities while styles0 and2 retain the same ceiling', () => {
  const input=fixture();input.preset.kind='ATTACK';input.preset.specialChallenges=[];
  input.attempts=30;input.desiredProbability=.05;
  const card=variants.cardVariants(input.roster[0],'SSR')[0];
  const makeCatalog=power=>{const data=clone(catalog);data[card.name].etc=`クリティカル(${power})(自/3T)(M1)`;return data;};
  const small=makeCatalog('小'),medium=makeCatalog('中');
  const task=style=>({anchor:card.name,totsu:0,cost:0,challenges:[],style});
  const style1Small=generation.createEstimator(input,task(1),small)([card]);
  const style1Medium=generation.createEstimator(input,task(1),medium)([card]);
  assert.ok(style1Medium>style1Small,'style1 mean lane should prefer the higher actual critical rate');
  for(const style of [0,2])assert.equal(
    generation.createEstimator(input,task(style),small)([card]),
    generation.createEstimator(input,task(style),medium)([card]),
    `style${style} must retain the saturated tail ceiling`);
});

test('ATTACK style1 honors the attacking card\'s one-way DUO requirement in full teams', () => {
  const input=fixture();input.preset.kind='ATTACK';input.preset.specialChallenges=[];
  input.attempts=30;input.desiredProbability=.05;
  const names=Object.values(catalog).filter(card=>card.rare==='SSR').slice(0,5).map(card=>card.name);
  const cards=names.map((name,index)=>({
    ...variants.cardVariants({...input.roster[0],name,level:80,totsu:0},'SSR')[0],
    selectedMagic:[1,2],
    magicLevels:[10,10,10],
    buddyLevels:[10,10,10],
    support:false,
    cardIndex:index,
  }));
  const matching=clone(catalog);
  for(const [index,name] of names.entries()) {
    const raw=matching[name];
    raw.chara=`duo-${index}`;raw.duo='';raw.atk='5000';raw.base_atk='1000';raw.hp='12000';raw.base_hp='2400';raw.etc='';
    for(let m=1;m<=3;m++) {
      raw[`magic${m}atr`]='無';raw[`magic${m}pow`]='単発(強)';raw[`magic${m}etc`]='';raw[`magic${m}buf`]='';raw[`magic${m}heal`]='';
      raw[`buddy${m}s`]='';raw[`buddy${m}s_totsu`]='';raw[`buddy${m}c`]='';
    }
  }
  matching[names[0]].duo='duo-1';
  const wrong=clone(matching);wrong[names[0]].duo='duo-missing';
  const task={anchor:names[0],totsu:0,cost:0,challenges:[],style:1};
  const withDuo=generation.createEstimator(input,task,matching)(cards);
  const withoutDuo=generation.createEstimator(input,task,wrong)(cards);
  assert.ok(withDuo>withoutDuo,'the attacker must request the partner character for a DUO');
});

test('ATTACK style1 paired effects use the registered magic level rather than parsed text defaults', () => {
  const input=fixture();input.preset.kind='ATTACK';input.preset.specialChallenges=[];
  input.attempts=30;input.desiredProbability=.05;
  const names=Object.values(catalog).filter(card=>card.rare==='SSR').slice(0,5).map(card=>card.name);
  const cards=names.map((name,index)=>({
    ...variants.cardVariants({...input.roster[0],name,level:80,totsu:0},'SSR')[0],
    selectedMagic:[1,2],magicLevels:[10,10,10],buddyLevels:[10,10,10],support:false,cardIndex:index,
  }));
  const data=clone(catalog);
  for(const [index,name] of names.entries()) {
    const raw=data[name];raw.chara=`level-${index}`;raw.duo='';raw.atk='5000';raw.base_atk='1000';raw.hp='12000';raw.base_hp='2400';raw.etc='';
    for(let m=1;m<=3;m++) {
      raw[`magic${m}atr`]='無';raw[`magic${m}pow`]='単発(強)';raw[`magic${m}etc`]='';raw[`magic${m}buf`]='';raw[`magic${m}heal`]='';
      raw[`buddy${m}s`]='';raw[`buddy${m}s_totsu`]='';raw[`buddy${m}c`]='';
    }
  }
  data[names[0]].etc='ATKUP(中)(自/1T)(M1)';
  const low=cards.map((card,index)=>index===0?{...card,magicLevels:[1,10,10]}:card);
  const task={anchor:names[0],totsu:0,cost:0,challenges:[],style:1};
  const highValue=generation.createEstimator(input,task,data)(cards);
  const lowValue=generation.createEstimator(input,task,data)(low);
  assert.ok(highValue>lowValue,'paired effects must read the selected card\'s registered magic level');
});

test('ATTACK style1 does not restore mean credit for a frozen card beyond the immunity partner cap', () => {
  const input=fixture();input.preset.kind='ATTACK';input.preset.specialChallenges=[{id:'freeze-test',effects:[{kind:'playerFreeze',duration:10}]}];
  input.attempts=30;input.desiredProbability=.05;
  const names=Object.values(catalog).filter(card=>card.rare==='SSR').slice(0,5).map(card=>card.name);
  const cards=names.map(name=>variants.cardVariants({...input.roster[0],name,level:80,totsu:0},'SSR')[0]);
  const synthetic=clone(catalog);
  for(const [index,name] of names.entries()) {
    const raw=synthetic[name];raw.chara=`synthetic-${index}`;raw.duo='';raw.atk='5000';raw.base_atk='1000';raw.hp='12000';raw.base_hp='2400';
    raw.etc='';
    for(let m=1;m<=3;m++){raw[`magic${m}atr`]='水';raw[`magic${m}pow`]='単発(強)';raw[`magic${m}etc`]='';raw[`magic${m}buf`]='';raw[`magic${m}heal`]='';raw[`buddy${m}s`]='';raw[`buddy${m}s_totsu`]='';raw[`buddy${m}c`]='';}
  }
  synthetic[names[0]].etc='凍結無効(味方選択)(M1)';
  synthetic[names[1]].etc='クリティカル(極大)(自/3T)(M1)';
  const twoCritical=clone(synthetic);twoCritical[names[4]].etc='クリティカル(極大)(自/3T)(M1)';
  const task={anchor:names[0],totsu:0,cost:0,challenges:['freeze-test'],style:1};
  const one=generation.createEstimator(input,task,synthetic)(cards);
  const two=generation.createEstimator(input,task,twoCritical)(cards);
  assert.ok(Math.abs(two-one)<1e-9,'the second frozen critical is outside the single selected-ally immunity slot');
});

test('completed frozen teams get no credit for blocked buffs but retain potential before a cure can join', () => {
  const input=fixture();input.preset.kind='ATTACK';
  input.preset.specialChallenges=[{id:'freeze-test',effects:[{kind:'playerFreeze',duration:10}]}];
  const cards=[...input.roster.map(c=>variants.cardVariants(c,'SSR')[0]),variants.cardVariants(input.supports[0],'SSR',true)[0]];
  const task={anchor:cards[0].name,totsu:0,cost:0,challenges:['freeze-test'],style:0};
  const bare=clone(catalog);
  for(const card of cards) {
    const raw=bare[card.name];raw.etc='';
    for(let m=1;m<=3;m++){raw[`magic${m}buf`]='';raw[`magic${m}heal`]='';raw[`buddy${m}s`]='';raw[`buddy${m}s_totsu`]='';}
  }
  const boosted=clone(bare);boosted[cards[0].name].etc='クリティカル(極大)(自/3T)(M1)';
  const plain=generation.createEstimator(input,task,bare),blocked=generation.createEstimator(input,task,boosted);
  assert.equal(blocked(cards),plain(cards));
  const blockedAttack=clone(bare);
  blockedAttack[cards[0].name].magic1buf='ATKUP(中)';
  assert.equal(generation.createEstimator(input,task,blockedAttack)(cards),plain(cards),
    'freeze suppresses the buff without reducing the spell intrinsic damage');
  assert.ok(blocked(cards.slice(0,2))>plain(cards.slice(0,2)));
  for(const data of [bare,boosted])data[cards[1].name].etc='デバフ解除(味方選択)(M1)';
  assert.ok(generation.createEstimator(input,task,boosted)(cards)>generation.createEstimator(input,task,bare)(cards));
});

test('recombination discovers multi-card swaps while preserving item and ownership constraints', () => {
  const input=fixture();
  input.roster=Object.values(catalog).filter(c=>c.rare==='SSR').slice(0,8).map(c=>({...input.roster[0],name:c.name}));
  const make=(start,id)=>({id,cards:[...input.roster.slice(start,start+4).map(c=>variants.cardVariants(c,'SSR')[0]),variants.cardVariants(input.supports[0],'SSR',true)[0]],
    cost:0,policy:'effects',estimate:0,challengeIds:variants.challengeVariants(input)[0],preferredPlan:[['0-M1','1-M1']]});
  const a=make(0,'a'),b=make(4,'b');
  const children=generation.crossCandidates(input,a,b,catalog,new Set());
  assert.ok(children.some(c=>c.cards.filter(x=>!x.support&&a.cards.slice(0,4).some(y=>y.name===x.name)).length===2));
  for(const c of children) {
    assert.equal(c.preferredPlan,undefined);
    assert.equal(c.cards.filter(x=>x.support).length,1);
    assert.equal(new Set(c.cards.filter(x=>!x.support).map(x=>x.name)).size,4);
    assert.ok(c.cards.filter(x=>!x.support).every(x=>input.roster.some(r=>r.name===x.name)));
    assert.ok(c.cost<=input.budget);
  }
});
test('public-observation policy is deterministic and has a legal fallback', () => {
  const observation = { turn: 1, kind: 'BASIC', enemyHp: 100000, playerHp: 30000, maxHp: 30000,
    pairs: [{ ids: ['0-M1', '1-M1'], damage: 10000, firstDamage: 5000, duo: 0, heal: 0, utility: 0, defense: 0, finisherUsed: false },
      { ids: ['2-M2', '1-M1'], damage: 20000, firstDamage: 15000, duo: 1, heal: 0, utility: 0, defense: 0, finisherUsed: true }] };
  assert.deepEqual(clone(policy.chooseObservedPair(observation, 'reserve')), ['0-M1', '1-M1']);
  assert.deepEqual(clone(policy.chooseObservedPair(observation, 'balanced')), ['2-M2', '1-M1']);
  assert.equal(policy.chooseObservedPair({ ...observation, pairs: [] }, 'balanced'), null);
});

test('learned timing adapts to a missing partner using only visible pairs', () => {
  const pair=(ids,damage)=>({ids,damage,firstDamage:damage/2,duo:0,heal:0,utility:0,defense:0,finisherUsed:false});
  const observation={turn:1,kind:'ATTACK',enemyHp:100000,playerHp:40000,maxHp:40000,
    pairs:[pair(['late1','late2'],12000),pair(['early','late1'],11000)]};
  const learned=[['early','missing'],['late1','late2']];
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects')),['late1','late2']);
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects',learned)),['early','late1']);
});

test('ATTACK timing uses the current five-turn hand cycle rather than the first occurrence of a repeated spell', () => {
  const pair=ids=>({ids,damage:10000,firstDamage:5000,duo:0,heal:0,utility:0,defense:0,finisherUsed:false});
  const observation={turn:6,kind:'ATTACK',enemyHp:100000,playerHp:40000,maxHp:50000,
    pairs:[pair(['late-a','late-b']),pair(['repeat-a','repeat-b'])]};
  const plan=[['repeat-a','repeat-b'],['x','y'],['q','r'],['s','t'],['late-a','late-b'],['repeat-a','repeat-b']];
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects',plan)),['repeat-a','repeat-b']);
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects',plan.slice(0,5))),['repeat-a','repeat-b']);
});

test('checkpoint history is bounded on continuous resume but retained on manual resume', async () => {
  const input = fixture();
  const saved = { cursor: 0, seen: Array.from({ length: 9000 }, (_, i) => `discarded-${i}`),
    pool: [], finalists: [], pending: [], round: 0, elapsed: 0, trialSerial: 0, nonce: 'history-diagnostic' };
  const engine = { prepare: async () => {}, trial: () => { throw Error('zero-duration run must not evaluate'); } };
  for (const continuous of [false, true]) {
    const session = new SearchSession(input, catalog, engine, 'history-diagnostic', clone(saved));
    await session.run(0, () => {}, continuous);
    assert.equal(session.checkpoint().seen.length, continuous ? 4096 : 9000);
  }
});

test('scheduler stops, resumes and uses independent development/validation seeds', async () => {
  const input = fixture(); input.budget = 0;
  const seeds = [], snapshots = [];
  const engine = { prepare: async () => {}, trial: seed => { seeds.push(seed); if(seeds.length===8)setImmediate(()=>session.stop()); return { score: 45000, retired: false, finishTurn: 5 }; } };
  const session = new SearchSession(input, catalog, engine, 'test');
  await session.run(1500, p => snapshots.push(clone(p)));
  assert.equal(snapshots.at(-1).phase, 'stopped');
  await session.run(2500, p => snapshots.push(clone(p)));
  assert.equal(snapshots.at(-1).phase, 'done');
  assert.equal(new Set(seeds).size, seeds.length);
  assert.ok(seeds.some(s => s.includes(':development:')));
  assert.ok(seeds.some(s => s.includes(':validation:')));
  for (const r of snapshots.at(-1).results) {
    assert.equal(r.developmentBest.score,Math.max(...r.development.scores));
    assert.ok(r.developmentBest.seed.startsWith('test:development:'));
    assert.ok(r.validation.scores.length <= r.validationTarget);
    if(r.validation.scores.length) {
      assert.equal(r.validationBest.score,Math.max(...r.validation.scores));
      assert.ok(r.validationBest.seed.startsWith('test:validation:'));
    }
  }
  const checkpoint = clone(session.checkpoint());
  const restored = new SearchSession(input, catalog, engine, 'ignored', checkpoint);
  assert.equal(restored.checkpoint().tasksTotal,checkpoint.tasksTotal,'restoring validation retains the known task count before rebuilding tasks');
  await restored.run(300, () => {});
  assert.equal(new Set(seeds).size, seeds.length, 'restored sessions must not reuse trial seeds');
  const before=clone(restored.checkpoint()),chosen=before.finalists[0];
  restored.refineValidation(chosen.candidate.id);
  const fresh=restored.checkpoint().finalists.find(r=>r.candidate.id===chosen.candidate.id);
  assert.equal(fresh.validationTarget,32768);
  assert.equal(fresh.validation.scores.length,0);
  assert.deepEqual(clone(fresh.candidate),chosen.candidate,'confirmation must keep the chosen team and plan fixed');
  await restored.run(300,()=>{});
  assert.equal(new Set(seeds).size,seeds.length,'confirmation uses a fresh holdout');
});

test('hypothetical critical scouts never enter measured samples or reported best scores',async()=>{
  const input=fixture();input.budget=0;input.preset.kind='BASIC';
  const scouts=[],ordinary=[],idealHands=[];
  const engine={prepare:async()=>{},scout:(seed,policy,index,idealHand)=>{scouts.push(seed);idealHands.push(idealHand);return {score:999999,retired:false,finishTurn:4,forcedHits:1,plan:[['0-M1','1-M1']]};},
    trial:seed=>{ordinary.push(seed);return {score:42000,retired:false,finishTurn:4};}};
  const session=new SearchSession(input,catalog,engine,'isolated-scout');
  await session.run(1500,()=>{});
  const rows=[...session.checkpoint().pool,...session.checkpoint().finalists];
  assert.ok(scouts.length>0);
  assert.ok(idealHands.includes(true)&&idealHands.includes(false),'bounded scouting tests templates as well as actual hand draws');
  assert.ok(scouts.every(seed=>seed.includes(':critical-scout:')));
  assert.ok(ordinary.every(seed=>!seed.includes(':critical-scout:')));
  assert.ok(rows.some(r=>r.criticalScout?.score===999999));
  assert.ok(rows.every(r=>[...r.development.scores,...r.validation.scores].every(score=>score===42000)));
  assert.ok(rows.every(r=>!r.validationBest||r.validationBest.score===42000));
  const copy=clone(session.checkpoint());
  for(const row of copy.pool)if(row.criticalScout)delete row.criticalScout.magic;
  assert.ok(new SearchSession(input,catalog,engine,'ignored',copy).checkpoint().pool.some(r=>r.criticalScout?.score===999999),
    'checkpoints from before scout magic provenance remain readable');
});

test('BASIC critical scouts alternate all-magic and M2-only target cycles while ATTACK stays unfiltered',async()=>{
  const makeResult=kind=>{
    const input=fixture();input.budget=0;input.preset.kind=kind;
    const cards=[...input.roster.map(c=>variants.cardVariants(c,'SSR')[0]),variants.cardVariants(input.supports[0],'SSR',true)[0]];
    for(const card of cards)card.selectedMagic=[1,2];
    return {input,result:{candidate:{id:`scout-${kind}`,cards,challengeIds:[],cost:0,policy:'effects-tail',estimate:0},development:{scores:[],retired:0,turns:0},validation:{scores:[],retired:0,turns:0},validationTarget:2048}};
  };
  const basicCalls=[];const basic=makeResult('BASIC');
  const basicEngine={scoutTargets:()=>[0,1,2,3,4],scout:(seed,policy,index,idealHand,magic)=>{basicCalls.push({index,idealHand,magic});return {score:100,retired:false,finishTurn:4,forcedHits:1};}};
  const basicSession=new SearchSession(basic.input,catalog,basicEngine,'scout-modes');
  await basicSession.scout(basic.result,performance.now()+1000,32);
  assert.ok(basicCalls.length===32);
  for(const index of [0,1,2,3,4]) {
    const modes=basicCalls.filter(call=>call.index===index).map(call=>call.magic);
    assert.ok(modes.includes(undefined)&&modes.includes(2),`target ${index} should receive both BASIC scout modes`);
  }
  assert.ok(basicCalls.slice(0,8).every(call=>call.idealHand),'the first 8 scout hands remain ideal');
  assert.ok(basicCalls.slice(8).some(call=>!call.idealHand),'later scout hands remain ordinary');

  const attackCalls=[];const attack=makeResult('ATTACK');
  const attackEngine={scoutTargets:()=>[0,1,2,3,4],scout:(seed,policy,index,idealHand,magic)=>{attackCalls.push({index,idealHand,magic});return {score:100,retired:false,finishTurn:4,forcedHits:1};}};
  const attackSession=new SearchSession(attack.input,catalog,attackEngine,'scout-attack');
  await attackSession.scout(attack.result,performance.now()+1000,32);
  assert.ok(attackCalls.length===32&&attackCalls.every(call=>call.magic===undefined),'ATTACK scouts must retain all-magic behavior');
});

test('defence score policy uses actual score contributions instead of arbitrary defense weights', () => {
  const pair=(ids,projectedScore,defense)=>({ids,projectedScore,defense,damage:10000,firstDamage:5000,duo:0,heal:0,utility:0,finisherUsed:false});
  const observation={turn:3,kind:'DEFENCE',enemyHp:50000,playerHp:30000,maxHp:50000,
    pairs:[pair(['a','b'],42000,5),pair(['c','d'],45000,1)]};
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects-score')),['c','d']);
});

test('plan learning can reuse a successful development replay without learning from validation seeds', async () => {
  const input=fixture();input.budget=0;
  const observed=[['0-M1','1-M1']],replayed=[],prepared=[];
  const engine={prepare:async(_,candidate)=>{if(candidate.preferredPlan)prepared.push(clone(candidate.preferredPlan));},
    trial:(seed,policy,keepLog)=>{if(keepLog)replayed.push(seed);return {score:45000,retired:false,finishTurn:4,plan:keepLog?observed:undefined};},
    learnPlan:async()=>[['0-M2','1-M2']]};
  const session=new SearchSession(input,catalog,engine,'observed-plan');
  await session.run(2000,()=>{});
  assert.ok(session.checkpoint().pool.some(result=>result.development.scores.length>64),
    'promising candidates get more development draws before plan learning');
  assert.ok(session.checkpoint().pool.every(result=>result.development.scores.length<=512),
    'extra development work stays bounded');
  assert.ok(replayed.length);
  assert.ok(replayed.every(seed=>seed.startsWith('observed-plan:development:')));
  assert.ok(prepared.some(plan=>JSON.stringify(plan)===JSON.stringify(observed)));
});

test('an initially winless near-win survives pruning and receives additional independent development draws',async()=>{
  const input=fixture();input.budget=0;input.target=50000;
  const base=generation.generateCandidates(input,generation.buildTasks(input,catalog)[0],catalog)[0];
  const sample=(score,fitness)=>({scores:Array(64).fill(score),fitnessSum:fitness*64,retired:score?0:64,turns:256});
  const result=(id,score,fitness)=>({candidate:{...clone(base),id},development:sample(score,fitness),validation:{scores:[],retired:0,turns:0},validationTarget:2048});
  const pool=Array.from({length:241},(_,i)=>result(`safe-${i}`,49000,49000));
  pool.push(result('rare-near-win',0,12000));
  let current;
  const engine={prepare:async(_,candidate)=>{current=candidate;},trial:()=>({score:current.id==='rare-near-win'?52000:49000,retired:false,finishTurn:4})};
  const checkpoint={cursor:0,seen:pool.map(r=>r.candidate.id),pool,finalists:[],pending:[],round:0,elapsed:0,trialSerial:100000,nonce:'rare-draws'};
  const session=new SearchSession(input,catalog,engine,'rare-draws',checkpoint);
  await session.run(1500,()=>{});
  const recovered=session.checkpoint().pool.find(r=>r.candidate.id==='rare-near-win');
  assert.ok(recovered,'near-win candidates must survive the bounded pool pruning');
  assert.ok(recovered.development.scores.length>64);
  assert.equal(Math.max(...recovered.development.scores),52000);
  assert.ok(session.checkpoint().finalists.some(r=>r.candidate.id==='rare-near-win'));
});

test('continuing a search retains a stronger independently evaluated candidate and its replay seed', async () => {
  const input=fixture();input.budget=0;
  const candidate=generation.generateCandidates(input,generation.buildTasks(input,catalog)[0],catalog)[0];
  candidate.id='previous-best';
  const best={candidate,development:{scores:Array(64).fill(50000),retired:0,turns:320},
    validation:{scores:Array(2048).fill(50000),retired:0,turns:10240},validationTarget:2048,validationBest:{seed:'previous-independent-seed',score:50000}};
  const engine={prepare:async()=>{},trial:()=>({score:10000,retired:false,finishTurn:5})};
  const session=new SearchSession(input,catalog,engine,'retention',{cursor:0,seen:[],pool:[clone(best)],pending:[],finalists:[clone(best)],round:1,elapsed:0,trialSerial:0,nonce:'retention'});
  await session.run(1000,()=>{});
  const retained=session.checkpoint().finalists.find(r=>r.candidate.id==='previous-best');
  assert.ok(retained,'a worse continuation must not remove the previous result');
  assert.deepEqual(clone(retained.validation),best.validation);
  assert.deepEqual(clone(retained.validationBest),best.validationBest);
  assert.ok(session.checkpoint().finalists.length<=8);
});


test('BASIC reserve policy gives a lasting finisher setup priority over immediate damage', () => {
  const pair=(ids,damage,setup,duo)=>({ids,damage,setup,duo,firstDamage:damage/2,heal:0,utility:0,defense:0,finisherUsed:false});
  const observation={turn:2,kind:'BASIC',enemyHp:100000,playerHp:50000,maxHp:60000,
    pairs:[pair(['setup','immunity'],20000,6500,0),pair(['duo-a','duo-b'],60000,0,2)]};
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects-reserve')),['setup','immunity']);
});

test('normal exams require five distinct owned cards and never borrow supports, including refinements', async () => {
  const input = fixture();
  input.preset = clone(examPresetDefinitions.find(p => !p.specialChallenges?.length && !p.title.includes('統一')));
  input.preset.difficulty ??= 1.5;
  assert.equal(variants.validateInput(input,catalog),'roster');
  const extra=Object.values(catalog).filter(c=>c.rare==='SSR'&&!input.roster.some(r=>r.name===c.name)).slice(0,2);
  input.roster.push(...extra.map(c=>({...input.roster[0],name:c.name,level:83})));
  input.supports=[];
  assert.equal(variants.validateInput(input, catalog), null);
  assert.deepEqual(clone(variants.challengeVariants(input)), [[]]);
  const tasks = generation.buildTasks(input, catalog);
  assert.ok(tasks.length);
  assert.ok(tasks.every(task=>!task.supportAnchor));
  const candidates = generation.generateCandidates(input, tasks[0], catalog);
  assert.ok(candidates.length);
  assert.ok(candidates.every(c => c.challengeIds.length === 0));
  const neighbors=await generation.generateNeighbors(input,candidates[0],catalog,new Set(),()=>false);
  const crossed=generation.crossCandidates(input,candidates[0],candidates.at(-1),catalog,new Set());
  for(const candidate of [...candidates,...neighbors,...crossed]) {
    assert.equal(candidate.cards.length,5);
    assert.ok(candidate.cards.every(c=>!c.support&&input.roster.some(r=>r.name===c.name&&Math.min(120,r.level+5*(c.totsu-r.totsu))===c.level)));
    assert.equal(new Set(candidate.cards.map(c=>c.name)).size,5);
    assert.equal(candidate.cost,variants.upgradeCost(input,candidate.cards));
    assert.ok(candidate.cost<=input.budget);
  }
});

test('local refinement tests card replacements even when spell and upgrade alternatives fill each slot', async () => {
  const input=fixture();
  input.roster.forEach(c=>{c.totsu=3;c.level=95;});
  const extra=Object.values(catalog).find(c=>c.rare==='SSR'&&!input.roster.some(r=>r.name===c.name));
  input.roster.push({...clone(input.roster[0]),name:extra.name});
  const cards=input.roster.slice(0,4).map(c=>variants.cardVariants(c,'SSR')[0]);
  cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const parent={id:'refinement-regression',cards,cost:0,estimate:0,challengeIds:[],policy:'effects-tail'};
  const neighbors=await generation.generateNeighbors(input,parent,catalog,new Set(),()=>false);
  for(const removed of parent.cards.filter(c=>!c.support)) {
    assert.ok(neighbors.some(c=>c.cards.some(x=>!x.support&&x.name===extra.name)
      &&parent.cards.filter(x=>!x.support&&x.name!==removed.name).every(x=>c.cards.some(y=>!y.support&&y.name===x.name))
      &&!c.cards.some(x=>!x.support&&x.name===removed.name)),`no single-card replacement for ${removed.name}`);
  }
});

test('local refinement preserves ownership and resource limits and respects cancellation', async () => {
  const input = fixture();
  const parent = generation.generateCandidates(input, generation.buildTasks(input,catalog)[0],catalog)[0];
  const seen = new Set([parent.id]);
  const neighbors = await generation.generateNeighbors(input,parent,catalog,seen,()=>false);
  assert.ok(neighbors.length);
  for (const c of neighbors) {
    assert.ok(!seen.has(c.id));
    assert.equal(c.cards.filter(x=>x.support).length,1);
    const own=c.cards.filter(x=>!x.support);
    assert.equal(new Set(own.map(x=>x.name)).size,4);
    assert.ok(own.every(x=>input.roster.some(r=>r.name===x.name)));
    assert.equal(c.cost,variants.upgradeCost(input,c.cards));
    assert.ok(c.cost<=input.budget);
    assert.deepEqual(clone(c.challengeIds),clone(parent.challengeIds));
  }
  const large = {...input,supports:Array(100).fill(input.supports[0])};
  assert.deepEqual(clone(await generation.generateNeighbors(large,parent,catalog,seen,()=>true)),[]);
});

test('local refinement exchanges a same-card support role with its owned character replacement', async () => {
  const input = fixture();
  const make = name => ({ name, totsu: 0, level: 80, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true });
  input.roster = ['riddle_birth', 'deuce_birth2', 'ace_groom', 'trey_Queens_Chefs_Court', 'cater_birth'].map(make);
  const originalSupport = input.roster[0];
  const promoted = input.roster[1];
  input.supports = [clone(originalSupport), { ...clone(promoted), level: 120, totsu: 4 }];
  const cards = input.roster.slice(1, 5).map((card, index) =>
    variants.cardVariants(card, 'SSR', false, index === 0 ? 2 : card.totsu)[0]);
  cards.push(variants.cardVariants(originalSupport, 'SSR', true)[0]);
  const parent = { id: 'support-role-exchange', cards, cost: 2, estimate: 0,
    challengeIds: [], policy: 'effects-tail', preferredPlan: [['0-M1', '1-M2']], preferredPlanMode: 'turn' };
  const data = clone(catalog);
  data[promoted.name].magic2pow = '単発(弱)';
  data[originalSupport.name].magic2pow = '単発(弱)';
  for (const card of input.roster) {
    data[card.name].duo = '';
    data[card.name].buddy1c = '';
    data[card.name].buddy2c = '';
    data[card.name].buddy3c = '';
  }
  const neighbors = await generation.generateNeighbors(input, parent, data, new Set(), () => false);
  const isExchange = candidate => candidate.cards.some(card => card.support && card.name === promoted.name)
    && candidate.cards.some(card => !card.support && card.name === originalSupport.name);
  const exchanged = neighbors.filter(isExchange);
  assert.ok(exchanged.length, 'same-card support promotion should be proposed');
  assert.ok(exchanged.some(candidate => candidate.cards.some(card =>
    !card.support && card.name === originalSupport.name && card.totsu === 3) && candidate.cost === 3),
    'the promoted slot frees its old investment for the owned replacement');
  for (const candidate of exchanged) {
    const own = candidate.cards.filter(card => !card.support), support = candidate.cards.filter(card => card.support);
    assert.equal(own.length, 4); assert.equal(support.length, 1);
    assert.equal(new Set(own.map(card => card.name)).size, 4);
    assert.ok(candidate.cost <= input.budget);
    assert.equal(candidate.preferredPlan, undefined);
    assert.equal(candidate.preferredPlanMode, undefined);
    assert.equal(support[0].name, promoted.name);
    assert.equal(support[0].level, input.supports[1].level);
  }
  const byCost = new Map();
  for (const candidate of exchanged) byCost.set(candidate.cost, (byCost.get(candidate.cost) ?? 0) + 1);
  assert.ok([...byCost.values()].every(count => count <= 2), 'role exchanges stay bounded per promoted slot and cost');
  const dualM2 = candidate => candidate.cards.some(card => card.support && card.name === promoted.name
    && card.selectedMagic.includes(2)) && candidate.cards.some(card => !card.support
    && card.name === originalSupport.name && card.selectedMagic.includes(2));
  assert.ok(exchanged.some(dualM2), 'a legal M2/M2 role exchange is retained');
  assert.ok([...new Set(exchanged.map(candidate => candidate.cost))].some(cost => {
    const rows = exchanged.filter(candidate => candidate.cost === cost);
    return rows.some(candidate => !dualM2(candidate)) && rows.some(dualM2);
  }), 'the M2/M2 option survives alongside a non-M2 best option');
  const seen = new Set(exchanged.map(candidate => candidate.id));
  const withoutSeen = await generation.generateNeighbors(input, parent, data, seen, () => false);
  assert.ok(!withoutSeen.some(candidate => seen.has(candidate.id)));
  assert.deepEqual(clone(await generation.generateNeighbors(input, parent, data, new Set(), () => true)), []);
  const normal = clone(input);
  normal.preset = clone(examPresetDefinitions.find(p => !p.specialChallenges?.length && !p.title.includes('統一')));
  normal.preset.difficulty ??= 1.5;
  normal.supports = [];
  const normalCards = normal.roster.slice(0, 5).map(card => variants.cardVariants(card, 'SSR')[0]);
  const normalParent = { ...parent, cards: normalCards, cost: 0 };
  const normalNeighbors = await generation.generateNeighbors(normal, normalParent, catalog, new Set(), () => false);
  assert.ok(normalNeighbors.every(candidate => candidate.cards.every(card => !card.support)));
});

test('support role exchange refunds a different unchanged donor before dropping the replacement', async () => {
  const input = fixture(); input.budget = 3;
  const make = name => ({ name, totsu: 0, level: 80, magicLevels: [10, 10, 10], buddyLevels: [10, 10, 10], allowUpgrade: true });
  input.roster = ['riddle_birth', 'deuce_birth2', 'ace_groom', 'trey_Queens_Chefs_Court', 'cater_birth'].map(make);
  const originalSupport = input.roster[0], promoted = input.roster[1], donor = input.roster[2];
  input.supports = [clone(originalSupport), { ...clone(promoted), level: 120, totsu: 4 }];
  const data = clone(catalog);
  for (const card of input.roster) for (const field of ['duo', 'buddy1c', 'buddy2c', 'buddy3c']) data[card.name][field] = '';
  const cards = [variants.cardVariants(promoted, 'SSR', false, 2)[0],
    variants.cardVariants(donor, 'SSR', false, 1)[0],
    variants.cardVariants(input.roster[3], 'SSR', false)[0],
    variants.cardVariants(input.roster[4], 'SSR', false)[0],
    variants.cardVariants(originalSupport, 'SSR', true)[0]];
  const parent = { id: 'support-role-refund', cards, cost: 3, estimate: 0, challengeIds: [], policy: 'effects-tail' };
  const before = clone(input.roster);
  const neighbors = await generation.generateNeighbors(input, parent, data, new Set(), () => false);
  const exchanged = neighbors.filter(candidate => candidate.cards.some(card => card.support && card.name === promoted.name)
    && candidate.cards.some(card => !card.support && card.name === originalSupport.name));
  const refunded = exchanged.find(candidate => candidate.cards.some(card => !card.support && card.name === originalSupport.name && card.totsu === 3)
    && candidate.cards.some(card => !card.support && card.name === donor.name && card.totsu === 0));
  assert.ok(refunded, 'a 0->3 replacement must be funded by refunding the other owned +1');
  assert.equal(refunded.cost, 3);
  assert.equal(refunded.cards.find(card => card.support).name, promoted.name);
  assert.equal(refunded.cards.find(card => !card.support && card.name === originalSupport.name).level, 95);
  assert.equal(refunded.cards.find(card => !card.support && card.name === donor.name).level, 80);
  assert.ok(refunded.cards.find(card => !card.support && card.name === donor.name).selectedMagic.every(m => m !== 3));
  assert.deepEqual(input.roster, before);
});

test('local refinement can fund an unrelated owned replacement by reallocating donor training', async () => {
  const input = fixture(); input.budget = 3;
  const extra = Object.values(catalog).find(card => card.rare === 'SSR' && !input.roster.some(raw => raw.name === card.name));
  input.roster.push({...clone(input.roster[0]), name: extra.name, totsu: 0, level: 80});
  const supportExtra = Object.values(catalog).find(card => card.rare === 'SSR'
    && !input.roster.some(raw => raw.name === card.name));
  input.supports = [{...clone(input.roster[0]), name: supportExtra.name, totsu: 0, level: 80}];
  input.roster.slice(1, 4).forEach(card => { card.totsu = 2; });
  const before = clone(input.roster), data = clone(catalog);
  Object.assign(data[extra.name], {atk:'30000',base_atk:'6000',max_atk:'30000',magic1atr:'水',magic1pow:'単発(弱)',
    magic2atr:'水',magic2pow:'単発(弱)',magic3atr:'火',magic3pow:'3連撃(強)',magic3buf:'ATKUP(極大)'});
  for (const raw of [...input.roster, ...input.supports]) for (const field of ['duo','buddy1c','buddy2c','buddy3c']) data[raw.name][field] = '';
  const cards = [variants.cardVariants(input.roster[0], 'SSR', false, 0)[0],
    ...input.roster.slice(1, 4).map(card => variants.cardVariants(card, 'SSR', false, 3)[1]),
    variants.cardVariants(input.supports[0], 'SSR', true)[0]];
  const parent = {id:'unrelated-donor-rebalance',cards,cost:3,estimate:0,challengeIds:[],policy:'effects-tail',
    preferredPlan:[['0-M1','1-M3']],preferredPlanMode:'turn'};
  const neighbors = await generation.generateNeighbors(input, parent, data, new Set(), () => false);
  const rows = neighbors.filter(candidate => candidate.cost === 3
    && candidate.cards.some(card => !card.support && card.name === extra.name && card.totsu >= 2));
  assert.ok(rows.length, 'an unrelated replacement should fit within the shared three-break budget');
  const donorNames = new Set(input.roster.slice(1, 4).map(card => card.name));
  const funded = rows.filter(candidate => candidate.cards.filter(card => !card.support && donorNames.has(card.name)).length === 3);
  assert.ok(funded.length, 'the replacement lane must retain the unrelated three-donor composition');
  for (const row of funded) {
    const donors = row.cards.filter(card => !card.support && donorNames.has(card.name));
    const replacementCard = row.cards.find(card => !card.support && card.name === extra.name);
    assert.ok(donors.every(card => card.totsu >= 2 && card.totsu <= 3));
    assert.equal(donors.reduce((sum,card) => sum + 3 - card.totsu,0),replacementCard.totsu,
      'donors must refund exactly the replacement investment');
    assert.equal(variants.upgradeCost(input,row.cards),row.cost);
    assert.ok(donors.every(card => card.level === 80 + 5 * (card.totsu - 2)), 'donor levels must follow registered training');
    assert.ok(donors.filter(card => card.totsu === 2).every(card => card.selectedMagic.join(',') === '1,2'),
      'downgrading below M3 must retain a legal magic pair');
    assert.equal(replacementCard.level, 80 + 5 * replacementCard.totsu);
    assert.equal(row.preferredPlan, undefined); assert.equal(row.preferredPlanMode, undefined);
  }
  assert.deepEqual(input.roster, before);
});

test('normal replacement rebalance keeps four-donor outputs bounded', async () => {
  const input = fixture();
  input.preset = clone(examPresetDefinitions.find(p => !p.specialChallenges?.length && !p.title.includes('統一')));
  input.preset.difficulty ??= 1.5; input.supports = []; input.budget = 4;
  const ownedExtra = Object.values(catalog).find(card => card.rare === 'SSR' && !input.roster.some(raw => raw.name === card.name));
  input.roster.push({...clone(input.roster[0]),name:ownedExtra.name});
  const replacement = Object.values(catalog).find(card => card.rare === 'SSR'
    && !input.roster.some(raw => raw.name === card.name));
  input.roster.push({...clone(input.roster[0]),name:replacement.name});
  input.roster.slice(1, 5).forEach(card => { card.totsu = 0; });
  const data = clone(catalog);
  Object.assign(data[replacement.name], {atk:'30000',base_atk:'6000',max_atk:'30000',magic1atr:'水',magic1pow:'単発(弱)',
    magic2atr:'水',magic2pow:'単発(弱)',magic3atr:'火',magic3pow:'3連撃(強)',magic3buf:'ATKUP(極大)'});
  for (const raw of input.roster) for (const field of ['duo','buddy1c','buddy2c','buddy3c']) data[raw.name][field] = '';
  const cards = [variants.cardVariants(input.roster[0], 'SSR')[0],
    ...input.roster.slice(1, 5).map(card => variants.cardVariants(card, 'SSR', false, 1)[0])];
  const parent = {id:'normal-donor-bound',cards,cost:4,estimate:0,challengeIds:[],policy:'effects-tail'};
  const neighbors = await generation.generateNeighbors(input,parent,data,new Set(),()=>false);
  const rows = neighbors.filter(candidate => candidate.cost === 4
    && candidate.cards.some(card => !card.support && card.name === replacement.name && card.totsu === 4));
  assert.ok(rows.length);
  const fourDonorRow = rows.find(candidate =>
    !candidate.cards.some(card => !card.support && card.name === cards[0].name)
    && cards.slice(1).every(donor => candidate.cards.some(card =>
      !card.support && card.name === donor.name && card.totsu === 0)));
  assert.ok(fourDonorRow, 'the replacement may displace only the anchor while recovering all four donor breaks');
  const byMissing = new Map();
  for (const row of rows) {
    const missing = cards.find(card => !row.cards.some(next => next.name === card.name));
    const key = missing?.name ?? 'unknown'; byMissing.set(key, (byMissing.get(key) ?? 0) + 1);
  }
  assert.ok([...byMissing.values()].every(count => count <= 6), 'retained outputs remain bounded per omitted-card lane');
});

test('two-card refinement finds a weak partner whose buddy points back to the stronger replacement', async()=>{
  const input=fixture(),data=clone(catalog),template=clone(data[input.roster[0].name]);
  input.preset.kind='ATTACK';input.preset.enemyElement='木';input.budget=0;
  const make=(name,atk)=>{
    const raw={...clone(template),name,chara:name,atk:String(atk),base_atk:String(atk/5),hp:'10000',base_hp:'2000',duo:'',etc:''};
    for(const i of [1,2,3]) {
      raw['buddy'+i+'c']='';raw['buddy'+i+'s']='';raw['buddy'+i+'s_totsu']='';
      raw['magic'+i+'atr']='火';raw['magic'+i+'pow']='連撃(強)';
      for(const field of ['buf','heal','etc'])raw['magic'+i+field]='';
    }
    data[name]=raw;
    return {...clone(input.roster[0]),name,allowUpgrade:false};
  };
  const originals=Array.from({length:4},(_,i)=>make(`old-${i}`,1000));
  const strong=make('strong-new',30000),partner=make('weak-partner',10000);
  data[partner.name].buddy1c=strong.name;
  data[partner.name].buddy1s='ATKUP(中)';data[partner.name].buddy1s_totsu='ATKUP(中)';
  input.roster=[...originals,strong,partner,...Array.from({length:8},(_,i)=>make(`unrelated-${i}`,11000))];
  input.supports=[make('fixed-support',1000)];
  const cards=originals.map(c=>variants.cardVariants(c,'SSR')[0]);
  cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const parent={id:'reverse-buddy-regression',cards,cost:0,estimate:0,challengeIds:[],policy:'effects-tail'};
  const neighbors=await generation.generateNeighbors(input,parent,data,new Set(),()=>false);
  assert.ok(neighbors.some(c=>c.cards.some(x=>x.name===strong.name)&&c.cards.some(x=>x.name===partner.name)),
    'the weaker partner is below the solo shortlist but becomes stronger through its own buddy');
});

test('effect-aware policy excludes an unexecuted second hit and truly holds the BASIC finisher', () => {
  const pair = (ids,damage,firstDamage,finisherUsed=false) => ({ids,damage,firstDamage,finisherUsed,duo:0,heal:0,utility:0,defense:0});
  const observation={turn:4,kind:'BASIC',enemyHp:10000,playerHp:20000,maxHp:30000,
    pairs:[pair(['small','large'],40000,11000),pair(['large','small'],40000,29000)]};
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects')),['large','small']);
  observation.turn=2; observation.enemyHp=100000;
  observation.pairs=[pair(['finisher','x'],70000,50000,true),pair(['y','z'],15000,8000)];
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects-reserve')),['y','z']);
});


test('spell search covers every changed loadout without relying on earlier composition refinements',()=>{
  const input=fixture();
  input.roster=input.roster.map(c=>({...c,totsu:4}));
  input.supports=input.supports.map(c=>({...c,totsu:4}));
  const cards=[...input.roster.slice(0,4).map(c=>variants.cardVariants(c,'SSR')[0]),variants.cardVariants(input.supports[0],'SSR',true)[0]];
  const parent={cards,cost:0,policy:'effects-tail',challengeIds:['locked'],id:'original',estimate:0,preferredPlan:[['0-M1','1-M1']],preferredPlanMode:'turn'};
  const children=variants.jointSpellCandidates(input,parent,catalog);
  assert.equal(children.length,242);
  assert.equal(new Set(children.map(c=>c.id)).size,242);
  assert.equal(children.filter(child=>child.cards.filter((c,i)=>c.selectedMagic.join(',')!==cards[i].selectedMagic.join(',')).length===1).length,10);
  assert.deepEqual(clone(children),clone(variants.jointSpellCandidates(input,parent,catalog)));
  for(const child of children){
    assert.equal(child.cost,0);assert.equal(child.preferredPlan,undefined);assert.equal(child.preferredPlanMode,undefined);
    assert.deepEqual(clone(child.challengeIds),['locked']);
    assert.ok(child.cards.some((c,i)=>c.selectedMagic.join(',')!==cards[i].selectedMagic.join(',')));
    child.cards.forEach((c,i)=>{for(const key of ['name','level','totsu','originalTotsu','support'])assert.equal(c[key],cards[i][key]);});
  }
});


test('broad discovery uses one policy and measured-team refinements retain the other policies',()=>{
  const input=fixture();
  for(const kind of ['BASIC','ATTACK','DEFENCE']){
    input.preset.kind=kind;
    const task=generation.buildTasks(input,catalog)[0];
    const initial=generation.generateCandidates(input,task,catalog);
    assert.equal(new Set(initial.map(c=>c.policy)).size,1);
    const parent={...initial[0],preferredPlan:[['0-M1','1-M1']],preferredPlanMode:'turn'};
    const children=variants.alternatePolicyCandidates(input,parent);
    assert.ok(children.length>=4);
    assert.ok(children.every(c=>c.policy!==parent.policy&&c.cards===parent.cards&&c.cost===parent.cost&&!c.preferredPlan&&!c.preferredPlanMode));
    assert.equal(new Set(children.map(c=>c.id)).size,children.length);
  }
});


test('two-turn allied setup remains available to a DUO with a different partner next turn',()=>{
  const input=fixture();input.preset.kind='ATTACK';input.preset.specialChallenges=[];
  const bare=clone(catalog);
  const cards=[...input.roster.map(c=>variants.cardVariants(c,'SSR')[0]),variants.cardVariants(input.supports[0],'SSR',true)[0]];
  for(const card of cards){const raw=bare[card.name];raw.chara=card.name;raw.etc='';for(let i=1;i<=3;i++){raw['magic'+i+'buf']='';raw['buddy'+i+'s']='';raw['buddy'+i+'s_totsu']='';}}
  bare[cards[0].name].duo=bare[cards[1].name].chara;
  const task={anchor:'',totsu:0,cost:0,challenges:[],style:0};
  const withDuration=duration=>{
    const data=clone(bare);data[cards[2].name].etc=`ATKUP(中)(味方全体/${duration}T)(M1)`;
    return generation.createEstimator(input,task,data)(cards);
  };
  assert.ok(withDuration(2)>withDuration(1));
  assert.equal(withDuration(2),withDuration(3));
});


test('refinement visits every item band before spending time on second-choice parents',()=>{
  const input=fixture(),session=new SearchSession(input,catalog,{},'band-refinement');
  session.pool=[0,1,2,3].flatMap(cost=>Array.from({length:4},(_,index)=>({
    candidate:{id:`${cost}-${index}`,cost,cards:[{name:`${cost}-${index}`}],policy:'effects-tail'},
    development:{scores:[50000-index*100]},validation:{scores:[]},validationTarget:2048
  })));
  const parents=session.diverseParents(4);
  assert.deepEqual(clone(parents.slice(0,4).map(r=>r.candidate.cost)),[0,1,2,3]);
  assert.equal(new Set(parents.map(r=>r.candidate.id)).size,16);
});

test('local refinement can move the upgrade budget between members without changing the five cards', async()=>{
  const input=fixture();input.maxRemoved=1;
  const cards=input.roster.map((c,index)=>variants.cardVariants(c,'SSR',false,index===0?3:c.totsu)[0]);
  cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const parent={id:'upgrade-transfer-regression',cards,cost:3,estimate:0,challengeIds:[],policy:'effects-tail'};
  const neighbors=await generation.generateNeighbors(input,parent,catalog,new Set(),()=>false);
  for(const next of input.roster.slice(1))assert.ok(neighbors.some(candidate=>candidate.cost===3
    &&candidate.cards.every(c=>cards.some(old=>old.name===c.name&&old.support===c.support))
    &&candidate.cards.some(c=>!c.support&&c.name===input.roster[0].name&&c.totsu===0&&c.level===80)
    &&candidate.cards.some(c=>!c.support&&c.name===next.name&&c.totsu===3&&c.level===95)),
    `missing upgrade transfer to ${next.name}`);
});

test('every available support has a forced baseline path without buying owned upgrades',()=>{
  const input=fixture();
  const extra=Object.values(catalog).find(c=>c.rare==='SSR'&&!input.supports.some(s=>s.name===c.name));
  input.supports.push({...clone(input.supports[0]),name:extra.name});
  const tasks=generation.buildTasks(input,catalog),forced=tasks.filter(task=>task.supportAnchor);
  assert.deepEqual([...new Set(forced.map(task=>task.supportAnchor))].sort(),input.supports.map(c=>c.name).sort());
  assert.ok(tasks.findIndex(task=>task.supportAnchor)<8,'support paths must start before the full owned catalogue finishes');
  for(const task of forced) {
    assert.equal(task.cost,0);
    const candidates=generation.generateCandidates(input,task,catalog);
    assert.ok(candidates.length);
    for(const candidate of candidates) {
      assert.deepEqual(clone(candidate.cards.filter(c=>c.support).map(c=>c.name)),[task.supportAnchor]);
      assert.ok(candidate.cards.filter(c=>!c.support).every(c=>c.totsu===c.originalTotsu));
      assert.equal(candidate.cost,0);
    }
  }
});

test('critical-tail ceilings survive alongside higher-frequency teams in every cost band',()=>{
  const input=fixture(),session=new SearchSession(input,catalog,{},'ceiling-test');
  const row=(id,cost,scores)=>({candidate:{id,cost,cards:[{name:id}],policy:'effects-tail'},development:{scores},validation:{scores:[]},validationTarget:2048});
  const reliable=row('reliable',1,Array(64).fill(48000)),rare=row('rare',1,[60000,...Array(63).fill(0)]);
  // Two policies on the same composition must not eliminate one another.
  reliable.candidate.cards=rare.candidate.cards;
  const baseline=row('baseline',0,Array(64).fill(45000));
  session.pool=[reliable,rare,baseline];
  assert.deepEqual(clone(session.diverseParents(2).filter(r=>r.candidate.cost===1).map(r=>r.candidate.id)),['rare','reliable']);
  session.selectFinalists();
  assert.ok(session.checkpoint().finalists.some(r=>r.candidate.id==='rare'));
  assert.ok(session.checkpoint().finalists.some(r=>r.candidate.id==='reliable'));
  assert.ok(session.checkpoint().finalists.every(r=>r.validation.scores.length===0));
});


test('compact results maximize score within the requested reach condition in each cost band',()=>{
  const row=(id,cost,successes,max)=>({candidate:{id,cost},validationTarget:2048,
    validation:{scores:[max,...Array(successes-1).fill(51000),...Array(2048-successes).fill(0)]}});
  const lucky=row('rare',1,1,60000),qualified=row('qualified',1,100,55000),consistent=row('consistent',1,200,53000);
  const baseline=row('baseline',0,1,52000);
  assert.deepEqual(clone(stats.compactResults([lucky,consistent,qualified,baseline],50000,30,.05).map(r=>r.candidate.id)),['baseline','qualified']);
  assert.equal(stats.compactResults([lucky],50000,30,.05)[0].candidate.id,'rare');
});

test('display packets preserve measured probabilities and ranking without transporting trial arrays or hypothetical scores',()=>{
  const rows=[0,1].map(cost=>({candidate:{id:'display-'+cost,cost,cards:[]},validationTarget:32768,
    development:{scores:Array(512).fill(90000),retired:0,turns:2048},
    criticalScout:{attempted:8,score:999999,idealHand:true},
    validation:{scores:Array.from({length:32768},(_,index)=>index%(cost?2:4)?49000:52000),retired:0,turns:131072},
    validationBest:{seed:'measured-best-'+cost,score:52000}}));
  const progress={phase:'validate',generated:2,evaluated:2,tasksDone:2,tasksTotal:2,elapsedMs:1000,results:rows};
  const packet=stats.displayProgress(progress,50000,30);
  assert.ok(JSON.stringify(packet).length<2000,'progress size is independent of the number of stored trials');
  for(const [index,row] of packet.results.entries()) {
    assert.equal(row.validation.scores.length,0);assert.equal(row.development.scores.length,0);
    assert.equal(row.criticalScout,undefined);
    assert.deepEqual(clone(stats.resultMetrics(row,50000,30)),clone(stats.metrics(rows[index].validation,50000,30)));
    assert.deepEqual(clone(row.validationBest),rows[index].validationBest);
    assert.equal(rows[index].validation.scores.length,32768,'display conversion must not mutate the checkpoint');
  }
  assert.deepEqual(clone(stats.rankedResults(packet.results,50000,30,.05).map(r=>r.candidate.id)),
    clone(stats.rankedResults(rows,50000,30,.05).map(r=>r.candidate.id)));
  assert.deepEqual(clone(stats.compactResults(packet.results,50000,30,.05).map(r=>r.candidate.id)),
    clone(stats.compactResults(rows,50000,30,.05).map(r=>r.candidate.id)));
});

test('score distribution keeps the observed maximum separate from the nearest-rank 95th percentile',()=>{
  const samples={scores:[999,...Array(17).fill(100),Number.NaN,-3],retired:2,turns:20};
  assert.deepEqual(clone(stats.scoreDistribution(samples)),{n:20,max:999,p95:100});
  assert.deepEqual(clone(stats.resultScoreDistribution({validation:samples})),{n:20,max:999,p95:100});
  assert.deepEqual(clone(stats.resultScoreDistribution({validation:{scores:[]}})),{n:0,max:0,p95:null});
});

test('display packets retain score distribution and legacy summaries provide max without inventing p95',()=>{
  const samples={scores:[1000,...Array(19).fill(0)],retired:19,turns:20};
  const source={candidate:{id:'distribution',cost:0},validation:samples,validationTarget:20};
  const displayed=stats.displayProgress({results:[source]},50000,30).results[0];
  assert.deepEqual(clone(displayed.validationSummary.scoreDistribution),{n:20,max:1000,p95:0});
  assert.deepEqual(clone(stats.resultScoreDistribution(displayed)),{n:20,max:1000,p95:0});
  const legacy={validation:{scores:[]},validationSummary:{target:50000,attempts:30,metrics:{n:20,successes:0,p:0,reach:0,low:0,high:0,max:777}}};
  assert.deepEqual(clone(stats.resultScoreDistribution(legacy)),{n:20,max:777,p95:null});
});

test('an unobserved critical template reaches ordinary validation without displacing the measured peak',()=>{
  const input=fixture();input.target=50000;
  const session=new SearchSession(input,catalog,{},'unobserved-template');
  const row=(id,score,ceiling)=>({candidate:{id,cost:0,cards:[{name:id}],policy:'effects-tail'},
    development:{scores:Array(64).fill(score)},criticalScout:ceiling?{attempted:8,score:ceiling,idealHand:true}:undefined,
    validation:{scores:[]},validationTarget:2048});
  session.pool=[row('measured-peak',49000),row('ordinary-runner-up',48900),row('template',47000,55000)];
  // Fill the other bands so each band has the normal two finalist slots.
  for(const cost of [1,2,3])session.pool.push({...row('other-'+cost,49000),candidate:{id:'other-'+cost,cost,cards:[{name:'other-'+cost}]}});
  session.selectFinalists();
  const selected=session.checkpoint().finalists;
  assert.ok(selected.some(r=>r.candidate.id==='measured-peak'));
  assert.ok(selected.some(r=>r.candidate.id==='template'));
  assert.ok(selected.every(r=>r.validation.scores.length===0));
  assert.ok(selected.every(r=>!r.validationBest));
  session.finalists=[0,1,2,3].map(cost=>({...row('retained-'+cost,48000),
    candidate:{id:'retained-'+cost,cost,cards:[{name:'retained-'+cost}]},
    validation:{scores:Array(2048).fill(48000)},validationTarget:2048}));
  session.selectFinalists();
  assert.ok(session.checkpoint().finalists.some(r=>r.candidate.id==='retained-0'));
  assert.ok(session.checkpoint().finalists.some(r=>r.candidate.id==='template'),
    'a continuation must use its one remaining slot to test the new template');
});

test('flexible plans reorder visible preparation pairs while protecting buff timing and the finisher',()=>{
  const steps=[{ids:['a1','a2'],earliestTurn:1,requires:[]},{ids:['setup','b2'],earliestTurn:2,requires:[]},
    {ids:['c1','c2'],earliestTurn:1,requires:[]},{ids:['finish','partner'],earliestTurn:4,requires:['setup']}];
  const visible=steps.flatMap(s=>s.ids);
  assert.deepEqual(clone(policy.chooseFlexiblePlanPair(1,visible.filter(id=>!id.startsWith('a')),new Set(),steps)),['c1','c2']);
  assert.deepEqual(clone(policy.chooseFlexiblePlanPair(2,visible,new Set(['c1','c2']),steps)),['setup','b2']);
  assert.equal(policy.chooseFlexiblePlanPair(4,['finish','partner'],new Set(),steps),null);
  assert.deepEqual(clone(policy.chooseFlexiblePlanPair(4,['finish','partner'],new Set(['setup','b2']),steps)),['finish','partner']);
  assert.equal(policy.chooseFlexiblePlanPair(3,['finish','partner'],new Set(['setup','b2']),steps),null);
});

test('split upgrade allocations include every budget distribution and restore each registered level',async()=>{
  const input=fixture(),before=clone(input.roster);
  const cards=input.roster.map(c=>variants.cardVariants(c,'SSR')[0]);
  cards[0]=variants.cardVariants(input.roster[0],'SSR',false,3)[1];
  cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const parent={id:'split',cards,cost:3,policy:'effects',estimate:1,challengeIds:[],preferredPlan:[['0-M3','1-M1']]};
  const neighbors=await generation.generateNeighbors(input,parent,catalog,new Set([parent.id]),()=>false);
  assert.ok(neighbors.some(c=>c.cards[0].totsu===1&&c.cards[1].totsu===1&&c.cost===2));
  assert.ok(neighbors.some(c=>c.cards[0].totsu===1&&c.cards[1].totsu===1&&c.cards[2].totsu===1&&c.cost===3));
  for(const c of neighbors){
    assert.equal(c.cost,variants.upgradeCost(input,c.cards));assert.ok(c.cost<=3);
    for(const card of c.cards.filter(c=>!c.support)) {
      const registered=input.roster.find(r=>r.name===card.name);
      assert.equal(card.level,Math.min(120,registered.level+5*(card.totsu-registered.totsu)));
      assert.ok(card.totsu>=3||!card.selectedMagic.includes(3));
    }
  }
  const split=neighbors.find(c=>c.cards[0].totsu===1&&c.cards[1].totsu===1&&c.cost===2);
  const cheaper=variants.lowerCostCandidates(input,split,catalog);
  assert.ok(cheaper.some(c=>c.cost===0));
  assert.ok(cheaper.some(c=>c.cost===1&&c.cards[0].totsu===0&&c.cards[1].totsu===1));
  assert.ok(cheaper.some(c=>c.cost===1&&c.cards[0].totsu===1&&c.cards[1].totsu===0));
  assert.deepEqual(input.roster,before);
  input.itemsPerLimitBreak=2;
  const expensive=[...variants.allocationCards(input,parent,catalog)];
  assert.ok(expensive.every(c=>variants.upgradeCost(input,c)<=3));
  assert.ok(expensive.every(c=>c.filter(x=>!x.support&&x.totsu>x.originalTotsu).length<=1));
});

test('crossing singly upgraded teams can retain both investments within the total budget',()=>{
  const input=fixture();input.budget=2;
  const base=input.roster.map(c=>variants.cardVariants(c,'SSR')[0]);
  base.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const make=index=>({id:String(index),cards:base.map((c,i)=>i===index?variants.cardVariants(input.roster[i],'SSR',false,1)[0]:c),
    cost:1,estimate:0,challengeIds:[],policy:'effects'});
  const crossed=generation.crossCandidates(input,make(0),make(1),catalog,new Set());
  assert.ok(crossed.some(c=>c.cost===2&&c.cards.filter(x=>!x.support&&x.totsu>x.originalTotsu).length===2));
  input.budget=1;
  assert.ok(generation.crossCandidates(input,make(0),make(1),catalog,new Set()).every(c=>c.cost<=1));
});

test('shared budget can unlock M3 on two cards while leaving the support free',()=>{
  const input=fixture();input.budget=4;
  input.roster[0].totsu=1;input.roster[1].totsu=1;
  input.roster[2].allowUpgrade=false;input.roster[3].allowUpgrade=false;
  const cards=input.roster.map(c=>variants.cardVariants(c,'SSR')[0]);
  cards.push(variants.cardVariants(input.supports[0],'SSR',true,4)[2]);
  const parent={id:'double-unlock',cards,cost:0,estimate:0,challengeIds:[],policy:'effects'};
  const allocations=[...variants.allocationCards(input,parent,catalog)];
  const joint=allocations.find(c=>c[0].totsu===3&&c[1].totsu===3&&c[0].selectedMagic.includes(3)&&c[1].selectedMagic.includes(3));
  assert.ok(joint);assert.equal(variants.upgradeCost(input,joint),4);
  assert.equal(joint[0].level,90);assert.equal(joint[1].level,90);
  assert.ok(allocations.every(c=>c[2].totsu===0&&c[3].totsu===0&&c[4].totsu===4));
  const reduced=variants.lowerCostCandidates(input,{...parent,cards:joint,cost:4,preferredPlan:[['0-M3','1-M3']]},catalog);
  assert.ok(reduced.some(c=>c.cost===0));
  assert.ok(reduced.every(c=>!c.preferredPlan));
});

test('input rejects budgets outside the displayed four-break limit before allocation expansion',()=>{
  const input=fixture();input.itemsPerLimitBreak=10;
  input.budget=40;assert.equal(variants.validateInput(input,catalog),null);
  input.budget=50;assert.equal(variants.validateInput(input,catalog),'budget');
  input.budget=35;assert.equal(variants.validateInput(input,catalog),null,'unused item remainders do not buy an additional break');
});

test('ATK score-aware finishing compares score contributions instead of excess damage',()=>{
  const pair=(ids,damage,projectedScore)=>({ids,damage,firstDamage:damage,projectedScore,duo:0,heal:0,utility:0,defense:0,finisherUsed:false});
  const observation={turn:6,kind:'ATTACK',enemyHp:10000,playerHp:5000,maxHp:60000,
    pairs:[pair(['large','plain'],35000,48000),pair(['buff','attacker'],20000,49200),pair(['not-lethal','buff'],9000,51000)]};
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects-score')),['buff','attacker']);
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects')),['large','plain']);
  const input=fixture();input.preset.kind='ATTACK';
  assert.ok(variants.alternatePolicyCandidates(input,{cards:[],challengeIds:[],policy:'effects'}).some(c=>c.policy==='effects-score'));
});

test('initial construction can discover two M3 unlocks before either team has won a trial',()=>{
  const input=fixture(),data=clone(catalog);input.budget=4;
  input.roster.forEach((c,index)=>{c.totsu=1;c.allowUpgrade=index<2;});
  input.preset.kind='ATTACK';input.preset.enemyElement='木';input.preset.specialChallenges=[];
  for(const c of input.roster.slice(0,2)){
    const raw=data[c.name];raw.atk='30000';raw.base_atk='6000';raw.magic3atr='火';raw.magic3pow='連撃(強)';
    raw.magic1atr='水';raw.magic1pow='単発(弱)';raw.magic2atr='水';raw.magic2pow='単発(弱)';
  }
  // Keep unified team size without relying on any measured parent or seed team.
  input.preset.title='統一試験';
  const candidates=generation.generateCandidates(input,{anchor:input.roster[0].name,totsu:3,cost:2,style:2,challenges:[]},data);
  assert.ok(candidates.some(c=>input.roster.slice(0,2).every(r=>c.cards.some(x=>!x.support&&x.name===r.name&&x.totsu===3&&x.selectedMagic.includes(3)))));
  for(const c of candidates){assert.equal(c.cost,variants.upgradeCost(input,c.cards));assert.ok(c.cost<=4);}
});

test('a fixed support does not force the owned partner used to order the task',()=>{
  const input=fixture(),data=clone(catalog);
  const extra=Object.values(data).find(c=>c.rare==='SSR'&&!input.roster.some(r=>r.name===c.name));
  input.roster.push({...clone(input.roster[0]),name:extra.name});input.budget=0;
  const weak=input.roster[0],raw=data[weak.name];raw.atk='1';raw.base_atk='1';raw.hp='1';raw.base_hp='1';
  for(const i of [1,2,3]){raw['buddy'+i+'c']='';raw['buddy'+i+'s']='';raw['buddy'+i+'s_totsu']='';raw['magic'+i+'buf']='';raw['magic'+i+'heal']='';}
  raw.etc='';raw.duo='';
  const candidates=generation.generateCandidates(input,{anchor:weak.name,totsu:weak.totsu,cost:0,style:0,
    challenges:[],supportFirst:true,supportAnchor:input.supports[0].name},data);
  assert.ok(candidates.some(c=>!c.cards.some(card=>!card.support&&card.name===weak.name)));
  assert.ok(candidates.every(c=>c.cards.filter(card=>card.support).length===1&&c.cards.some(card=>card.support&&card.name===input.supports[0].name)));
});

test('buddy packages retain pairs and add bounded triple packages for BASIC and ATTACK',()=>{
  const makeInput=(kind)=>{
    const input=fixture(),data=clone(catalog);input.preset.kind=kind;
    input.roster.forEach((c,i)=>{data[c.name].chara='package-'+i;});
    const root=data[input.roster[0].name];
    root.buddy1c='package-1';root.buddy1s='HPUP(中)';root.buddy1s_totsu='HPUP(中)&クリティカル(小)';
    root.buddy2c='package-2';root.buddy2s='ATKUP(中)';root.buddy2s_totsu='ATKUP(中)';
    root.buddy3c='package-3';root.buddy3s='ATKUP(中)';root.buddy3s_totsu='ATKUP(中)';
    input.supports[0].totsu=4;
    return {input,data,root};
  };
  for(const kind of ['BASIC','ATTACK']) {
    const {input,data,root}=makeInput(kind);
    const tasks=generation.buildTasks(input,data);
    const packageTasks=tasks.filter(t=>!t.supportAnchor&&t.anchor===root.name&&t.requiredCharacters);
    const triple=packageTasks.find(t=>t.requiredCharacters.length===3);
    assert.ok(triple,`${kind} should schedule one triple package`);
    for(const pair of [['package-1','package-2'],['package-1','package-3'],['package-2','package-3']])
      assert.ok(packageTasks.some(t=>t.requiredCharacters.length===2&&pair.every(name=>t.requiredCharacters.includes(name))),`${kind} should retain pair ${pair.join('+')}`);
    const supportTriple=tasks.find(t=>t.supportAnchor===root.name&&t.requiredCharacters?.length===3);
    assert.ok(supportTriple,`${kind} should schedule the support triple package`);
    for(const task of [triple,supportTriple]) {
      const candidates=generation.generateCandidates(input,task,data);assert.ok(candidates.length);
      for(const c of candidates) {
        assert.ok(task.requiredCharacters.every(name=>c.cards.some(card=>data[card.name].chara===name)));
        assert.equal(c.cost,variants.upgradeCost(input,c.cards));assert.ok(c.cost<=input.budget);
        assert.equal(c.cards.filter(card=>card.support).length,1);
        assert.ok(c.cards.filter(card=>!card.support).every(card=>input.roster.some(rawCard=>rawCard.name===card.name)));
        assert.ok(c.cards.every(card=>card.selectedMagic.length===2
          &&(!card.selectedMagic.includes(3)||card.totsu>=3)));
      }
    }
  }
  const {input,data,root}=makeInput('DEFENCE');
  assert.equal(generation.buildTasks(input,data).some(t=>t.anchor===root.name&&t.requiredCharacters?.length===3),false);
});

test('buddy packages construct the critical and attack partners together with legal training',()=>{
  const input=fixture(),data=clone(catalog);input.preset.kind='BASIC';
  input.roster.forEach((c,i)=>{data[c.name].chara='package-'+i;});
  const root=data[input.roster[0].name];
  root.buddy1c='package-1';root.buddy1s='HPUP(中)';root.buddy1s_totsu='HPUP(中)&クリティカル(小)';
  root.buddy2c='package-2';root.buddy2s='ATKUP(中)';root.buddy2s_totsu='ATKUP(中)';
  root.buddy3c='';root.buddy3s='';root.buddy3s_totsu='';
  input.supports[0].totsu=4;
  const tasks=generation.buildTasks(input,data);
  const own=tasks.find(t=>!t.supportAnchor&&t.anchor===root.name&&t.totsu===3&&t.requiredCharacters?.includes('package-1')&&t.requiredCharacters?.includes('package-2'));
  const support=tasks.find(t=>t.supportAnchor===root.name&&t.requiredCharacters?.includes('package-1')&&t.requiredCharacters?.includes('package-2'));
  assert.ok(own);assert.ok(support);assert.ok(tasks.some(t=>!t.requiredCharacters));
  for(const task of [own,support]) {
    const candidates=generation.generateCandidates(input,task,data);assert.ok(candidates.length);
    for(const c of candidates) {
      assert.ok(task.requiredCharacters.every(name=>c.cards.some(card=>data[card.name].chara===name)));
      assert.equal(c.cost,variants.upgradeCost(input,c.cards));assert.ok(c.cost<=input.budget);
      assert.equal(c.cards.filter(card=>card.support).length,1);
    }
  }
});

test('buddy package ordering includes reciprocal benefits instead of only the anchor benefit',()=>{
  const input=fixture(),data=clone(catalog);input.budget=0;input.preset.kind='DEFENCE';
  input.roster.forEach((card,i)=>{
    const raw=data[card.name];raw.chara='reciprocal-'+i;raw.hp='10000';raw.base_hp='2000';raw.atk='1';raw.base_atk='1';raw.growtype='BAL';
    for(const b of [1,2,3]){raw['buddy'+b+'c']='';raw['buddy'+b+'s']='';raw['buddy'+b+'s_totsu']='';}
  });
  for(const [index,partner,power] of [[0,1,'小'],[1,0,'大'],[2,3,'中']]){
    const raw=data[input.roster[index].name];raw.buddy1c='reciprocal-'+partner;
    raw.buddy1s=raw.buddy1s_totsu=`HPUP(${power})`;
  }
  const packages=generation.buildTasks(input,data).filter(t=>!t.supportAnchor&&t.requiredCharacters);
  const reciprocal=packages.findIndex(t=>t.anchor===input.roster[0].name);
  const oneWay=packages.findIndex(t=>t.anchor===input.roster[2].name);
  assert.ok(reciprocal>=0&&oneWay>=0);
  assert.ok(reciprocal<oneWay,'two active HP buddies outrank the individually larger one-way buff');
});

test('host yielding resolves concurrent requests in order on the message-channel fallback',async()=>{
  const relative='src/utils/yieldToHost.ts',module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync(path.join(root,relative),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,MessageChannel,setTimeout},{filename:relative});
  const order=[];
  const requests=Array.from({length:16},(_,i)=>module.exports.yieldToHost().then(()=>order.push(i)));
  assert.equal(order.length,0,'yield must leave the current task');
  await Promise.all(requests);
  assert.deepEqual(order,Array.from({length:16},(_,i)=>i));
});

test('weighted critical likelihood preserves a reachable tail over an implausible forced ceiling',()=>{
  const input=fixture();input.target=50000;
  const session=new SearchSession(input,catalog,{},'weighted-selection');
  const row=(id,cost,score,ceiling,successWeight)=>({candidate:{id,cost,cards:[{name:id}],policy:'effects-tail'},
    development:{scores:Array(32).fill(score)},criticalScout:{attempted:32,score:ceiling},
    importance:{n:512,successWeight,upperScore:score},validation:{scores:[]},validationTarget:2048});
  const before=Array(32).fill(47000);
  const tail=row('reachable-tail',0,47000,52000,2);tail.importance.upperScore=52000;tail.development.scores=[...before];
  session.pool=[row('peak',0,49000,49000,0),row('impossible-ceiling',0,48000,999999,.001),tail];
  for(const cost of [1,2,3])for(let i=0;i<2;i++)session.pool.push(row('other-'+cost+'-'+i,cost,49000,49000,0));
  assert.ok(session.diverseParents(3).some(r=>r.candidate.id==='reachable-tail'));
  session.selectFinalists();
  const selected=session.checkpoint().finalists;
  assert.ok(selected.some(r=>r.candidate.id==='peak'));
  assert.ok(selected.some(r=>r.candidate.id==='reachable-tail'));
  assert.ok(!selected.some(r=>r.candidate.id==='impossible-ceiling'));
  assert.deepEqual(tail.development.scores,before);
  assert.ok(selected.every(r=>r.validation.scores.length===0));
  const packet=stats.displayProgress({results:selected},50000,30);
  assert.ok(packet.results.every(r=>r.importance===undefined),'proposal rates cannot be displayed as measured probabilities');
});

test('importance upper tails retain a reachable score before any ordinary trial reaches target',()=>{
  const input=fixture();input.target=50000;
  const session=new SearchSession(input,catalog,{},'weighted-upper-score');
  const row=(id,score,upperScore,scout=0)=>({candidate:{id,cost:0,cards:[{name:id}],policy:'effects-tail'},
    development:{scores:Array(32).fill(score)},criticalScout:{attempted:32,score:scout},
    importance:{n:32,successWeight:0,upperScore},validation:{scores:[]},validationTarget:2048});
  const ordinary=row('ordinary',49000,49000),weighted=row('weighted-tail',48000,52000),forced=row('forced-scout',47000,47000,60000);
  const before=ordinary.development.scores.slice();
  session.pool=[ordinary,weighted,forced];
  assert.ok(session.diverseParents(3).some(r=>r.candidate.id==='weighted-tail'));
  session.selectFinalists();
  const selected=session.checkpoint().finalists;
  assert.ok(selected.some(r=>r.candidate.id==='weighted-tail'));
  assert.deepEqual(ordinary.development.scores,before);
  const packet=stats.displayProgress({results:selected},50000,30);
  assert.ok(packet.results.every(r=>r.importance===undefined),'weighted upper scores are internal ranking data');
});

test('positive weighted tails retain a second finalist below the measured ceiling',()=>{
  const input=fixture();input.target=50000;
  const session=new SearchSession(input,catalog,{},'weighted-positive-finalist');
  const row=(id,cost,score,upperScore,successWeight,cardName=id,preferredPlan)=>({candidate:{id,cost,cards:[{name:cardName}],policy:'effects-tail',preferredPlan},
    development:{scores:Array(32).fill(score)},importance:{n:512,successWeight,observations:[],upperScore},
    validation:{scores:[]},validationTarget:2048});
  const bands=Array.from({length:4},(_,cost)=>[
    row(`ordinary-ceiling-${cost}`,cost,52000,52000,0,`same-card-${cost}`,[['ceiling']]),
    row(`positive-tail-${cost}`,cost,48000,49000,2,`same-card-${cost}`,[['positive']]),
    row(`ordinary-fallback-${cost}`,cost,49000,49000,0,`fallback-card-${cost}`,[['fallback']])]);
  const ceiling=bands[0][0],positive=bands[0][1];
  assert.ok(positive.importance.upperScore<ceiling.development.scores[0]);
  session.pool=bands.flat();
  session.selectFinalists();
  const selected=session.checkpoint().finalists;
  for(const [,tail] of bands)assert.ok(selected.some(result=>result.candidate.id===tail.candidate.id),
    'each positive weighted tail must survive even below its measured peak');
  assert.ok(selected.some(result=>result.candidate.id===ceiling.candidate.id));
  assert.ok(selected.every(result=>result.validation.scores.length===0));
});

test('positive weighted tails get the new slot beside every retained cost band',()=>{
  const input=fixture();input.target=50000;
  const session=new SearchSession(input,catalog,{},'weighted-retained-slot');
  const row=(id,cost,score,upperScore=score,successWeight=0)=>({candidate:{id,cost,cards:[{name:id}],policy:'effects-tail'},
    development:{scores:Array(32).fill(score)},importance:{n:64,successWeight,observations:[],upperScore},
    validation:{scores:[]},validationTarget:2048});
  const retained=Array.from({length:4},(_,cost)=>({...row(`retained-${cost}`,cost,48000),
    validation:{scores:Array(2048).fill(48000)},validationTarget:2048,
    validationBest:{score:48000,seed:`retained-seed-${cost}`,turn:4}}));
  const retainedBefore=retained.map(result=>({validation:clone(result.validation),validationBest:clone(result.validationBest)}));
  const positive=Array.from({length:4},(_,cost)=>row(`positive-${cost}`,cost,47000,49000,1));
  const ceiling=Array.from({length:4},(_,cost)=>row(`ceiling-${cost}`,cost,52000,52000,0));
  session.finalists=retained;
  session.pool=[...positive,...ceiling];
  session.selectFinalists();
  const selected=session.checkpoint().finalists;
  for(const result of positive)assert.ok(selected.some(candidate=>candidate.candidate.id===result.candidate.id));
  retained.forEach((result,index)=>{
    const kept=selected.find(candidate=>candidate.candidate.id===result.candidate.id);
    assert.deepEqual(clone(kept.validation),retainedBefore[index].validation);
    assert.deepEqual(clone(kept.validationBest),retainedBefore[index].validationBest);
  });
});

test('without a positive weighted tail finalist fallback remains unchanged',()=>{
  const input=fixture();input.target=50000;
  const session=new SearchSession(input,catalog,{},'weighted-no-positive');
  const row=(id,score,upperScore)=>({candidate:{id,cost:0,cards:[{name:id}],policy:'effects-tail'},
    development:{scores:Array(32).fill(score)},importance:{n:64,successWeight:0,observations:[],upperScore},
    validation:{scores:[]},validationTarget:2048});
  session.pool=[row('measured',48000,48000),row('upper-fallback',47000,52000)];
  session.selectFinalists();
  assert.ok(session.checkpoint().finalists.some(result=>result.candidate.id==='upper-fallback'));
});

test('finalist selection deduplicates separate objects with the same candidate ID',()=>{
  const input=fixture();input.target=50000;
  const session=new SearchSession(input,catalog,{},'weighted-duplicate-id');
  const row=(id,name,score)=>({candidate:{id,cost:0,cards:[{name}],policy:'effects-tail'},
    development:{scores:Array(32).fill(score)},validation:{scores:[]},validationTarget:2048});
  session.pool=[row('duplicate','first-copy',52000),row('duplicate','second-copy',51000),row('distinct','other',50000)];
  session.selectFinalists();
  assert.equal(session.checkpoint().finalists.filter(result=>result.candidate.id==='duplicate').length,1);
});

test('finalist selection handles restored large development batches without spread limits',()=>{
  const input=fixture();input.target=50000;
  const session=new SearchSession(input,catalog,{},'large-development-batch');
  const scores=Array(200000).fill(49000);
  session.pool=[{candidate:{id:'large-batch',cost:0,cards:[{name:'large-batch'}],policy:'effects-tail'},
    development:{scores},validation:{scores:[]},validationTarget:2048}];
  session.selectFinalists();
  assert.equal(session.checkpoint().finalists[0].candidate.id,'large-batch');
  assert.equal(scores.length,200000);
});

test('importance screening rebuilds legacy summaries without touching validation',async()=>{
  const input=fixture();input.preset.kind='ATTACK';
  let calls=0;
  const engine={importanceTrial:()=>({score:1000+calls++,weight:.5}),trial:()=>({score:0,retired:false,finishTurn:1})};
  const session=new SearchSession(input,catalog,engine,'legacy-importance');
  const validation={scores:[123],retired:1,turns:2};
  const result={candidate:{id:'legacy',cost:0,cards:[],challengeIds:[],policy:'effects-duo',estimate:0},
    development:{scores:[]},importance:{n:2,successWeight:5},validation,validationTarget:2048};
  await session.importanceScreen(result,performance.now()+1000,2);
  assert.equal(result.importance.n,2);
  assert.equal(result.importance.successWeight,0);
  assert.equal(result.importance.observations.length,2);
  assert.ok(result.importance.upperScore>0);
  assert.deepEqual(result.validation,validation);
});

test('learned plans survive additional split upgrades without changing their spells or hand records',()=>{
  const input=fixture(),before=clone(input);
  const cards=input.roster.map(c=>variants.cardVariants(c,'SSR')[0]);
  cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const parent={id:'learned',cards,cost:0,policy:'effects-tail',estimate:0,challengeIds:[],
    preferredPlan:[['0-M1','1-M2'],['2-M1','3-M2']],preferredPlanMode:'flexible'};
  const candidates=variants.trainedUpgradeCandidates(input,parent,catalog);
  assert.ok(candidates.some(c=>c.cost===2&&c.cards[0].totsu===1&&c.cards[1].totsu===1));
  assert.ok(candidates.some(c=>c.cost===3&&c.cards[0].totsu===3));
  assert.ok(candidates.every((c,i)=>!i||c.cost>=candidates[i-1].cost));
  for(const candidate of candidates){
    assert.ok(candidate.cost>0&&candidate.cost<=input.budget);
    assert.equal(candidate.preferredPlan,parent.preferredPlan);
    assert.equal(candidate.preferredPlanMode,'flexible');
    assert.notEqual(candidate.id,parent.id);
    assert.deepEqual(clone(candidate.cards.map(c=>c.selectedMagic)),clone(cards.map(c=>c.selectedMagic)));
    for(const card of candidate.cards.filter(c=>!c.support)){
      const registered=input.roster.find(r=>r.name===card.name);
      assert.equal(card.level,Math.min(120,registered.level+5*(card.totsu-registered.totsu)));
    }
  }
  const noPlan=variants.trainedUpgradeCandidates(input,{...parent,preferredPlan:undefined,preferredPlanMode:undefined},catalog);
  assert.ok(noPlan.length);
  assert.ok(noPlan.every(c=>c.preferredPlan===undefined&&c.preferredPlanMode===undefined));
  assert.deepEqual(input,before);
});

test('no-plan trained upgrades include legal multi-card allocations with canonical IDs',()=>{
  const input=fixture();input.budget=2;const before=clone(input.roster);
  const cards=input.roster.map(c=>variants.cardVariants(c,'SSR')[0]);
  cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const parent={id:'no-plan',cards,cost:0,policy:'effects-tail',estimate:0,challengeIds:[]};
  const candidates=variants.trainedUpgradeCandidates(input,parent,catalog);
  const split=candidates.find(c=>c.cost===2&&c.cards[0].totsu===1&&c.cards[1].totsu===1);
  assert.ok(split,'the final pass should retain a two-card +1/+1 allocation');
  assert.ok(candidates.every(c=>c.cost>0&&c.cost<=input.budget));
  assert.ok(candidates.every(c=>c.preferredPlan===undefined&&c.preferredPlanMode===undefined));
  assert.ok(candidates.every(c=>JSON.parse(c.id).length===3&&!c.id.includes('null')));
  assert.deepEqual(clone(split.cards.map(c=>c.selectedMagic)),clone(cards.map(c=>c.selectedMagic)));
  for(const candidate of candidates)for(const card of candidate.cards.filter(c=>!c.support)) {
    const registered=input.roster.find(r=>r.name===card.name);
    assert.equal(card.level,Math.min(120,registered.level+5*(card.totsu-registered.totsu)));
  }
  assert.deepEqual(input.roster,before);
});

test('learned plans retain same-cost redistributions without duplicating the parent',()=>{
  const input=fixture(),before=clone(input.roster);
  const cards=input.roster.map(c=>variants.cardVariants(c,'SSR')[0]);
  cards[0]=variants.cardVariants(input.roster[0],'SSR',false,2)[0];
  cards[1]=variants.cardVariants(input.roster[1],'SSR',false,1)[0];
  cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const parent={id:'redistribution',cards,cost:3,policy:'effects-tail',estimate:0,challengeIds:[],
    preferredPlan:[['0-M1','1-M2']],preferredPlanMode:'flexible'};
  const candidates=variants.trainedUpgradeCandidates(input,parent,catalog);
  const threeZero=candidates.find(c=>c.cost===3&&c.cards[0].totsu===3&&c.cards[1].totsu===0);
  const oneTwo=candidates.find(c=>c.cost===3&&c.cards[0].totsu===1&&c.cards[1].totsu===2);
  assert.ok(threeZero,'a legal M3-unlocked 2+1 allocation can redistribute to 3+0');
  assert.ok(oneTwo,'same-cost redistribution must include 1+2');
  assert.ok(candidates.every(c=>c.cost>=parent.cost&&c.cost<=input.budget));
  assert.ok(candidates.every(c=>c.cards.some((card,i)=>card.totsu!==parent.cards[i].totsu)));
  assert.ok(candidates.every(c=>c.preferredPlan===parent.preferredPlan&&c.preferredPlanMode===parent.preferredPlanMode));
  assert.ok(candidates.every(c=>c.cards.every((card,i)=>card.selectedMagic.join(',')===parent.cards[i].selectedMagic.join(','))));
  assert.ok(candidates.every(c=>c.id!==parent.id));
  assert.deepEqual(input.roster,before);
  for(const candidate of [threeZero,oneTwo])for(const card of candidate.cards.filter(c=>!c.support)) {
    const registered=input.roster.find(r=>r.name===card.name);
    assert.equal(card.level,Math.min(120,registered.level+5*(card.totsu-registered.totsu)));
  }
});

test('the scheduler measures upgraded learned plans on fresh development trials',async()=>{
  const input=fixture();input.budget=2;
  let current;const measured=[];
  const engine={prepare:async(_,candidate)=>{current=candidate;},
    trial:seed=>{
      if(current.cost>0&&current.preferredPlan)measured.push({seed,cost:current.cost});
      return {score:current.preferredPlan?45000+current.cost*100:40000,retired:false,finishTurn:4};
    },
    learnPlan:async()=>current.cost===0?[['0-M1','1-M2']]:null};
  const session=new SearchSession(input,catalog,engine,'trained-upgrades');
  await session.run(2000,()=>{});
  assert.ok(measured.some(row=>row.seed.startsWith('trained-upgrades:development:')));
  assert.ok(measured.every(row=>row.cost<=2));
  assert.ok(session.checkpoint().pool.some(row=>row.candidate.cost>0&&row.candidate.preferredPlan&&row.development.scores.length>=64));
});

test('loadout refinement skips a duplicate candidate shared by multiple parents', async()=>{
  const input=fixture();input.budget=0;
  const cards=input.roster.map(card=>variants.cardVariants(card,'SSR')[0]);
  cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const candidate={id:'duplicate-loadout-parent',cards,challengeIds:[],cost:0,policy:'effects',estimate:0};
  const row={candidate,development:{scores:[],retired:0,turns:0},validation:{scores:[]},validationTarget:2048};
  let current,first=true;
  const engine={prepare:async(_,next)=>{current=next;},trial:()=>({score:40000,retired:false,finishTurn:4})};
  const session=new SearchSession(input,catalog,engine,'duplicate-loadout');
  session.tasksReady=true;session.tasks=[];session.pool=[];session.pending=[];session.finalists=[];session.knownTasksTotal=0;
  session.diverseParents=()=>first?(first=false,[row,row]):[];
  session.contenders=()=>[];session.selectFinalists=()=>{};
  await session.run(2000,()=>{});
  const duplicateId=variants.alternatePolicyCandidates(input,candidate)[0].id;
  const matches=session.checkpoint().pool.filter(result=>result.candidate.id===duplicateId);
  assert.equal(matches.length,1,'the same loadout must be measured once even when two parents propose it');
  assert.equal(session.checkpoint().pool.length,new Set(session.checkpoint().pool.map(result=>result.candidate.id)).size);
});

test('ideal critical plan learning uses development seeds and normal trials for reported scores',async()=>{
  const input=fixture();input.budget=0;input.preset.kind='BASIC';
  const learned=[];
  const engine={prepare:async()=>{},
    trial:()=>({score:45000,retired:false,finishTurn:4,plan:[['0-M1','1-M1']]}),
    scoutTargets:()=>[0],
    scout:(seed,policy,index,idealHand,magic)=>({score:magic===2?91000:90000,retired:false,finishTurn:4,forcedHits:1,plan:[['0-M2','1-M2']]}),
    learnPlan:async()=>[['0-M1','1-M1']],
    learnCriticalPlan:async(seed,ms,card,ideal,magic)=>{
      learned.push({seed,ms,card,ideal,magic});return [['0-M1','1-M2']];
    }};
  const session=new SearchSession(input,catalog,engine,'ideal-training');
  await session.run(2000,()=>{});
  assert.ok(learned.some(call=>call.ideal===true));
  assert.ok(learned.every(call=>call.seed.startsWith(call.ideal?'ideal-training:critical-scout:':'ideal-training:critical-plan-development:')&&call.ms===250&&call.card===0));
  assert.ok(learned.some(call=>call.ideal===true&&call.magic===2),'ideal critical learning should receive the winning M2 mode');
  assert.ok(learned.some(call=>call.ideal===false&&call.magic===2),'ordinary critical learning should receive the winning M2 mode');
  assert.ok(session.checkpoint().pool.some(result=>result.criticalScout?.seed?.startsWith('ideal-training:critical-scout:')));
  assert.ok(session.checkpoint().pool.some(result=>result.criticalScout?.magic===2));
  for(const result of [...session.checkpoint().pool,...session.checkpoint().finalists])
    assert.ok([...result.development.scores,...result.validation.scores].every(score=>score===45000));
});

test('card refinement receives an asynchronous stop while using host yields',async()=>{
  const input=fixture();input.supports=Array(100).fill(input.supports[0]);
  const cards=input.roster.map(c=>variants.cardVariants(c,'SSR')[0]);cards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const parent={id:'async-stop',cards,cost:0,policy:'effects',estimate:0,challengeIds:[]};
  let stopped=false;
  const pending=generation.generateNeighbors(input,parent,catalog,new Set(),()=>stopped);
  setImmediate(()=>{stopped=true;});
  assert.deepEqual(clone(await pending),[]);
});

test('DUO chains preserve an intermediate partner and obey normal/unified card roles',async()=>{
  const input=fixture();input.preset.kind='BASIC';input.budget=0;
  const raw=clone(catalog[input.roster[0].name]),training=clone(input.roster[0]);
  const data={};
  for(const [name,chara,duo] of [['a','A','B'],['b','B','C'],['c','C','D'],['d','D','S'],['s','S','A'],['closed','A','S']])
    data[name]={...clone(raw),name,chara,duo};
  input.roster=['a','b','c','d','closed'].map(name=>({...clone(training),name}));
  input.supports=[{...clone(training),name:'s',level:120,totsu:4}];
  const task={anchor:'a',totsu:0,cost:0,challenges:[],style:0,supportAnchor:'s',duoChain:true};
  const output=generation.generateCandidates(input,task,data);
  assert.ok(output.some(c=>['a','b','c','d','s'].every(name=>c.cards.some(card=>card.name===name))),
    'a closed two-card DUO must not exclude a longer five-card chain');
  for(const c of output){
    assert.equal(c.cards.length,5);assert.equal(c.cards.filter(card=>card.support).length,1);
    assert.equal(new Set(c.cards.filter(card=>!card.support).map(card=>card.name)).size,4);
    assert.equal(c.cost,0);
  }
  assert.deepEqual(clone(await generation.generateCandidatesAsync(input,task,data,()=>false)),clone(output));
  input.requiredCharacters=['A','C'];
  const constrained=generation.generateCandidates(input,task,data);
  assert.ok(constrained.some(c=>['a','b','c','d','s'].every(name=>c.cards.some(card=>card.name===name))),
    'mandatory characters must preserve a legal longer DUO chain');
  assert.ok(constrained.every(c=>input.requiredCharacters.every(chara=>c.cards.some(card=>data[card.name].chara===chara))));
  input.preset.specialChallenges=[];input.preset.title='通常試験';
  input.roster.push({...clone(training),name:'s'});input.supports=[];
  const normal=generation.generateCandidates(input,{...task,anchor:'s',supportAnchor:undefined},data);
  assert.ok(normal.length);
  assert.ok(normal.every(c=>c.cards.length===5&&c.cards.every(card=>!card.support)&&new Set(c.cards.map(card=>card.name)).size===5));
});

test('upgraded DUO chains retain low-cost states and a legal partner M3',async()=>{
  const input=fixture();input.preset.kind='ATTACK';input.budget=4;
  const raw=clone(catalog[input.roster[0].name]),training=clone(input.roster[0]);
  const data={};
  for(const [name,chara,duo] of [['a','A','B'],['b','B','C'],['c','C','D'],['d','D','S'],['s','S','A'],['closed','A','S']])
    data[name]={...clone(raw),name,chara,duo};
  Object.assign(data.b,{atk:'30000',base_atk:'6000',magic1atr:'火',magic1pow:'単発(弱)',magic2atr:'火',magic2pow:'単発(弱)',
    magic3atr:'水',magic3pow:'3連撃(強)'});
  input.roster=['a','b','c','d','closed'].map(name=>({...clone(training),name}));
  input.supports=[{...clone(training),name:'s'}];
  const before=clone(input);
  const scheduled=generation.buildTasks(input,data).filter(candidate=>candidate.duoChain&&candidate.cost>0);
  assert.ok(scheduled.length<=8&&scheduled.every(candidate=>candidate.cost>0));
  for(const cost of new Set(scheduled.map(candidate=>candidate.cost)))
    assert.ok(scheduled.filter(candidate=>candidate.cost===cost).length<=2);
  const task={anchor:'a',totsu:1,cost:1,challenges:[],style:0,duoChain:true};
  const candidates=generation.generateCandidates(input,task,data);
  const card=(candidate,name)=>candidate.cards.find(c=>c.name===name);
  assert.ok(candidates.some(candidate=>candidate.cost===1&&card(candidate,'a').totsu===1&&card(candidate,'b').totsu===0),
    'the positive-cost chain keeps its registered partner state');
  assert.ok(candidates.some(candidate=>candidate.cost===4&&card(candidate,'a').totsu===1
    &&card(candidate,'b').totsu===3&&card(candidate,'b').selectedMagic.includes(3)),
    'the positive-cost chain can spend its remaining budget on a partner M3');
  assert.ok(candidates.every(candidate=>candidate.cost<=input.budget));
  assert.equal(card(candidates.find(candidate=>candidate.cost===4),'a').level,training.level+5,
    'the upgraded root receives exactly one five-level breakthrough');
  assert.deepEqual(clone(input),before,'chain generation does not mutate registered input cards');
  input.preset.title='通常試験';input.preset.specialChallenges=[];input.supports=[];
  const normal=generation.generateCandidates(input,{...task},data);
  assert.ok(normal.length&&normal.every(candidate=>candidate.cards.every(card=>!card.support)),
    'the same positive-cost chain obeys the normal five-owned-card role');
  input.supports=[{...clone(training),name:'s'}];
  input.roster=Array.from({length:100},(_,index)=>({...clone(training),name:index===0?'a':`extra-${index}`}));
  for(const card of input.roster.slice(1))data[card.name]={...clone(raw),name:card.name,chara:card.name,duo:''};
  let checks=0;
  assert.equal(await generation.generateCandidatesAsync(input,task,data,()=>++checks>=2),null,
    'expanded partner options still yield to cancellation');
  const zeroInput=clone(before);zeroInput.budget=0;
  const zeroChains=generation.buildTasks(zeroInput,data).filter(candidate=>candidate.duoChain);
  assert.ok(zeroChains.length>0&&zeroChains.every(candidate=>candidate.cost===0),
    'budget zero keeps the original cost-free DUO chain path');
});

test('ATTACK task preparation schedules bounded DUO chains with the attack policy',()=>{
  const input=fixture();input.preset.kind='ATTACK';input.budget=0;input.seedTeams=undefined;
  const raw=clone(catalog[input.roster[0].name]),training=clone(input.roster[0]);
  const data={};
  for(const [name,chara,duo] of [['a','A','B'],['b','B','C'],['c','C','D'],['d','D','S'],['s','S','A'],['closed','A','S']])
    data[name]={...clone(raw),name,chara,duo};
  input.roster=['a','b','c','d','closed'].map(name=>({...clone(training),name}));
  input.supports=[{...clone(training),name:'s'}];

  const tasks=generation.buildTasks(input,data);
  const chainTasks=tasks.filter(task=>task.duoChain&&!task.seedTeam);
  assert.ok(chainTasks.length,'ATTACK preparation should schedule DUO chains without seed hints');
  const found=chainTasks.map(task=>({task,candidates:generation.generateCandidates(input,task,data)}))
    .find(row=>row.candidates.length);
  assert.ok(found,'at least one scheduled ATTACK DUO chain should produce candidates');
  for(const candidate of found.candidates){
    const own=candidate.cards.filter(card=>!card.support),supports=candidate.cards.filter(card=>card.support);
    assert.equal(candidate.policy,'effects-duo');
    assert.equal(candidate.cards.length,5);
    assert.equal(new Set(own.map(card=>card.name)).size,4);
    assert.equal(supports.length,1);
    assert.ok(own.every(card=>input.roster.some(rawCard=>rawCard.name===card.name)));
    assert.ok(supports.every(card=>input.supports.some(rawCard=>rawCard.name===card.name)));
    assert.ok(candidate.cost<=input.budget);
    assert.ok(candidate.cards.every(card=>card.selectedMagic.length===2
      &&(!card.selectedMagic.includes(3)||card.totsu>=3)));
  }

  input.preset.kind='BASIC';
  assert.ok(generation.buildTasks(input,data).some(task=>task.duoChain),
    'BASIC preparation should retain DUO chain tasks');
  const basicTask={...found.task};
  assert.ok(generation.generateCandidates(input,basicTask,data).every(candidate=>candidate.policy==='effects-score'));
  input.preset.kind='DEFENCE';
  assert.equal(generation.buildTasks(input,data).some(task=>task.duoChain),false);
});

test('one selected-ally freeze cure cannot activate the whole team in the completed estimate',()=>{
  const input=fixture();input.preset.kind='ATTACK';
  input.preset.specialChallenges=[{id:'freeze-test',effects:[{kind:'playerFreeze',duration:10}]}];
  input.supports[0].name=Object.values(catalog).filter(c=>c.rare==='SSR')[4].name;
  const cards=[...input.roster.map(c=>variants.cardVariants(c,'SSR')[0]),variants.cardVariants(input.supports[0],'SSR',true)[0]];
  const data=clone(catalog),task={anchor:'',totsu:0,cost:0,challenges:['freeze-test'],style:0};
  for(const [index,card] of cards.entries()) {
    const raw=data[card.name];raw.duo='';raw.etc=index?'ATKUP(中)(自/3T)(M1)':'凍結無効(味方選択/1T)(M1)';
    for(let m=1;m<=3;m++){raw[`magic${m}buf`]='';raw[`magic${m}heal`]='';raw[`buddy${m}s`]='';raw[`buddy${m}s_totsu`]='';}
  }
  const selected=generation.createEstimator(input,task,data)(cards);
  const all=clone(data);all[cards[0].name].etc='凍結無効(味方全体/1T)(M1)';
  assert.ok(generation.createEstimator(input,task,all)(cards)>selected,
    'covering all allies must exceed a single partner slot when four allies need their buffs');
  const sameSpell=clone(data);sameSpell[cards[0].name].etc+=' デバフ解除(味方選択)(M1)';
  assert.equal(generation.createEstimator(input,task,sameSpell)(cards),selected,
    'two cure effects on one selected spell still have only one partner');
});

test('cached identical own/support profiles do not stack both cards self buffs on each card',()=>{
  const input=fixture();input.preset.kind='ATTACK';
  const cards=[...input.roster.map(c=>variants.cardVariants(c,'SSR')[0]),variants.cardVariants(input.supports[0],'SSR',true)[0]];
  const data=clone(catalog),task={anchor:'',totsu:0,cost:0,challenges:[],style:0};
  for(const card of cards) {
    const raw=data[card.name];raw.duo='';raw.etc='ATKUP(中)(自/3T)(M1)';
    for(let m=1;m<=3;m++){raw[`magic${m}buf`]='';raw[`magic${m}heal`]='';raw[`buddy${m}s`]='';raw[`buddy${m}s_totsu`]='';}
  }
  const equivalent=clone(cards);equivalent[4].buddyLevels[0]=9;
  const estimate=generation.createEstimator(input,task,data);
  assert.equal(estimate(cards),estimate(equivalent),
    'changing the level of an absent buddy effect only changes the cache key, never damage');
});

test('BASIC score finishing compares executed action scores and still preserves preparation turns',()=>{
  const pair=(ids,damage,projectedScore)=>({ids,damage,firstDamage:damage,duo:1,heal:0,utility:0,defense:0,finisherUsed:true,projectedScore});
  const highDamage=pair(['a','b'],60000,49000),highScore=pair(['c','d'],55000,51000);
  const prepare={...pair(['e','f'],1000,undefined),finisherUsed:false};
  const observation={kind:'BASIC',turn:4,enemyHp:50000,playerHp:50000,maxHp:50000,pairs:[highDamage,highScore,prepare]};
  assert.deepEqual(clone(policy.chooseObservedPair(observation,'effects-score')),['c','d']);
  assert.deepEqual(clone(policy.chooseObservedPair({...observation,turn:3},'effects-score')),['e','f'],
    'a finishing forecast must not override the early-kill and finisher reservation penalties');
});

test('ATK ordering tries a weak multi-buff specialist without counting enemy buffs',()=>{
  const input=fixture();input.preset.kind='ATTACK';input.preset.title='通常試験';input.preset.specialChallenges=[];input.budget=0;
  input.roster=Object.values(catalog).filter(c=>c.rare==='SSR').slice(0,5).map(c=>({...clone(input.roster[0]),name:c.name}));
  input.supports=[];const data=clone(catalog),specialist=input.roster[4].name;
  for(const card of input.roster){
    const raw=data[card.name];raw.duo='';raw.etc='';raw.base_atk=3000;raw.atk=raw.max_atk=raw.originalMaxATK=6000;
    for(let m=1;m<=3;m++){raw[`magic${m}buf`]='';raw[`magic${m}heal`]='';raw[`buddy${m}c`]='';raw[`buddy${m}s`]='';raw[`buddy${m}s_totsu`]='';}
  }
  const weak=data[specialist];weak.base_atk=weak.atk=weak.max_atk=weak.originalMaxATK=100;
  weak.etc=[1,3,5].map(turns=>`ATKUP(極小)(自/${turns}T)(M1)`).join('<br>');
  assert.equal(generation.buildTasks(input,data)[0].anchor,specialist,
    'a scoring specialist must receive a real trial before raw power anchors exhaust the budget');
  const opponent=clone(data);opponent[specialist].etc=weak.etc.replaceAll('自/','相手/');
  assert.notEqual(generation.buildTasks(input,opponent)[0].anchor,specialist,
    'giving the enemy buffs does not earn player ATK buff points');
});

test('ATK construction tries a scoring spell together with its freeze immunity instead of requiring M2',()=>{
  const input=fixture();input.preset.kind='ATTACK';input.preset.enemyElement='水';
  input.preset.specialChallenges=[{id:'freeze-test',effects:[{kind:'playerFreeze',duration:5}]}];
  const trained=name=>({...clone(input.roster[0]),name,totsu:4,level:110});
  input.roster=['jamil_Thermal_sand_plotter','azul_dormitory','vil_dormitory','leona_dormitory'].map(trained);
  input.supports=[{...trained('leona_dormitory'),level:120}];input.budget=0;
  const task={anchor:'jamil_Thermal_sand_plotter',totsu:4,cost:0,challenges:['freeze-test'],style:0,supportFirst:true};
  const generated=generation.generateCandidates(input,task,catalog);
  assert.ok(generated.some(c=>c.cards.some(card=>!card.support&&card.name===task.anchor&&card.selectedMagic.join(',')==='1,3')),
    'triple ATK buffs and M3 freeze immunity need a real trial even without the DUO spell');
});

test('required card identities validate roles and make a unified support-only card mandatory',()=>{
  const input=fixture();
  input.requiredCards=[input.roster[0].name,'missing-card'];
  assert.equal(variants.validateInput(input,catalog),'required-cards-unknown');
  input.requiredCards=[input.roster[0].name,input.roster[0].name];
  assert.equal(variants.validateInput(input,catalog),'required-cards-duplicate');
  input.requiredCards=Object.values(catalog).filter(c=>c.rare==='SSR').slice(0,6).map(c=>c.name);
  assert.equal(variants.validateInput(input,catalog),'required-cards-limit');

  const unified=fixture();
  const extra=Object.values(catalog).find(c=>c.rare==='SSR'&&!unified.roster.some(r=>r.name===c.name));
  unified.supports=[{...clone(unified.roster[0]),name:extra.name}];
  unified.requiredCards=[extra.name];
  assert.equal(variants.validateInput(unified,catalog),null);
  const tasks=generation.buildTasks(unified,catalog), candidates=tasks.flatMap(task=>generation.generateCandidates(unified,task,catalog));
  assert.ok(candidates.length,'required support path should produce candidates');
  assert.ok(candidates.every(candidate=>candidate.cards.some(card=>card.name===extra.name&&card.support)),
    'a required unowned card must be assigned to the unified support slot');
});

test('required owned identities seed the beam, retain multi-upgrades and survive normal task restriction',()=>{
  const input=fixture();
  input.preset=clone(examPresetDefinitions.find(p=>!p.specialChallenges?.length&&!p.title.includes('統一')));
  input.preset.enemyHp=50000; input.preset.difficulty=1.5;
  input.supports=[];
  input.roster=Object.values(catalog).filter(c=>c.rare==='SSR').slice(0,5).map(c=>({...clone(input.roster[0]),name:c.name,totsu:2}));
  input.budget=2;
  input.requiredCards=input.roster.map(card=>card.name);
  assert.equal(variants.validateInput(input,catalog),null);
  const tasks=generation.buildTasks(input,catalog);
  assert.ok(tasks.length&&tasks.every(task=>input.requiredCards.includes(task.anchor)),
    'five required owned cards should not spend time on unrelated anchors');
  const candidates=generation.generateCandidates(input,tasks.find(task=>task.cost===2)??tasks[0],catalog);
  assert.ok(candidates.length);
  assert.ok(candidates.every(candidate=>input.requiredCards.every(name=>candidate.cards.some(card=>card.name===name&&!card.support))));
  assert.ok(candidates.some(candidate=>input.roster.slice(0,2).every(raw=>candidate.cards.some(card=>card.name===raw.name&&card.totsu===3))),
    'the required-first beam must retain a two-card 1+1 upgrade allocation');

  const parent=candidates[0];
  return generation.generateNeighbors(input,parent,catalog,new Set(),()=>false).then(neighbors=>{
    assert.ok(neighbors.every(candidate=>input.requiredCards.every(name=>candidate.cards.some(card=>card.name===name))));
    const other={...parent,id:'other-required',cards:parent.cards.map(card=>({...card}))};
    const crossed=generation.crossCandidates(input,parent,other,catalog,new Set());
    assert.ok(crossed.every(candidate=>input.requiredCards.every(name=>candidate.cards.some(card=>card.name===name))));
  });
});

test('required-card resume state drops legacy invalid visible candidates while retaining valid ones',()=>{
  const input=fixture(); input.requiredCards=[input.roster[0].name];
  const validCards=input.roster.slice(0,4).map(card=>variants.cardVariants(card,'SSR')[0]);
  validCards.push(variants.cardVariants(input.supports[0],'SSR',true)[0]);
  const invalidCards=validCards.map(card=>({...card,name:input.roster[1].name}));
  const result=candidate=>({candidate,development:{scores:[1],retired:0,turns:1},validation:{scores:[],retired:0,turns:0},validationTarget:2048});
  const valid={id:'valid-required',cards:validCards,challengeIds:[],cost:0,policy:'effects-score',estimate:1};
  const invalid={id:'invalid-required',cards:invalidCards,challengeIds:[],cost:0,policy:'effects-score',estimate:1};
  const scheduler=load('src/domain/examSearch/scheduler.ts');
  const engine={prepare:async()=>{},trial:()=>({score:0,retired:false,finishTurn:1})};
  const checkpoint={cursor:0,seen:[],pool:[result(invalid),result(valid)],finalists:[result(invalid),result(valid)],pending:[result(invalid),result(valid)],round:0,elapsed:0,trialSerial:0,nonce:'resume'};
  const session=new scheduler.SearchSession(input,catalog,engine,'resume',checkpoint);
  const restored=session.checkpoint();
  assert.deepEqual(restored.pool.map(row=>row.candidate.id),['valid-required']);
  assert.deepEqual(restored.finalists.map(row=>row.candidate.id),['valid-required']);
  assert.deepEqual(restored.pending.map(row=>row.candidate.id),['valid-required']);
});


test('five distinct required characters construct legal normal and unified teams and refinements',async()=>{
  const unique=[...new Map(Object.values(catalog).filter(c=>c.rare==='SSR').map(c=>[c.chara,c])).values()].slice(0,6);
  for(const unified of [false,true]){
    const input=fixture();input.budget=0;
    if(!unified){input.preset.title='通常試験';input.preset.specialChallenges=[];}
    const trained=card=>({...clone(input.roster[0]),name:card.name});
    input.roster=(unified?unique.filter((_,i)=>i!==4):unique).map(trained);
    input.supports=unified?[trained(unique[4])]:[];
    input.requiredCharacters=unique.slice(0,5).map(c=>c.chara);
    assert.equal(variants.validateInput(input,catalog),null);
    const candidates=generation.buildTasks(input,catalog).flatMap(task=>generation.generateCandidates(input,task,catalog));
    assert.ok(candidates.length,`five required characters must be constructible: support=${unified}`);
    for(const candidate of candidates){
      assert.ok(variants.candidateIncludesRequired(input,candidate,catalog));
      assert.equal(candidate.cards.length,5);
      assert.equal(candidate.cards.some(c=>c.name===unique[5].name),false);
    }
    const neighbors=await generation.generateNeighbors(input,candidates[0],catalog,new Set(),()=>false);
    const crossed=generation.crossCandidates(input,candidates[0],candidates.at(-1),catalog,new Set());
    for(const candidate of [...neighbors,...crossed])assert.ok(variants.candidateIncludesRequired(input,candidate,catalog));
    const {constrainCheckpoint}=load('src/domain/examSearch/requiredCheckpoint.ts');
    const valid={candidate:candidates[0]},invalid={candidate:{...candidates[0],id:'outsider',cards:candidates[0].cards.map((c,i)=>i===0?{...c,name:unique[5].name}:c)}};
    const child={pool:[valid,invalid],finalists:[valid,invalid],pending:[valid,invalid]};
    const cleaned=constrainCheckpoint(input,{...child,parallel:{checkpoints:[child],owners:{[valid.candidate.id]:0,outsider:0},baseNonce:'chars'}},catalog);
    for(const row of [cleaned,...cleaned.parallel.checkpoints])for(const field of ['pool','finalists','pending'])assert.equal(row[field].length,1);
  }
});
