const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { load } = require('./test-helpers.cjs');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function fixture() {
  const version = 'a'.repeat(20), base = 'https://test.invalid/recognition/';
  const index = Buffer.from(JSON.stringify({ schemaVersion: 2, source: 'https://twst.wikiru.jp/', extractor: 'orb-art-catalog-diverse-v5', templates: [{ id: 'a:normal', cardKey: 'a', kind: 'art', variant: 'normal', sourceUrl: 'https://twst.wikiru.jp/attach2/test.png', sourceHash: '0'.repeat(64), offset: 0, count: 12 }], cards: [] }));
  const features = Buffer.alloc(480);
  const manifest = { schemaVersion: 2, source: 'https://twst.wikiru.jp/', extractor: 'orb-art-catalog-diverse-v5', datasetVersion: version,
    index: { path: 'objects/' + hash(index) + '.json', sha256: hash(index), bytes: index.length }, features: { parts: [{ path: 'objects/' + hash(features) + '.bin', sha256: hash(features), bytes: features.length }], bytes: features.length } };
  const network = new Map([[base + 'latest.json', Buffer.from(JSON.stringify(manifest))], [base + manifest.index.path, index], [base + manifest.features.parts[0].path, features]]);
  const saved = new Map(), calls = [];
  const cache = { keys: async () => [...saved.keys()].map(url=>({url})), delete: async url => saved.delete(url), match: async url => saved.has(url) ? new Response(saved.get(url)) : undefined, put: async (url, response) => saved.set(url, await response.arrayBuffer()) };
  const api = load('src/domain/handScreenshot/dataset.ts', { crypto: crypto.webcrypto, location: { href: base }, caches: { open: async () => cache }, fetch: async url => { calls.push(url); if (!network.has(url)) throw new Error('offline'); return new Response(network.get(url)); } });
  return { api, base, network, saved, manifest, cache, calls };
}
test('fully verified dictionary is cached and usable offline', async () => {
  const f = fixture(), signal = new AbortController().signal;
  const online = await f.api.loadDataset(f.base, signal, () => {}); assert.equal(online.offline, false);
  f.network.clear(); const offline = await f.api.loadDataset(f.base, signal, () => {}); assert.equal(offline.offline, true);
});
test('a corrupt release never advances the latest cached pointer', async () => {
  const f = fixture(); f.network.set(f.base + f.manifest.features.parts[0].path, Buffer.alloc(480, 1));
  await assert.rejects(f.api.loadDataset(f.base, new AbortController().signal, () => {}), /checksum/);
  assert.equal(f.saved.has(f.base + 'latest.json'), false);
});
test('unsupported manifest does not request arbitrary paths', async () => {
  const f = fixture(); f.manifest.features.parts[0].path = '../private.bin'; f.network.set(f.base + 'latest.json', Buffer.from(JSON.stringify(f.manifest)));
  await assert.rejects(f.api.loadDataset(f.base, new AbortController().signal, () => {}), /path/);
});

test('storage exhaustion cannot replace the pointer with a partially cached release', async () => {
  const f = fixture();
  const put = f.cache.put;
  f.cache.put = async (url, response) => { if (url.endsWith('.bin')) throw new Error('Quota exceeded'); return put(url, response); };
  const result = await f.api.loadDataset(f.base, new AbortController().signal, () => {});
  assert.equal(result.offline, false);
  assert.equal(f.saved.has(f.base + 'latest.json'), false);
});

test('cancellation never falls back to a cached dictionary or advances its pointer', async () => {
  const f = fixture(), controller = new AbortController();
  await f.api.loadDataset(f.base, controller.signal, () => {});
  controller.abort();
  await assert.rejects(f.api.loadDataset(f.base, controller.signal, () => {}));
});

test('second run reuses feature objects; adding a card downloads only the new shard and index', async () => {
 const f=fixture(), signal=new AbortController().signal;
 await f.api.loadDataset(f.base,signal,()=>{});f.calls.length=0;
 const cached=await f.api.loadDataset(f.base,signal,()=>{});
 assert.deepEqual(f.calls,[f.base+'latest.json']);
 assert.equal(cached.downloadedBytes,f.network.get(f.base+'latest.json').length);
 const added=Buffer.alloc(480,7),addedPart={path:'objects/'+hash(added)+'.bin',sha256:hash(added),bytes:added.length};
 const index=JSON.parse(f.network.get(f.base+f.manifest.index.path));index.templates.push({...index.templates[0],id:'b:normal',cardKey:'b',offset:480});
 const raw=Buffer.from(JSON.stringify(index)),indexPart={path:'objects/'+hash(raw)+'.json',sha256:hash(raw),bytes:raw.length};
 f.manifest={...f.manifest,datasetVersion:'b'.repeat(20),index:indexPart,features:{parts:[...f.manifest.features.parts,addedPart],bytes:960}};
 f.network.set(f.base+'latest.json',Buffer.from(JSON.stringify(f.manifest)));f.network.set(f.base+indexPart.path,raw);f.network.set(f.base+addedPart.path,added);f.calls.length=0;
 const updated=await f.api.loadDataset(f.base,signal,()=>{});
 assert.equal(updated.features.byteLength,960);
 assert.deepEqual(new Set(f.calls),new Set([f.base+'latest.json',f.base+indexPart.path,f.base+addedPart.path]));
});

test('corrupt cached shard is verified and repaired, retaining the usable offline release',async()=>{
 const f=fixture(),signal=new AbortController().signal;await f.api.loadDataset(f.base,signal,()=>{});
 f.saved.set(f.base+f.manifest.features.parts[0].path,new Uint8Array(480).fill(9).buffer);f.calls.length=0;
 await f.api.loadDataset(f.base,signal,()=>{});assert.ok(f.calls.includes(f.base+f.manifest.features.parts[0].path));
 f.network.clear();assert.equal((await f.api.loadDataset(f.base,signal,()=>{})).offline,true);
});

test('an older extractor in browser cache does not prevent activating the upgraded dictionary',async()=>{
 const f=fixture(),signal=new AbortController().signal;
 f.saved.set(f.base+'latest.json',Buffer.from(JSON.stringify({...f.manifest,extractor:'orb-art-640-960-v2'})));
 await f.api.loadDataset(f.base,signal,()=>{});
 assert.equal(JSON.parse(Buffer.from(f.saved.get(f.base+'latest.json')).toString()).extractor,f.manifest.extractor);
 f.network.clear();assert.equal((await f.api.loadDataset(f.base,signal,()=>{})).offline,true);
});
