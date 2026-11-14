import fs from 'node:fs';
import assert from 'node:assert/strict';
const [tag,output]=process.argv.slice(2);
assert.ok(tag&&output,'Usage: auxiliary.mjs tag output.json');
const root='artifacts/nrc19',summary=JSON.parse(fs.readFileSync(`${root}/${tag}-summary.json`));
assert.ok(summary.completePlanned,'Only summarize a complete paired plan');
const read=side=>fs.readdirSync(`${root}/${tag}-${side}`).filter(f=>f.startsWith('case-')&&f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`${root}/${tag}-${side}/${f}`)));
const before=read('before'),after=new Map(read('after').map(r=>[r.profile+'|'+r.caseId,r]));
const rows=before.map(a=>{const b=after.get(a.profile+'|'+a.caseId);assert.ok(b);
 const one=r=>r.topCandidates[0].validation1024;
 const three=r=>Math.max(...r.topCandidates.map(c=>c.validation1024.expectedMaxOfAttempts));
 return {profile:a.profile,id:a.caseId,current:a.caseId.startsWith('第19回'),rankOneExpectedDelta:one(b).expectedMaxOfAttempts-one(a).expectedMaxOfAttempts,
  maxDelta:one(b).max-one(a).max,p95Delta:one(b).p95-one(a).p95,winRateDelta:one(b).winRate-one(a).winRate,
  bestOfTopThreeExpectedDelta:three(b)-three(a),costBefore:a.topCandidates[0].candidate.cost,costAfter:b.topCandidates[0].candidate.cost};});
const aggregate=rs=>Object.fromEntries([['n',rs.length],...['rankOneExpectedDelta','maxDelta','p95Delta','winRateDelta','bestOfTopThreeExpectedDelta','costBefore','costAfter'].map(k=>[k,rs.reduce((n,r)=>n+r[k],0)/Math.max(1,rs.length)])]);
const result={tag,note:'Best of top three is an audit-selected auxiliary diagnostic, never the adoption metric or production selection.',current:aggregate(rows.filter(r=>r.current)),historical:aggregate(rows.filter(r=>!r.current)),currentByProfile:Object.fromEntries([...new Set(rows.map(r=>r.profile))].map(p=>[p,aggregate(rows.filter(r=>r.current&&r.profile===p))])),rows};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({tag,pairs:rows.length}));
