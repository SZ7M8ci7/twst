const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '../../public/twst-cache-sw.js'), 'utf8');
const origin = 'https://example.test';

function requestAsset(caches, fetch) {
  let onFetch;
  const self = { location: { origin }, addEventListener(type, handler) { if (type === 'fetch') onFetch = handler; } };
  vm.runInNewContext(source, { self, caches, fetch, URL, Response, Headers });
  let result;
  onFetch({ request: new Request(origin + '/assets/examSearch.worker.js'), respondWith(promise) { result = promise; } });
  return result;
}

for (const failure of ['open', 'match', 'put']) {
  test(`network asset is readable when cache ${failure} fails`, async () => {
    const fail = async () => { throw new DOMException('Cache unavailable', 'QuotaExceededError'); };
    const cache = { match: failure === 'match' ? fail : async () => undefined, put: fail };
    const caches = { open: failure === 'open' ? fail : async () => cache };
    let requests = 0;
    const response = await requestAsset(caches, async () => { requests++; return new Response('worker script'); });
    assert.equal(await response.text(), 'worker script');
    assert.equal(requests, 1);
  });
}

test('cached assets can still be used offline after a successful network load', async () => {
  let saved;
  const caches = { open: async () => ({ match: async () => saved?.clone(), put: async (_, value) => { saved = value; } }) };
  await requestAsset(caches, async () => new Response('worker script'));
  assert.ok(Number(saved.headers.get('sw-cache-timestamp')) > 0);
  assert.equal(await (await requestAsset(caches, () => assert.fail('fresh hit'))).text(), 'worker script');
  saved.headers.set('sw-cache-timestamp', '1');
  assert.equal(await (await requestAsset(caches, async () => { throw new Error('offline'); })).text(), 'worker script');
});
