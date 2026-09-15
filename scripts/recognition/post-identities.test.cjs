const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {check}=require('./check-batch.cjs'),fixtures=Object.entries(require('./post-identities.json').images).map(([file,expected])=>({file,expected}));
const directory='artifacts/recognition-real-posts',available=fs.existsSync('public/recognition/latest.json')&&fixtures.every(f=>fs.existsSync(path.join(directory,f.file)));
test('original five posts: all 207 card identities through full frame detection', {skip:!available&&!process.env.REAL_SCREENSHOTS_REQUIRED,timeout:1500000},()=>{
 const out=directory+'/identity-regression-results.json';
 execFileSync(process.execPath,[path.join(__dirname,'benchmark-batch.cjs'),directory,out],{timeout:1400000,maxBuffer:2000000});
 assert.equal(check(JSON.parse(fs.readFileSync(out)),fixtures),207);
});
