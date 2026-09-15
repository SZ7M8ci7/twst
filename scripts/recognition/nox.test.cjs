const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {check}=require('./check-batch.cjs'),fixture=require('./nox-fixture.json');
const directory=path.join(__dirname,'fixtures/nox'),available=fs.existsSync('public/recognition/latest.json');
test('11 Nox screenshots: all 132 identities, current/max levels and uncaps', {skip:!available&&!process.env.RECOGNITION_REQUIRED,timeout:1200000},()=>{
 for(const f of fixture.images)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(directory,f.file))).digest('hex'),f.sha256);
 fs.mkdirSync('artifacts/recognition-nox',{recursive:true});
 const out='artifacts/recognition-nox/regression-results.json';
 execFileSync(process.execPath,[path.join(__dirname,'benchmark-batch.cjs'),directory,out],{timeout:1100000,maxBuffer:2000000});
 assert.equal(check(JSON.parse(fs.readFileSync(out)),fixture.images),132);
});
