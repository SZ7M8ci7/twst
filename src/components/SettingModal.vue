<template>
  <div class="modal-background">
    <v-card-title>{{ $t('settingModal.sortSettings') }}</v-card-title>
      <v-card-text class="ma-0 pa-0">
        <div v-for="(option, index) in sortOptions" :key="index" class="ma-0 pa-0 sort-option">
          <span class="sort-rank">{{ index + 1 }}.</span>
          <v-select
            v-model="option.prop"
            :items="availableSortProps"
            :label="$t('settingModal.sortKey')"
            item-text="prop"
            item-value="value"
            class="ma-0 pa-0"
            hide-details
            dense
          ></v-select>
          <v-select
            v-model="option.order"
            :items="[$t('settingModal.asc'), $t('settingModal.desc')]"
            :label="$t('settingModal.order')"
            class="ma-0 pa-0"
            hide-details
            dense
            style="max-width: 130px;"
          ></v-select>
          <v-btn icon @click="removeSortOption(index)" size="x-small">
            <v-icon>mdi-minus</v-icon>
          </v-btn>
        </div>
        <div class="add-button-container">
          <v-btn icon fab @click="addSortOption" size="x-small"><v-icon>mdi-plus</v-icon></v-btn>
        </div>

      </v-card-text>
      <v-card-title class="mt-0 pt-0">{{ $t('settingModal.minimumValueSetting') }}</v-card-title>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumEHP') }}</span>
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
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumHP') }}</span>
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
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumHPBuddy') }}</span>
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
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumEvasion') }}</span>
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
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumDuo') }}</span>
        <v-text-field
            type="number"
            v-model="minDuo"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumNeutralDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumAdvantageDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceAdvantageDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumAgainstFireDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceVsHiDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumAgainstWaterDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceVsMizuDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.minimumAgainstFloraDamage') }}</span>
        <v-text-field
            type="number"
            v-model="minReferenceVsKiDamage"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="0"
          />
      </v-card-text>
    <v-card-title>{{ $t('settingModal.searchSettings') }}</v-card-title>
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.maximumResult') }}</span>
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
      <v-card-text class="sort-option ma-0 pa-0">
        <span class="min-label">{{ $t('settingModal.attackNum') }}</span>
        <v-text-field
            type="number"
            v-model="attackNum"
            class="mt-0 pt-0"
            hide-details="auto"
            dense
            solo
            :min="1"
            :max="10"
          />
      </v-card-text>
      <v-card-text class="sort-option mt-2 mb-2 pa-0">
        <span class="min-label mt-0 pa-0">{{ $t('settingModal.allowSameCharacter') }}</span>
        <v-radio-group v-model="allowSameCharacter" class="ma-0 pa-0" inline hide-details>
          <v-radio :label="$t('settingModal.yes')" :value="true" ></v-radio>
          <v-radio :label="$t('settingModal.no')" :value="false"></v-radio>
        </v-radio-group>
      </v-card-text>
    <div class="button-container">
      <v-btn class="button" @click="cancel">{{ $t('settingModal.cancel') }}</v-btn>
      <v-btn class="button apply-button" @click="applyFilter" :disabled="sortOptions.length==0">{{ $t('settingModal.ok') }}</v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSearchSettingsStore } from '@/store/searchSetting';
import { onBeforeMount } from 'vue';
import { cloneDeep } from 'lodash';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { getAvailableSortProps } from '@/components/common'
const searchSettingsStore = useSearchSettingsStore();
const minEHP = ref(searchSettingsStore.minEHP);
const minHP = ref(searchSettingsStore.minHP);
const minHPBuddy = ref(searchSettingsStore.minHPBuddy);
const minEvasion = ref(searchSettingsStore.minEvasion);
const minDuo = ref(searchSettingsStore.minDuo);
const minReferenceDamage = ref(searchSettingsStore.minReferenceDamage);
const minReferenceAdvantageDamage = ref(searchSettingsStore.minReferenceAdvantageDamage);
const minReferenceVsHiDamage = ref(searchSettingsStore.minReferenceVsHiDamage);
const minReferenceVsMizuDamage = ref(searchSettingsStore.minReferenceVsMizuDamage);
const minReferenceVsKiDamage = ref(searchSettingsStore.minReferenceVsKiDamage);
const maxResult = ref(searchSettingsStore.maxResult)
const attackNum = ref(searchSettingsStore.attackNum)
let initialSortOptions: any = undefined;
let sortOptions = ref();

const availableSortProps = getAvailableSortProps(t);
onBeforeMount(()=>{
  // sortOptionsの初期状態を保持するためのリアクティブな参照
  initialSortOptions = cloneDeep(searchSettingsStore.sortOptions);
  // ユーザーによる変更を保持するためのリアクティブな参照
  sortOptions = ref(cloneDeep(initialSortOptions));
})

const allowSameCharacter = ref(searchSettingsStore.allowSameCharacter);


function addSortOption() {
  sortOptions.value.push({ prop: '', order: t('settingModal.desc') });
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
    minDuo: minDuo.value,
    minReferenceDamage: minReferenceDamage.value,
    minReferenceAdvantageDamage: minReferenceAdvantageDamage.value,
    minReferenceVsHiDamage: minReferenceVsHiDamage.value,
    minReferenceVsMizuDamage: minReferenceVsMizuDamage.value,
    minReferenceVsKiDamage: minReferenceVsKiDamage.value,
    sortOptions: sortOptions.value,
    maxResult: maxResult.value,
    attackNum: attackNum.value,
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
  max-height: 95vh; /* Maximum height - 80% of the viewport height */
  overflow-y: auto; /* Enable vertical scrolling if content overflows */
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
.add-button-container {
  display: flex;
  justify-content: center; /* Center the button horizontally */
  padding: 0px 0px 5px 0px; /* Add some padding above and below the button */
}

</style>