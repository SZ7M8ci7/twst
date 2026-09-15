const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ts = require('typescript'), vue = require('vue');
const { parse, compileScript } = require('@vue/compiler-sfc');
const { load, root } = require('./test-helpers.cjs');
const { descriptor } = parse(fs.readFileSync(path.join(root, 'src/components/HandScreenshotImport.vue'), 'utf8'));
const code = ts.transpileModule(compileScript(descriptor, { id:'import-level-test' }).content, {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true},
}).outputText;

function createImporter() {
  const saved = new Map([['card', {isOwned:false,level:40,totsu:0}]]);
  const store = {
    batchUpdates:fn=>fn(), peekHandCard:key=>saved.get(key),getHandCard:key=>saved.get(key),
    updateHandCard:(key,values)=>saved.set(key,{...saved.get(key),...values}),removeHandCard:key=>saved.delete(key),
  };
  const modules = {
    vue:{...vue,onUnmounted:()=>{}},
    'vue-i18n':{useI18n:()=>({t:key=>key,locale:vue.ref('ja')})},
    '@/assets/chara.json':[{name:'card',rare:'SSR',chara:'Riddle',costume:'Test'}],
    '@/store/handCollection':{useHandCollectionStore:()=>store},
    '@/utils/characterAssets':{loadImageUrls:()=>Promise.resolve({})},
    '@/utils/localizedDisplay':{localizeCharacterName:x=>x,localizeCostumeName:x=>x.costume},
    '@/constants/levels':{getInputMaxLevel:()=>120},
  };
  const module={exports:{}};
  vm.runInNewContext(code,{module,exports:module.exports,console,require:id=>{
    if(id in modules)return modules[id];
    if(id.endsWith('.vue'))return {};
    if(id.startsWith('@/domain/'))return load('src/'+id.slice(2)+'.ts');
    throw Error('Unexpected module: '+id);
  }});
  const scope=vue.effectScope();
  const ui=scope.run(()=>module.exports.default.setup({}, {expose:()=>{}}));
  return {ui,saved,stop:()=>scope.stop()};
}
const row=(extra={})=>({id:'1',fileIndex:0,box:{x:0,y:0,width:100,height:100},candidates:[],confident:true,
  selected:'card',level:52,maxLevel:80,totsu:0,totsuEvidence:'max-level',...extra});

test('default maximum and switching current determine actual hand updates and undo',()=>{
  const x=createImporter();
  try {
    x.ui.rows.value=[row()];
    assert.equal(x.ui.levelMode.value,'maximum');
    assert.equal(x.ui.merged.value[0].level,80);
    x.ui.apply(); assert.equal(x.saved.get('card').level,80);
    x.ui.undo(); assert.equal(x.saved.get('card').level,40);
    x.ui.levelMode.value='current';
    assert.equal(x.ui.merged.value[0].level,52);
    x.ui.apply(); assert.equal(x.saved.get('card').level,52);
  } finally {x.stop();}
});

test('edits remain per mode and do not alter OCR max level or uncaps evidence',()=>{
  const x=createImporter();
  try {
    x.ui.rows.value=[row()];const r=x.ui.rows.value[0];
    x.ui.changeLevel(r,{target:{value:'84'}});
    assert.equal(x.ui.merged.value[0].level,84);
    x.ui.levelMode.value='current';assert.equal(x.ui.merged.value[0].level,52);
    x.ui.changeLevel(r,{target:{value:'60'}});
    x.ui.levelMode.value='maximum';assert.equal(x.ui.merged.value[0].level,84);
    assert.equal(r.maxLevel,80);assert.equal(r.level,52);assert.equal(r.totsu,0);
    x.ui.apply();assert.equal(x.saved.get('card').level,84);
  } finally {x.stop();}
});

test('duplicate conflicts use selected mode, including review filtering',()=>{
  const x=createImporter();
  try {
    x.ui.rows.value=[row(),row({id:'2',level:60})];
    assert.equal(x.ui.merged.value[0].conflict,false);
    assert.equal(x.ui.visibleRows.value.length,0);
    x.ui.levelMode.value='current';
    assert.equal(x.ui.merged.value[0].conflict,true);
    assert.equal(x.ui.visibleRows.value.length,2);
    x.ui.apply();assert.equal(x.saved.get('card').level,40);
  } finally {x.stop();}
});

test('unreadable or manually cleared maximum stays unknown and preserves saved level',()=>{
  const x=createImporter();
  try {
    x.ui.rows.value=[row({maxLevel:undefined})];
    assert.equal(x.ui.merged.value[0].level,undefined);
    assert.equal(x.ui.visibleRows.value.length,1);
    x.ui.apply();assert.equal(x.saved.get('card').level,40);x.ui.undo();
    x.ui.rows.value=[row()];x.ui.changeLevel(x.ui.rows.value[0],{target:{value:''}});
    assert.equal(x.ui.merged.value[0].level,undefined);
    x.ui.levelMode.value='current';assert.equal(x.ui.merged.value[0].level,52);
    x.ui.levelMode.value='maximum';assert.equal(x.ui.merged.value[0].level,undefined);
  } finally {x.stop();}
});
