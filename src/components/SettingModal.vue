<template>
  <div class="modal-background">
    <v-card-title>ソート設定</v-card-title>
      <v-card-text>
        <div v-for="(option, index) in sortOptions" :key="index" class="my-2 sort-option">
          <span class="sort-rank">{{ index + 1 }}.</span>
          <v-select
            v-model="option.prop"
            :items="availableSortProps"
            label="ソートキー"
            item-text="prop"
            item-value="value"
            hide-details
            dense
          ></v-select>
          <v-select
            v-model="option.order"
            :items="['昇順', '降順']"
            label="順序"
            hide-details
            dense
            style="max-width: 130px;"
          ></v-select>
          <v-btn icon @click="removeSortOption(index)">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
        <v-btn @click="addSortOption">ソート条件を追加</v-btn>
      </v-card-text>
      <v-card-title>最低値設定</v-card-title>
      <v-card-text class="sort-option">
        <span class="min-label">最低実質HP</span>
        <v-text-field
            type="number"
            v-model="minEHP"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option">
        <span class="min-label">最低実HP</span>
        <v-text-field
            type="number"
            v-model="minHP"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option">
        <span class="min-label">最低HPバディ数</span>
        <v-text-field
            type="number"
            v-model="minHPBuddy"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option">
        <span class="min-label">最低回避数</span>
        <v-text-field
            type="number"
            v-model="minEvasion"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
    <v-card-title>検索設定</v-card-title>
      <v-card-text class="sort-option">
        <span class="min-label">結果上限数</span>
        <v-text-field
            type="number"
            v-model="maxResult"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option">
        <span class="min-label">同キャラを許可</span>
        <v-radio-group v-model="allowSameCharacter" class="mt-0 pt-0" inline>
          <v-radio label="はい" :value="true"></v-radio>
          <v-radio label="いいえ" :value="false"></v-radio>
        </v-radio-group>
      </v-card-text>
    <div class="button-container">
      <v-btn class="button" @click="cancel">キャンセル</v-btn>
      <v-btn class="button apply-button" @click="applyFilter" :disabled="sortOptions.length==0">決定</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { onBeforeMount } from 'vue';
import { cloneDeep } from 'lodash';
import { availableSortProps } from '@/components/common'
const searchSettingsStore = useSearchSettingsStore();
const minEHP = ref(searchSettingsStore.minEHP);
const minHP = ref(searchSettingsStore.minHP);
const minHPBuddy = ref(searchSettingsStore.minHPBuddy);
const minEvasion = ref(searchSettingsStore.minEvasion);
const maxResult = ref(searchSettingsStore.maxResult)
let initialSortOptions: any = undefined;
let sortOptions = ref();

onBeforeMount(()=>{
  // sortOptionsの初期状態を保持するためのリアクティブな参照
  initialSortOptions = cloneDeep(searchSettingsStore.sortOptions);
  // ユーザーによる変更を保持するためのリアクティブな参照
  sortOptions = ref(cloneDeep(initialSortOptions));
})

const allowSameCharacter = ref(searchSettingsStore.allowSameCharacter);


function addSortOption() {
  sortOptions.value.push({ prop: '', order: '降順' });
}

function removeSortOption(index:number) {
  sortOptions.value.splice(index, 1);
}
const emit = defineEmits(['close']);

function applyFilter() {
  searchSettingsStore.updateSearchSettings({
    minEHP: minEHP.value,
    minHP: minHP.value,
    minHPBuddy: minHPBuddy.value,
    minEvasion: minEvasion.value,
    sortOptions: sortOptions.value,
    maxResult: maxResult.value,
    allowSameCharacter: allowSameCharacter.value,
  });
  emit('close'); // モーダルを閉じる
}
// キャンセルを押した場合、sortOptionsを元の状態に戻す
function cancel() {
  searchSettingsStore.sortOptions = [...initialSortOptions]; 
  emit('close'); // モーダルを閉じる
}
</script>
<style scoped>
.character-list > .character-item {
  display: inline-flex; /* or 'inline-block' */
  align-items:center;
  width: 110px;
  text-align: left;
}

.modal-background {
  background-color: white;
  padding: 20px; /* パディングを調整 */
  border-radius: 8px; /* 角を丸くする */
}

.button-container {
  display: flex;
  gap: 10px; /* ボタン間のスペース */
  justify-content: center;
  padding-top: 14px;
}

.button, .apply-button {
  width: 150px; /* ボタンの幅を統一 */
}

.apply-button {
  background-color: #19d241;
  color: white;
}
.sort-option {
  display: flex;
  align-items: center; /* 中央揃え */
  gap: 10px; /* 要素間のスペース */
}
.min-label {
  min-width: 120px;
}
::v-deep .v-card-text {
  padding: 5px;
}
</style>