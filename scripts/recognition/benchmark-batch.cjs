const fs=require('node:fs'),path=require('node:path'),{PNG}=require('pngjs'),{load}=require('./test-helpers.cjs');
(async()=>{
 const cv=await require('@techstark/opencv-js'),{Recognizer,detectBoxes}=load('src/domain/handScreenshot/recognizer.ts');
 const {prepareLevelImage,levelRegion,readUncaps,applyMaxLevelUncaps}=load('src/domain/handScreenshot/metadata.ts'),{parseLevels}=load('src/domain/handScreenshot/types.ts');
 const {recognizeLevels}=load('src/domain/handScreenshot/levelOcr.ts');
 const {createWorker,PSM}=require('tesseract.js'),ocr=await createWorker('eng',1,{langPath:'public/recognition-runtime/v7',cachePath:'.cache/recognition-ocr'});
 await ocr.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'0123456789/Lv',user_defined_dpi:'150'});
 const dir=process.argv[2]||'artifacts/recognition-collection-grid',out=process.argv[3]||dir+'/baseline.json',report={};
 const dict='public/recognition',m=JSON.parse(fs.readFileSync(dict+'/latest.json')),index=JSON.parse(fs.readFileSync(dict+'/'+m.index.path)),bin=Buffer.concat(m.features.parts.map(p=>fs.readFileSync(dict+'/'+p.path))),engine=new Recognizer(cv,index,bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength));
 const cards=new Map(require('../../src/assets/chara.json').map(c=>[c.name,c]));
 try {for(const file of fs.readdirSync(dir).filter(n=>/^(collection-grid-\d{2}|\d{19}-\d)\.png$/.test(n)&&!n.includes('-audit')).sort()) {
  const png=PNG.sync.read(fs.readFileSync(path.join(dir,file))),src=cv.matFromImageData(png),scale=Math.min(1,1400/png.width),scout=new cv.Mat();cv.resize(src,scout,new cv.Size(Math.round(png.width*scale),Math.round(png.height*scale)));
  const boxes=detectBoxes(cv,{width:scout.cols,height:scout.rows,data:scout.data}).map(b=>Object.fromEntries(Object.entries(b).map(([k,v])=>[k,v/scale])));scout.delete();
  const rows=[];
  for(const box of boxes){
   const b=Object.fromEntries(Object.entries(box).map(([k,v])=>[k,Math.round(v)])),roi=src.roi(new cv.Rect(b.x,b.y,b.width,b.height)),q=new cv.Mat();cv.resize(roi,q,new cv.Size(128,128));
   const match=engine.match({width:128,height:128,data:q.data}),row={box,...match,selected:match.confident?match.candidates[0].cardKey:''};roi.delete();q.delete();
   const contextRoi=src.roi(new cv.Rect(b.x,b.y,b.width,Math.min(Math.round(b.width*1.28),png.height-b.y))),ctx=new cv.Mat();cv.resize(contextRoi,ctx,new cv.Size(256,328));Object.assign(row,readUncaps({width:256,height:328,data:ctx.data}));contextRoi.delete();ctx.delete();
   const region=levelRegion(box,png.height),raw=new PNG({width:region.width,height:region.height});PNG.bitblt(png,raw,region.x,region.y,region.width,region.height,0,0);const prepared=prepareLevelImage(raw);
   if(prepared)Object.assign(row,await recognizeLevels(ocr,prepared,p=>PNG.sync.write({...p,data:Buffer.from(p.data)}),new AbortController().signal));
   applyMaxLevelUncaps(row,cards.get(row.selected)?.rare);rows.push(row);
   console.log(file,rows.length,row.selected||'UNKNOWN',row.candidates[0]?.cardKey,row.level,row.maxLevel,row.totsu);
  }
  report[file]=rows;fs.writeFileSync(out,JSON.stringify(report,null,2));src.delete();console.log('DONE',file,rows.filter(r=>r.selected).length,'/',rows.length);
 }}finally{await ocr.terminate();}
})();
