<template>
  <div class="modal-background">
    <div class="character-list">
      <div class="character-item">
        <v-checkbox v-model="selectedRare" value="SSR" label="SSR" hide-details />
      </div>
      <div class="character-item">
        <v-checkbox v-model="selectedRare" value="SR" label="SR" hide-details />
      </div>
      <div class="character-item">
        <v-checkbox v-model="selectedRare" value="R" label="R" hide-details />
      </div>
    </div>
    <hr class="rare-divider" />
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('heartslabyuls')">{{ isGroupFullySelected('heartslabyuls') ? '解除' : '選択'
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in heartslabyuls" :key="character" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character" :label="character" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('savanaclaws')">{{ isGroupFullySelected('savanaclaws') ? '解除' : '選択'
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in savanaclaws" :key="character" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character" :label="character" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('octavinelles')">{{ isGroupFullySelected('octavinelles') ? '解除' : '選択'
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in octavinelles" :key="character" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character" :label="character" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('scarabias')">{{ isGroupFullySelected('scarabias') ? '解除' : '選択' }}</v-btn>
        <div class="character-items">
          <div v-for="character in scarabias" :key="character" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character" :label="character" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('pomefiores')">{{ isGroupFullySelected('pomefiores') ? '解除' : '選択'
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in pomefiores" :key="character" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character" :label="character" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('ignihydese')">{{ isGroupFullySelected('ignihydese') ? '解除' : '選択'
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in ignihydese" :key="character" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character" :label="character" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('diasomnias')">{{ isGroupFullySelected('diasomnias') ? '解除' : '選択'
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in diasomnias" :key="character" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character" :label="character" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="character-item">
        <v-checkbox v-model="selectedCharacters" value="その他" label="その他" hide-details />
      </div>
    </div>
    <!-- ボタンのコンテナ -->
    <div class="button-container">
      <v-btn class="button" @click="$emit('close')">キャンセル</v-btn>
      <v-btn class="button apply-button" :disabled="selectedCharacters.length === 0 || selectedRare.length === 0"
        @click="applyFilter">決定</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
import { onMounted, ref } from 'vue';

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const selectedCharacters = ref<string[]>([]);
const selectedRare = ref<string[]>([]);
const emit = defineEmits(['close']);

const heartslabyulsButtonLabel = ref('選択');
const savanaclawsButtonLabel = ref('選択');
const octavinellesButtonLabel = ref('選択');
const scarabiasButtonLabel = ref('選択');
const pomefioresButtonLabel = ref('選択');
const ignihydeseButtonLabel = ref('選択');
const diasomniasButtonLabel = ref('選択');
// 選択可能なキャラクターのリスト
const heartslabyuls = ['リドル', 'エース', 'デュース', 'ケイト', 'トレイ'];
const savanaclaws = ['レオナ', 'ジャック', 'ラギー'];
const octavinelles = ['アズール', 'ジェイド', 'フロイド'];
const scarabias = ['カリム', 'ジャミル'];
const pomefiores = ['ヴィル', 'エペル', 'ルーク'];
const ignihydese = ['イデア', 'オルト'];
const diasomnias = ['マレウス', 'シルバー', 'セベク', 'リリア'];
const students = [...heartslabyuls,...savanaclaws,...octavinelles,...scarabias,...pomefiores,...ignihydese,...diasomnias];
onMounted(() => {
  const selectedCharactersSet = new Set<string>();
  const selectedRareSet = new Set<string>();
  characters.value.forEach(character => {
    if (character.visible) {
      selectedRareSet.add(character.rare);
      if (students.includes(character.chara)){
        selectedCharactersSet.add(character.chara);
      } else {
        selectedCharactersSet.add('その他');
      }
    }
  })
  selectedCharacters.value = Array.from(selectedCharactersSet);
  selectedRare.value = Array.from(selectedRareSet);
});
function applyFilter() {
  const unselectedCharactersSet = new Set<string>();
  students.forEach(student => unselectedCharactersSet.add(student));

  students.forEach(student => {
    if (unselectedCharactersSet.has(student)) {
      // 選択されたキャラクターを選択済みの集合に追加し、未選択から削除
      if (selectedCharacters.value.includes(student)) {
        unselectedCharactersSet.delete(student);
      }
    }
  });
  characters.value.forEach(character => {
    if (selectedRare.value.includes(character.rare)){
      // character.charaがselectedCharactersに存在するかチェック
      if (selectedCharacters.value.includes(character.chara)) {
        character.visible = true;
      // character.charaがnotSelectedCharactersに存在するかチェック
      } else if (unselectedCharactersSet.has(character.chara)) {
        character.visible = false;
      // どちらにも属さない場合、"その他"がselectedCharactersに含まれているかで決定
      } else {
        character.visible = selectedCharacters.value.includes("その他");
      }
    } else {
      character.visible = false;
    }
  });
  emit('close'); // モーダルを閉じる
}
function toggleSelectAll(group: string) {
  if (group === 'heartslabyuls') {
    toggleGroupSelection(heartslabyuls, heartslabyulsButtonLabel);
  } else if (group === 'savanaclaws') {
    toggleGroupSelection(savanaclaws, savanaclawsButtonLabel);
  } else if (group === 'octavinelles') {
    toggleGroupSelection(octavinelles, octavinellesButtonLabel);
  } else if (group === 'scarabias') {
    toggleGroupSelection(scarabias, scarabiasButtonLabel);
  } else if (group === 'pomefiores') {
    toggleGroupSelection(pomefiores, pomefioresButtonLabel);
  } else if (group === 'ignihydese') {
    toggleGroupSelection(ignihydese, ignihydeseButtonLabel);
  } else if (group === 'diasomnias') {
    toggleGroupSelection(diasomnias, diasomniasButtonLabel);
  }
}

function toggleGroupSelection(group: string[], buttonLabel: any) {
  const allSelected = group.every(character => selectedCharacters.value.includes(character));
  if (allSelected) {
    selectedCharacters.value = selectedCharacters.value.filter(character => !group.includes(character));
    buttonLabel.value = '選択';
  } else {
    selectedCharacters.value = [...new Set([...selectedCharacters.value, ...group])];
    buttonLabel.value = '解除';
  }
}
function isGroupFullySelected(group: string): boolean {
  let characters: string[] = [];

  if (group === 'heartslabyuls') {
    characters = heartslabyuls;
  } else if (group === 'savanaclaws') {
    characters = savanaclaws;
  } else if (group === 'octavinelles') {
    characters = octavinelles;
  } else if (group === 'scarabias') {
    characters = scarabias;
  } else if (group === 'pomefiores') {
    characters = pomefiores;
  } else if (group === 'ignihydese') {
    characters = ignihydese;
  } else if (group === 'diasomnias') {
    characters = diasomnias;
  }

  return characters.every(character => selectedCharacters.value.includes(character));
}
</script>
<style scoped>
.select-all-container {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.character-items {
  display: flex;
  flex-wrap: wrap;
}

.character-list > .character-item {
  display: inline-flex;
  align-items: center;
  width: 110px;
  text-align: left;
}

.modal-background {
  background-color: white;
  padding: 20px; /* パディングを調整 */
  border-radius: 8px; /* 角を丸くする */
  max-height: 95vh; /* Maximum height - 80% of the viewport height */
  overflow-y: auto; /* Enable vertical scrolling if content overflows */
}

.button-container {
  display: flex;
  gap: 10px; /* ボタン間のスペース */
  justify-content: center;
}

.button, .apply-button {
  width: 150px; /* ボタンの幅を統一 */
}

.apply-button {
  background-color: #19d241;
  color: white;
}
.rare-divider {
  border: none; /* 既存のボーダースタイルを消去 */
  height: 1px; /* 線の厚み */
  background-color: #e0e0e0; /* 線の色 */
  width: 100%; /* 親要素の幅いっぱいに線を引く */
  margin-bottom: 20px; /* 区切り線と下の要素とのスペースを確保 */
}
</style>