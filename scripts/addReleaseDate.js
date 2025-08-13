#!/usr/bin/env node
/*
  Adds releaseDate to src/assets/chara.json from 実装日.txt (TSV).
  - Matching keys: chara (キャラ名), costume (衣装), rare (レア)
  - Date format: keep source format (YYYY/MM/DD)
  - Unmatched entries are skipped and reported
  - Creates a backup: src/assets/chara.backup.json
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TXT_PATH = path.join(ROOT, '実装日.txt');
const JSON_PATH = path.join(ROOT, 'src', 'assets', 'chara.json');
const BACKUP_PATH = path.join(ROOT, 'src', 'assets', 'chara.backup.json');

function readTextTSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines.shift();
  if (!header) throw new Error('TSV header missing');
  const cols = header.split('\t');
  const colIndex = {
    name: cols.indexOf('キャラ名'),
    costume: cols.indexOf('衣装'),
    rare: cols.indexOf('レア'),
    date: cols.indexOf('実装日'),
  };
  for (const [k, v] of Object.entries(colIndex)) {
    if (v === -1) throw new Error(`Column not found: ${k}`);
  }

  const records = [];
  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length < cols.length) continue; // skip invalid lines
    const rec = {
      name: parts[colIndex.name].trim(),
      costume: parts[colIndex.costume].trim(),
      rare: parts[colIndex.rare].trim(),
      date: parts[colIndex.date].trim(),
    };
    records.push(rec);
  }
  return records;
}

function normalizeKey(v) {
  if (v == null) return '';
  // Normalize full-width/half-width spaces and generic trimming
  let s = String(v)
    .replace(/\u00A0/g, ' ') // nbsp
    .replace(/[\u3000]/g, ' ') // full-width space
    .trim();
  return s;
}

function makeKey(name, costume, rare) {
  return `${normalizeKey(name)}\u0001${normalizeKey(costume)}\u0001${normalizeKey(rare)}`;
}

// Remove any parenthetical variant from costume names
// e.g., "スターゲイズ・ギア(星送りの衣)" -> "スターゲイズ・ギア"
function stripParenSegments(value) {
  if (!value) return '';
  return String(value)
    .replace(/\s*[\(（][^()（）]*[\)）]\s*/g, '')
    .trim();
}

function main() {
  // Read TSV
  if (!fs.existsSync(TXT_PATH)) {
    console.error(`Not found: ${TXT_PATH}`);
    process.exit(1);
  }
  const tsvRecords = readTextTSV(TXT_PATH);

  // Build map
  const dateMap = new Map();
  for (const r of tsvRecords) {
    // Keep source date format as-is
    const key = makeKey(r.name, r.costume, r.rare);
    dateMap.set(key, r.date);
    // Also index by costume without any parenthetical variant
    const stripped = stripParenSegments(r.costume);
    if (stripped !== r.costume) {
      const keyStripped = makeKey(r.name, stripped, r.rare);
      if (!dateMap.has(keyStripped)) {
        dateMap.set(keyStripped, r.date);
      }
    }
  }

  // Read JSON
  if (!fs.existsSync(JSON_PATH)) {
    console.error(`Not found: ${JSON_PATH}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const data = JSON.parse(raw);

  // Backup
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(data, null, 2));

  // Apply releaseDate
  let matched = 0;
  let unmatched = 0;
  for (const item of data) {
    const key = makeKey(item.chara, item.costume, item.rare);
    let date = dateMap.get(key);
    // Fallback: try stripped costume on the JSON side as well
    if (!date) {
      const strippedCostume = stripParenSegments(item.costume);
      const strippedKey = makeKey(item.chara, strippedCostume, item.rare);
      date = dateMap.get(strippedKey);
    }
    if (date) {
      item.releaseDate = date; // keep original format
      matched++;
    } else {
      unmatched++;
    }
  }

  // Save
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2));

  // Report
  console.log(`Done. matched=${matched}, unmatched=${unmatched}, total=${data.length}`);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
