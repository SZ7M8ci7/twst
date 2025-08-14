#!/usr/bin/env node
/*
Generate time-series top-10 finisher-vs-fire ranking data and composite icons.
- Timeline: daily from oldest releaseDate to newest in src/assets/chara.json
- Source: finisherDamage logic approximation (SSR only, magic2 as finisher)
- Pair: (finisher card, its duo partner providing buffs)
- Output:
  - generated/finisher_race_fire/data.csv (wide format for Flourish racing bar chart)
  - generated/finisher_race_fire/img/{finisherName}__{duoName}.webp (composited 2 icons)
Notes:
- Hand collection OFF (max stats).
- Buffs from duo partner include ATKUP and Damage buffs per finisherDamage.vue mappings.
- We include also a no-buff baseline entry per finisher.
*/

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const CHAR_JSON = path.join(ROOT, 'src', 'assets', 'chara.json');
const CHAR_INFO_JSON = path.join(ROOT, 'src', 'assets', 'characters_info.json');
const OUT_DIR = path.join(ROOT, 'generated', 'finisher_race_fire');
const IMG_DIR = path.join(OUT_DIR, 'img');
const CSV_PATH = path.join(OUT_DIR, 'data.csv');
const ICON_BASE_URL = 'https://raw.githubusercontent.com/SZ7M8ci7/twst/flourish/generated/finisher_race_fire/img/';

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function parseDateStr(s) {
  // Expect YYYY/MM/DD
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`; // Flourish-friendly
}

// Damage params from finisherDamage.vue
const atkBuddyRates = { small: 0.2, medium: 0.35 };
const atkBuffDict = { 'ATKUP(極小)': 0.1, 'ATKUP(小)': 0.2, 'ATKUP(中)': 0.35, 'ATKUP(大)': 0.5, 'ATKUP(極大)': 0.8 };
function calcSelfAtkUp(etc) {
  if (etc.includes('ATKUP(極小)(自/3T)')) return 0.1;
  if (etc.includes('ATKUP(小)(自/3T)')) return 0.2;
  if (etc.includes('ATKUP(中)(自/3T)')) return 0.35;
  if (etc.includes('ATKUP(大)(自/3T)')) return 0.5;
  return 0;
}
function calcSelfDamageUp(etc) {
  if (etc.includes('ダメージUP(極小)(自/3T)')) return 0.02;
  if (etc.includes('ダメージUP(小)(自/3T)')) return 0.05;
  if (etc.includes('ダメージUP(中)(自/3T)')) return 0.0875;
  if (etc.includes('ダメージUP(大)(自/3T)')) return 0.125;
  if (etc.includes('被ダメージUP(中)(相手全体/2T)')) return 0.0875; // fellow special-case
  return 0;
}
const attributeModifiers = {
  '無': { fire: 1, water: 1, flora: 1, cosmic: 1 },
  '火': { fire: 1, water: 0.5, flora: 1.5, cosmic: 1 },
  '水': { fire: 1.5, water: 1, flora: 0.5, cosmic: 1 },
  '木': { fire: 0.5, water: 1.5, flora: 1, cosmic: 1 },
};

function buildEffectDict(characters) {
  const dict = {}; // key: chara (ja), val: list of {buff, name, buffSource}
  const buffValues = ['(極小)', '(小)', '(中)', '(大)', '(極大)'];
  const buffTypes = ['ATKUP', 'ダメージUP', '無属性ダメージUP', '火属性ダメージUP', '水属性ダメージUP', '木属性ダメージUP', '被ダメージUP'];
  for (const ch of characters) {
    const etcItems = (ch.etc || '').split('<br>');
    if (!dict[ch.chara]) dict[ch.chara] = [];
    for (const item of etcItems) {
      const trimmed = item.trim();
      if (!trimmed.includes('味方') && !(trimmed.includes('被ダメージUP') && trimmed.includes('相手'))) continue;
      for (const t of buffTypes) {
        if (trimmed.startsWith(t)) {
          for (const v of buffValues) {
            if (trimmed.includes(v)) {
              let src = '';
              if (trimmed.includes('(M1)')) src = 'M1';
              else if (trimmed.includes('(M2)')) src = 'M2';
              else if (trimmed.includes('(M3)')) src = 'M3';
              // Only include M3 for SSR providers (hand OFF, assume allowed)
              if (src === 'M3' && (ch.rare === 'R' || ch.rare === 'SR')) continue;
              dict[ch.chara].push({ buff: t + v, name: ch.name, buffSource: src });
            }
          }
        }
      }
    }
  }
  return dict;
}

function isOnOrBefore(dateObj, y, m, d) {
  const cmp = new Date(y, m - 1, d).getTime();
  return dateObj.getTime() <= cmp;
}

function calculateStatFromLevel(maxStat, baseStat, rare, level, isLimitBreak) {
  const levelDict = { 'R': 70, 'SR': 90, 'SSR': 110 };
  const maxLevel = levelDict[rare] || 110;
  const calculatedBaseStat = baseStat || Math.floor(maxStat / (rare === 'SSR' ? 4.7 : rare === 'SR' ? 4.3 : 4.2));
  const bonusStat = calculatedBaseStat * 0.2;
  const statPerLv = maxLevel > 1 ? (maxStat - 2 * bonusStat - calculatedBaseStat) / (maxLevel - 1) : 0;
  const levelDiff = maxLevel - level;
  const totsurate = isLimitBreak ? 0 : 1;
  const calculatedStat = (maxStat - statPerLv * levelDiff) - bonusStat * totsurate;
  return Math.max(0, Number(calculatedStat.toFixed(1)));
}

function computeFinisherATKAtDate(ch, dateObj) {
  // Determine level and limit-break availability by date
  let level = 110;
  let isLimitBreak = true;
  if (isOnOrBefore(dateObj, 2022, 5, 29)) {
    level = 100;
    isLimitBreak = false;
  } else if (isOnOrBefore(dateObj, 2023, 3, 9)) {
    level = 110;
    isLimitBreak = false;
  } else {
    level = 110;
    isLimitBreak = true;
  }

  const maxATK = Number(ch.originalMaxATK) || Number(ch.max_atk) || Number(ch.atk) || 0;
  const baseATK = Number(ch.base_atk) || 0;
  return calculateStatFromLevel(maxATK, baseATK, ch.rare || 'SSR', level, isLimitBreak);
}

function calcFinisherVsFireDamage(ch, partnerBuff, dateObj) {
  // hand OFF: use max ATK-like
  const baseATK = computeFinisherATKAtDate(ch, dateObj);
  const buddyBonus = ((ch.buddy1s||'').includes('ATK') ? ((ch.buddy1s.includes('中'))? atkBuddyRates.medium : atkBuddyRates.small) : 0)
                   + ((ch.buddy2s||'').includes('ATK') ? ((ch.buddy2s.includes('中'))? atkBuddyRates.medium : atkBuddyRates.small) : 0)
                   + ((ch.buddy3s||'').includes('ATK') ? ((ch.buddy3s.includes('中'))? atkBuddyRates.medium : atkBuddyRates.small) : 0);
  const selfAtkBuff = calcSelfAtkUp(ch.etc || '');
  const selfDamageBuff = calcSelfDamageUp(ch.etc || '');
  const atr = ch.magic2atr; // finisher attribute
  const atkPartnerBuff = atkBuffDict[partnerBuff] || 0;
  let partnerDamageBuff = 0;
  if (partnerBuff.includes(atr + '属性ダメージUP')) {
    if (partnerBuff.includes('(極小)')) partnerDamageBuff = 0.025; // small tweak vs vue (kept similar)
    if (partnerBuff.includes('(小)')) partnerDamageBuff = 0.06;
    if (partnerBuff.includes('(中)')) partnerDamageBuff = 0.105;
    if (partnerBuff.includes('(大)')) partnerDamageBuff = 0.15;
    if (partnerBuff.includes('(極大)')) partnerDamageBuff = 0.27;
  } else if (partnerBuff.includes('ダメージUP') && !partnerBuff.includes('属性ダメージUP')) {
    if (partnerBuff.includes('(極小)')) partnerDamageBuff = 0.0225;
    if (partnerBuff.includes('(小)')) partnerDamageBuff = 0.05;
    if (partnerBuff.includes('(中)')) partnerDamageBuff = 0.0875;
    if (partnerBuff.includes('(大)')) partnerDamageBuff = 0.125;
    if (partnerBuff.includes('(極大)')) partnerDamageBuff = 0.225;
  }
  if (partnerBuff && atkPartnerBuff === 0 && partnerDamageBuff === 0) return null;
  const cosmicRatio = atr === '無' ? 1.1 : 1;
  const atk = baseATK + baseATK * buddyBonus + baseATK * selfAtkBuff + baseATK * atkPartnerBuff;
  const baseDamage = Math.floor(atk * (cosmicRatio + selfDamageBuff + partnerDamageBuff) * 2.4);
  const mod = attributeModifiers[atr] || { fire: 1, water: 1, flora: 1, cosmic: 1 };
  const vsFire = baseDamage * mod.fire;
  return vsFire;
}

// Helpers to resolve image paths
function resolveFromCardName(name) {
  if (!name) return null;
  const tryIcon = path.join(ROOT, 'src', 'assets', 'img', 'icon', `${name}.webp`);
  if (fs.existsSync(tryIcon)) return tryIcon;
  const tryMain = path.join(ROOT, 'src', 'assets', 'img', `${name}.webp`);
  if (fs.existsSync(tryMain)) return tryMain;
  return null;
}
function resolveFromUrlLike(p) {
  if (!p) return null;
  const m = /([^\/]+)\.webp(?:\?.*)?$/.exec(String(p));
  if (!m) return null;
  const base = m[1];
  const try1 = path.join(ROOT, 'src', 'assets', 'img', 'icon', base + '.webp');
  if (fs.existsSync(try1)) return try1;
  const try2 = path.join(ROOT, 'src', 'assets', 'img', base + '.webp');
  if (fs.existsSync(try2)) return try2;
  return null;
}
function resolveFromInfoMap(key, infoMap) {
  const info = infoMap.get(key);
  if (!info) return null;
  return resolveFromUrlLike(info.iconSrc) || resolveFromUrlLike(info.imgSrc);
}
function resolveCharIconFromInfoMap(key, infoMap) {
  const info = infoMap.get(key);
  if (!info) return null;
  return resolveFromUrlLike(info.iconSrc);
}

async function composeIcon(finisherKey, duoKey, infoMap, mode = 'card-card') {
  // mode: 'card-card' | 'card-char'
  let finisherLocal = null;
  let duoLocal = null;

  if (mode === 'card-card') {
    finisherLocal = resolveFromCardName(finisherKey) || resolveFromInfoMap(finisherKey, infoMap);
    duoLocal = resolveFromCardName(duoKey) || resolveFromInfoMap(duoKey, infoMap);
  } else {
    // card-char baseline: left card image, right character icon only
    finisherLocal = resolveFromCardName(finisherKey) || resolveFromInfoMap(finisherKey, infoMap);
    duoLocal = resolveCharIconFromInfoMap(duoKey, infoMap) || resolveFromInfoMap(duoKey, infoMap);
  }
  if (!finisherLocal || !duoLocal) return null;

  const size = 128;
  const gap = 8;
  const width = size * 2 + gap;
  const height = size;
  const outName = `${finisherKey}__${duoKey}`.replace(/[\s/\\]/g, '_') + '.webp';
  const outPath = path.join(IMG_DIR, outName);

  const finisherImg = await sharp(finisherLocal).resize(size, size).toBuffer();
  const duoImg = await sharp(duoLocal).resize(size, size).toBuffer();

  const composite = await sharp({ create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: finisherImg, top: 0, left: 0 },
      { input: duoImg, top: 0, left: size + gap },
    ])
    .webp({ quality: 95 })
    .toFile(outPath);

  return outName;
}

function buildCharacterInfoMap(storeChars, characterInfo) {
  // Map Japanese name -> {imgSrc/iconSrc via predictable paths}
  const map = new Map();
  // icons by English name are under src/assets/img/icon/{name_en}.webp
  const jaToEn = new Map(characterInfo.map(cd => [cd.name_ja, cd.name_en]));
  for (const ch of storeChars) {
    const en = jaToEn.get(ch.chara) || jaToEn.get(ch.name) || null;
    const iconUrl = en ? path.join('src/assets/img/icon', `${en}.webp`) : null;
    const imgUrl = ch.imgUrl ? ch.imgUrl : (ch.name ? path.join('src/assets/img', `${ch.name}.webp`) : null);
    map.set(ch.name, { iconSrc: iconUrl, imgSrc: imgUrl });
    map.set(ch.chara, { iconSrc: iconUrl, imgSrc: imgUrl });
  }
  return map;
}

function toJaCardTitle(cardObj) {
  if (!cardObj) return '';
  const chara = cardObj.chara || '';
  const costume = cardObj.costume || '';
  if (chara && costume) return `${chara}【${costume}】`;
  return chara || costume || '';
}

async function main() {
  ensureDir(OUT_DIR); ensureDir(IMG_DIR);
  const chars = readJson(CHAR_JSON);
  const info = readJson(CHAR_INFO_JSON);

  // Filter SSR only and ensure releaseDate
  const ssr = chars.filter(c => c.rare === 'SSR' && c.releaseDate);
  // Build time range
  const dates = ssr.map(c => parseDateStr(c.releaseDate)).filter(Boolean);
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  // Pre-build info map for icons
  const infoMap = buildCharacterInfoMap(chars, info);

  // Prepare rows keyed by label ("FinisherName x DuoName")
  const seriesMap = new Map(); // key -> { label, iconFile, values: Map(dateStr->value) }

  // Iterate each day
  for (let d = new Date(minDate); d <= maxDate; d.setDate(d.getDate() + 1)) {
    const dayStr = formatDate(d);

    // Available cards by date
    const availableCards = chars.filter(c => c.releaseDate && parseDateStr(c.releaseDate) <= d);
    const availableFinishers = availableCards.filter(c => c.rare === 'SSR');

    // Build effect dict for this date only from available cards
    const effectDict = buildEffectDict(availableCards);

    // Compute candidate pairs and damages vs fire
    const entries = [];
    for (const fin of availableFinishers) {
      const duoJa = fin.duo || '';
      // baseline without partner buff (always available once finisher exists)
      const dmg0 = calcFinisherVsFireDamage(fin, '', d);
      if (dmg0 != null) {
        const finJa = toJaCardTitle(fin);
        const label = `${finJa} × ${duoJa}`;
        entries.push({ key: `${fin.name}__${duoJa}`, label, finisher: fin, duo: duoJa, damage: dmg0, baseline: true });
      }
      // partner buffs only from available partner cards at this date
      const partnerEffects = effectDict[duoJa] || [];
      for (const eff of partnerEffects) {
        const dmg = calcFinisherVsFireDamage(fin, eff.buff, d);
        if (dmg != null) {
          const finJa = toJaCardTitle(fin);
          const partnerCard = availableCards.find(c => c.name === eff.name) || null;
          const duoJaCard = partnerCard ? toJaCardTitle(partnerCard) : eff.name;
          const label = `${finJa} × ${duoJaCard}`;
          entries.push({ key: `${fin.name}__${eff.name}`, label, finisher: fin, duo: eff.name, damage: dmg });
        }
      }
    }

    // Sort desc and keep ALL entries for the day
    entries.sort((a, b) => b.damage - a.damage);

    // Record values and ensure icons for all entries
    for (const e of entries) {
      if (!seriesMap.has(e.key)) {
        let iconFile = null;
        if (e.duo) {
          if (e.baseline) {
            // No-buff: finisher card image × duo character icon/name
            iconFile = await composeIcon(e.finisher.name, e.duo, infoMap, 'card-char');
          } else {
            // Buff case: finisher card × duo card
            iconFile = await composeIcon(e.finisher.name, e.duo, infoMap, 'card-card');
          }
        } else {
          // No partner case rarely happens; fallback to finisher duplicate
          iconFile = await composeIcon(e.finisher.name, e.finisher.name, infoMap, 'card-card');
        }
        seriesMap.set(e.key, { label: e.label, iconFile, values: new Map() });
      }
      seriesMap.get(e.key).values.set(dayStr, Math.floor(e.damage));
    }
    // For continuity: fill 0 for series that already existed but are not in today's top300
    for (const [key, series] of seriesMap) {
      if (!series.values.has(dayStr)) {
        series.values.set(dayStr, 0);
      }
    }
  }

  // Build CSV: columns = [name, icon, date1, date2, ...]
  const allDates = [];
  for (let d = new Date(new Date(Math.min(...ssr.map(c => +parseDateStr(c.releaseDate))))); d <= maxDate; d.setDate(d.getDate() + 1)) {
    allDates.push(formatDate(d));
  }
  const header = ['name', 'icon', ...allDates];
  const rows = [header.join(',')];
  for (const [key, series] of seriesMap) {
    const vals = allDates.map(ds => series.values.get(ds) ?? 0);
    const iconUrl = series.iconFile ? ICON_BASE_URL + series.iconFile : '';
    rows.push([series.label, iconUrl, ...vals].join(','));
  }
  fs.writeFileSync(CSV_PATH, rows.join('\n'));

  console.log(`Done. Series=${seriesMap.size}, dates=${allDates.length}, out=${CSV_PATH}`);
}

main().catch(e => { console.error(e); process.exit(1); });
