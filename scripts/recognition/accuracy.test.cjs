const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const {PNG}=require('pngjs'),{load}=require('./test-helpers.cjs');
const fixture=require('./accuracy-fixture.json'),directory=path.resolve('public/recognition');
const available=fs.existsSync(path.join(directory,'latest.json'));

test('user screenshot: at least 95% correct identities, including smaller recompressed images', {skip:!available&&!process.env.RECOGNITION_REQUIRED,timeout:300000},async()=>{
 assert.ok(available,'Build the Japanese Wiki dictionary first');
 const original=path.join(__dirname,'fixtures/accuracy-grid.jpg');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(original)).digest('hex'),fixture.sha256);
 const m=JSON.parse(fs.readFileSync(path.join(directory,'latest.json'))),index=JSON.parse(fs.readFileSync(path.join(directory,m.index.path))),bin=Buffer.concat(m.features.parts.map(part=>fs.readFileSync(path.join(directory,part.path))));
 const cv=await require('@techstark/opencv-js'),{Recognizer,detectBoxes,detectionResult}=load('src/domain/handScreenshot/recognizer.ts');
 const engine=new Recognizer(cv,index,bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength)),report=[];
 for(const scale of [1,.7]){
  const raw=execFileSync('python',['-c',`from PIL import Image;import io,sys
im=Image.open(sys.argv[1]).convert('RGB');scale=float(sys.argv[2])
if scale!=1:
 im=im.resize((round(im.width*scale),round(im.height*scale)));buf=io.BytesIO();im.save(buf,format='JPEG',quality=70);im=Image.open(io.BytesIO(buf.getvalue())).convert('RGB')
im.save(sys.stdout.buffer,format='PNG')`,original,String(scale)],{maxBuffer:15_000_000});
  const png=PNG.sync.read(raw),source=cv.matFromImageData(png),results=[];
  const detected=detectBoxes(cv,png);assert.equal(detected.length,68,'68 fully visible cards; four stickers are excluded');
  for(let i=0;i<fixture.boxes.length;i++){
   const box=fixture.boxes[i],sx=png.width/1146,sy=png.height/2048;
   const roi=source.roi(new cv.Rect(Math.round(box.x*sx),Math.round(box.y*sy),Math.round(box.width*sx),Math.round(box.height*sy))),query=new cv.Mat();
   cv.resize(roi,query,new cv.Size(128,128));const result=detectionResult(String(i),0,box,engine.match({width:128,height:128,data:query.data}));
   results.push({number:i+1,expected:fixture.expected[i],selected:result.selected});roi.delete();query.delete();
  }
  const correct=results.filter(r=>r.selected===r.expected).length,wrong=results.filter(r=>r.selected&&r.selected!==r.expected),unknown=results.filter(r=>!r.selected);
  report.push({scale,correct,total:results.length,wrong,unknown});console.log(JSON.stringify(report.at(-1)));
  assert.ok(correct>=65,`${scale}: ${correct}/68 correctly selected, need at least 95%`);assert.ok(wrong.length<=1,`${scale}: false matches ${JSON.stringify(wrong)}`);
  if(scale===1){
   // Emoji-covered slots must not be given a fabricated card identity.
   for(const x of [430,571,712,853]){
    const roi=source.roi(new cv.Rect(x,1828,108,108)),q=new cv.Mat();cv.resize(roi,q,new cv.Size(128,128));
    assert.equal(engine.match({width:128,height:128,data:q.data}).confident,false,'sticker-covered card');roi.delete();q.delete();
   }
  }
  source.delete();
 }
 fs.mkdirSync('artifacts/recognition-accuracy',{recursive:true});fs.writeFileSync('artifacts/recognition-accuracy/regression-results.json',JSON.stringify(report,null,2));
});
