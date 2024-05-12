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
        <v-btn small @click="toggleSelectAll('heartslabyuls')">{{ isGroupFullySelected('heartslabyuls') ? t('filterModal.release') : t('filterModal.select')
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in heartslabyuls" :key="character.name" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character.value" :label="character.name" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('savanaclaws')">{{ isGroupFullySelected('savanaclaws') ? t('filterModal.release') : t('filterModal.select')
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in savanaclaws" :key="character.name" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character.value" :label="character.name" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('octavinelles')">{{ isGroupFullySelected('octavinelles') ? t('filterModal.release') : t('filterModal.select')
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in octavinelles" :key="character.name" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character.value" :label="character.name" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('scarabias')">{{ isGroupFullySelected('scarabias') ? t('filterModal.release') : t('filterModal.select') }}</v-btn>
        <div class="character-items">
          <div v-for="character in scarabias" :key="character.name" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character.value" :label="character.name" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('pomefiores')">{{ isGroupFullySelected('pomefiores') ? t('filterModal.release') : t('filterModal.select')
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in pomefiores" :key="character.name" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character.value" :label="character.name" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('ignihydese')">{{ isGroupFullySelected('ignihydese') ? t('filterModal.release') : t('filterModal.select')
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in ignihydese" :key="character.name" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character.value" :label="character.name" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('diasomnias')">{{ isGroupFullySelected('diasomnias') ? t('filterModal.release') : t('filterModal.select')
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in diasomnias" :key="character.name" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character.value" :label="character.name" hide-details />
          </div>
        </div>
      </div>
    </div>
    <div class="character-list">
      <div class="character-item">
        <v-checkbox v-model="selectedCharacters" value="その他" :label="t('filterModal.other')" hide-details />
      </div>
    </div>
    <!-- ボタンのコンテナ -->
    <div class="button-container">
      <v-btn class="button" @click="$emit('close')">{{ $t('filterModal.cancel') }}</v-btn>
      <v-btn class="button apply-button" :disabled="selectedCharacters.length === 0 || selectedRare.length === 0"
        @click="applyFilter">{{ $t('filterModal.submit') }}</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const selectedCharacters = ref<string[]>([]);
const selectedRare = ref<string[]>([]);
const emit = defineEmits(['close']);

const heartslabyulsButtonLabel = ref(t('filterModal.select'));
const savanaclawsButtonLabel = ref(t('filterModal.select'));
const octavinellesButtonLabel = ref(t('filterModal.select'));
const scarabiasButtonLabel = ref(t('filterModal.select'));
const pomefioresButtonLabel = ref(t('filterModal.select'));
const ignihydeseButtonLabel = ref(t('filterModal.select'));
const diasomniasButtonLabel = ref(t('filterModal.select'));
// 選択可能なキャラクターのリスト
const heartslabyuls = [
  { name: t('filterModal.riddle'), value: 'リドル' },
  { name: t('filterModal.ace'), value: 'エース' },
  { name: t('filterModal.deuce'), value: 'デュース' },
  { name: t('filterModal.cater'), value: 'ケイト' },
  { name: t('filterModal.trey'), value: 'トレイ' }
];
const savanaclaws = [
  { name: t('filterModal.leona'), value: 'レオナ' },
  { name: t('filterModal.jack'), value: 'ジャック' },
  { name: t('filterModal.ruggie'), value: 'ラギー' }
];
const octavinelles = [
  { name: t('filterModal.azul'), value: 'アズール' },
  { name: t('filterModal.jade'), value: 'ジェイド' },
  { name: t('filterModal.floyd'), value: 'フロイド' }
];
const scarabias = [
  { name: t('filterModal.kalim'), value: 'カリム' },
  { name: t('filterModal.jamil'), value: 'ジャミル' }
];
const pomefiores = [
  { name: t('filterModal.vil'), value: 'ヴィル' },
  { name: t('filterModal.epel'), value: 'エペル' },
  { name: t('filterModal.rook'), value: 'ルーク' }
];
const ignihydese = [
  { name: t('filterModal.idia'), value: 'イデア' },
  { name: t('filterModal.ortho'), value: 'オルト' }
];
const diasomnias = [
  { name: t('filterModal.malleus'), value: 'マレウス' },
  { name: t('filterModal.silver'), value: 'シルバー' },
  { name: t('filterModal.sebek'), value: 'セベク' },
  { name: t('filterModal.lilia'), value: 'リリア' }
];

const students = [...heartslabyuls, ...savanaclaws, ...octavinelles, ...scarabias, ...pomefiores, ...ignihydese, ...diasomnias];

onMounted(() => {
  const selectedCharactersSet = new Set<string>();
  const selectedRareSet = new Set<string>();
  characters.value.forEach(character => {
    if (character.visible) {
      selectedRareSet.add(character.rare);
      if (students.some(student => student.value === character.chara)) {
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
  students.forEach(student => unselectedCharactersSet.add(student.value));

  students.forEach(student => {
    if (unselectedCharactersSet.has(student.value)) {
      // 選択されたキャラクターを選択済みの集合に追加し、未選択から削除
      if (selectedCharacters.value.includes(student.value)) {
        unselectedCharactersSet.delete(student.value);
      }
    }
  });

  characters.value.forEach(character => {
    if (selectedRare.value.includes(character.rare)) {
      // character.charaがselectedCharactersに存在するかチェック
      if (selectedCharacters.value.includes(character.chara)) {
        character.visible = true;
      // character.charaがnotSelectedCharactersに存在するかチェック  
      } else if (unselectedCharactersSet.has(character.chara)) {
        character.visible = false;
      // どちらにも属さない場合、"その他"がselectedCharactersに含まれているかで決定
      } else {
        character.visible = selectedCharacters.value.includes('その他');
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

function toggleGroupSelection(group: { name: string; value: string }[], buttonLabel: any) {
  const allSelected = group.every(character => selectedCharacters.value.includes(character.value));
  if (allSelected) {
    selectedCharacters.value = selectedCharacters.value.filter(character => !group.some(c => c.value === character));
    buttonLabel.value = t('filterModal.select');
  } else {
    selectedCharacters.value = [...new Set([...selectedCharacters.value, ...group.map(c => c.value)])];
    buttonLabel.value = t('filterModal.release');
  }
}

function isGroupFullySelected(group: string): boolean {
  let characters: { name: string; value: string }[] = [];

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

  return characters.every(character => selectedCharacters.value.includes(character.value));
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