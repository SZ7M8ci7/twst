const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { createI18n } = require('vue-i18n');

const root = path.resolve(__dirname, '..');
// Load the small, pure TS display modules without adding a test framework or
// changing the app's bundler aliases/global require hooks.
function loadTs(relative, globals = {}, cache = new Map()) {
  if (cache.has(relative)) return cache.get(relative);
  const filename = path.join(root, relative);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
  }).outputText;
  const localRequire = (id) => {
    if (!id.startsWith('@/')) return require(id);
    const resolved = 'src/' + id.slice(2);
    return id.endsWith('.json') ? require(path.join(root, resolved)) : loadTs(resolved + '.ts', globals, cache);
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: localRequire, ...globals }, { filename });
  cache.set(relative, module.exports);
  return module.exports;
}

const display = loadTs('src/utils/localizedDisplay.ts');
const ja = require('../src/i18n/ja.json');
const en = require('../src/i18n/en.json');
const zh = require('../src/i18n/zh-CN.json');
const game = require('../src/i18n/zh-CN-game.json');
const cards = require('../src/assets/chara.json');
const characters = require('../src/assets/characters_info.json');
const flatten = (obj, prefix = '') => Object.fromEntries(Object.entries(obj).flatMap(([key, value]) => {
  const name = prefix + key;
  return typeof value === 'object' ? Object.entries(flatten(value, name + '.')) : [[name, value]];
}));

test('Chinese covers every message and preserves interpolation arguments', () => {
  const source = flatten(ja), translated = flatten(zh);
  assert.deepEqual(Object.keys(translated).sort(), Object.keys(source).sort());
  const args = (value) => [...value.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]).sort();
  for (const [key, value] of Object.entries(translated)) {
    assert.equal(typeof value, 'string', key);
    assert.ok(value.length > 0, key);
    assert.deepEqual(args(value), args(source[key]), key);
    if (key !== 'top.createdBy') assert.doesNotMatch(value, /[ぁ-ゖァ-ヺ]/, key);
  }
  const errors = [];
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: false, messages: { 'zh-CN': zh }, onError: (error) => errors.push(error) });
  for (const [key, value] of Object.entries(translated)) {
    i18n.global.t(key, Object.fromEntries(args(value).map((name) => [name, 'TEST'])));
  }
  assert.deepEqual(errors, []);
  assert.equal(i18n.global.t('examSimulator.actionCount', { count: 2 }), '2次行动');
});

test('all current costumes have explicit names, independent of birthN IDs', () => {
  for (const card of cards) {
    assert.ok(Object.hasOwn(game.costumes, card.costume), card.costume);
    assert.equal(display.localizeCostumeName(card, 'zh-CN'), game.costumes[card.costume]);
  }
  assert.equal(display.localizeCostumeName({ name: 'ace_birth2', costume: 'ユニオンバースデー' }, 'zh-CN'), 'Union生日装扮');
  assert.equal(display.localizeCostumeName({ name: 'ace_birth3', costume: 'ブルームバースデー' }, 'zh-CN'), 'Bloom生日装扮');
  assert.equal(display.localizeCostumeName({ name: 'ace_birth4', costume: 'プラチナジャケット' }, 'zh-CN'), '白金夹克');
  assert.equal(display.localizeCostumeName('未確認の衣装', 'zh-CN'), '未確認の衣装');
});

test('character names agree across filters, cards and tooltips', () => {
  for (const character of characters) {
    const name = display.localizeCharacterName(character.name_ja, 'zh-CN');
    assert.doesNotMatch(name, /[ぁ-ゖァ-ヺ]/);
    const key = character.name_en === 'rollo' ? 'lolo' : character.name_en;
    if (zh.filterModal[key]) assert.equal(name, zh.filterModal[key]);
    if (zh.comments[key]) assert.equal(name, zh.comments[key]);
  }
  assert.equal(display.localizeCharacterName('トレイン', 'zh-CN'), 'Trein');
  assert.equal(display.localizeCardTitle({ chara: 'リドル', costume: '寮服' }, 'zh-CN'), 'Riddle【寮服】');
  assert.equal(display.localizeGameText('ディアソムニア', 'zh-CN'), 'Diasomnia寮');
});

test('effects retain numbers, targets and markup without cascading replacements', () => {
  assert.equal(display.localizeGameText('火属性被ダメージDOWN(大)(相手全体/3T)', 'zh-CN'), '火属性受到伤害降低(大)(敌方全体/3T)');
  assert.equal(display.localizeGameText('HP継続回復(中)<br>呪い無効(味方選択/1T)', 'zh-CN'), 'HP持续回复(中)<br>免疫诅咒(指定队友/1T)');
  assert.equal(display.localizeGameText('ATKUP(小)(自/1T)', 'zh-CN'), 'ATK提升(小)(自身/1T)');
  assert.equal(display.localizeGameText('3連撃(弱)', 'zh-CN'), '3连击(弱)');
  assert.equal(display.localizeGameText(null, 'zh-CN'), '');
  const options = display.localizeOptionItems(['無', '回復'], 'zh-CN');
  assert.equal(options[0].title, '无');
  assert.equal(options[0].value, '無');
  assert.equal(options[1].value, '回復');
  for (const card of cards) {
    for (const key of ['attr', 'growtype', 'etc', 'magic1pow', 'magic2pow', 'magic3pow', 'magic1heal', 'magic2heal', 'magic3heal', 'buddy1s', 'buddy2s', 'buddy3s']) {
      assert.doesNotMatch(display.localizeGameText(card[key], 'zh-CN'), /[ぁ-ゖァ-ヺ]/, `${card.name}.${key}`);
    }
  }
});

test('costume search accepts Chinese, Japanese and English regardless of active locale', () => {
  const card = { name: 'ace_experiment', costume: '実験着' };
  for (const query of ['实验', '実験', 'LABWEAR', '  Ｌａｂｗｅａｒ  ', '']) assert.ok(display.matchesCostumeSearch(card, query), query);
  assert.equal(display.matchesCostumeSearch(card, '寮服'), false);
});

test('exam presets and special challenges are readable without changing their data', () => {
  const source = fs.readFileSync(path.join(root, 'src/utils/examPresets.ts'), 'utf8');
  for (const [, label] of source.matchAll(/(?:title|label): '([^']+)'/g)) {
    assert.doesNotMatch(display.localizeGameText(label, 'zh-CN'), /[ぁ-ゖァ-ヺ]/, label);
  }
  assert.equal(display.localizeGameText('第18回統一火DF', 'zh-CN'), '第18届统一考试火DF');
  assert.equal(display.localizeGameText('ディアソ以外にダメDOWN(10T/20.5%)', 'zh-CN'), '对Diasomnia寮以外的角色：伤害降低(10T/20.5%)');
});

test('Japanese and English display and translations remain usable', () => {
  assert.equal(display.localizeGameText('火属性ダメージUP', 'ja'), '火属性ダメージUP');
  assert.equal(display.localizeGameText('火属性ダメージUP', 'en'), 'Fire Damage UP');
  assert.equal(display.localizeCharacterName('リドル', 'ja'), 'リドル');
  assert.equal(display.localizeCharacterName('リドル', 'en'), 'Riddle');
  assert.equal(display.localizeCostumeName({ name: 'ace_experiment', costume: '実験着' }, 'en'), 'Labwear');
  const i18n = createI18n({ legacy: false, locale: 'ja', messages: { ja, en, 'zh-CN': zh } });
  for (const [locale, expected] of [['ja', '手持ち設定'], ['en', en.tool.handCollection], ['zh-CN', '持有卡牌设置'], ['ja', '手持ち設定']]) {
    i18n.global.locale.value = locale;
    assert.equal(i18n.global.t('tool.handCollection'), expected);
  }
  assert.equal(display.localizeNumberUnit(3, '回', 'ja'), '3回');
  assert.equal(display.localizeNumberUnit(3, '回', 'en'), '3 times');
  assert.equal(display.localizeNumberUnit(3, '回', 'zh-CN'), '3次');
  assert.equal(display.localizeNumberUnit(3, '行動', 'zh-CN'), '3次行动');
});

test('saved locale normalizes Simplified aliases, defaults to Japanese and survives blocked storage', () => {
  let saved = null;
  const localStorage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
  const locales = loadTs('src/i18n/locales.ts', { localStorage });
  assert.equal(locales.getSavedLocale(), 'ja');
  for (const alias of ['zh', 'zh-CN', 'zh_SG', 'zh-Hans', 'zh-Hans-CN']) assert.equal(locales.normalizeLocale(alias), 'zh-CN');
  for (const unsupported of ['zh-TW', 'zh-Hant', 'fr', null]) assert.equal(locales.normalizeLocale(unsupported), undefined);
  locales.saveLocale('zh-CN');
  assert.equal(locales.getSavedLocale(), 'zh-CN');
  saved = 'invalid';
  assert.equal(locales.getSavedLocale(), 'ja');
  const blocked = loadTs('src/i18n/locales.ts', { localStorage: { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } } });
  assert.equal(blocked.getSavedLocale(), 'ja');
  assert.doesNotThrow(() => blocked.saveLocale('zh-CN'));
});
