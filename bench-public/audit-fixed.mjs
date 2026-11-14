import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {createServer} from 'vite';
const source=process.argv[2],root=path.resolve(source);
const report=JSON.parse(gunzipSync(Buffer.from(JSON.parse(fs.readFileSync(`bench-public/T1-${source}-rare-report.json`)).gzipBase64,'base64')));
const server=await createServer({root,configFile:path.join(root,'vite.config.mts'),plugins:[{name:'no-scan',configResolved(c){c.optimizeDeps.noDiscovery=true;c.optimizeDeps.include=[];}}],cacheDir:path.join(process.cwd(),'artifacts','vite-audit-'+source),server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
try{
 const {createResourceBattleHost}=await server.ssrLoadModule('/src/workers/resourceBattleHost.ts');
 const engine=createResourceBattleHost();await engine.prepare(report.input,report.candidate);
 const n=32768,scores=[],nonce='T1-public-fixed-selection-deep-audit-v1';let wins=0,max=0,sum=0;
 for(let i=0;i<n;i++){const result=engine.trial(`${nonce}:${i}`,report.candidate.policy);const s=result.score;scores.push(s);wins+=Number(s>0);sum+=s;max=Math.max(max,s);}
 scores.sort((a,b)=>a-b);
 const expected30=scores.reduce((acc,s,i)=>acc+s*(Math.pow((i+1)/n,30)-Math.pow(i/n,30)),0);
 const result={source,caseId:report.caseId,profile:report.profile,selection:'Frozen top1 from wave4 rep2, not reselected',n,wins,winRate:wins/n,mean:sum/n,max,expected30,nonce,sourceHash:report.sourceHash,candidate:report.candidate,scores};
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync(`artifacts/fixed-${source}.json`,JSON.stringify(result));console.log(JSON.stringify({...result,scores:undefined,candidate:undefined}));
}finally{await server.close();}
