const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const fixture=require('./fixtures/exam-observation-equivalence.json');
test('ordinary battles preserve all policy results and reset observation metadata between candidates',async()=>{
 const {createServer}=await import('vite');
 const root=path.resolve(process.env.EXAM_REFERENCE_ROOT||path.join(__dirname,'../..'));
 const server=await createServer({root,configFile:path.join(root,'vite.config.mts'),plugins:[{name:'regression-no-scan',configResolved(c){c.optimizeDeps.noDiscovery=true;c.optimizeDeps.include=[];}}],server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
 try{
  const {createResourceBattleHost}=await server.ssrLoadModule('/src/workers/resourceBattleHost.ts');
  const engine=createResourceBattleHost(),digests=[];
  // Reuse the host across subjects and return to the first candidate: stale
  // per-candidate metadata must not leak across training/deck/preset changes.
  for(const [index,row] of [...fixture.rows,fixture.rows[0]].entries()){
   await engine.prepare(row.input,row.candidate);
   const trials=[];
   for(const policy of ['balanced','reserve','effects','effects-reserve','effects-score','effects-public','effects-tail','effects-duo'])
    for(let i=0;i<16;i++)trials.push(engine.trial(`observation-regression:${index%fixture.rows.length}:${policy}:${i}`,policy,i<2));
   digests.push(createHash('sha256').update(JSON.stringify(trials)).digest('hex'));
  }
  assert.equal(digests[0],digests.at(-1));
  if(process.env.EXAM_RECORD_REFERENCE){assert.ok(process.env.EXAM_REFERENCE_ROOT,'Explicit baseline required');fs.writeFileSync(path.join(__dirname,'fixtures/exam-observation-equivalence-digests.json'),JSON.stringify(digests,null,2)+'\n');}
  else assert.deepEqual(digests,require('./fixtures/exam-observation-equivalence-digests.json'));
 }finally{await server.close();}
});
