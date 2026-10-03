// Optional, pixel-based acceptance test for the user's six screenshots.
// Keep image bytes outside the repository. Set TWST_GROOVY_SCREENSHOT_DIR to
// their directory; this test never uploads them or supplies mocked detections.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { inflateSync } = require('node:zlib');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const directory = process.env.TWST_GROOVY_SCREENSHOT_DIR;
const cases = [
  ['43.560', 'APPAAA', 'PAPAAP'], ['40.343', 'PAAAPP', 'PPPPPP'],
  ['37.359', 'PPPAAA', 'PAAAPP'], ['34.043', 'APPPPP', 'PPPAAP'],
  ['31.210', 'AAPPPA', 'APAPAA'], ['47.627', 'APAPAA', 'PPAAPP'],
];
function load(relative, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText, { module, exports: module.exports, require: id => dependencies[id] || require(id) });
  return module.exports;
}
function pngPixels(filename) {
  const png = fs.readFileSync(filename);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const compressed = []; let width, height, channels;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      assert.equal(body[8], 8); assert.ok([2, 6].includes(body[9]));
      assert.deepEqual([...body.subarray(10)], [0, 0, 0]); channels = body[9] === 2 ? 3 : 4;
    }
    if (type === 'IDAT') compressed.push(body);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(compressed)), stride = width * channels;
  assert.equal(raw.length, (stride + 1) * height);
  const pixels = Buffer.alloc(stride * height), data = new Uint8ClampedArray(width * height * 4);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, left = x >= channels ? pixels[i - channels] : 0;
      const up = y ? pixels[i - stride] : 0, corner = y && x >= channels ? pixels[i - stride - channels] : 0;
      pixels[i] = (raw[y * (stride + 1) + x + 1] + [0, left, up, Math.floor((left + up) / 2), paeth(left, up, corner)][filter]) & 255;
    }
  }
  for (let i = 0; i < width * height; i++) {
    data.set(pixels.subarray(i * channels, i * channels + 3), i * 4);
    data[i * 4 + 3] = channels === 4 ? pixels[i * channels + 3] : 255;
  }
  return { width, height, data };
}

test('six supplied images: all 72 full-card bands and 36 clipped bottom cards', { skip: !directory && 'Set TWST_GROOVY_SCREENSHOT_DIR to run with the actual user screenshots' }, async () => {
  const cv = await require('@techstark/opencv-js');
  const { detectBoxes } = load('src/domain/handScreenshot/recognizer.ts', { './geometry': {} });
  const { readGroovyStatus } = load('src/domain/handScreenshot/groovyRibbon.ts');
  const combined = [], clipped = [];
  for (const [suffix, top, second] of cases) {
    const filename = `Screenshot_2026.09.15_05.54.${suffix}.png`;
    const image = pngPixels(path.join(directory, filename));
    assert.equal(image.width, 960); assert.equal(image.height, 540);
    const src = new cv.Mat(image.height, image.width, cv.CV_8UC4), scout = new cv.Mat(); src.data.set(image.data);
    try {
      const scale = Math.min(1, 1400 / image.width);
      cv.resize(src, scout, new cv.Size(Math.round(image.width * scale), Math.round(image.height * scale)), 0, 0, cv.INTER_LINEAR);
      const boxes = detectBoxes(cv, { width: scout.cols, height: scout.rows, data: scout.data })
        .map(box => ({ x: box.x / scale, y: box.y / scale, width: box.width / scale, height: box.height / scale }));
      assert.equal(boxes.length, 12, `${filename}: clipped third row must be excluded`);
      const classify = box => {
        const nativeHeight = Math.min(box.width * 1.28, image.height - box.y), height = Math.round(nativeHeight / box.width * 256);
        const sx = box.width / 256, sy = nativeHeight / height;
        const matrix = cv.matFromArray(2, 3, cv.CV_64F, [sx, 0, box.x + sx / 2 - .5, 0, sy, box.y + sy / 2 - .5]);
        const out = new cv.Mat();
        try {
          // Pixel-center-aligned fractional crop, approximating Canvas drawImage.
          // Browser/UI acceptance must additionally exercise its actual Canvas path.
          cv.warpAffine(src, out, matrix, new cv.Size(256, height), cv.INTER_LINEAR | cv.WARP_INVERSE_MAP, cv.BORDER_CONSTANT);
          const source = { width: box.width, complete: box.height >= box.width * .97 && box.x >= 0 && box.y >= 0 && box.x + box.width <= image.width && box.y + box.width * 1.28 <= image.height };
          return readGroovyStatus({ width: out.cols, height: out.rows, data: out.data }, source);
        } finally { out.delete(); matrix.delete(); }
      };
      const states = boxes.map(classify);
      for (const [index, expected] of [...top, ...second].entries()) {
        assert.equal(states[index], expected === 'P' ? 'present' : 'absent', `${filename}: row ${Math.floor(index / 6) + 1}, column ${index % 6 + 1}`);
      }
      // The COLLECT badge is horizontal and on the left, not a Groovy ribbon.
      if (suffix === '34.043') assert.equal(states[10], 'absent');
      combined.push(...states);
      for (let column = 0; column < 6; column++) {
        const box = boxes[column + 6], rowSpacing = box.y - boxes[column].y;
        clipped.push(classify({ ...box, y: box.y + rowSpacing }));
      }
    } finally { scout.delete(); src.delete(); }
  }
  assert.equal(combined.length, 72);
  assert.equal(combined.filter(status => status === 'present').length, 40);
  assert.equal(combined.filter(status => status === 'absent').length, 32);
  assert.equal(clipped.length, 36);
  assert.ok(clipped.every(status => status === 'unknown'));
});
