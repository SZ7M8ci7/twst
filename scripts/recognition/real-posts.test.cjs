const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PNG}=require('pngjs'),{createWorker,PSM}=require('tesseract.js');
const {load}=require('./test-helpers.cjs');
const {prepareLevelImage,levelRegion,readUncaps}=load('src/domain/handScreenshot/metadata.ts');
const {parseLevel,mergeDetections}=load('src/domain/handScreenshot/types.ts');
const {detectBoxes}=load('src/domain/handScreenshot/recognizer.ts');
const {recognizeLevels}=load('src/domain/handScreenshot/levelOcr.ts');
const fixtures=require('./real-posts.json').images,dir=path.resolve('artifacts/recognition-real-posts');
const available=fixtures.every(f=>fs.existsSync(path.join(dir,f.file.replace('.jpg','.png'))));

test('unknown uncaps never become a claimed zero; merging preserves known evidence and flags conflicts',()=>{
 const result=mergeDetections([{selected:'a',totsu:undefined},{selected:'a',totsu:3},{selected:'b',totsu:3},{selected:'b',totsu:4},{selected:'c',totsu:undefined}]);
 assert.equal(result[0].totsu,3);assert.equal(result[1].totsuConflict,true);assert.equal(result[2].totsu,undefined);
});

test('all 11 saved X screenshots: complete frames, current levels and specified uncaps', {skip:!available&&!process.env.REAL_SCREENSHOTS_REQUIRED,timeout:180000},async()=>{
 assert.ok(available,'Run python scripts/recognition/download-real-posts.py');
 const cv=await require('@techstark/opencv-js');
 fs.mkdirSync('.cache/recognition-ocr',{recursive:true});
 const worker=await createWorker('eng',1,{langPath:'public/recognition-runtime/v7',cachePath:'.cache/recognition-ocr'});
 await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789/Lv',user_defined_dpi:'150'});
 const results=[];
 try {
  const scaled=fixtures.filter(f=>['2093301178482450833-1.jpg','1819999957765759150-1.jpg'].includes(f.file)).map(f=>({...f,original:f.file,file:f.file.replace('.jpg','-small.jpg')}));
  for(const fixture of [...fixtures,...scaled]){
   const bytes=fs.readFileSync(path.join(dir,fixture.file));
   if(!fixture.original) assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fixture.sha256);
   const image=PNG.sync.read(fs.readFileSync(path.join(dir,fixture.file.replace('.jpg','.png'))));
   const source=cv.matFromImageData(image),scale=Math.min(1,1400/image.width),scout=new cv.Mat();
   cv.resize(source,scout,new cv.Size(Math.round(image.width*scale),Math.round(image.height*scale)));
   const boxes=detectBoxes(cv,{width:scout.cols,height:scout.rows,data:scout.data}).map(b=>Object.fromEntries(Object.entries(b).map(([k,v])=>[k,v/scale])));
   assert.equal(boxes.length,fixture.levels.length,fixture.file+' complete card count');
   for(let i=0;i<boxes.length;i++){
    const box=boxes[i],region=levelRegion(box,image.height),raw=new PNG({width:region.width,height:region.height});
    PNG.bitblt(image,raw,region.x,region.y,region.width,region.height,0,0);
    const prepared=prepareLevelImage(raw);assert.ok(prepared,fixture.file+' '+i+' number region');
    const {level}=await recognizeLevels(worker,prepared,p=>PNG.sync.write({...p,data:Buffer.from(p.data)}),new AbortController().signal) ?? {};
    assert.equal(level,fixture.levels[i],fixture.file+' card '+i+' current level');
    const roi=source.roi(new cv.Rect(Math.round(box.x),Math.round(box.y),Math.round(box.width),Math.round(box.width*1.28))),context=new cv.Mat();
    cv.resize(roi,context,new cv.Size(256,328));
    const uncaps=readUncaps({width:256,height:328,data:context.data});
    assert.equal(uncaps.totsu??null,fixture.uncaps[i],fixture.file+' card '+i+' uncaps');
    results.push({file:fixture.file,card:i,level,totsu:uncaps.totsu??null});
    roi.delete();context.delete();
   }
   source.delete();scout.delete();
  }
  fs.writeFileSync(path.join(dir,'verified-metadata.json'),JSON.stringify(results,null,2));
  assert.equal(results.length,261);
 } finally {await worker.terminate();}
});
