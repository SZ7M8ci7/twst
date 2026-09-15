const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./test-helpers.cjs');
const {moveImage,orderedCards,samePortrait}=load('src/domain/handScreenshot/export.ts');
test('reordering preserves image ownership and orders each image spatially',()=>{
 const original=[0,1,2],order=moveImage(original,0,1);
 assert.equal(JSON.stringify(original),'[0,1,2]');assert.equal(JSON.stringify(order),'[1,0,2]');
 const rows=[{id:'bottom',fileIndex:0,box:{x:0,y:110,width:100}},{id:'right',fileIndex:0,box:{x:110,y:3,width:100}},{id:'left',fileIndex:0,box:{x:0,y:0,width:100}},{id:'second',fileIndex:1,box:{x:0,y:0,width:100}}];
 assert.equal(orderedCards(rows,order).map(r=>r.id).join(','),'second,left,right,bottom');
 assert.equal(JSON.stringify(moveImage(original,0,-1)),JSON.stringify(original));
 assert.equal(JSON.stringify(moveImage([0,1,2,3],0,3)),'[1,2,3,0]');
 assert.equal(JSON.stringify(moveImage([0,1,2,3],3,-3)),'[3,0,1,2]');
});
test('overlap signatures tolerate compression but distinguish different artwork',()=>{
 const a=new Uint8ClampedArray(4096).fill(120),compressed=new Uint8ClampedArray(4096).fill(125),different=new Uint8ClampedArray(4096).fill(190);
 assert.equal(samePortrait(a,compressed,true),true);assert.equal(samePortrait(a,compressed,false),true);
 assert.equal(samePortrait(a,different,true),false);assert.equal(samePortrait(a,new Uint8ClampedArray(),true),false);
});
