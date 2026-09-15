const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { PNG } = require('pngjs');
const { load, root } = require('./test-helpers.cjs');
const { Recognizer, detectBoxes } = load('src/domain/handScreenshot/recognizer.ts');
const directory = path.join(root, 'public/recognition');
const available = fs.existsSync(path.join(directory, 'latest.json'));

test('Wiki dictionary matches real normal and Groovy list icons across resolutions', { skip: !available && !process.env.RECOGNITION_REQUIRED }, async () => {
  assert.ok(available, 'Build the dictionary first');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'latest.json')));
  const index = JSON.parse(fs.readFileSync(path.join(directory, manifest.index.path)));
  const binary = Buffer.concat(manifest.features.parts.map(part => fs.readFileSync(path.join(directory, part.path))));
  const { validateIndex } = load('src/domain/handScreenshot/types.ts');
  validateIndex(index, binary.length);
  const crypto = require('node:crypto');
  for (const part of [manifest.index, ...manifest.features.parts]) {
    const bytes = fs.readFileSync(path.join(directory, part.path));
    assert.equal(bytes.length, part.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), part.sha256);
  }
  const cv = await require('@techstark/opencv-js');
  const engine = new Recognizer(cv, index, binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
  for (const [fixture, expected] of [['jamil_nightmare_normal', 'jamil_Nightmare_Suit'], ['riddle_dormitory_groovy_jp', 'riddle_dormitory'], ['leona_dormitory_groovy_jp', 'leona_dormitory']]) {
    const png = PNG.sync.read(fs.readFileSync(path.join(__dirname, 'fixtures', fixture + '.png')));
    const source = cv.matFromImageData(png), small = new cv.Mat(), query = new cv.Mat();
    try {
      for (const size of [48, 64, 96, 160]) {
        cv.resize(source, small, new cv.Size(size, size), 0, 0, cv.INTER_AREA);
        cv.resize(small, query, new cv.Size(128, 128), 0, 0, cv.INTER_LINEAR);
        const result = engine.match({ width: 128, height: 128, data: query.data });
        console.log(fixture, size, JSON.stringify(result));
        assert.equal(result.candidates[0]?.cardKey, expected, `${fixture}, ${size}px`);
        // Very small crops may require confirmation; they must never select a wrong identity.
        // A partial-art crop can remain uncertain even at high resolution; the candidate must stay correct.
      }
    } finally { source.delete(); small.delete(); query.delete(); }
  }
  const blank = new Uint8Array(128 * 128 * 4).fill(180);
  assert.equal(engine.match({ width: 128, height: 128, data: blank }).confident, false);
});

test('grid extraction tolerates scale, column count and level strips', async () => {
  const cv = await require('@techstark/opencv-js');
  for (const [size, columns] of [[48, 5], [96, 3], [160, 6]]) {
    const width = columns * (size + 20) + 30, height = (size + 45) * 2 + 30;
    const png = new PNG({ width, height }); png.data.fill(255);
    for (let row = 0; row < 2; row++) for (let col = 0; col < columns; col++) {
      const x = 15 + col * (size + 20), y = 15 + row * (size + 45);
      for (let py = y; py < y + size + 15; py++) for (let px = x; px < x + size; px++) {
        const offset = (py * width + px) * 4;
        const value = px < x + 2 || px >= x + size - 2 || py < y + 2 || py >= y + size ? 30 : 170;
        png.data[offset] = png.data[offset + 1] = png.data[offset + 2] = value;
      }
    }
    const boxes = detectBoxes(cv, png);
    assert.equal(boxes.length, columns * 2, `${size}px / ${columns} columns`);
    assert.ok(boxes.every(box => Math.abs(box.width - size) <= 3));
  }
});
