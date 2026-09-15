const {test}=require('node:test'),assert=require('node:assert/strict'),{load}=require('./test-helpers.cjs');
test('file validation rejects unsupported, oversized and forged files before image decoding',async()=>{
 let decoded=0;const {validateScreenshot}=load('src/domain/handScreenshot/input.ts',{createImageBitmap:async()=>{decoded++;throw Error('must not decode')}});
 for(const file of [{type:'application/pdf',size:100},{type:'image/png',size:31_000_000},{type:'image/jpeg',size:20,slice:()=>({arrayBuffer:async()=>new ArrayBuffer(16)})}])await assert.rejects(validateScreenshot(file));
 assert.equal(decoded,0);
});
test('valid image metadata is checked and decoding memory released even when dimensions are rejected',async()=>{
 let closed=0;const api=load('src/domain/handScreenshot/input.ts',{createImageBitmap:async()=>({width:10000,height:10000,close:()=>closed++})});
 const file={type:'image/png',size:100,slice:()=>({arrayBuffer:async()=>new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0,0,0,0,0]).buffer})};
 await assert.rejects(api.validateScreenshot(file));assert.equal(closed,1);
});
