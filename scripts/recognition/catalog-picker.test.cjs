const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const vue = require('vue');
const { parse, compileScript } = require('@vue/compiler-sfc');
const root = path.resolve(__dirname, '../..');
const { descriptor } = parse(fs.readFileSync(path.join(root, 'src/components/SimCharaModal.vue'), 'utf8'));
const code = ts.transpileModule(compileScript(descriptor, { id: 'catalog-mode-regression' }).content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
}).outputText;

function createPicker(catalogMode) {
  const cards = vue.reactive([
    { name:'riddle_ssr', chara:'リドル', rare:'SSR', visible:true, level:100, hp:1000, atk:500, totsu:4 },
    { name:'riddle_r', chara:'リドル', rare:'R', visible:false, level:60, hp:500, atk:250, totsu:0 },
    { name:'trey_sr', chara:'トレイ', rare:'SR', visible:false, level:80, hp:700, atk:300, totsu:0 },
  ]);
  const writes=[];const hooks=[];const events=[];
  const hand = vue.reactive({ useHandCollection:true,
    isCharacterOwned:name=>name==='riddle_ssr', peekHandCard:()=>({isOwned:true,level:95,totsu:2,isLimitBreak:false}),
    isFirstModalOpen:()=>true, hasAnyHandSettings:true,
    setUseHandCollection:()=>writes.push('hand mode'), incrementModalOpenCount:()=>writes.push('modal count'),
  });
  const filters=vue.reactive({sortBy:'default',sortOrder:'asc',isFirst:true,
    markSortAsModified:()=>writes.push('sort'),saveCurrentSortState:()=>writes.push('save sort')});
  const modules={
    vue:{...vue,onMounted:fn=>hooks.push(fn),onUnmounted:()=>{}},
    'vue-i18n':{useI18n:()=>({t:key=>key,locale:vue.ref('ja')})},
    pinia:{storeToRefs:vue.toRefs},
    '@/store/characters':{useCharacterStore:()=>vue.reactive({characters:cards})},
    '@/store/simulatorStore':{useSimulatorStore:()=>vue.reactive({deckCharacters:[]})},
    '@/store/filterd':{useFilterdStore:()=>filters},
    '@/store/handCollection':{useHandCollectionStore:()=>hand},
    '@/utils/sortUtils':{applyDefaultSort:items=>[...items],applyMultiLevelSort:(_a,_b,n)=>n},
    '@/utils/totsu':{clampTotsuCount:n=>n,isM3Unlocked:(_r,n)=>n>=3,isMaxLimitBreak:n=>n===4},
    '@/utils/calculations':{recalculateHP:()=>950,recalculateATK:()=>475},
    '@/utils/localizedDisplay':{localizeCharacterName:name=>name},
  };
  const module={exports:{}};
  const fallback=new Proxy({__esModule:true},{get:(target,key)=>key in target?target[key]:()=>{}});
  const scope=vue.effectScope();
  vm.runInNewContext(code,{module,exports:module.exports,require:id=>{
    if(modules[id])return modules[id];
    if(id.endsWith('.json'))return require(path.join(root,'src',id.slice(2)));
    return fallback;
  },window:{setTimeout:()=>1},setTimeout:()=>1,clearTimeout:()=>{},requestAnimationFrame:()=>{},console});
  const picker=scope.run(()=>module.exports.default.setup({catalogMode,charaIndex:-1,selectedAttribute:'対全'},
    {expose:()=>{},emit:(...event)=>events.push(event)}));
  return {picker,cards,filters,hand,writes,hooks,events,stop:()=>scope.stop()};
}

test('catalog picker includes unowned R/SR cards despite saved filters, without changing settings',async()=>{
  const x=createPicker(true);
  const before=JSON.stringify({cards:x.cards,filters:x.filters,hand:x.hand});
  await x.hooks[0]();
  assert.deepEqual(Array.from(x.picker.filteredCharacters.value,c=>c.name),['riddle_ssr','riddle_r','trey_sr']);
  x.picker.updateCatalogVisibility({selection:{characters:['trey']},cardNames:['trey_sr']});
  assert.deepEqual(Array.from(x.picker.filteredCharacters.value,c=>c.name),['trey_sr']);
  x.picker.sortOrder.value='desc';await vue.nextTick();
  x.picker.useHandCollection.value=true;await x.picker.updateFilteredCharacters();
  assert.equal(x.picker.filteredCharacters.value.length,0);
  x.picker.useHandCollection.value=false;await x.picker.updateFilteredCharacters();
  x.filters.sortBy='deckDamage';await vue.nextTick();
  assert.deepEqual(Array.from(x.picker.filteredCharacters.value,c=>c.name),['trey_sr']);
  x.filters.sortBy='default';await vue.nextTick();
  assert.equal(JSON.stringify({cards:x.cards,filters:x.filters,hand:x.hand}),before);
  assert.deepEqual(x.writes,[]);
  x.stop();
});

test('catalog selection emits the chosen card without applying hand levels or uncaps',()=>{
  const x=createPicker(true);x.picker.selectImage(x.cards[1]);
  assert.equal(x.events[0][0],'select');
  assert.equal(x.events[0][1].name,'riddle_r');
  assert.equal(x.events[0][1].level,60);
  assert.equal(x.events[0][1].totsu,0);
  assert.deepEqual(x.writes,[]);x.stop();
});

test('regular picker still uses visibility, ownership and saved card settings',async()=>{
  const x=createPicker(false);await x.picker.updateFilteredCharacters();
  assert.deepEqual(Array.from(x.picker.filteredCharacters.value,c=>c.name),['riddle_ssr']);
  x.picker.selectImage(x.cards[0]);
  assert.equal(x.events[0][1].level,95);assert.equal(x.events[0][1].totsu,2);
  x.stop();
});
