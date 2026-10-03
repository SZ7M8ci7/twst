const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function runtime(initial = null, lock) {
  let raw = initial, writes = 0, fail = false;
  const storage = { getItem: () => raw, setItem: (_key, value) => { writes++; if (fail) throw new Error('QuotaExceededError'); raw = value; } };
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
    }).outputText, { module, exports: module.exports, window: { localStorage: storage },
      navigator: lock ? { locks: { request: lock } } : {}, require: id => load(`src/${id.slice(2)}.ts`) });
    cache.set(relative, module.exports); return module.exports;
  }
  return { api: load('src/storage/handCollectionStorage.ts'), raw: () => raw, writes: () => writes,
    replace: value => { raw = value; }, quota: () => { fail = true; } };
}
const card = level => ({ cardName: 'card', characterName: '名前', isOwned: true, level, totsu: 1, isLimitBreak: false, isM3: false });
const document = count => ({ version: 2, activeSetId: 'id0', sets: Array.from({ length: count }, (_, n) => ({ id: `id${n}`, name: `自由な名前${n}`, data: { card: card(n + 1) } })) });
const plain = value => JSON.parse(JSON.stringify(value));

test('sparse slot metadata round-trips empty selection and prevents duplicate or out-of-range slots', async () => {
  const r=runtime(), doc=document(2); doc.sets[0].slot=1; doc.sets[1].slot=5; doc.activeSetId=null; doc.activeSlot=3;
  await r.api.saveStoredHandCollectionDocument(doc,null);
  const snapshot=r.api.readHandCollectionSnapshot(); assert.equal(snapshot.activeSlot,3); assert.deepEqual(plain(snapshot.data),{});
  const restored=r.api.parseHandCollectionSetsBackup(r.api.createHandCollectionSetsBackup(snapshot));
  assert.deepEqual(plain(restored),plain(r.api.validateHandCollectionDocument(doc)));
  for(const slot of [0,6,1,1.5]) {
    const invalid=plain(doc); invalid.sets[1].slot=slot;
    assert.throws(()=>r.api.validateHandCollectionDocument(invalid),e=>e.reason==='invalid');
  }
});

test('old IDs and free names retain assigned order around explicit occupied slots', () => {
  const doc=document(3); doc.sets[1].slot=1;
  const raw=JSON.stringify(doc), r=runtime(raw), snapshot=r.api.readHandCollectionSnapshot();
  assert.deepEqual(Array.from(snapshot.sets,s=>[s.slot,s.id,s.name]),[[1,'id1','自由な名前1'],[2,'id0','自由な名前0'],[3,'id2','自由な名前2']]);
  assert.equal(snapshot.activeSlot,2); assert.equal(r.raw(),raw); assert.equal(r.writes(),0);
});
test('legacy version1 and bare data migrate virtually without touching existing bytes', () => {
  for (const data of [{ version: 1, data: { card: card(70) } }, { card: card(70) }]) {
    const raw = JSON.stringify(data), r = runtime(raw), snapshot = r.api.readHandCollectionSnapshot();
    assert.equal(snapshot.activeSetId, 'legacy'); assert.equal(snapshot.sets.length, 1);
    assert.equal(snapshot.data.card.level, 70); assert.equal(r.raw(), raw); assert.equal(r.writes(), 0);
  }
  const missing = runtime().api.readHandCollectionSnapshot(); assert.equal(missing.sets.length, 0); assert.equal(missing.activeSetId, null);
});
test('all five named sets round-trip with selected set; text names and image fields remain safe', async () => {
  const r = runtime(), doc = document(5); doc.sets[0].name = '<img src=x onerror=alert(1)> & 自由名';
  doc.sets[0].data.card.imgUrl = 'data:image/png;base64,not-saved';
  const raw = await r.api.saveStoredHandCollectionDocument(doc, null);
  assert.equal(r.writes(), 1); assert.ok(!raw.includes('imgUrl')); assert.ok(!raw.includes('base64'));
  const snapshot = r.api.readHandCollectionSnapshot(); assert.equal(snapshot.sets[0].name, doc.sets[0].name);
  const json = r.api.createHandCollectionSetsBackup(snapshot), restored = r.api.parseHandCollectionSetsBackup(json, [{ name: 'card', rare: 'SSR' }]);
  assert.deepEqual(plain(restored), plain(r.api.validateHandCollectionDocument(doc)));
  assert.equal(r.api.parseHandCollectionSetsBackup('{"format":"twst-hand-collection-v3","cards":{}}'), null);
});
test('sixth set, duplicate ids, dangling selection and invalid backup levels reject before a write', async () => {
  const initial = JSON.stringify(document(5)), r = runtime(initial);
  await assert.rejects(r.api.saveStoredHandCollectionDocument(document(6), initial), e => e.reason === 'limit');
  const duplicate = document(2); duplicate.sets[1].id = duplicate.sets[0].id;
  assert.throws(() => r.api.validateHandCollectionDocument(duplicate), e => e.reason === 'invalid');
  const dangling = document(1); dangling.activeSetId = 'missing';
  assert.throws(() => r.api.validateHandCollectionDocument(dangling), e => e.reason === 'invalid');
  const bad = document(1); bad.sets[0].data.card.level = 80;
  assert.throws(() => r.api.parseHandCollectionSetsBackup(r.api.createHandCollectionSetsBackup(bad), [{ name: 'card', rare: 'R' }]), e => e.reason === 'invalid');
  assert.equal(r.raw(), initial); assert.equal(r.writes(), 0);
});
test('quota errors preserve every existing set and legacy bytes', async () => {
  for (const initial of [JSON.stringify(document(5)), JSON.stringify({ version: 1, data: { card: card(40) } })]) {
    const r = runtime(initial); r.quota();
    await assert.rejects(r.api.saveStoredHandCollectionDocument(document(1), initial), /QuotaExceededError/);
    assert.equal(r.raw(), initial); assert.equal(r.writes(), 1);
  }
});
test('delayed locks freeze content, protect concurrent tab writes, and run editor guard before committing', async () => {
  let release; const lock = (_key, write) => new Promise((resolve, reject) => { release = () => { try { resolve(write()); } catch (e) { reject(e); } }; });
  const r = runtime(null, lock), doc = document(1), save = r.api.saveStoredHandCollectionDocument(doc, null);
  doc.sets[0].data.card.level = 99; release(); await save; assert.equal(r.api.readHandCollectionSnapshot().data.card.level, 1);
  const base = r.raw(), concurrent = r.api.saveStoredHandCollectionDocument(document(1), base);
  r.replace('other-tab'); release(); await assert.rejects(concurrent, e => e.reason === 'conflict'); assert.equal(r.raw(), 'other-tab');
  const guarded = runtime(null, lock); const pending = guarded.api.saveStoredHandCollectionDocument(document(1), null, () => { throw new Error('editor changed'); });
  release(); await assert.rejects(pending, /editor changed/); assert.equal(guarded.raw(), null); assert.equal(guarded.writes(), 0);
});
test('corruption and unsupported versions are never treated as missing saved data', () => {
  for (const raw of ['{broken', '{"version":99,"data":{}}', '{"version":2,"activeSetId":"x","sets":[]}']) {
    const r = runtime(raw); assert.throws(() => r.api.readHandCollectionSnapshot()); assert.equal(r.raw(), raw); assert.equal(r.writes(), 0);
  }
});
