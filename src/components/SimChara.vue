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
              <input type="number" v-model="simulatorStore.deckCharacters[props.charaIndex].level" @input=" simulatorStore.updateLevel(charaIndex)" class="stat-input" />
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
              <v-col cols="3">
                <button :class="{'mbutton': true, 'selected': simulatorStore.deckCharacters[props.charaIndex][`isM${index}Selected`], 'shake': shakingStates[`isM${index}Shaking`]}" @click="toggleM(index)">M{{ index }}</button>
              </v-col>
              <v-col cols="3">
                <ElementDropdown :chara-index="props.charaIndex" :element-index="index"/>
              </v-col>
              <v-col cols="6">
                <MagicDropdown :chara-index="props.charaIndex" :element-index="index"/>
              </v-col>
            </v-row>
          </div>
        </v-col>


        <v-col cols="2" class="center">
          <div class="buttons-section">
            <button class="buff-btn"  @click="addBuff">バフ<br>追加</button>
            <button class="details-btn">詳細<br>編集</button>
          </div>
        </v-col>
      </v-row>
    </div>
    <div>
      <v-row dense>
        <v-col cols="12" v-for="(buff, index) in buffs" :key="index">
          <div class="buff-section">
            <v-row dense>
              <v-col cols="6" class="center" style="padding: 1px;">
                <BuffDropdown/>
              </v-col>
              <v-col cols="6" class="center" style="padding: 1px;">
                <BuffDropdown/>
              </v-col>
            </v-row>
          </div>
        </v-col>
      </v-row>
    </div>
    <SimCharaModal v-if="isCharaModalOpen" @close="closeCharaModal" @select="selectCharaImage" />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import defaultImg from '@/assets/img/default.png';
import ElementDropdown from './ElementDropdown.vue';
import SimCharaModal from './SimCharaModal.vue';
import MagicDropdown from './MagicDropdown.vue';
import BuffDropdown from './BuffDropdown.vue';
import { useSimulatorStore } from '@/store/simulatorStore';
const simulatorStore = useSimulatorStore();


const imgpath = ref(defaultImg);
const props = defineProps(['charaIndex']);

onMounted(() => {
  console.log(simulatorStore);
});


// SimCharaModalの制御
const isCharaModalOpen = ref(false);

// Modalを開く
const openCharaModal = () => {
  isCharaModalOpen.value = true;
};

// Modalを閉じる
const closeCharaModal = () => {
  isCharaModalOpen.value = false;
};

const levelDict = {'R':70,'SR':90,'SSR':110}
// 画像を選択したときに呼ばれる
const selectCharaImage = async (character) => {
  simulatorStore.deckCharacters[props.charaIndex] = JSON.parse(JSON.stringify(character));
  simulatorStore.deckCharacters[props.charaIndex].level = levelDict[simulatorStore.deckCharacters[props.charaIndex].rare];
  simulatorStore.deckCharacters[props.charaIndex].isM1Selected = true;
  simulatorStore.deckCharacters[props.charaIndex].isM2Selected = true;
  simulatorStore.deckCharacters[props.charaIndex].isM3Selected = false;
  imgpath.value = character.imgUrl;
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
const buffs = ref([]);

const addBuff = () => {
  buffs.value.push({ name: '', value: 0 });
};


const toggleBonus = () => {
  isBonusSelected.value = !isBonusSelected.value;
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


</script>

<style scoped>
.component-container {
  align-items: center;
  border: 1px solid #ccc;
  padding: 1px;
  font-size: 0.7em;
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
  margin-bottom: 1px;
}

.buff-input {
  margin-left: 10px;
  margin-right: 10px;
  border: 1px solid #ccc;
  width: 100px;
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
</style>
