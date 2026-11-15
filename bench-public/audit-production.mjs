import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {createServer} from 'vite';
const source=process.argv[2],rep=process.argv[3],variant=process.argv[4],root=path.resolve(source);
const lane=process.argv[5],cap=Number(process.argv[6]);
if(![0,20].includes(cap))throw new Error("Invalid cap");
const dir=`artifacts/nrc19/${variant}-seed${rep}-${lane}-before`;
const rows=fs.readdirSync(dir).filter(f=>f.startsWith('case-')&&f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f))));
const original=rows.find(r=>r.profile==='synthetic-3'&&r.caseId==='第19回統一全ATK'&&(r.input.additionalLevelCap??0)===cap);
if(!original)throw new Error('Missing frozen rare candidate');
const report={...original,candidate:original.topCandidates[0].candidate};
const server=await createServer({root,configFile:path.join(root,'vite.config.mts'),plugins:[{name:'no-scan',configResolved(c){c.optimizeDeps.noDiscovery=true;c.optimizeDeps.include=[];}}],cacheDir:path.join(process.cwd(),'artifacts','vite-audit-'+source),server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
try{
 const {createResourceBattleHost}=await server.ssrLoadModule('/src/workers/resourceBattleHost.ts');
 const engine=createResourceBattleHost();await engine.prepare(report.input,report.candidate);
 const n=32768,scores=[],nonce=`current-N3-audit-7c88b1cd743f406dad9398cc080aad79-rep${rep}-cap${cap}-v1`;let wins=0,max=0,sum=0;
 for(let i=0;i<n;i++){const result=engine.trial(`${nonce}:${i}`,report.candidate.policy);const s=result.score;scores.push(s);wins+=Number(s>0);sum+=s;max=Math.max(max,s);}
 const sortedScores=[...scores].sort((a,b)=>a-b);
 const expected30=sortedScores.reduce((acc,s,i)=>acc+s*(Math.pow((i+1)/n,30)-Math.pow(i/n,30)),0);
 const result={source,rep,variant,lane,cap,caseId:report.caseId,profile:report.profile,selection:'Frozen top1 from frozen-current-master ABBA screening, not reselected',n,wins,winRate:wins/n,mean:sum/n,max,expected30,nonce,sourceHash:report.sourceHash,candidate:report.candidate,scores};
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(`artifacts/fixed-${variant}-rep${rep}-${lane}-cap${cap}.json`,JSON.stringify(result));console.log(JSON.stringify({...result,scores:undefined,candidate:undefined}));
}finally{await server.close();}
