<template>
  <!-- ロード中に表示するロードスクリーン -->
  <div v-if="loadingImgUrl" class="text-center">
    <v-progress-circular indeterminate></v-progress-circular>
    <p>Loading...</p>
  </div>

  <!-- ロード完了後に表示するメインコンテンツ -->
  <div v-else>
  <v-container class="container">
    <v-row class="controls-container" no-gutters>
      <v-col class="controls-search flex-grow-1">
        <v-text-field
          v-model="search"
          label="Search"
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          hide-details
          single-line
          style="max-height: 60px">
        </v-text-field>
      </v-col>
      <v-col cols="auto" class="controls-toggle d-flex justify-end align-center">
        <v-switch
          v-model="useHandCollectionFilter"
          :label="t('data.useHandCollection')"
          density="compact"
          hide-details
          inset
          :color="useHandCollectionFilter ? 'success' : 'grey'"
        />
      </v-col>
      <v-col cols="auto" class="controls-download d-flex justify-end">
        <v-btn color="green" @click="exportToExcel">{{ t('data.downloadExcel') }}</v-btn>
      </v-col>
    </v-row>



      <v-card style="overflow-x: auto;">
        <v-data-table :headers="headers" :items="visibleCharacters" class="elevation-1" :items-per-page="-1"
          :search="search" style="max-height: calc(100vh - 250px); overflow-y: auto;" :hide-default-footer="true"
          fixed-header :mobile-breakpoint="0">
          <!-- level列のカスタムテンプレート定義 -->
          <template v-slot:[`item.type`]="{ item }">
            <div class="text-no-wrap">{{ item.type }}</div>
          </template>
          <template v-slot:[`item.buddy1s`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy1s) }}</div>
          </template>
          <template v-slot:[`item.buddy1s_totsu`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy1s_totsu) }}</div>
          </template>
          <template v-slot:[`item.buddy2s`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy2s) }}</div>
          </template>
          <template v-slot:[`item.buddy2s_totsu`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy2s_totsu) }}</div>
          </template>
          <template v-slot:[`item.buddy3s`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy3s) }}</div>
          </template>
          <template v-slot:[`item.buddy3s_totsu`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy3s_totsu) }}</div>
          </template>
          <template v-slot:[`item.name`]="{ item }">
            <LazyCharacterImage
              :src="item.imgUrl || defaultImg"
              :alt="item.name"
              class="character-image"
            />
          </template>
        </v-data-table>
      </v-card>
    </v-container>

  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useCharacterStore } from '@/store/characters';
import { useHandCollectionStore } from '@/store/handCollection';
import { storeToRefs } from 'pinia';
import { hydrateCharacterImageUrls } from '@/utils/characterAssets';
import { applyDefaultSort } from '@/utils/sortUtils';
import { useI18n } from 'vue-i18n';
import {
  localizeCharacterName,
  localizeCostumeName,
  localizeGameText,
} from '@/utils/localizedDisplay';
import defaultImg from '@/assets/img/default.webp';
import LazyCharacterImage from '@/components/LazyCharacterImage.vue';
const characterStore = useCharacterStore();
const handCollectionStore = useHandCollectionStore();
const { characters } = storeToRefs(characterStore);
const { t, locale } = useI18n();
const loadingImgUrl = ref(true);
const useHandCollectionFilter = ref(false);

function getTypeFromAttr(attr: string) {
  switch (attr) {
    case 'アタック':
      return 'ATK';
    case 'バランス':
      return 'BAL';
    case 'ディフェンス':
      return 'DEF';
    default:
      return attr ? attr.substring(0, 3).toUpperCase() : '';
  }
}

// visibleプロパティがtrueのキャラクターだけを表示（レアリティ・実装日順でソート）
const visibleCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }
  const filteredCharacters = characters.value.filter(character => {
    if (!character.visible || !character.imgUrl) {
      return false;
    }
    if (!useHandCollectionFilter.value) {
      return true;
    }
    const handCard = handCollectionStore.getHandCard(character.name);
    return handCard.isOwned;
  });
  return applyDefaultSort(filteredCharacters).map(character => ({
    ...character,
    chara: localizeCharacterName(character.chara, locale.value),
    costume: localizeCostumeName(character, locale.value),
    type: getTypeFromAttr(character.attr),
    growtype: localizeGameText(character.growtype, locale.value),
    duo: localizeCharacterName(character.duo, locale.value),
    magic1atr: localizeGameText(character.magic1atr, locale.value),
    magic1pow: localizeGameText(character.magic1pow, locale.value),
    magic1buf: localizeGameText(character.magic1buf, locale.value),
    magic1heal: localizeGameText(character.magic1heal, locale.value),
    magic2atr: localizeGameText(character.magic2atr, locale.value),
    magic2pow: localizeGameText(character.magic2pow, locale.value),
    magic2buf: localizeGameText(character.magic2buf, locale.value),
    magic2heal: localizeGameText(character.magic2heal, locale.value),
    magic3atr: localizeGameText(character.magic3atr, locale.value),
    magic3pow: localizeGameText(character.magic3pow, locale.value),
    magic3buf: localizeGameText(character.magic3buf, locale.value),
    magic3heal: localizeGameText(character.magic3heal, locale.value),
    buddy1c: localizeCharacterName(character.buddy1c, locale.value),
    buddy1s: localizeGameText(character.buddy1s, locale.value),
    buddy1s_totsu: localizeGameText(character.buddy1s_totsu, locale.value),
    buddy2c: localizeCharacterName(character.buddy2c, locale.value),
    buddy2s: localizeGameText(character.buddy2s, locale.value),
    buddy2s_totsu: localizeGameText(character.buddy2s_totsu, locale.value),
    buddy3c: localizeCharacterName(character.buddy3c, locale.value),
    buddy3s: localizeGameText(character.buddy3s, locale.value),
    buddy3s_totsu: localizeGameText(character.buddy3s_totsu, locale.value),
    etc: localizeGameText(character.etc, locale.value),
  }));
});
const search = ref('');
const headers = computed(() => [
  { title: t('data.headers.card'), value: 'name', sortable: false, width: 78 },
  { title: t('data.headers.name'), value: 'chara', sortable: true  },
  { title: t('data.headers.costume'), value: 'costume', sortable: true  },
  { title: t('data.headers.rarity'), value: 'rare', sortable: true  },
  { title: t('data.headers.type'), value: 'type', sortable: true },
  { title: t('data.headers.growthType'), value: 'growtype', sortable: true  },
  { title: 'HP', value: 'hp', sortable: true  },
  { title: 'ATK', value: 'atk', sortable: true  },
  { title: t('data.headers.duo'), value: 'duo', sortable: true  },
  { title: 'M1', value: 'magic1atr', sortable: true  },
  { title: t('data.headers.magicType', { magic: 'M1' }), value: 'magic1pow', sortable: true  },
  { title: t('data.headers.magicBuff', { magic: 'M1' }), value: 'magic1buf', sortable: true  },
  { title: t('data.headers.magicHeal', { magic: 'M1' }), value: 'magic1heal', sortable: true  },
  { title: 'M2', value: 'magic2atr', sortable: true  },
  { title: t('data.headers.magicType', { magic: 'M2' }), value: 'magic2pow', sortable: true  },
  { title: t('data.headers.magicBuff', { magic: 'M2' }), value: 'magic2buf', sortable: true  },
  { title: t('data.headers.magicHeal', { magic: 'M2' }), value: 'magic2heal', sortable: true  },
  { title: 'M3', value: 'magic3atr', sortable: true  },
  { title: t('data.headers.magicType', { magic: 'M3' }), value: 'magic3pow', sortable: true  },
  { title: t('data.headers.magicBuff', { magic: 'M3' }), value: 'magic3buf', sortable: true  },
  { title: t('data.headers.magicHeal', { magic: 'M3' }), value: 'magic3heal', sortable: true  },
  { title: t('data.headers.buddy', { number: 1 }), value: 'buddy1c', sortable: true  },
  { title: t('data.headers.buddy', { number: 1 }), value: 'buddy1s', sortable: true  },
  { title: t('data.headers.buddyLimit', { number: 1 }), value: 'buddy1s_totsu', sortable: true  },
  { title: t('data.headers.buddy', { number: 2 }), value: 'buddy2c', sortable: true  },
  { title: t('data.headers.buddy', { number: 2 }), value: 'buddy2s', sortable: true  },
  { title: t('data.headers.buddyLimit', { number: 2 }), value: 'buddy2s_totsu', sortable: true  },
  { title: t('data.headers.buddy', { number: 3 }), value: 'buddy3c', sortable: true  },
  { title: t('data.headers.buddy', { number: 3 }), value: 'buddy3s', sortable: true  },
  { title: t('data.headers.buddyLimit', { number: 3 }), value: 'buddy3s_totsu', sortable: true  },
  { title: t('data.headers.other'), value: 'etc', sortable: false  },
]);
import * as XLSX from 'xlsx';

const exportToExcel = () => {
  const data = visibleCharacters.value.map(character => ({
    [t('data.headers.name')]: character.chara,
    [t('data.headers.costume')]: character.costume,
    [t('data.headers.rarity')]: character.rare,
    [t('data.headers.type')]: character.type,
    [t('data.headers.growthType')]: character.growtype,
    HP: character.hp,
    ATK: character.atk,
    [t('data.headers.duo')]: character.duo,
    [t('data.headers.attribute', { magic: 'M1' })]: character.magic1atr,
    [t('data.headers.magicType', { magic: 'M1' })]: character.magic1pow,
    [t('data.headers.magicBuff', { magic: 'M1' })]: character.magic1buf,
    [t('data.headers.magicHeal', { magic: 'M1' })]: character.magic1heal,
    [t('data.headers.attribute', { magic: 'M2' })]: character.magic2atr,
    [t('data.headers.magicType', { magic: 'M2' })]: character.magic2pow,
    [t('data.headers.magicBuff', { magic: 'M2' })]: character.magic2buf,
    [t('data.headers.magicHeal', { magic: 'M2' })]: character.magic2heal,
    [t('data.headers.attribute', { magic: 'M3' })]: character.magic3atr,
    [t('data.headers.magicType', { magic: 'M3' })]: character.magic3pow,
    [t('data.headers.magicBuff', { magic: 'M3' })]: character.magic3buf,
    [t('data.headers.magicHeal', { magic: 'M3' })]: character.magic3heal,
    [t('data.headers.buddy', { number: 1 })]: character.buddy1c,
    [t('data.headers.buddySkill', { number: 1 })]: character.buddy1s,
    [t('data.headers.buddyLimitSkill', { number: 1 })]: character.buddy1s_totsu,
    [t('data.headers.buddy', { number: 2 })]: character.buddy2c,
    [t('data.headers.buddySkill', { number: 2 })]: character.buddy2s,
    [t('data.headers.buddyLimitSkill', { number: 2 })]: character.buddy2s_totsu,
    [t('data.headers.buddy', { number: 3 })]: character.buddy3c,
    [t('data.headers.buddySkill', { number: 3 })]: character.buddy3s,
    [t('data.headers.buddyLimitSkill', { number: 3 })]: character.buddy3s_totsu,
    [t('data.headers.other')]: character.etc
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Characters');
  XLSX.writeFile(workbook, 'characters_data.xlsx');
};

// Method to replace "UP" with an empty string for display purposes
const formatBuddy = (value: string) => {
  return value.replace(/UP/g, '');
};

onBeforeMount(() => {
  void hydrateCharacterImageUrls(characters.value, 'name', { fallbackName: 'notyet' })
    .finally(() => {
      loadingImgUrl.value = false;
    });
});
</script>
<style scoped>
.character-image {
  width: 45px;
  height: 45px;
  border-radius: 4px;
  object-fit: cover;
  display: block;
  margin: 0 auto;
}

.table-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.controls-container {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  align-items: center;
}
.controls-search {
  min-width: 200px;
}
.container {
  height: 100vh;
  padding: 0;
  margin: 0;
}
.v-data-table :deep(tbody tr td) {
  white-space: nowrap;
  border-left: 1px solid #ddd;
  border-right: 1px solid #ddd;
}
.v-data-table :deep(thead th) {
  white-space: nowrap;
  border-left: 1px solid #ddd;
  border-right: 1px solid #ddd;
}
.v-data-table :deep(thead th:first-child),
.v-data-table :deep(tbody tr td:first-child) {
  width: 78px;
  min-width: 78px;
  max-width: 78px;
}
.v-data-table :deep(.v-data-table-footer) {
   display: none; /* NOTE: フッタを非表示にする為 */
}

@media (max-width: 600px) {
  .controls-container {
    flex-wrap: wrap;
    gap: 8px;
  }

  .controls-search {
    flex: 1 1 100%;
    min-width: 0;
  }

  .controls-toggle,
  .controls-download {
    flex: 1 1 100%;
    justify-content: flex-start !important;
  }

  .controls-download :deep(.v-btn) {
    width: 100%;
  }
}
</style>
