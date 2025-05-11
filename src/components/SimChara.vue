<template>
  <div class="component-container">
    <div>
      <v-row dense>
        <v-col cols="2" class="center">
          <div class="image-section">
            <img :src="imgpath" alt="Character" class="character-image" @click="openCharaModal" />
          </div>
        </v-col>
        <v-col cols="3" class="center">
          <div class="stats-section">
            <div class="stat">
              <button class="bonusbutton" :class="{'selected': isBonusSelected}" @click="toggleBonus">凸</button>
              <label>Lv</label>
              <input 
                type="number" 
                :value="simulatorStore.deckCharacters[props.charaIndex].level"
                @input="handleLevelInput"
                class="stat-input" 
                min="0"
                :max="getMaxLevel(simulatorStore.deckCharacters[props.charaIndex].rare)"
              />
            </div>
            <div class="stat">
              <label>HP</label>
              <input type="number" v-model="simulatorStore.deckCharacters[props.charaIndex].hp" class="stat-input" />
            </div>
            <div class="stat">
              <label>ATK</label>
              <input type="number" v-model="simulatorStore.deckCharacters[props.charaIndex].atk" class="stat-input" />
            </div>
          </div>
        </v-col>
        <v-col cols="5">
          <div v-for="index in 3" :key="index" class="stat">
            <v-row dense>
              <v-col cols="2">
                <button :class="{'mbutton': true, 'selected': simulatorStore.deckCharacters[props.charaIndex][`isM${index}Selected`], 'shake': shakingStates[`isM${index}Shaking`]}" @click="toggleM(index)">M{{ index }}</button>
              </v-col>
              <v-col cols="2">
                <ElementDropdown :chara-index="props.charaIndex" :element-index="index"/>
              </v-col>
              <v-col cols="3">
                <select
                  v-if="windowWidth >= 360"
                  v-model="simulatorStore.deckCharacters[props.charaIndex][`magic${index}Lv`]"
                  class="level-select"
                  style="min-width: 35px; max-width: 60px;"
                >
                  <option disabled value="">Lv</option>
                  <option v-for="n in 10" :key="n" :value="n">Lv{{ n }}</option>
                </select>
              </v-col>
              <v-col cols="4">
                <MagicDropdown
                  v-model="simulatorStore.deckCharacters[props.charaIndex][`magic${index}Power`]"
                  style="min-width: 70px; max-width: 120px;"
                />
              </v-col>
            </v-row>
          </div>
        </v-col>
        <v-col cols="2" class="center">
          <div class="buttons-section">
            <button class="buff-btn"  @click="addBuff">バフ<br>追加</button>
            <button class="details-btn" @click="openDetailModal">詳細<br>編集</button>
          </div>
        </v-col>
      </v-row>
    </div>
    <v-row dense>
      <div class="buff-list">
        <template v-for="(buff, index) in simulatorStore.deckCharacters[props.charaIndex].buffs" :key="index">
          <div class="buff-section">
            <BuffDropdown v-model="simulatorStore.deckCharacters[props.charaIndex].buffs[index]"/>
          </div>
        </template>
      </div>
    </v-row>
    <SimCharaModal v-if="isCharaModalOpen" @close="closeCharaModal" @select="selectCharaImage" />
    <SimCharaDetailModal
      v-model="isDetailModalOpen"
      :character="simulatorStore.deckCharacters[props.charaIndex]"
      @save="saveDetailChanges"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import defaultImg from '@/assets/img/default.png';
import ElementDropdown from './ElementDropdown.vue';
import SimCharaModal from './SimCharaModal.vue';
import MagicDropdown from './MagicDropdown.vue';
import BuffDropdown from './BuffDropdown.vue';
import SimCharaDetailModal from './SimCharaDetailModal.vue';
import { useSimulatorStore } from '@/store/simulatorStore';
import { useCharacterStore } from '@/store/characters';
const simulatorStore = useSimulatorStore();
const characterStore = useCharacterStore();


const imgpath = ref(defaultImg);
const props = defineProps(['charaIndex']);

// SimCharaModalの制御
const isCharaModalOpen = ref(false);
const isDetailModalOpen = ref(false);

// Modalを開く
const openCharaModal = () => {
  isCharaModalOpen.value = true;
};

// Modalを閉じる
const closeCharaModal = () => {
  isCharaModalOpen.value = false;
};

// 詳細編集モーダルを開く
const openDetailModal = () => {
  isDetailModalOpen.value = true;
};

// 詳細編集モーダルを閉じる
const closeDetailModal = () => {
  isDetailModalOpen.value = false;
};

const levelDict = {'R':70,'SR':90,'SSR':110}
// 画像を選択したときに呼ばれる
const selectCharaImage = (chara) => {
  console.log('Selected character:', chara);
  
  // 初期設定の処理
  const initialSettings = {
    chara: chara.chara || '',
    level: levelDict[chara.rare],
    hp: chara.hp || 0,
    atk: chara.atk || 0,
    isM1Selected: true,
    isM2Selected: true,
    isM3Selected: false,
    isBonusSelected: true,
    magic1Lv: chara.magic1Lv || 10,
    magic2Lv: chara.magic2Lv || 10,
    magic3Lv: chara.magic3Lv || 10,
    buddy1c: chara.buddy1c || '',
    buddy2c: chara.buddy2c || '',
    buddy3c: chara.buddy3c || '',
    buddy1s: chara.buddy1s || '',
    buddy2s: chara.buddy2s || '',
    buddy3s: chara.buddy3s || '',
    buddy1Lv: chara.buddy1Lv || 10,
    buddy2Lv: chara.buddy2Lv || 10,
    buddy3Lv: chara.buddy3Lv || 10,
    buffs: []
  };

  // 各魔法の初期設定をループで処理
  for (let i = 1; i <= 3; i++) {
    const magicKey = `magic${i}`;
    // バフと回復の設定
    chara[`${magicKey}buf`] = chara[`${magicKey}buf`] || '';
    chara[`${magicKey}heal`] = chara[`${magicKey}heal`] || '';
    // マジックの属性と威力の設定
    chara[`${magicKey}Attribute`] = chara[`${magicKey}atr`] || '';
    chara[`${magicKey}Power`] = chara[`${magicKey}pow`] || '単発(弱)';

    // バフと回復の自動設定
    const buffValue = chara[`${magicKey}buf`];
    const healValue = chara[`${magicKey}heal`];

    // バフの追加
    if (buffValue) {
      const buffType = buffValue.includes('ATKUP') ? 'ATKUP' :
                      buffValue.includes('ダメUP') ? 'ダメージUP' :
                      buffValue.includes('属性ダメUP') ? '属性ダメUP' : '';
      
      if (buffType) {
        initialSettings.buffs.push({
          magicOption: `M${i}`,
          buffOption: buffType,
          powerOption: getPowerOption(buffValue),
          levelOption: 10
        });
      }
    }
    
    // 回復の追加
    if (healValue) {
      if (healValue.includes('継続回復')) {
        initialSettings.buffs.push({
          magicOption: `M${i}`,
          buffOption: '継続回復',
          powerOption: getPowerOption(healValue),
          levelOption: 10
        });
      }
      if (healValue.includes('回復')) {
        initialSettings.buffs.push({
          magicOption: `M${i}`,
          buffOption: '回復',
          powerOption: getPowerOption(healValue),
          levelOption: 10
        });
      }
    }
  }

  // デュオキャラクターの効果を設定
  if (chara.duo && simulatorStore.charaDict[chara.duo]) {
    chara.magic2power = 'デュオ';
  }

  // 初期設定を適用
  Object.assign(chara, initialSettings);

  // キャラクター選択時にselectCharacterを呼び出す
  simulatorStore.selectCharacter(props.charaIndex, chara);
  // 画像を更新 - エラーハンドリングを追加
  if (chara.imgUrl) {
    imgpath.value = chara.imgUrl;
  } else {
    console.log(`Using default image for ${chara.chara}`);
    imgpath.value = defaultImg;
  }
  
  // ボーナス選択状態を更新
  isBonusSelected.value = chara.isBonusSelected;
  closeCharaModal();
};


// M1, M2, M3 ボタンの選択状態
const isBonusSelected = ref(false);

// 揺れアニメーションの制御
const shakingStates = ref( {
        isM1Shaking: false,
        isM2Shaking: false,
        isM3Shaking: false,
      });
let shakeTimeout = null;

// バフの強さを判定するヘルパー関数
const getPowerOption = (buffString) => {
  if (buffString.includes('極小')) return '極小';
  if (buffString.includes('小')) return '小';
  if (buffString.includes('中')) return '中';
  if (buffString.includes('大')) return '大';
  if (buffString.includes('極大')) return '極大';
  return '中'; // デフォルト値
};

const addBuff = () => {
  const character = simulatorStore.deckCharacters[props.charaIndex];
  
  // buffs配列が存在しない場合は初期化
  if (!character.buffs) {
    character.buffs = [];
  }
  
  // 空のバフを追加（全ての値を空文字列に設定）
  character.buffs.push({
    magicOption: '',
    buffOption: '',
    powerOption: '',
    levelOption: 10
  });
};


const toggleBonus = () => {
  isBonusSelected.value = !isBonusSelected.value;
  const character = simulatorStore.deckCharacters[props.charaIndex];
  character.isBonusSelected = isBonusSelected.value;
  // ボーナス状態が変更されたら再計算
  const newStats = simulatorStore.calculateBaseStats(character);
  // 計算結果を直接反映
  character.atk = newStats.atk;
  character.hp = newStats.hp;
  // 全ステータスを再計算
  simulatorStore.calculateAllStats();
};

// 選択されている M ボタンの数をカウントする
const selectedCount = () => {
  return [simulatorStore.deckCharacters[props.charaIndex].isM1Selected,
   simulatorStore.deckCharacters[props.charaIndex].isM2Selected,
    simulatorStore.deckCharacters[props.charaIndex].isM3Selected].filter(Boolean).length;
};

// 揺れアニメーションの開始
const startShaking = (shakingKey) => {
  shakingStates.value[shakingKey] = true;
  clearTimeout(shakeTimeout);
  shakeTimeout = setTimeout(() => {
    shakingStates.value[shakingKey] = false;
  }, 500); // 0.5秒間揺れる
};


const toggleM = (index) => {
  const selectedKey = `isM${index}Selected`;
  const shakingKey = `isM${index}Shaking`;

  if (simulatorStore.deckCharacters[props.charaIndex][selectedKey] || selectedCount() < 2) {
    simulatorStore.deckCharacters[props.charaIndex][selectedKey] = !simulatorStore.deckCharacters[props.charaIndex][selectedKey];
  } else {
    startShaking(shakingKey);
  }
};

// 最大レベルを取得する関数
const getMaxLevel = (rare) => {
  return levelDict[rare] || 110;
};

// レベル入力のハンドラー
const handleLevelInput = (event) => {
  const value = parseInt(event.target.value) || 0;
  const maxLevel = getMaxLevel(simulatorStore.deckCharacters[props.charaIndex].rare);
  const validLevel = Math.max(0, Math.min(value, maxLevel));
  simulatorStore.updateLevel(props.charaIndex, validLevel);
};

// 詳細設定の保存
const saveDetailChanges = (updatedCharacter) => {
  simulatorStore.selectCharacter(props.charaIndex, updatedCharacter);
  closeDetailModal();
};

const windowWidth = ref(window.innerWidth);
const handleResize = () => {
  windowWidth.value = window.innerWidth;
};
onMounted(() => {
  window.addEventListener('resize', handleResize);
});
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

</script>

<style scoped>
.component-container {
  align-items: center;
  border: 1px solid #ccc;
  padding: 1px;
  font-size: 0.7em;
  max-width: 100%;
}
.center{
  display: flex;
  justify-content: center;
  align-items: center;
}
.image-section {
  padding-left: 5%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.selected {
  background-color: #8faef3;
  color: rgb(0, 0, 0);
}

.character-image {
  width: 100%;
  max-width: 80px;
  height: 100%;
  object-fit: cover;
}

.stats-section {
  display: flex;
  flex-direction: column;
}

.stat {
  display: flex;
  align-items: center;
}

.stat-input {
  width: 100%;
  margin-left: 10px;
  border: 1px solid #ccc;
}

select {
  margin-right: 1px;
}

.buttons-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;
}

.buff-btn, .details-btn {
  margin-bottom: 1px;
  border-radius: 8px;
  padding: 0px 10px;
  border: 1px solid #ccc;
  background-color: #f0f0f0;
  cursor: pointer;
  font-size: 0.8em;
}
.bonusbutton {
  margin-bottom: 1px;
  padding-left: 2%;
  padding-right: 2%;
  border-radius: 5px;
  border: 1px solid #ccc;
  cursor: pointer;
}
.mbutton {
  margin-bottom: 1px;
  padding-left: 20%;
  padding-right: 20%;
  border-radius: 5px;
  border: 1px solid #ccc;
  cursor: pointer;
}

.mbutton.shake {
  animation: shake 0.25s;
}


.buff-section {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1px;
  width: 100%;
}

.buff-input {
  margin-left: 5px;
  margin-right: 5px;
  border: 1px solid #ccc;
  width: 45px;
}

.remove-btn {
  padding: 0px 10px;
  border-radius: 8px;
  border: 1px solid #ccc;
  background-color: #f0f0f0;
  cursor: pointer;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5%);
  }
  75% {
    transform: translateX(5%);
  }
}

.buff-list {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1px;
  justify-items: center;
  width: 100%;
  margin-bottom: 2px;
}

@media (min-width: 450px) {
  .buff-list {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (min-width: 900px) {
  .buff-list {
    grid-template-columns: repeat(3, 1fr);
  }
}
@media (min-width: 1350px) {
  .buff-list {
    grid-template-columns: repeat(4, 1fr);
  }
}

.level-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: none;
  background-image: none;
  border-radius: 5px;
  border: 1px solid #ccc;
  padding: 1px 8px;
  font-size: 0.9em;
  min-width: 48px;
  max-width: 60px;
  margin: 0;
}
.level-select::-ms-expand {
  display: none;
}
.level-select:focus {
  outline: none;
  border-color: #66afe9;
  box-shadow: 0 0 8px rgba(102, 175, 233, 0.6);
}
</style>
