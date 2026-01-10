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
        <v-btn color="green" @click="exportToExcel">Excelでダウンロード</v-btn>
      </v-col>
    </v-row>



      <v-card style="overflow-x: auto;">
        <v-data-table :headers="headers" :items="visibleCharacters" class="elevation-1" :items-per-page="-1"
          :search="search" style="max-height: calc(100vh - 250px); overflow-y: auto;" :hide-default-footer="true"
          fixed-header :mobile-breakpoint="0">
          <!-- level列のカスタムテンプレート定義 -->
          <template v-slot:[`item.type`]="{ item }">
            <div class="text-no-wrap">{{ item.growtype.slice(-3) }}</div>
          </template>
          <template v-slot:[`item.buddy1s`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy1s) }}</div>
          </template>
          <template v-slot:[`item.buddy2s`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy2s) }}</div>
          </template>
          <template v-slot:[`item.buddy3s`]="{ item }">
            <div class="text-no-wrap">{{ formatBuddy(item.buddy3s) }}</div>
          </template>
          <template v-slot:[`item.name`]="{ item }">
            <img :src="item.imgUrl" :alt="item.name" class="character-image" />
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
import { applyDefaultSort } from '@/utils/sortUtils';
import { useI18n } from 'vue-i18n';
const characterStore = useCharacterStore();
const handCollectionStore = useHandCollectionStore();
const { characters } = storeToRefs(characterStore);
const { t } = useI18n();
const loadingImgUrl = ref(true);
const useHandCollectionFilter = ref(false);
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
  return applyDefaultSort(filteredCharacters);
});
const search = ref('');
const headers = [
  { title: 'キャラ', value: 'name', sortable: false  },
  { title: '名前', value: 'chara', sortable: true  },
  { title: '衣装', value: 'costume', sortable: true  },
  { title: 'レア', value: 'rare', sortable: true  },
  { title: 'タイプ', value: 'type', sortable: true },
  { title: '非公式タイプ', value: 'growtype', sortable: true  },
  { title: 'HP', value: 'hp', sortable: true  },
  { title: 'ATK', value: 'atk', sortable: true  },
  { title: 'デュオ', value: 'duo', sortable: true  },
  { title: 'M1', value: 'magic1atr', sortable: true  },
  { title: 'M1種', value: 'magic1pow', sortable: true  },
  { title: 'M1バフ', value: 'magic1buf', sortable: true  },
  { title: 'M1回復', value: 'magic1heal', sortable: true  },
  { title: 'M2', value: 'magic2atr', sortable: true  },
  { title: 'M2種', value: 'magic2pow', sortable: true  },
  { title: 'M2バフ', value: 'magic2buf', sortable: true  },
  { title: 'M2回復', value: 'magic2heal', sortable: true  },
  { title: 'M3', value: 'magic3atr', sortable: true  },
  { title: 'M3種', value: 'magic3pow', sortable: true  },
  { title: 'M3バフ', value: 'magic3buf', sortable: true  },
  { title: 'M3回復', value: 'magic3heal', sortable: true  },
  { title: 'バディ1', value: 'buddy1c', sortable: true  },
  { title: 'バディ1', value: 'buddy1s', sortable: true  },
  { title: 'バディ2', value: 'buddy2c', sortable: true  },
  { title: 'バディ2', value: 'buddy2s', sortable: true  },
  { title: 'バディ3', value: 'buddy3c', sortable: true  },
  { title: 'バディ3', value: 'buddy3s', sortable: true  },
  { title: 'その他', value: 'etc', sortable: false  },
];
import * as XLSX from 'xlsx';

const exportToExcel = () => {
  const data = visibleCharacters.value.map(character => ({
    名前: character.chara,
    衣装: character.costume,
    レア: character.rare,
    タイプ: character.growtype.slice(-3),
    非公式タイプ: character.growtype,
    HP: character.hp,
    ATK: character.atk,
    デュオ: character.duo,
    M1属性: character.magic1atr,
    M1種: character.magic1pow,
    M1バフ: character.magic1buf,
    M1回復: character.magic1heal,
    M2属性: character.magic2atr,
    M2種: character.magic2pow,
    M2バフ: character.magic2buf,
    M2回復: character.magic2heal,
    M3属性: character.magic3atr,
    M3種: character.magic3pow,
    M3バフ: character.magic3buf,
    M3回復: character.magic3heal,
    バディ1: character.buddy1c,
    バディ1スキル: character.buddy1s,
    バディ2: character.buddy2c,
    バディ2スキル: character.buddy2s,
    バディ3: character.buddy3c,
    バディ3スキル: character.buddy3s,
    その他: character.etc
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
  const promises = characters.value.map(character => {
    return import(`@/assets/img/${character.name}.webp`)
      .then(module => {
        character.imgUrl = module.default;
      })
      .catch(async () => {
        const module = await import(`@/assets/img/notyet.webp`);
        character.imgUrl = module.default;
      })
      .catch(() => {
        character.imgUrl = ''; // 画像の読み込みに失敗した場合
      });
  });

  Promise.all(promises).then(() => {
    loadingImgUrl.value = false; // すべての画像のロードが完了
  });
});
</script>
<style scoped>
.character-image {
  width: 45px;
  height: 45px;
  border-radius: 4px;
  object-fit: cover;
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
.v-data-table ::v-deep tbody tr td {
  white-space: nowrap;
  border-left: 1px solid #ddd;
  border-right: 1px solid #ddd;
}
.v-data-table ::v-deep thead th {
  white-space: nowrap;
  border-left: 1px solid #ddd;
  border-right: 1px solid #ddd;
}
.v-data-table :deep(.v-data-table-footer) {
   display: none; /* NOTE: フッタを非表示にする為 */
}
</style>
