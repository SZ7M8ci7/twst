#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const JSON_PATH = path.join(ROOT, 'src', 'assets', 'chara.json');

const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const missing = data.filter(x => !('releaseDate' in x) || !x.releaseDate);

console.log(`missing releaseDate count=${missing.length}`);
for (const item of missing) {
  console.log(`${item.chara}\t${item.costume}\t${item.rare}\tname=${item.name}\tid=${item.id}`);
}
