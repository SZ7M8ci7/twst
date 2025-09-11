<template>
  <v-container>
    <!-- コントロールセクション -->
    <div class="controls-section">
      <!-- モード切り替えボタン -->
      <button @click="toggleMODE" class="mode-toggle-button" v-html="formattedMode"></button>
      
      <!-- 手持ち設定トグル -->
      <v-switch
        v-model="handCollectionStore.useHandCollection"
        :label="$t('buddyDuo.reflectHandSettings')"
        density="compact"
        hide-details
        inset
        :color="handCollectionStore.useHandCollection ? 'success' : 'grey'"
        :class="{ 'hand-collection-active': handCollectionStore.useHandCollection }"
      />
    </div>
    
    <div class="matrix-container">
      <div class="matrix-scroll">
        <table class="matrix-table">
          <!-- 固定ヘッダー行 -->
          <thead>
            <tr>
              <th class="fixed-corner"></th>
              <th v-for="(header, index) in headers" :key="index" class="header-cell">
                <img :src="headerImgs[index]" :alt="header" class="img" />
              </th>
            </tr>
            <tr>
              <th class="fixed-left">Total</th>
              <td v-for="(total, index) in totals" :key="index" 
                  class="data-cell"
                  :class="{ 'highlighted-col': highlightedCol === index }">
                <button @click="showTotalCharacterModal(index, -1, index)" class="cell-button">{{ total }}</button>
              </td>
            </tr>
          </thead>

          <tbody>
            <tr v-for="(row, rowIndex) in matrix" :key="rowIndex">
              <th class="fixed-left"><img :src="headerImgs[rowIndex]" class="img" /></th>
              <td v-for="(cell, cellIndex) in row" :key="cellIndex" 
                  class="data-cell"
                  :class="{ 
                    'highlighted-row': highlightedRow === rowIndex,
                    'highlighted-col': highlightedCol === cellIndex,
                    'highlighted-cell': highlightedRow === rowIndex && highlightedCol === cellIndex
                  }"
                  @click="cell !== null ? showCharacterModal(currentRelations[headers[rowIndex]][headers[cellIndex]], rowIndex, cellIndex) : showCharacterModal([], rowIndex, cellIndex)">
                <button
                  v-if="cell !== null"
                  class="cell-button"
                >
                  {{ cell }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </v-container>
  <!-- モーダル -->
  <v-dialog v-model="showModal" max-width="600px">
    <v-card>
      <v-card-text>
        <v-simple-table style="display: flex; justify-content: center;">
          <template v-slot:default>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
              <li v-for="(value, key) in selectedCharacter" :key="key" style="list-style: none;">
                <CharacterIconWithType :imgSrc="value[0]" :wikiUrl="value[1]" :cardType="value[2]" :iconSize="62" />
              </li>
            </div>
          </template>
        </v-simple-table>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" @click="showModal = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

</template>
<script setup lang="ts">
import { computed, onMounted, Ref, ref, watch } from 'vue';
import { useCharacterStore, Character } from '@/store/characters';
import { useHandCollectionStore } from '@/store/handCollection';
import charactersInfo from '@/assets/characters_info.json';
import { storeToRefs } from 'pinia';
import characterData from '@/assets/characters_info.json';
import { loadImageUrls, createCharacterInfoMap, CharacterCardInfo } from '@/components/common';
import CharacterIconWithType from '@/components/CharacterIconWithType.vue';
import { applyDefaultSort } from '@/utils/sortUtils';

const characterStore = useCharacterStore();
const handCollectionStore = useHandCollectionStore();
const { characters } = storeToRefs(characterStore);
const headers: Ref<string[]> = ref([]);
const headerImgs = ref<string[]>([]);
const selectedCharacter: Ref<Array<[string | undefined, string | undefined, string | undefined]>> = ref([]);
const duoRelations: Ref<Record<string, Record<string, any>>> = ref({});
const buddyRelations: Ref<Record<string, Record<string, any>>> = ref({});
const HPBuddyRelations: Ref<Record<string, Record<string, any>>> = ref({});
const ATKBuddyRelations: Ref<Record<string, Record<string, any>>> = ref({});
const showModal = ref(false);
const mode = ref('DUO');
const highlightedRow = ref(-1);
const highlightedCol = ref(-1);

const characterInfoMap = ref<Map<string, CharacterCardInfo>>(new Map());
const imgUrlDictionary: Ref<Record<string, string>> = ref({});
const iconUrlDictionary: Ref<Record<string, string>> = ref({});

// 手持ち設定でフィルタリングされたキャラクター一覧（ソート適用）
const filteredCharacters = computed(() => {
  let filtered;
  if (!handCollectionStore.useHandCollection) {
    filtered = characters.value;
  } else {
    filtered = characters.value.filter(character => 
      handCollectionStore.isCharacterOwned(character.name)
    );
  }
  return applyDefaultSort(filtered);
});

const formattedMode = computed(() => {
  if (mode.value === 'HP Buddy' || mode.value === 'ATK Buddy') {
    return mode.value.replace(' ', '<br>');
  }
  return mode.value;
});

const matrix: Ref<(number|undefined)[][]> = ref([]);
const currentRelations = computed(() => {
  switch (mode.value) {
    case 'DUO':
      return duoRelations.value;
    case 'Buddy':
      return buddyRelations.value;
    case 'HP Buddy':
      return HPBuddyRelations.value;
    case 'ATK Buddy':
      return ATKBuddyRelations.value;
    default:
      return duoRelations.value;
  }
});
const toggleMODE = () => {
  const modes = ['DUO', 'Buddy', 'HP Buddy', 'ATK Buddy'];
  const currentIndex = modes.indexOf(mode.value);
  const nextIndex = (currentIndex + 1) % modes.length;
  mode.value = modes[nextIndex];
  updateMatrix(currentRelations.value);
};

const showCharacterModal = (characterInfoArray: any[], rowIndex?: number, cellIndex?: number) => {
  selectedCharacter.value = [];
  
  // ハイライト設定（常に実行）
  if (rowIndex !== undefined && cellIndex !== undefined) {
    highlightedRow.value = rowIndex;
    highlightedCol.value = cellIndex;
  }
  
  // データがある場合のみモーダルを表示
  if (Array.isArray(characterInfoArray) && characterInfoArray.length > 0) {
    // 手持ち設定が有効な場合は所持カードのみ表示
    const charactersToShow = handCollectionStore.useHandCollection
      ? characterInfoArray.filter((char: { name: string; }) => handCollectionStore.isCharacterOwned(char.name))
      : characterInfoArray;
    
    if (charactersToShow.length > 0) {
      showModal.value = true;
      charactersToShow.forEach((charFromRelation: { name:string; imgUrl: string; wikiURL: string; }) => {
        const info = characterInfoMap.value.get(charFromRelation.name);
        selectedCharacter.value.push([charFromRelation.imgUrl, charFromRelation.wikiURL, info?.type]);
      });
    }
  }
};
const updateMatrix = (relations: Record<string, Record<string, any[]>>) => {
  matrix.value = headers.value.map((char) =>
    headers.value.map((otherChar) =>
      relations[char][otherChar] && relations[char][otherChar].length > 0
        ? relations[char][otherChar].length
        : undefined
    )
  );
};
const showTotalCharacterModal = (colIndex: number, rowIndex?: number, cellIndex?: number) => {
  selectedCharacter.value = [];
  
  // ハイライト設定（常に実行）
  if (rowIndex !== undefined && cellIndex !== undefined) {
    highlightedRow.value = rowIndex;
    highlightedCol.value = cellIndex;
  }
  
  const targetColumnHeader = headers.value[colIndex];
  let charactersToShow: any[] = [];

  headers.value.forEach((rowHeader) => {
    const relation = currentRelations.value[rowHeader][targetColumnHeader];
    if (Array.isArray(relation) && relation.length > 0) {
      charactersToShow = charactersToShow.concat(relation);
    }
  });

  // 手持ち設定が有効な場合は所持カードのみ表示
  if (handCollectionStore.useHandCollection) {
    charactersToShow = charactersToShow.filter((char: { name: string; }) => 
      handCollectionStore.isCharacterOwned(char.name)
    );
  }

  if (charactersToShow.length > 0) {
    showModal.value = true;
    charactersToShow.forEach((charFromRelation: { name: string; imgUrl: string; wikiURL: string; }) => {
      const info = characterInfoMap.value.get(charFromRelation.name);
      selectedCharacter.value.push([charFromRelation.imgUrl, charFromRelation.wikiURL, info?.type]);
    });
  }
};

const totals = computed(() => {
  if (!matrix.value || matrix.value.length === 0 || matrix.value[0].length === 0) return [];

  return matrix.value[0].map((_, colIndex) =>
    matrix.value.reduce((sum, row) => sum + (row[colIndex] ?? 0), 0)
  );
});

onMounted(async () => {
  const imageLoadPromises = characters.value.map((char: Character) => {
    return import(`@/assets/img/${char.name}.webp`)
      .then(module => {
        char.imgUrl = module.default;
      })
      .catch(async () => {
        const module = await import(`@/assets/img/notyet.webp`);
        char.imgUrl = module.default;
      });
  });

  try {
    await Promise.all(imageLoadPromises);
  } catch (error) {
    // console.error("Error during Promise.all in buddyDuo:", error);
  }

  characterInfoMap.value = createCharacterInfoMap(characters.value);
  imgUrlDictionary.value = await loadImageUrls(characterData, 'name_en');
  iconUrlDictionary.value = await loadImageUrls(charactersInfo, 'name_en', 'icon/');
  
  // キャラクター名を元々の順序で維持（charactersInfo.jsonの順序）
  headers.value = charactersInfo.map((char) => char.name_ja);
  
  // アイコン画像を設定
  headerImgs.value = charactersInfo.map((char) => iconUrlDictionary.value[char.name_en]);

  headers.value.forEach((char) => {
    duoRelations.value[char] = {};
    buddyRelations.value[char] = {};
    HPBuddyRelations.value[char] = {};
    ATKBuddyRelations.value[char] = {};
    headers.value.forEach((otherChar) => {
      duoRelations.value[char][otherChar] = [];
      buddyRelations.value[char][otherChar] = [];
      HPBuddyRelations.value[char][otherChar] = [];
      ATKBuddyRelations.value[char][otherChar] = [];
    });
  });

  // 関係性の構築処理を関数として分離
  const buildRelations = () => {
    // 関係性をリセット
    headers.value.forEach((char) => {
      duoRelations.value[char] = {};
      buddyRelations.value[char] = {};
      HPBuddyRelations.value[char] = {};
      ATKBuddyRelations.value[char] = {};
      headers.value.forEach((otherChar) => {
        duoRelations.value[char][otherChar] = [];
        buddyRelations.value[char][otherChar] = [];
        HPBuddyRelations.value[char][otherChar] = [];
        ATKBuddyRelations.value[char][otherChar] = [];
      });
    });

    // フィルタリングされたキャラクターで関係性を構築
    filteredCharacters.value.forEach((character: Character) => {
      if (!duoRelations.value[character.chara]) {
        duoRelations.value[character.chara] = {};
      }
      if (!buddyRelations.value[character.chara]) {
        buddyRelations.value[character.chara] = {};
      }
      if (!HPBuddyRelations.value[character.chara]) {
        HPBuddyRelations.value[character.chara] = {};
      }
      if (!ATKBuddyRelations.value[character.chara]) {
        ATKBuddyRelations.value[character.chara] = {};
      }

      if (character.duo && duoRelations.value[character.chara]) {
        if (!duoRelations.value[character.chara][character.duo]) {
          duoRelations.value[character.chara][character.duo] = [];
        }
        duoRelations.value[character.chara][character.duo].push(character);
      }

      const buddies = [character.buddy1c, character.buddy2c, character.buddy3c].filter(b => b);
      buddies.forEach(buddy => {
        if (buddy && buddyRelations.value[character.chara]) {
          if (!buddyRelations.value[character.chara][buddy]) {
            buddyRelations.value[character.chara][buddy] = [];
          }
          buddyRelations.value[character.chara][buddy].push(character);
        }
      });

      const buddyInfo = [
        { name: character.buddy1c, typeString: character.buddy1s },
        { name: character.buddy2c, typeString: character.buddy2s },
        { name: character.buddy3c, typeString: character.buddy3s },
      ];

      buddyInfo.forEach(buddy => {
        if (buddy.name && buddy.typeString && HPBuddyRelations.value[character.chara] && ATKBuddyRelations.value[character.chara]) { 
          if (buddy.typeString.includes('HP')) {
            if (!HPBuddyRelations.value[character.chara][buddy.name]) {
              HPBuddyRelations.value[character.chara][buddy.name] = [];
            }
            HPBuddyRelations.value[character.chara][buddy.name].push(character);
          } else if (buddy.typeString.includes('ATK')) {
            if (!ATKBuddyRelations.value[character.chara][buddy.name]) {
              ATKBuddyRelations.value[character.chara][buddy.name] = [];
            }
            ATKBuddyRelations.value[character.chara][buddy.name].push(character);
          }
        }
      });
    });
  };

  buildRelations();

  // 手持ち設定の変更を監視して関係性を再構築
  watch(() => handCollectionStore.useHandCollection, () => {
    buildRelations();
    updateMatrix(currentRelations.value);
  });

  // 手持ちコレクションの変更を監視して関係性を再構築
  watch(() => handCollectionStore.handCollection, () => {
    if (handCollectionStore.useHandCollection) {
      buildRelations();
      updateMatrix(currentRelations.value);
    }
  }, { deep: true });

  updateMatrix(duoRelations.value);
});
</script>
<style scoped>
/* コンテナ全体のサイズ制限 */
.v-container {
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 8px !important;
}

/* マトリクスコンテナ */
.matrix-container {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* スクロール可能エリア */
.matrix-scroll {
  width: 100%;
  height: 100%;
  overflow: auto;
}

/* テーブル基本スタイル */
.matrix-table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}

th,
td {
  border: 1px solid #000;
}

/* 固定要素 */
.fixed-corner {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 20;
  background: #f5f5f5;
}

.header-cell {
  position: sticky;
  top: 0;
  z-index: 15;
  background: #f5f5f5;
}

.fixed-left {
  position: sticky;
  left: 0;
  z-index: 15;
  background: #f5f5f5;
}

.img {
  width: 28px;
  margin: 0;
  padding: 0;
}
.mode-toggle-button {
  background-color: #5de459; 
  box-shadow: 0 2px 2px rgba(0, 0, 0, .3);
  color: #3b4b27;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.2; 
  min-width: 80px; 
  text-align: center;
  white-space: nowrap;
}

.controls-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.hand-collection-active :deep(.v-label) {
  color: #4caf50 !important;
}

/* ハイライト効果 */
.highlighted-row {
  background-color: rgba(76, 175, 80, 0.2) !important;
}

.highlighted-col {
  background-color: rgba(76, 175, 80, 0.2) !important;
}

.highlighted-cell {
  background-color: rgba(76, 175, 80, 0.4) !important;
}
.cell-button {
  background-color: #e0e0e0;
  border-radius: 8px;
  padding: 0px 8px;
  color: inherit;
  font-size: inherit;
  cursor: pointer;
  box-shadow: 0 1px 1px rgba(0, 0, 0, .2);
  text-align: center;
}

.cell-button:hover {
  color: #e25513; 
}

</style>