import { DATASET_SOURCE, EXTRACTOR, validateIndex, type AssetPart, type DatasetIndex, type DatasetManifest } from './types';

const CACHE = 'twst-recognition-jp-v2';
export interface DatasetProgress { phase: 'manifest' | 'data'; loadedBytes: number; totalBytes: number; downloadedBytes: number }
async function hash(data: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(v => v.toString(16).padStart(2, '0')).join('');
}
function assets(manifest: DatasetManifest): AssetPart[] {
  if (manifest.schemaVersion !== 2 || manifest.source !== DATASET_SOURCE || manifest.extractor !== EXTRACTOR || !/^[a-f0-9]{20}$/.test(manifest.datasetVersion)) throw new Error('Unsupported dictionary version');
  if (!Array.isArray(manifest.features?.parts) || !manifest.features.parts.length || manifest.features.parts.length > 256) throw new Error('Invalid dictionary parts');
  const parts = [manifest.index, ...manifest.features.parts];
  for (const part of parts) {
    if (!part || !/^[a-f0-9]{64}$/.test(part.sha256) || !['objects/' + part.sha256 + '.json', 'objects/' + part.sha256 + '.bin'].includes(part.path) || !Number.isInteger(part.bytes) || part.bytes < 1 || part.bytes > 5_000_000) throw new Error('Invalid dictionary path or size');
  }
  const bytes = manifest.features.parts.reduce((total, part) => total + part.bytes, 0);
  if (bytes !== manifest.features.bytes || bytes > 192_000_000) throw new Error('Invalid dictionary total');
  return parts;
}
export async function loadDataset(base: string, signal: AbortSignal, progress: (value: DatasetProgress) => void) {
  const root = new URL(base, location.href), latest = new URL('latest.json', root).href;
  let cache: Cache | undefined, downloadedBytes = 0;
  try { cache = await caches.open(CACHE); } catch { /* Optional browser storage. */ }
  async function download(url: string, limit: number, fresh = false, report?: (bytes: number) => void) {
    signal.throwIfAborted();
    const controller = new AbortController(), abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    const timeout = () => controller.abort(new Error('Dictionary download stalled'));
    let timer = setTimeout(timeout, 30000);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: 'omit', ...(fresh ? { cache: 'no-cache' as const } : {}) });
      if (!response.ok) throw new Error(`Dictionary HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > limit) throw new Error('Dictionary too large');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Empty dictionary');
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          clearTimeout(timer); timer = setTimeout(timeout, 30000);
          size += value.byteLength;
          if (size > limit) { await reader.cancel(); throw new Error('Dictionary too large'); }
          chunks.push(value); downloadedBytes += value.byteLength; report?.(value.byteLength);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return bytes.buffer;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  }
  async function read(manifest: DatasetManifest, offline: boolean) {
    const parts = assets(manifest), buffers: ArrayBuffer[] = new Array(parts.length);
    const totalBytes = parts.reduce((total, part) => total + part.bytes, 0);
    let loadedBytes = 0, cacheComplete = !!cache, next = 0;
    const report = (bytes: number) => { loadedBytes += bytes; progress({ phase: 'data', loadedBytes, totalBytes, downloadedBytes }); };
    async function worker() {
      while (next < parts.length) {
        const index = next++, part = parts[index], url = new URL(part.path, root).href;
        signal.throwIfAborted();
        const cached = await cache?.match(url);
        let buffer = cached ? await cached.arrayBuffer() : undefined;
        if (buffer && (buffer.byteLength !== part.bytes || await hash(buffer) !== part.sha256)) {
          buffer = undefined;
          try { await cache?.delete(url); } catch { /* Retry the asset online. */ }
        }
        if (!buffer) {
          if (offline) throw new Error('No complete offline dictionary');
          buffer = await download(url, part.bytes, false, report);
          if (buffer.byteLength !== part.bytes || await hash(buffer) !== part.sha256) throw new Error('Dictionary checksum mismatch');
          try { await cache?.put(url, new Response(buffer)); } catch { cacheComplete = false; }
        } else report(buffer.byteLength);
        buffers[index] = buffer;
      }
    }
    // Wait for every started transfer before falling back or releasing its buffers.
    const workers = await Promise.allSettled(Array.from({ length: Math.min(4, parts.length) }, () => worker()));
    const failed = workers.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failed) throw failed.reason;
    signal.throwIfAborted();
    const index = JSON.parse(new TextDecoder().decode(buffers[0])) as DatasetIndex;
    validateIndex(index, manifest.features.bytes);
    const features = new Uint8Array(manifest.features.bytes); let offset = 0;
    for (let i = 1; i < buffers.length; i++) { features.set(new Uint8Array(buffers[i]), offset); offset += buffers[i].byteLength; }
    return { manifest, index, features: features.buffer, offline, cacheComplete, downloadedBytes };
  }
  try {
    progress({ phase: 'manifest', loadedBytes: 0, totalBytes: 0, downloadedBytes });
    const manifest = JSON.parse(new TextDecoder().decode(await download(latest, 1_000_000, true)));
    const data = await read(manifest, false);
    signal.throwIfAborted();
    if (cache && data.cacheComplete) {
      try {
        const previous = await cache.match(latest), keep = new Set([latest, ...assets(manifest).map(part => new URL(part.path, root).href)]);
        if (previous) {
          try { for (const part of assets(await previous.json())) keep.add(new URL(part.path, root).href); }
          catch { /* An older extractor must not block activation of this verified release. */ }
        }
        await cache.put(latest, new Response(JSON.stringify(manifest)));
        for (const request of await cache.keys()) if (request.url.startsWith(root.href) && !keep.has(request.url)) await cache.delete(request);
      } catch { /* Optional caching must never prevent online recognition. */ }
    }
    return data;
  } catch (error) {
    if (signal.aborted) throw error;
    const previous = await cache?.match(latest);
    if (!previous) throw error;
    return read(await previous.json(), true);
  }
}
