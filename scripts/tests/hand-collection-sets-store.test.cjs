const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript'), vue = require('vue');
const { createPinia, setActivePinia } = require('pinia');
const root = path.resolve(__dirname, '../..'), key = 'twst-hand-collection', draftKey = key + '-draft-v1';
const card = level => ({ characterName: '', cardName: 'card', isOwned: true, level, totsu: 0, isLimitBreak: false, isM3: false });
const document = (active = 'a') => ({ version: 2, activeSetId: active, sets: [
  { id: 'a', name: 'A', data: { card: card(10) } }, { id: 'b', name: 'B', data: { card: card(20) } },
] });
const reason = value => error => error.reason === value;

test('assigned import preserves unassigned sets and current dirty editor/name/selection', async t => {
  const r=runtime(t,{raw:JSON.stringify(document())}); r.store.updateHandCard('card',{level:37}); r.store.nameDraft='未保存の名前';
  const untouched=JSON.stringify(r.store.savedSets[0]), revision=r.store.collectionContextRevision;
  await r.store.importAssignedSets([{slot:2,name:' 読み込み B ',data:{card:card(82)}},{slot:5,name:'E',data:{card:card(55)}}],{overwriteConfirmed:true,expectedRevision:revision});
  assert.equal(r.writes(),1); assert.equal(JSON.stringify(r.store.savedSets[0]),untouched);
  assert.equal(r.store.savedSets.find(s=>s.slot===2).id,'b'); assert.equal(r.store.savedSets.find(s=>s.slot===2).name,'読み込み B');
  assert.equal(r.store.activeSlot,1); assert.equal(r.store.activeSetId,'a'); assert.equal(r.store.handCollection.card.level,37);
  assert.equal(r.store.nameDraft,'未保存の名前'); assert.equal(r.store.hasUnsavedChanges,true); assert.equal(r.store.collectionContextRevision,revision);
  r.store.resetUnsavedChanges(); assert.equal(r.store.handCollection.card.level,10);
});

test('current assigned import requires confirmation, replaces baseline, clears name, and invalidates prior image context', async t => {
  const r=runtime(t,{raw:JSON.stringify(document())}); r.store.updateHandCard('card',{level:37}); r.store.nameDraft='Draft';
  const raw=r.raw(), revision=r.store.collectionContextRevision;
  await assert.rejects(r.store.importAssignedSets([{slot:1,name:'ImportA',data:{card:card(88)}}]),reason('confirmation')); assert.equal(r.raw(),raw);
  await r.store.importAssignedSets([{slot:1,name:'ImportA',data:{card:card(88)}}],{overwriteConfirmed:true,expectedRevision:revision});
  assert.equal(r.store.activeSlot,1); assert.equal(r.store.activeSetId,'a'); assert.equal(r.store.nameDraft,null); assert.equal(r.store.handCollection.card.level,88);
  assert.equal(r.store.hasUnsavedChanges,false); assert.equal(r.store.collectionContextRevision,revision+1); assert.equal(r.session.has(draftKey),false);
  r.store.updateHandCard('card',{level:90}); r.store.resetUnsavedChanges(); assert.equal(r.store.handCollection.card.level,88);
});

test('assigned import into empty current slot keeps selection and untouched slot IDs; all skip never writes', async t => {
  const r=runtime(t); const revision=r.store.collectionContextRevision;
  await r.store.importAssignedSets([],{expectedRevision:-1}); assert.equal(r.raw(),null); assert.equal(r.writes(),0); assert.equal(r.store.collectionContextRevision,revision);
  await r.store.importAssignedSets([{slot:4,name:'Fourth',data:{card:card(44)}}]); assert.equal(r.store.activeSlot,1); assert.equal(r.store.activeSetId,null);
  await r.store.importAssignedSets([{slot:1,name:'First',data:{card:card(11)}}]); assert.equal(r.store.activeSlot,1); assert.equal(r.store.handCollection.card.level,11);
  assert.equal(r.store.savedSets.find(s=>s.slot===4).name,'Fourth'); assert.equal(r.store.collectionContextRevision,revision+1);
});

test('assigned import validates the whole assignment and stale revision before any write', async t => {
  const r=runtime(t,{raw:JSON.stringify(document())}), raw=r.raw(),revision=r.store.collectionContextRevision;
  const good={slot:3,name:'C',data:{card:card(33)}};
  for(const input of [[good,{...good}], [{...good,slot:6}], [{...good,slot:1.5}], [{...good,name:' '}], [{...good,data:{card:{level:-1}}}], [{...good,data:null}]]) {
    await assert.rejects(r.store.importAssignedSets(input,{overwriteConfirmed:true}),reason('invalid')); assert.equal(r.raw(),raw); assert.equal(r.writes(),0);
  }
  await assert.rejects(r.store.importAssignedSets([good],{expectedRevision:revision-1}),reason('confirmation')); assert.equal(r.raw(),raw);
});

test('quota and external conflicts leave assignment editor, name, selection and revision intact', async t => {
  for(const active of [true,false]) {
    const r=runtime(t,{raw:JSON.stringify(document())}); r.store.updateHandCard('card',{level:39}); r.store.nameDraft='NameDraft';
    const raw=r.raw(), revision=r.store.collectionContextRevision, sets=JSON.stringify(r.store.savedSets);
    r.quota(true); await assert.rejects(r.store.importAssignedSets([{slot:active?1:3,name:'Import',data:{card:card(90)}}],{overwriteConfirmed:true}));
    assert.equal(r.raw(),raw); assert.equal(r.store.handCollection.card.level,39); assert.equal(r.store.nameDraft,'NameDraft'); assert.equal(r.store.activeSlot,1);
    assert.equal(JSON.stringify(r.store.savedSets),sets); assert.equal(r.store.collectionContextRevision,revision);
  }
  const r=runtime(t,{raw:JSON.stringify(document())}), revision=r.store.collectionContextRevision; r.defer();
  const pending=r.store.importAssignedSets([{slot:1,name:'Import',data:{card:card(90)}}],{overwriteConfirmed:true});
  const external=JSON.stringify(document('b')); r.local.set(key,external); r.release(); await assert.rejects(pending,reason('conflict'));
  assert.equal(r.raw(),external); assert.equal(r.store.activeSetId,'a'); assert.equal(r.store.handCollection.card.level,10); assert.equal(r.store.collectionContextRevision,revision);
});

test('pending assigned import guards direct card edits, name edits, and context revision before writing', async t => {
  for(const change of ['card','name','revision']) {
    const r=runtime(t,{raw:JSON.stringify(document())}), raw=r.raw(); r.defer();
    const pending=r.store.importAssignedSets([{slot:1,name:'Import',data:{card:card(90)}}],{overwriteConfirmed:true});
    if(change==='card')r.store.handCollection.card.level=42; else if(change==='name')r.store.nameDraft='Changed'; else r.store.collectionContextRevision++;
    const editor=JSON.stringify(r.store.handCollection), name=r.store.nameDraft, revision=r.store.collectionContextRevision;
    r.release(); await assert.rejects(pending,reason('confirmation')); assert.equal(r.raw(),raw); assert.equal(r.writes(),0);
    assert.equal(JSON.stringify(r.store.handCollection),editor); assert.equal(r.store.nameDraft,name); assert.equal(r.store.collectionContextRevision,revision);
  }
});

test('assigned import freezes external payload before a delayed lock without losing unassigned slots', async t => {
  const r=runtime(t,{raw:JSON.stringify(document())}), data={card:card(44)}; r.defer();
  const pending=r.store.importAssignedSets([{slot:5,name:'Frozen',data}]); data.card.level=99; r.release(); await pending;
  assert.equal(r.store.savedSets.find(s=>s.slot===5).data.card.level,44); assert.equal(r.store.savedSets.find(s=>s.slot===1).data.card.level,10);
});

test('unsaved name alone requires confirmation and survives a cancelled slot switch', async t => {
  const raw = JSON.stringify(document()), r = runtime(t, { raw });
  r.store.nameDraft = '未保存の自由名';
  assert.equal(r.store.hasUnsavedChanges, false);
  assert.equal(r.store.hasUnsavedNameChanges, true);
  await assert.rejects(r.store.selectSlot(2), reason('confirmation'));
  assert.equal(r.raw(), raw); assert.equal(r.store.activeSlot, 1);
  assert.equal(r.store.nameDraft, '未保存の自由名');
  await r.store.selectSlot(2, true);
  assert.equal(r.store.activeSlot, 2); assert.equal(r.store.nameDraft, null);
});

test('name draft survives quota failure and clears only after a successful save', async t => {
  const raw = JSON.stringify(document()), r = runtime(t, { raw });
  r.store.nameDraft = '名前の再試行'; r.quota(true);
  await assert.rejects(r.store.saveSlot(1, r.store.nameDraft, { overwriteConfirmed: true }));
  assert.equal(r.raw(), raw); assert.equal(r.store.nameDraft, '名前の再試行');
  r.quota(false); await r.store.saveSlot(1, r.store.nameDraft, { overwriteConfirmed: true });
  assert.equal(r.store.activeSet.name, '名前の再試行'); assert.equal(r.store.nameDraft, null);
});

test('another tab cannot silently replace an unsaved name draft', t => {
  const r = runtime(t, { raw: JSON.stringify(document()) });
  r.store.nameDraft = '名前を編集中';
  const newer = document('b'); r.local.set(key, JSON.stringify(newer)); r.events.get('storage')({ key });
  assert.equal(r.store.hasConflict, true); assert.equal(r.store.activeSlot, 1);
  assert.equal(r.store.nameDraft, '名前を編集中');
});

test('fixed slots virtually migrate arbitrary IDs and names without rewriting existing bytes', async t => {
  const raw = JSON.stringify(document('b')), r = runtime(t, {raw});
  assert.equal(r.raw(),raw); assert.equal(r.writes(),0); assert.equal(r.store.activeSlot,2);
  assert.deepEqual(Array.from(r.store.slots,s => [s.slot,s.set?.id ?? null]),[[1,'a'],[2,'b'],[3,null],[4,null],[5,null]]);
  await r.store.selectSlot(5);
  assert.equal(r.store.activeSetId,null); assert.equal(r.store.activeSlot,5); assert.equal(Object.keys(r.store.handCollection).length,0);
  const saved = JSON.parse(r.raw()); assert.equal(saved.sets[0].id,'a'); assert.equal(saved.sets[1].name,'B');
  assert.equal(saved.activeSlot,5); assert.equal(saved.activeSetId,null);
});

test('all slot saves require confirmation and deleted holes never renumber other slots', async t => {
  const r = runtime(t,{raw:JSON.stringify(document())}); await r.store.selectSlot(5);
  r.store.updateHandCard('card',{level:55}); const before=r.raw();
  await assert.rejects(r.store.saveSlot(5,'自由名'),reason('confirmation')); assert.equal(r.raw(),before);
  await r.store.saveSlot(5,' 自由名 ',{overwriteConfirmed:true});
  assert.equal(r.store.activeSlot,5); assert.equal(r.store.activeSet.name,'自由名');
  await r.store.deleteSlot(2,{deleteConfirmed:true});
  assert.deepEqual(Array.from(r.store.savedSets,s=>s.slot),[1,5]); assert.equal(r.store.handCollection.card.level,55);
  await r.store.selectSlot(2); await r.store.saveSelectedSlot('再利用',true);
  assert.deepEqual(Array.from(r.store.savedSets,s=>s.slot),[1,2,5]);
});

test('delete active slot requires confirmation, clears only it, and quota failure retains raw/editor', async t => {
  const r=runtime(t,{raw:JSON.stringify(document())}); r.store.updateHandCard('card',{level:33}); const raw=r.raw();
  await assert.rejects(r.store.deleteSlot(1,{deleteConfirmed:true}),reason('confirmation'));
  r.quota(true); await assert.rejects(r.store.deleteSelectedSlot(true));
  assert.equal(r.raw(),raw); assert.equal(r.store.handCollection.card.level,33); assert.equal(r.store.activeSlot,1);
  r.quota(false); await r.store.deleteSelectedSlot(true);
  assert.equal(r.store.activeSetId,null); assert.equal(r.store.activeSlot,1); assert.equal(Object.keys(r.store.handCollection).length,0);
  assert.equal(r.store.savedSets.length,1); assert.equal(r.store.savedSets[0].id,'b'); assert.equal(r.store.savedSets[0].slot,2);
  assert.equal(r.store.hasUnsavedChanges,false);
});

test('empty slot draft survives reload and backup restores slot placement including holes', async t => {
  const r=runtime(t,{raw:JSON.stringify(document())}); await r.store.selectSlot(4); r.store.updateHandCard('card',{level:44});
  const draft=r.session.get(draftKey), raw=r.raw(); assert.equal(JSON.parse(draft).activeSlot,4);
  const recovered=runtime(t,{raw,draft}); assert.equal(recovered.store.activeSlot,4); assert.equal(recovered.store.handCollection.card.level,44);
  const backup=recovered.storage.parseHandCollectionSetsBackup(recovered.store.createSetsBackup('草稿'));
  assert.deepEqual(Array.from(backup.sets,s=>s.slot),[1,2,4]); assert.equal(backup.activeSlot,4);
  const fresh=runtime(t); await fresh.store.restoreSetsBackup(backup);
  assert.equal(fresh.store.activeSlot,4); assert.equal(fresh.store.handCollection.card.level,44);
  assert.equal(fresh.store.slots[2].set,null);
});

test('pending empty-slot switch or deletion aborts safely on direct editing and cross-tab conflicts', async t => {
  for(const action of ['switch','delete']) {
    const r=runtime(t,{raw:JSON.stringify(document())}), raw=r.raw(); r.defer();
    const pending=action==='switch'?r.store.selectSlot(5):r.store.deleteSelectedSlot(true);
    r.store.handCollection.card.level=77; r.release(); await assert.rejects(pending,reason('confirmation'));
    assert.equal(r.raw(),raw); assert.equal(r.store.activeSlot,1); assert.equal(r.store.handCollection.card.level,77);
  }
  const r=runtime(t,{raw:JSON.stringify(document())}); r.defer(); const pending=r.store.deleteSelectedSlot(true);
  const external=JSON.stringify({...document('b'),activeSlot:2}); r.local.set(key,external); r.release();
  await assert.rejects(pending,reason('conflict')); assert.equal(r.raw(),external); assert.equal(r.store.handCollection.card.level,10);
});

test('invalid duplicate slots or mismatched active slot reject without modifying storage', t => {
  const r=runtime(t), source=document(); source.sets[0].slot=3; source.sets[1].slot=3;
  assert.throws(()=>r.storage.validateHandCollectionDocument(source),reason('invalid'));
  assert.throws(()=>r.storage.validateHandCollectionDocument({...document(),activeSlot:5}),reason('invalid'));
  assert.equal(r.raw(),null);
});
// Production Vue/Pinia/store/storage; only browser storage and Web Locks are controlled.
function runtime(t, { raw = null, draft = null } = {}) {
  const local = new Map(), session = new Map(), events = new Map(), cache = new Map(), pending = [];
  if (raw !== null) local.set(key, raw); if (draft !== null) session.set(draftKey, draft);
  let defer = false, quota = false, writes = 0;
  const window = {
    localStorage: { getItem: k => local.get(k) ?? null, setItem(k, value) { if (quota) throw new Error('QuotaExceededError'); writes++; local.set(k, value); }, removeItem: k => local.delete(k) },
    sessionStorage: { getItem: k => session.get(k) ?? null, setItem: (k, value) => session.set(k, value), removeItem: k => session.delete(k) },
    addEventListener: (name, handler) => events.set(name, handler), removeEventListener: name => events.delete(name),
  };
  const navigator = { locks: { request: (_name, write) => defer ? new Promise((resolve, reject) => pending.push(() => {
    try { resolve(write()); } catch (error) { reject(error); }
  })) : Promise.resolve().then(write) } };
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative);
    const module = { exports: {} }; cache.set(relative, module.exports);
    const source = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
    }).outputText;
    vm.runInNewContext(source, { module, exports: module.exports, window, navigator, console: { warn() {} },
      require: id => id.startsWith('@/') ? load('src/' + id.slice(2) + '.ts') : require(id) });
    return module.exports;
  }
  setActivePinia(createPinia()); const scope = vue.effectScope();
  const store = scope.run(() => load('src/store/handCollection.ts').useHandCollectionStore());
  t.after(() => { store.$dispose(); scope.stop(); });
  return { store, local, session, events, storage: load('src/storage/handCollectionStorage.ts'),
    raw: () => local.get(key) ?? null, writes: () => writes, defer: () => { defer = true; },
    release: () => { assert.ok(pending.length); pending.shift()(); }, quota: value => { quota = value; } };
}

test('legacy bytes stay untouched until save; all five snapshots remain independent and a sixth is rejected', async t => {
  const raw = JSON.stringify({ version: 1, data: { card: card(10) } }), r = runtime(t, { raw });
  assert.equal(r.raw(), raw); assert.equal(r.writes(), 0); assert.equal(r.store.activeSetId, 'legacy'); assert.equal(r.store.activeSet.name, 'セット1');
  for (let level = 20; level <= 50; level += 10) { r.store.updateHandCard('card', { level }); await r.store.saveNewSet('Set ' + level); }
  assert.deepEqual(Array.from(r.store.savedSets, set => set.data.card.level), [10, 20, 30, 40, 50]);
  const before = r.raw(); await assert.rejects(r.store.saveNewSet('Six'), reason('limit'));
  assert.equal(r.raw(), before); assert.equal(r.store.maxSets, 5); assert.equal(r.store.hasUnsavedChanges, false);
});

test('selected existing destination saves current edits atomically and preserves other sets', async t => {
  const r = runtime(t, { raw: JSON.stringify(document()) });
  r.store.updateHandCard('card', { level: 42 });
  const before = r.raw(), revision = r.store.collectionContextRevision;
  await assert.rejects(r.store.saveHandCollectionManually({ setId: 'b' }), reason('confirmation'));
  await assert.rejects(r.store.saveHandCollectionManually({ setId: 'missing', overwriteConfirmed: true }), reason('invalid'));
  assert.equal(r.raw(), before);
  r.quota(true);
  await assert.rejects(r.store.saveHandCollectionManually({ setId: 'b', overwriteConfirmed: true }));
  assert.equal(r.raw(), before); assert.equal(r.store.activeSetId, 'a'); assert.equal(r.store.handCollection.card.level, 42);
  r.quota(false);
  await r.store.saveHandCollectionManually({ setId: 'b', overwriteConfirmed: true });
  const saved = JSON.parse(r.raw());
  assert.equal(saved.activeSetId, 'b'); assert.equal(saved.sets[0].data.card.level, 10); assert.equal(saved.sets[1].data.card.level, 42);
  assert.equal(r.store.handCollection.card.level, 42); assert.equal(r.store.hasUnsavedChanges, false);
  assert.equal(r.store.collectionContextRevision, revision + 1);
});

test('active overwrite requires confirmation while first save creates a set', async t => {
  const r = runtime(t); r.store.updateHandCard('card', { isOwned: true, level: 10 });
  await r.store.saveHandCollectionManually({ name: 'First' }); const before = r.raw();
  r.store.updateHandCard('card', { level: 20 }); await assert.rejects(r.store.saveHandCollectionManually(), reason('confirmation'));
  assert.equal(r.raw(), before); assert.equal(r.store.handCollection.card.level, 20);
  await r.store.saveHandCollectionManually({ overwriteConfirmed: true });
  assert.equal(JSON.parse(r.raw()).sets[0].data.card.level, 20); assert.equal(r.store.hasUnsavedChanges, false);
});

test('save snapshots freeze before locks; later direct edits stay dirty and editor API is disabled while saving', async t => {
  const r = runtime(t, { raw: JSON.stringify(document()) }); r.store.updateHandCard('card', { level: 30 }); r.defer();
  const saving = r.store.saveHandCollectionManually({ overwriteConfirmed: true });
  assert.equal(r.store.saving, true); assert.throws(() => r.store.updateHandCard('card', { level: 40 }), reason('confirmation'));
  r.store.handCollection.card.level = 40; r.release(); await saving;
  assert.equal(JSON.parse(r.raw()).sets[0].data.card.level, 30); assert.equal(r.store.handCollection.card.level, 40);
  assert.equal(r.store.hasUnsavedChanges, true); assert.equal(JSON.parse(r.session.get(draftKey)).data.card.level, 40);
});

test('rename saves only metadata and preserves dirty editor and the prior baseline', async t => {
  const r = runtime(t, { raw: JSON.stringify(document()) }); r.store.updateHandCard('card', { level: 30 });
  await r.store.renameActiveSet('Renamed'); const saved = JSON.parse(r.raw());
  assert.equal(saved.sets[0].name, 'Renamed'); assert.equal(saved.sets[0].data.card.level, 10);
  assert.equal(r.store.handCollection.card.level, 30); assert.equal(r.store.hasUnsavedChanges, true);
  r.store.resetUnsavedChanges(); assert.equal(r.store.handCollection.card.level, 10);
});

test('dirty switch requires confirmation and clears the draft only on successful atomic selection', async t => {
  const r = runtime(t, { raw: JSON.stringify(document()) }); r.store.updateHandCard('card', { level: 30 }); const before = r.raw();
  await assert.rejects(r.store.switchSet('b'), reason('confirmation')); assert.equal(r.raw(), before);
  await r.store.switchSet('b', true); assert.equal(r.store.activeSetId, 'b'); assert.equal(r.store.handCollection.card.level, 20);
  assert.equal(r.store.hasUnsavedChanges, false); assert.equal(r.session.has(draftKey), false); assert.equal(JSON.parse(r.raw()).activeSetId, 'b');
});

test('quota failure and direct editing during a pending switch preserve bytes and current editor', async t => {
  const raw = JSON.stringify(document()), r = runtime(t, { raw }); r.store.updateHandCard('card', { level: 30 }); r.quota(true);
  await assert.rejects(r.store.switchSet('b', true)); assert.equal(r.raw(), raw); assert.equal(r.store.activeSetId, 'a');
  assert.equal(r.store.handCollection.card.level, 30); r.quota(false); r.defer();
  const switching = r.store.switchSet('b', true); r.store.handCollection.card.level = 40; r.release();
  await assert.rejects(switching, reason('confirmation')); assert.equal(r.raw(), raw); assert.equal(r.store.activeSetId, 'a');
  assert.equal(r.store.handCollection.card.level, 40); assert.equal(r.store.hasUnsavedChanges, true);
});

test('restore validates all sets and protects existing data through confirmation and quota failure', async t => {
  const raw = JSON.stringify(document()), r = runtime(t, { raw }); r.store.updateHandCard('card', { level: 30 });
  await assert.rejects(r.store.restoreSetsBackup(document('b')), reason('confirmation'));
  await assert.rejects(r.store.restoreSetsBackup({ ...document(), sets: [...document().sets, { id: 'b', name: 'Duplicate', data: {} }] }, true), reason('invalid'));
  assert.equal(r.raw(), raw); assert.equal(r.store.handCollection.card.level, 30);
  r.quota(true); await assert.rejects(r.store.restoreSetsBackup(document('b'), true)); assert.equal(r.raw(), raw);
  r.quota(false); await r.store.restoreSetsBackup(document('b'), true);
  assert.equal(r.store.activeSetId, 'b'); assert.equal(r.store.handCollection.card.level, 20); assert.equal(r.store.hasUnsavedChanges, false);
});

test('backup preserves every saved set and substitutes the current unsaved active settings without saving', async t => {
  const r = runtime(t, { raw: JSON.stringify(document()) });
  for (let i = 3; i <= 5; i++) { r.store.updateHandCard('card', { level: i * 10 }); await r.store.saveNewSet('Set ' + i); }
  r.store.updateHandCard('card', { level: 60 }); const before = r.raw();
  const backup = r.storage.parseHandCollectionSetsBackup(r.store.createSetsBackup());
  assert.equal(backup.sets.length, 5); assert.equal(backup.sets.find(set => set.id === backup.activeSetId).data.card.level, 60);
  assert.equal(backup.sets[0].data.card.level, 10); assert.equal(r.raw(), before); assert.equal(r.store.hasUnsavedChanges, true);
  await r.store.restoreSetsBackup(backup, true); assert.equal(r.store.handCollection.card.level, 60);
});

test('without a saved active set the backup captures one working set and leaves storage empty', t => {
  const r = runtime(t); r.store.updateHandCard('card', { level: 40 });
  const backup = r.storage.parseHandCollectionSetsBackup(r.store.createSetsBackup('Draft'));
  assert.equal(backup.sets.length, 1); assert.equal(backup.sets[0].name, 'Draft'); assert.equal(backup.sets[0].data.card.level, 40);
  assert.equal(r.raw(), null); assert.equal(r.store.savedSets.length, 0); assert.equal(r.store.hasUnsavedChanges, true);
});

test('v2 draft restores its selected-set baseline and old v1 drafts still recover', t => {
  const raw = JSON.stringify(document());
  const r = runtime(t, { raw, draft: JSON.stringify({ version: 2, baseRaw: raw, activeSetId: 'b', data: { card: card(25) } }) });
  assert.equal(r.store.activeSetId, 'b'); assert.equal(r.store.handCollection.card.level, 25); assert.equal(r.store.hasUnsavedChanges, true);
  r.store.resetUnsavedChanges(); assert.equal(r.store.handCollection.card.level, 20);
  const old = runtime(t, { raw, draft: JSON.stringify({ version: 1, baseRaw: raw, data: { card: card(15) } }) });
  assert.equal(old.store.activeSetId, 'a'); assert.equal(old.store.handCollection.card.level, 15); old.store.resetUnsavedChanges();
  assert.equal(old.store.handCollection.card.level, 10);
});

test('other-tab metadata conflicts preserve the dirty editor and original draft raw base', async t => {
  const raw = JSON.stringify(document()), r = runtime(t, { raw }); r.store.updateHandCard('card', { level: 30 });
  const newer = document(); newer.sets[0].name = 'Other tab'; r.local.set(key, JSON.stringify(newer)); r.events.get('storage')({ key });
  assert.equal(r.store.hasConflict, true); await assert.rejects(r.store.saveNewSet('Unsafe'), reason('conflict'));
  assert.equal(r.store.handCollection.card.level, 30); assert.equal(JSON.parse(r.session.get(draftKey)).baseRaw, raw);
});

test('a deleted set draft remains recoverable as conflicting work after another tab replaces the document', t => {
  const raw = JSON.stringify({ version: 2, activeSetId: 'new', sets: [{ id: 'new', name: 'New', data: {} }] });
  const r = runtime(t, { raw, draft: JSON.stringify({ version: 2, baseRaw: JSON.stringify(document()), activeSetId: 'a', data: { card: card(45) } }) });
  assert.equal(r.store.handCollection.card.level, 45); assert.equal(r.store.hasConflict, true); assert.equal(r.store.draftFailed, false);
});

test('context revision invalidates import undo across new sets, reload, reset, switch and same-ID restore', async t => {
  const r = runtime(t, { raw: JSON.stringify(document()) }), base = r.store.collectionContextRevision;
  await r.store.renameActiveSet('Rename'); assert.equal(r.store.collectionContextRevision, base);
  await r.store.saveHandCollectionManually({ overwriteConfirmed: true }); assert.equal(r.store.collectionContextRevision, base);
  r.store.resetUnsavedChanges(); assert.equal(r.store.collectionContextRevision, base + 1);
  await r.store.saveNewSet('New'); assert.equal(r.store.collectionContextRevision, base + 2);
  await r.store.switchSet('a'); assert.equal(r.store.collectionContextRevision, base + 3);
  await r.store.restoreSetsBackup(document(), true); assert.equal(r.store.collectionContextRevision, base + 4);
  r.store.reloadHandCollection(); assert.equal(r.store.collectionContextRevision, base + 5);
});

test('a clean pending switch conflicts atomically and retains its old editor until explicit reload', async t => {
  const r = runtime(t, { raw: JSON.stringify(document()) }); r.defer();
  const switching = r.store.switchSet('b'), changed = document(); changed.sets[0].name = 'Other tab';
  const newerRaw = JSON.stringify(changed); r.local.set(key, newerRaw); r.events.get('storage')({ key }); r.release();
  await assert.rejects(switching, reason('conflict'));
  assert.equal(r.raw(), newerRaw); assert.equal(r.store.activeSetId, 'a'); assert.equal(r.store.handCollection.card.level, 10);
  assert.equal(r.store.savedSets[0].name, 'A'); assert.equal(r.store.hasConflict, true);
  r.store.reloadHandCollection(); assert.equal(r.store.savedSets[0].name, 'Other tab'); assert.equal(r.store.hasConflict, false);
});

test('editing while a restore waits for its lock aborts before changing stored bytes or selection', async t => {
  const raw = JSON.stringify(document()), r = runtime(t, { raw }); r.defer();
  const restoring = r.store.restoreSetsBackup(document('b'), true); r.store.handCollection.card.level = 45; r.release();
  await assert.rejects(restoring, reason('confirmation')); assert.equal(r.raw(), raw); assert.equal(r.store.activeSetId, 'a');
  assert.equal(r.store.handCollection.card.level, 45); assert.equal(r.store.hasUnsavedChanges, true);
});
