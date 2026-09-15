const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function load(relative, globals = {}, cache = new Map()) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText;
  const localRequire = id => id.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), id + '.ts')), globals, cache) : require(id);
  vm.runInNewContext(code, { module, exports: module.exports, require: localRequire, console, Uint8Array, Uint32Array, Int32Array, Float32Array, DataView, ArrayBuffer, TextDecoder, TextEncoder, URL, Response, AbortController, setTimeout, clearTimeout, atob, ...globals }, { filename });
  cache.set(filename, module.exports); return module.exports;
}
module.exports = { load, root };
