const { test } = require('node:test'), assert = require('node:assert/strict');
const { load } = require('./test-helpers.cjs');
const { mergeDetections, parseLevel, validateIndex, EXTRACTOR } = load('src/domain/handScreenshot/types.ts');
const { geometricScore } = load('src/domain/handScreenshot/geometry.ts');
const { abortable } = load('src/domain/handScreenshot/abortable.ts');

test('cancel releases the UI even if an OCR job never resolves after worker termination', async () => {
  const controller = new AbortController();
  const pending = abortable(new Promise(() => {}), controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(await abortable(Promise.resolve(70), new AbortController().signal), 70);
});

test('duplicate variants merge by card identity; contradictory levels remain unknown', () => {
  const rows = [{ selected: 'a', level: 80 }, { selected: 'a', level: 85 }, { selected: 'b', level: 70 }, { selected: '', level: 100 }];
  assert.deepEqual(JSON.parse(JSON.stringify(mergeDetections(rows))), [{ cardKey: 'a', conflict: true }, { cardKey: 'b', level: 70, conflict: false }]);
});
test('OCR accepts current/max only and rejects low confidence or impossible levels', () => {
  assert.equal(parseLevel('Lv 70 / 80', 90), 70);
  for (const text of ['80', '1/999', '90/80', '0/80', '70/8O', '71/81 80/80']) assert.equal(parseLevel(text, 95), undefined);
  assert.equal(parseLevel('70/80', 74), undefined);
});
test('geometric evidence requires a consistent scale and spatial support', () => {
  const matches = Array.from({ length: 18 }, (_, i) => { const qx = 10 + i % 6 * 19, qy = 15 + Math.floor(i / 6) * 35; return { qx, qy, x: qx * 2 + 200, y: qy * 2 + 300, distance: 20 }; });
  const result = geometricScore(matches);
  assert.equal(result.inliers, 18); assert.ok(result.spread > .3);
  assert.equal(geometricScore(matches.slice(0, 3)).inliers, 0);
  const scattered = matches.map((m, i) => ({ ...m, x: (i * 61) % 137, y: (i * i * 29) % 233 }));
  assert.ok(geometricScore(scattered).inliers < 8);
});
test('dictionary offsets, duplicates and incompatible extractors are rejected', () => {
  const valid = { schemaVersion: 2, extractor: EXTRACTOR, cards: [], templates: [{ id: 'a:normal', cardKey: 'a', kind: 'art', sourceUrl: 'https://twst.wikiru.jp/attach2/test.png', sourceHash: '0'.repeat(64), offset: 0, count: 12 }] };
  validateIndex(valid, 480);
  assert.throws(() => validateIndex(valid, 479));
  assert.throws(() => validateIndex({ ...valid, extractor: 'future' }, 480));
  assert.throws(() => validateIndex({ ...valid, templates: [...valid.templates, ...valid.templates] }, 480));
});

test('a rotated list portrait still matches the source artwork geometry',()=>{
 const angle=Math.PI/3,scale=2.5,a=Math.cos(angle)*scale,b=Math.sin(angle)*scale;
 const points=Array.from({length:24},(_,i)=>{const qx=12+i%6*18,qy=20+Math.floor(i/6)*24;return{qx,qy,x:a*qx-b*qy+350,y:b*qx+a*qy+50,distance:20};});
 const result=geometricScore(points);assert.equal(result.inliers,24);assert.ok(result.spread>.3);
});
