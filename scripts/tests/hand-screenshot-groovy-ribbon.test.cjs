const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { inflateSync } = require('node:zlib');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const moduleUnderTest = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/domain/handScreenshot/groovyRibbon.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
}).outputText, { module: moduleUnderTest, exports: moduleUnderTest.exports });
const { hasGroovyRibbon, readGroovyStatus } = moduleUnderTest.exports;

// Decode only the repository's 8-bit, noninterlaced RGB guide PNG. Using zlib
// keeps this real-image regression independent of browser/canvas dependencies.
function guidePixels() {
  const png = fs.readFileSync(path.join(root, 'src/assets/guides/card-level-list.png'));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [];
  let width, height;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset), type = png.toString('ascii', offset + 4, offset + 8);
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      assert.deepEqual([...body.subarray(8)], [8, 2, 0, 0, 0]);
    }
    if (type === 'IDAT') chunks.push(body);
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), stride = width * 3;
  assert.equal(raw.length, (stride + 1) * height);
  const rgb = Buffer.alloc(stride * height), data = new Uint8ClampedArray(width * height * 4);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, left = x >= 3 ? rgb[i - 3] : 0;
      const up = y ? rgb[i - stride] : 0, corner = y && x >= 3 ? rgb[i - stride - 3] : 0;
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, corner)][filter];
      rgb[i] = (raw[y * (stride + 1) + x + 1] + predictor) & 255;
    }
  }
  for (let i = 0; i < width * height; i++) {
    data.set(rgb.subarray(i * 3, i * 3 + 3), i * 4); data[i * 4 + 3] = 255;
  }
  return { width, height, data };
}

function crop(image, left, top, size, output = size, height = output) {
  const data = new Uint8ClampedArray(output * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < output; x++) {
    const sx = left + Math.min(size - 1, Math.floor(x * size / output));
    const sy = top + Math.floor(y * size / output), source = (sy * image.width + sx) * 4;
    data.set(image.data.subarray(source, source + 4), (y * output + x) * 4);
  }
  return { width: output, height, data };
}

test('real guide: all 5 visible Groovy ribbons and 7 complete cards without a ribbon', () => {
  const guide = guidePixels(), xs = [173, 399, 625, 851, 1078, 1305], ys = [270, 521];
  // Verified visually against the checked-in screenshot: one ribbon on the
  // first complete row, four on the second. The partial third row is excluded.
  const expected = [[false, false, true, false, false, false], [true, false, true, true, true, false]];
  for (const size of [178, 256]) for (let row = 0; row < 2; row++) for (let column = 0; column < 6; column++) {
    const card = crop(guide, xs[column], ys[row], 178, size, Math.round(size * 1.28));
    assert.equal(hasGroovyRibbon(card), expected[row][column], `row ${row + 1}, card ${column + 1}, size ${size}`);
    assert.equal(readGroovyStatus(card, { width: 178, complete: true }), expected[row][column] ? 'present' : 'absent', `status row ${row + 1}, card ${column + 1}, size ${size}`);
  }
});

function synthetic({ star = true, satellites = true, diagonal = true, solid = false } = {}) {
  const width = 256, height = 328, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const nx = x / width, ny = y / width, dx = Math.abs(nx - .887), dy = Math.abs(ny - .917);
    let color = [25, 30, 35, 255];
    const band = diagonal ? nx + ny > 1.724 && nx + ny < 1.884 : ny > .84 && ny < .97;
    if (nx > .68 && ny > .68 && ny < 1 && (band || solid)) color = [207, 35, 211, 255];
    const sparkle = dx / .031 + dy / .012 < 1 || dx / .012 + dy / .031 < 1;
    if (star && sparkle) color = [255, 255, 255, 255];
    if (satellites && [[.829, .975], [.941, .863]].some(([sx, sy]) => Math.hypot(nx - sx, ny - sy) < .008)) color = [239, 219, 230, 255];
    data.set(color, (y * width + x) * 4);
  }
  return { width, height, data };
}

test('requires the diagonal ribbon and complete white-star motif, not magenta alone', () => {
  assert.equal(hasGroovyRibbon(synthetic()), true);
  for (const options of [{ star: false }, { satellites: false }, { diagonal: false }, { solid: true }]) {
    assert.equal(hasGroovyRibbon(synthetic(options)), false, JSON.stringify(options));
  }
  const square = synthetic({ star: false });
  for (let y = 228; y < 241; y++) for (let x = 221; x < 234; x++) square.data.set([255, 255, 255, 255], (y * square.width + x) * 4);
  assert.equal(hasGroovyRibbon(square), false, 'a white rectangle is not the large star');
});

test('truncated, undersized and invalid pixels provide no positive ribbon evidence', () => {
  const full = synthetic();
  assert.equal(hasGroovyRibbon({ ...full, height: 240, data: full.data.slice(0, 256 * 240 * 4) }), false);
  assert.equal(hasGroovyRibbon({ ...full, data: full.data.slice(0, 100) }), false);
  assert.equal(hasGroovyRibbon({ width: 128, height: 128, data: new Uint8ClampedArray(128 * 128 * 4) }), false);
  assert.equal(hasGroovyRibbon({ width: 0, height: 0, data: new Uint8ClampedArray() }), false);
});

test('real OpenCV auto-detected boxes retain all five present and seven absent statuses', async () => {
  const cv = await require('@techstark/opencv-js');
  const recognition = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/domain/handScreenshot/recognizer.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText, { module: recognition, exports: recognition.exports, require: id => {
    assert.equal(id, './geometry'); return {};
  } });
  const guide = guidePixels(), src = new cv.Mat(guide.height, guide.width, cv.CV_8UC4), scout = new cv.Mat();
  src.data.set(guide.data);
  try {
    const scale = 1400 / guide.width;
    cv.resize(src, scout, new cv.Size(1400, Math.round(guide.height * scale)), 0, 0, cv.INTER_LINEAR);
    const boxes = recognition.exports.detectBoxes(cv, { width: scout.cols, height: scout.rows, data: scout.data })
      .map(box => ({ x: box.x / scale, y: box.y / scale, width: box.width / scale }));
    assert.equal(boxes.length, 12, 'the partial third row must not be treated as complete');
    const expected = ['absent', 'absent', 'present', 'absent', 'absent', 'absent', 'present', 'absent', 'present', 'present', 'present', 'absent'];
    for (const [index, box] of boxes.entries()) {
      const roi = src.roi(new cv.Rect(Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.width * 1.28)));
      const out = new cv.Mat();
      try {
        cv.resize(roi, out, new cv.Size(256, Math.round(roi.rows / roi.cols * 256)), 0, 0, cv.INTER_LINEAR);
        assert.equal(readGroovyStatus({ width: out.cols, height: out.rows, data: out.data }, { width: box.width, complete: true }), expected[index], `auto box ${index + 1}`);
      } finally { out.delete(); roi.delete(); }
      // Canvas drawImage preserves fractional source bounds and maps pixel
      // centres. Approximate that mapping with OpenCV too; browser interpolation may differ.
      const height = Math.round(256 * 1.28), sx = box.width / 256, sy = box.width * 1.28 / height;
      const transform = cv.matFromArray(2, 3, cv.CV_64F, [sx, 0, box.x + sx / 2 - .5, 0, sy, box.y + sy / 2 - .5]);
      const fractional = new cv.Mat();
      try {
        cv.warpAffine(src, fractional, transform, new cv.Size(256, height), cv.INTER_LINEAR | cv.WARP_INVERSE_MAP, cv.BORDER_CONSTANT);
        assert.equal(readGroovyStatus({ width: fractional.cols, height: fractional.rows, data: fractional.data }, { width: box.width, complete: true }), expected[index], `fractional bilinear approximation box ${index + 1}`);
      } finally { fractional.delete(); transform.delete(); }
    }
  } finally { scout.delete(); src.delete(); }
});

function paint(image, left, top, right, bottom, color) {
  const copy = { ...image, data: image.data.slice() };
  for (let y = Math.floor(top * image.width); y < Math.ceil(bottom * image.width); y++) {
    for (let x = Math.floor(left * image.width); x < Math.ceil(right * image.width); x++) {
      copy.data.set(color, (y * image.width + x) * 4);
    }
  }
  return copy;
}

test('low native resolution, missing provenance, clipping, patches and ambiguous ribbons stay unknown', async () => {
  const guide = guidePixels(), source = { width: 178, complete: true };
  const positive = crop(guide, 625, 270, 178, 256, 328), negative = crop(guide, 399, 270, 178, 256, 328);
  for (const original of [positive, negative]) {
    assert.equal(readGroovyStatus(original), 'unknown');
    assert.equal(readGroovyStatus(original, { width: 64, complete: true }), 'unknown', 'upsampling does not restore native detail');
    assert.equal(readGroovyStatus(original, { width: 178, complete: false }), 'unknown');
    assert.equal(readGroovyStatus({ ...original, height: 250, data: original.data.slice(0, 256 * 250 * 4) }, source), 'unknown');
    const transparent = { ...original, data: original.data.slice() };
    for (let i = 3; i < transparent.data.length; i += 4) transparent.data[i] = 0;
    assert.equal(readGroovyStatus(transparent, source), 'unknown', 'invisible RGB must not count as a visible ribbon');
    for (const color of [[0, 0, 0, 255], [128, 128, 128, 255], [30, 40, 50, 0]]) {
      assert.equal(readGroovyStatus(paint(original, .69, .69, 1, 1.08, color), source), 'unknown', `covered corner ${color}`);
      assert.equal(readGroovyStatus(paint(original, .79, .82, .94, .97, color), source), 'unknown', `covered central marker ${color}`);
    }
  }
  const noStar = paint(positive, .85, .88, .925, .96, [207, 35, 211, 255]);
  assert.equal(readGroovyStatus(noStar, source), 'unknown', 'purple without a readable star is not absent');
  const partial = crop(guide, 173, 772, 178, 256, 328);
  assert.equal(readGroovyStatus(partial, source), 'unknown', 'viewport clipping can occur inside screenshot bounds');
  const cv = await require('@techstark/opencv-js');
  for (const original of [positive, negative]) {
    const src = new cv.Mat(original.height, original.width, cv.CV_8UC4), blurred = new cv.Mat(); src.data.set(original.data);
    try {
      cv.GaussianBlur(src, blurred, new cv.Size(15, 15), 4, 4, cv.BORDER_DEFAULT);
      assert.equal(readGroovyStatus({ width: blurred.cols, height: blurred.rows, data: blurred.data }, source), 'unknown', 'blurred marker/frame must not become absent');
    } finally { blurred.delete(); src.delete(); }
  }
});

test('960px screenshots retain readable ~103px cards; genuine smaller cards remain unknown', async () => {
  const cv = await require('@techstark/opencv-js');
  const recognition = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src/domain/handScreenshot/recognizer.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText, { module: recognition, exports: recognition.exports, require: () => ({}) });
  const guide = guidePixels(), original = new cv.Mat(guide.height, guide.width, cv.CV_8UC4);
  original.data.set(guide.data);
  const expected = ['absent', 'absent', 'present', 'absent', 'absent', 'absent', 'present', 'absent', 'present', 'present', 'present', 'absent'];
  try {
    for (const width of [960, 800]) {
      const resized = new cv.Mat();
      try {
        cv.resize(original, resized, new cv.Size(width, Math.round(guide.height * width / guide.width)), 0, 0, cv.INTER_AREA);
        const boxes = recognition.exports.detectBoxes(cv, { width: resized.cols, height: resized.rows, data: resized.data });
        assert.equal(boxes.length, 12);
        for (const [index, box] of boxes.entries()) {
          const height = Math.round(256 * 1.28), sx = box.width / 256, sy = box.width * 1.28 / height;
          const matrix = cv.matFromArray(2, 3, cv.CV_64F, [sx, 0, box.x + sx / 2 - .5, 0, sy, box.y + sy / 2 - .5]);
          const out = new cv.Mat();
          try {
            cv.warpAffine(resized, out, matrix, new cv.Size(256, height), cv.INTER_LINEAR | cv.WARP_INVERSE_MAP, cv.BORDER_CONSTANT);
            const source = { width: box.width, complete: box.height >= box.width * .97 && box.x + box.width <= resized.cols && box.y + box.width * 1.28 <= resized.rows };
            assert.equal(readGroovyStatus({ width: out.cols, height: out.rows, data: out.data }, source), width === 960 ? expected[index] : 'unknown', `width ${width}, card ${index + 1}, native ${box.width}`);
          } finally { out.delete(); matrix.delete(); }
        }
      } finally { resized.delete(); }
    }
  } finally { original.delete(); }
});

test('faded or desaturated real ribbons never become absent', () => {
  const guide = guidePixels(), source = { width: 178, complete: true };
  const positive = crop(guide, 625, 270, 178, 256, 328);
  for (const factor of [.2, .4, .6, .8]) for (const mode of ['white', 'gray', 'dark']) {
    const copy = { ...positive, data: positive.data.slice() };
    for (let i = 0; i < copy.data.length; i += 4) {
      const gray = (positive.data[i] + positive.data[i + 1] + positive.data[i + 2]) / 3;
      for (let c = 0; c < 3; c++) copy.data[i + c] = positive.data[i + c] * (1 - factor) + (mode === 'white' ? 255 : mode === 'gray' ? gray : 0) * factor;
    }
    assert.notEqual(readGroovyStatus(copy, source), 'absent', `${mode} ${factor}`);
  }
});
// Reproduce the measured [255,138,255] antialiasing of compressed two-pixel
// satellites, while preserving central star and independent diagonal evidence.
test('compressed pink-tinted satellites retain both marks; a missing mark cannot prove Groovy', () => {
  const tintSatellites = (color, omitted = -1) => {
    const image = synthetic();
    const marks = [[.829, .975], [.941, .863]];
    for (let y = 0; y < image.width; y++) for (let x = 0; x < image.width; x++) {
      const index = marks.findIndex(([sx, sy]) => Math.hypot(x / image.width - sx, y / image.width - sy) < .008);
      if (index >= 0) image.data.set(index === omitted ? [207, 35, 211, 255] : [...color, 255], (y * image.width + x) * 4);
    }
    return image;
  };
  assert.equal(hasGroovyRibbon(tintSatellites([255, 138, 255])), true);
  for (const omitted of [0, 1]) {
    assert.equal(hasGroovyRibbon(tintSatellites([255, 138, 255], omitted)), false,
      'each independently visible satellite is required, even beside a bright central star');
  }
  assert.equal(hasGroovyRibbon(tintSatellites([255, 128, 255])), false,
    'pink regions without enough white-core evidence stay uncertain');
});

test('native-pixel rounding of a small star preserves its full ribbon evidence', () => {
  const image = synthetic();
  // A compressed central star's bright core is eight by six normalized pixels.
  // Its dim antialiased arms still exist, but do not pass the white-core test.
  for (let y = 222; y < 247; y++) for (let x = 216; x < 239; x++) {
    const i = (y * image.width + x) * 4;
    if (image.data[i + 1] > 190) image.data.set([185, 185, 185, 255], i);
  }
  const core = ['...##...', '..####..', '########', '########', '..####..', '...##...'];
  for (const [y, line] of core.entries()) for (const [x, pixel] of [...line].entries()) {
    if (pixel === '#') image.data.set([255, 255, 255, 255], ((232 + y) * image.width + 223 + x) * 4);
  }
  assert.equal(hasGroovyRibbon(image), false, 'no native resolution means no rounding allowance');
  assert.equal(hasGroovyRibbon(image, 115), true, 'half of a native pixel accounts for the compressed boundary');
  assert.equal(hasGroovyRibbon(image, 256), false, 'a full-resolution tiny mark does not get the allowance');
  for (const invalid of [0, 40, NaN, Infinity]) assert.equal(hasGroovyRibbon(image, invalid), false);
  const square = { ...image, data: new Uint8ClampedArray(image.data) };
  for (let y = 232; y < 238; y++) for (let x = 223; x < 231; x++) {
    square.data.set([255, 255, 255, 255], (y * square.width + x) * 4);
  }
  assert.equal(hasGroovyRibbon(square, 115), false, 'a compact white rectangle still fails the shape test');
});

test('dim high-contrast continuous gold frame is readable; purple crossings and dim blur are not', async () => {
  const width = 256, height = 328, source = { width: 178, complete: true };
  const frame = (color) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const noise = (x + y) % 9;
      data.set([25 + noise, 30 + noise, 35 + noise, 255], (y * width + x) * 4);
      if ((y === 256 && x >= 35) || (x === 246 && y >= 50 && y <= 256)) data.set([...color, 255], (y * width + x) * 4);
    }
    return { width, height, data };
  };
  const gold = frame([155, 145, 125]);
  assert.equal(readGroovyStatus(gold, source), 'absent');
  assert.equal(readGroovyStatus(frame([160, 125, 160]), source), 'unknown', 'purple crossing rejects absence even with identical frame control colours');
  const cv = await require('@techstark/opencv-js');
  const original = new cv.Mat(height, width, cv.CV_8UC4), blurred = new cv.Mat(); original.data.set(gold.data);
  try {
    cv.GaussianBlur(original, blurred, new cv.Size(15, 15), 4, 4, cv.BORDER_DEFAULT);
    assert.equal(readGroovyStatus({ ...gold, data: blurred.data }, source), 'unknown');
  } finally { original.delete(); blurred.delete(); }
});

test('flat artwork with a sharp bronze border stays absent; bounded central covers stay unknown', async () => {
  const width = 256, height = 328, source = { width: 104, complete: true };
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    data.set([25, 30, 35, 255], (y * width + x) * 4);
    if ((y === 256 && x >= 35) || (x === 246 && y >= 50 && y <= 256)) {
      data.set([79, 57, 31, 255], (y * width + x) * 4);
    }
  }
  const frame = { width, height, data };
  assert.equal(readGroovyStatus(frame, source), 'absent', 'uniform natural artwork is not a mask');
  for (const color of [[0, 0, 0, 255], [128, 128, 128, 255]]) {
    assert.equal(readGroovyStatus(paint(frame, .79, .82, .94, .97, color), source), 'unknown');
  }
  const antialiasedCover = paint(frame, .79, .82, .94, .97, [128, 128, 128, 255]);
  // Fractional Canvas bounds leave tinted edge pixels around a nearly solid
  // rectangle. Four small tinted corners keep roughly 96% connected coverage.
  for (const [left, top] of [[203, 210], [237, 210], [203, 245], [237, 245]]) {
    for (let y = top; y < top + 4; y++) for (let x = left; x < left + 4; x++) {
      antialiasedCover.data.set([120, 120, 120, 255], (y * width + x) * 4);
    }
  }
  assert.equal(readGroovyStatus(antialiasedCover, source), 'unknown', 'tinted rectangle edges do not restore visible marker evidence');
  const cv = await require('@techstark/opencv-js');
  const original = new cv.Mat(height, width, cv.CV_8UC4), blurred = new cv.Mat(); original.data.set(data);
  try {
    cv.GaussianBlur(original, blurred, new cv.Size(15, 15), 4, 4, cv.BORDER_DEFAULT);
    assert.equal(readGroovyStatus({ ...frame, data: blurred.data }, source), 'unknown');
  } finally { original.delete(); blurred.delete(); }
});

test('a stronger diagonal ribbon remains readable against purple surroundings only with both boundaries and all stars', () => {
  const purpleBackground = (options = {}, oneSideOnly = false) => {
    const image = synthetic(options);
    for (let y = Math.floor(image.width * .68); y < image.width; y++) {
      for (let x = Math.floor(image.width * .68); x < image.width; x++) {
        const distance = (x + y) / image.width - 1.8;
        if (Math.abs(distance) <= .08) continue;
        image.data.set(oneSideOnly && distance > 0 ? [207, 35, 211, 255] : [215, 100, 220, 255], (y * image.width + x) * 4);
      }
    }
    return image;
  };
  assert.equal(hasGroovyRibbon(purpleBackground()), true, 'purple on both sides does not erase a separate stronger band');
  assert.equal(hasGroovyRibbon(purpleBackground({}, true)), false, 'a colour boundary on only one side is insufficient');
  for (const options of [{ star: false }, { satellites: false }, { diagonal: false }]) {
    assert.equal(hasGroovyRibbon(purpleBackground(options)), false, JSON.stringify(options));
  }
  assert.equal(hasGroovyRibbon(synthetic({ solid: true })), false, 'uniform purple with a star motif is not a diagonal band');
});
