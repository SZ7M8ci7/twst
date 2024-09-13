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
      <div class="character-item">
      <v-checkbox v-model="selectedType" value="バランス" :label="t('filterModal.balance')" hide-details />
      </div>
      <div class="character-item">
        <v-checkbox v-model="selectedType" value="ディフェンス" :label="t('filterModal.defence')" hide-details />
      </div>
      <div class="character-item">
        <v-checkbox v-model="selectedType" value="アタック" :label="t('filterModal.attack')" hide-details />
      </div>
      <div class="character-item">
      <v-checkbox v-model="selectedAttr" value="火" :label="t('filterModal.fire')" hide-details />
      </div>
      <div class="character-item">
        <v-checkbox v-model="selectedAttr" value="水" :label="t('filterModal.water')" hide-details />
      </div>
      <div class="character-item">
        <v-checkbox v-model="selectedAttr" value="木" :label="t('filterModal.flora')" hide-details />
      </div>
      <div class="character-item">
        <v-checkbox v-model="selectedAttr" value="無" :label="t('filterModal.cosmic')" hide-details />
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
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('others')">{{ isGroupFullySelected('others') ? t('filterModal.release') : t('filterModal.select')
          }}</v-btn>
        <div class="character-items">
          <div v-for="character in others" :key="character.name" class="character-item">
            <v-checkbox v-model="selectedCharacters" :value="character.value" :label="character.name" hide-details />
          </div>
        </div>
      </div>
    </div>
    <hr class="rare-divider" />
    <div class="character-list">
      <div class="select-all-container">
        <v-btn small @click="toggleSelectAll('effects')">{{ isGroupFullySelected('effects') ? t('filterModal.release') : t('filterModal.select')
          }}</v-btn>
        <div class="character-items">
          <div v-for="effect in effects" :key="effect.name" class="character-item">
            <v-checkbox v-model="selectedEffects" :value="effect.value" :label="effect.name" hide-details />
          </div>
        </div>
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
import { useFilterdStore } from '@/store/filterd';
import { storeToRefs } from 'pinia';
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const filterdStore = useFilterdStore();
const { tempSelectedCharacters, tempSelectedRare, tempSelectedType, tempSelectedAttr, tempSelectedEffects ,isFirst } = storeToRefs(filterdStore);


const selectedCharacters = ref<string[]>([]);
const selectedRare = ref<string[]>([]);
const selectedType = ref<string[]>([]);
const selectedAttr = ref<string[]>([]);
const selectedEffects = ref<string[]>([]);
const emit = defineEmits(['close']);

const heartslabyulsButtonLabel = ref(t('filterModal.select'));
const savanaclawsButtonLabel = ref(t('filterModal.select'));
const octavinellesButtonLabel = ref(t('filterModal.select'));
const scarabiasButtonLabel = ref(t('filterModal.select'));
const pomefioresButtonLabel = ref(t('filterModal.select'));
const ignihydeseButtonLabel = ref(t('filterModal.select'));
const diasomniasButtonLabel = ref(t('filterModal.select'));
const othersButtonLabel = ref(t('filterModal.select'));
const effectsButtonLabel = ref(t('filterModal.select'));
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
const others = [
  { name: t('filterModal.grim'), value: 'グリム' },
  { name: t('filterModal.lolo'), value: 'ロロ' },
  { name: t('filterModal.crowley'), value: 'クロウリー' },
  { name: t('filterModal.crewel'), value: 'クルーウェル' },
  { name: t('filterModal.fellow'), value: 'フェロー' },
];
const effects = [
{ name: t('filterModal.power_boost'), value: 'ATKUP' },
  { name: t('filterModal.damage_boost'), value: 'ダメージUP' },
  { name: t('filterModal.critical'), value: 'クリティカル' },
  { name: t('filterModal.element_boost'), value: '属性ダメージUP' },
  { name: t('filterModal.damage_vulnerability'), value: '被ダメージUP' },
  { name: t('filterModal.power_cut'), value: 'ATKDOWN' },
  { name: t('filterModal.damage_cut'), value: 'ダメージDOWN' },
  { name: t('filterModal.evasion'), value: '回避' },
  { name: t('filterModal.element_cut'), value: '属性ダメージDOWN' },
  { name: t('filterModal.resistence'), value: '被ダメージDOWN' },
  { name: t('filterModal.hp_restoration'), value: 'HP回復' },
  { name: t('filterModal.hp_regen'), value: 'HP継続回復' },
  { name: t('filterModal.nullifies_blind'), value: '暗闇無効' },
  { name: t('filterModal.nullifies_curse'), value: '呪い無効' },
  { name: t('filterModal.nullifies_freeze'), value: '凍結無効' },
  { name: t('filterModal.debuff_removal'), value: 'デバフ解除' },
  { name: t('filterModal.curse'), value: '呪い' }
];
const students = [...heartslabyuls, ...savanaclaws, ...octavinelles, ...scarabias, ...pomefiores, ...ignihydese, ...diasomnias, ...others];

onMounted(() => {
  if (isFirst.value) {
    selectedCharacters.value = students.map(student => student.value).concat('その他').concat('Other');
    selectedRare.value = ['SSR','SR','R'];
    selectedType.value = ['バランス','ディフェンス','アタック'];
    selectedAttr.value = ['火','水','木','無'];
    selectedEffects.value = ['ATKUP','ダメージUP','クリティカル','属性ダメージUP','被ダメージUP','ATKDOWN','ダメージDOWN','回避','属性ダメージDOWN','被ダメージDOWN','HP回復','HP継続回復','暗闇無効','呪い無効','凍結無効','デバフ解除','呪い'];
  } else {
    // 一時保存されている選択状態を使用して復元
    if (tempSelectedCharacters.value.length > 0) {
      selectedCharacters.value = [...tempSelectedCharacters.value];
    } else {
      selectedCharacters.value = [];
    }

    if (tempSelectedRare.value.length > 0) {
      selectedRare.value = [...tempSelectedRare.value];
    } else {
      selectedRare.value = [];
    }

    if (tempSelectedType.value.length > 0) {
      selectedType.value = [...tempSelectedType.value];
    } else {
      selectedType.value = [];
    }

    if (tempSelectedAttr.value.length > 0) {
      selectedAttr.value = [...tempSelectedAttr.value];
    } else {
      selectedAttr.value = [];
    }

    if (tempSelectedEffects.value.length > 0) {
      selectedEffects.value = [...tempSelectedEffects.value];
    } else {
      selectedEffects.value = [];
    }
  }
  isFirst.value = false;
});


function applyFilter() {
  // 選択された項目を一時保存
  tempSelectedCharacters.value = [...selectedCharacters.value];
  tempSelectedRare.value = [...selectedRare.value];
  tempSelectedType.value = [...selectedType.value];
  tempSelectedAttr.value = [...selectedAttr.value];
  tempSelectedEffects.value = [...selectedEffects.value];

  const unselectedCharactersSet = new Set<string>();
  students.forEach(student => unselectedCharactersSet.add(student.value));

  students.forEach(student => {
    if (unselectedCharactersSet.has(student.value)) {
      if (selectedCharacters.value.includes(student.value)) {
        unselectedCharactersSet.delete(student.value);
      }
    }
  });

  characters.value.forEach(character => {
    // レア度チェック
    if (!selectedRare.value.includes(character.rare)) {
      character.visible = false;
      return
    }
    // キャラチェック
    if (selectedCharacters.value.includes(character.chara)) {
      character.visible = true;
    } else if (unselectedCharactersSet.has(character.chara)) {
      character.visible = false;
      return
    } else if (selectedCharacters.value.includes('その他')) {
      character.visible = true;
    } else {
      character.visible = false;
      return
    }
    // タイプチェック
    if (!selectedType.value.includes(character.attr)) {
      character.visible = false;
      return
    }
    // 属性チェック
    if ((!selectedAttr.value.includes(character.magic1atr))
      && (!selectedAttr.value.includes(character.magic2atr))
      && (!selectedAttr.value.includes(character.magic3atr))) {
      character.visible = false;
      return
    }
    // 効果チェック
    if (selectedEffects.value.length === 17) {
      // 効果が全件選択されている場合は無条件でtrue
      character.visible = true;
    } else {
      // 効果が16件以下の場合、character.etcに選択された効果が含まれているかをチェック
      const effectMatched = selectedEffects.value.some(effect => character.etc.includes(effect));
      if (!effectMatched) {
        character.visible = false;
        return;
      }
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
  } else if (group === 'others') {
    toggleGroupSelection(others, othersButtonLabel);
  } else if (group === 'effects') {
    toggleEffectSelection(effects, effectsButtonLabel);
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
function toggleEffectSelection(group: { name: string; value: string }[], buttonLabel: any) {
  const allSelected = group.every(effect => selectedEffects.value.includes(effect.value));
  if (allSelected) {
    selectedEffects.value = selectedEffects.value.filter(effect => !group.some(c => c.value === effect));
    buttonLabel.value = t('filterModal.select');
  } else {
    selectedEffects.value = [...new Set([...selectedEffects.value, ...group.map(c => c.value)])];
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
  } else if (group === 'effects') {
    characters = effects;
    return characters.every(character => selectedEffects.value.includes(character.value));
  }

  return characters.every(character => selectedCharacters.value.includes(character.value));
}
</script>

<style scoped>
.select-all-container {
  display: flex;
  align-items: center;
  margin-bottom: 0px;
}

.character-items {
  display: flex;
  flex-wrap: wrap;
}

.character-list > .character-item {
  display: inline-flex;
  align-items: center;
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
  margin-bottom: 2px; /* 区切り線と下の要素とのスペースを確保 */
}
</style>