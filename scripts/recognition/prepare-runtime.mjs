import { mkdir, copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const destination = path.join(root, 'public/recognition-runtime/v7');
await mkdir(destination, { recursive: true });
const tesseract = path.dirname(require.resolve('tesseract.js/package.json'));
const core = path.dirname(require.resolve('tesseract.js-core/package.json'));
const data = path.dirname(require.resolve('@tesseract.js-data/eng/package.json'));
await copyFile(path.join(tesseract, 'dist/worker.min.js'), path.join(destination, 'worker.min.js'));
// LSTM only, including non-SIMD fallback. No browser request goes to a CDN.
for (const name of ['tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm', 'tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm']) {
  await copyFile(path.join(core, name), path.join(destination, name));
}
await copyFile(path.join(data, '4.0.0_best_int/eng.traineddata.gz'), path.join(destination, 'eng.traineddata.gz'));
