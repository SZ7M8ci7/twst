const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const vue=require('vue'),ts=require('typescript');
const {parse,compileScript}=require('@vue/compiler-sfc');
const root=path.resolve(__dirname,'../..');
const {descriptor}=parse(fs.readFileSync(path.join(root,'src/components/FilterModal.vue'),'utf8'));
const code=ts.transpileModule(compileScript(descriptor,{id:'isolated-filter'}).content,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText;
const info=require('../../src/assets/characters_info.json');

async function createFilter(initialSelection=null){
 const hooks=[],events=[],writes=[];
 const cards=vue.reactive([
  {name:'riddle_ssr',chara:'リドル',rare:'SSR',attr:'バランス',magic1atr:'火',costume:'寮服',visible:false},
  {name:'riddle_r',chara:'リドル',rare:'R',attr:'バランス',magic1atr:'火',costume:'制服',visible:false},
  {name:'trey_sr',chara:'トレイ',rare:'SR',attr:'バランス',magic1atr:'火',costume:'実験着',visible:true},
 ]);
 const store=vue.reactive({tempSelectedCharacters:['trey'],tempSelectedRare:['SSR'],tempSelectedType:[],tempSelectedAttr:[],tempSelectedEffects:[],tempSelectedBuddyBonusEffects:[],tempCostumeSearch:'unrelated',isFirst:true,markFilterAsModified:()=>writes.push('mark'),saveCurrentState:()=>writes.push('save'),resetFilterState:()=>writes.push('reset')});
 const modules={
  vue:{...vue,onMounted:fn=>hooks.push(fn),onBeforeUnmount:()=>{}},pinia:{storeToRefs:vue.toRefs},'vue-i18n':{useI18n:()=>({t:x=>x})},
  '@/store/characters':{useCharacterStore:()=>vue.reactive({characters:cards})},'@/store/filterd':{useFilterdStore:()=>store},
  '@/assets/characters_info.json':info,
  '@/utils/characterAssets':{loadImageUrls:async()=>Object.fromEntries(info.map(c=>[c.name_en,'image']))},
  '@/store/searchResult':{effects:[{name:'attack',value:'attack'}],buddyBonusEffects:[{name:'hp',value:'hp'}],defaultSelectedEffectValues:['attack'],defaultSelectedBuddyBonusEffectValues:['hp']},
  '@/utils/localizedDisplay':{matchesCostumeSearch:(card,text)=>card.costume.includes(text)},
 };
 const module={exports:{}};
 vm.runInNewContext(code,{module,exports:module.exports,require:id=>modules[id]??{},document:{querySelector:()=>null},window:{innerWidth:1200,addEventListener:()=>{},removeEventListener:()=>{}},console});
 const scope=vue.effectScope();
 const filter=scope.run(()=>module.exports.default.setup({embedded:true,isolated:true,initialSelection},{expose:()=>{},emit:(...e)=>events.push(e)}));
 const before=JSON.stringify({cards,store});
 await hooks[0]();
 return {filter,cards,store,before,events,writes,latest:()=>events.filter(e=>e[0]==='local-filter').at(-1)[1],stop:()=>scope.stop()};
}

test('existing filter narrows local cards by character, rarity and outfit without mutating saved settings',async()=>{
 const x=await createFilter();
 assert.equal(x.latest().cardNames.length,3);
 x.filter.selectedCharacters.value=['riddle'];x.filter.selectedRare.value=['R'];await vue.nextTick();
 assert.deepEqual(Array.from(x.latest().cardNames),['riddle_r']);
 x.filter.costumeSearch.value='寮服';await vue.nextTick();assert.equal(x.latest().cardNames.length,0);
 x.filter.selectedRare.value=['SSR'];await vue.nextTick();assert.deepEqual(Array.from(x.latest().cardNames),['riddle_ssr']);
 x.filter.resetFilter();await vue.nextTick();assert.deepEqual(Array.from(x.latest().cardNames),['riddle_ssr']);
 assert.equal(JSON.stringify({cards:x.cards,store:x.store}),x.before);assert.deepEqual(x.writes,[]);x.stop();
});

test('collapsing and reopening the existing filter preserves an explicitly empty selection',async()=>{
 const x=await createFilter();x.filter.selectedCharacters.value=[];await vue.nextTick();
 assert.equal(x.latest().cardNames.length,0);
 const y=await createFilter(x.latest().selection);
 assert.equal(y.latest().cardNames.length,0);assert.equal(y.filter.selectedCharacters.value.length,0);
 assert.deepEqual(y.writes,[]);x.stop();y.stop();
});
