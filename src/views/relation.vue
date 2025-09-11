<template>
  <!-- ロード中に表示するロードスクリーン -->
  <div v-if="loadingImgUrl" class="text-center">
    <v-progress-circular indeterminate></v-progress-circular>
    <p>Loading...</p>
  </div>
  <!-- ロード完了後に表示するメインコンテンツ -->
  <div v-else>
    <div class="controls-container" style="display: flex; flex-direction: column;">
      <v-radio-group v-model="selectedAttribute" inline @change="recomputeDuos">
        <v-radio :label="$t('relation.all')" value="all"></v-radio>
        <v-radio :label="$t('relation.fire')" value="fire"></v-radio>
        <v-radio :label="$t('relation.water')" value="water"></v-radio>
        <v-radio :label="$t('relation.flora')" value="flora"></v-radio>
      </v-radio-group>

      <div style="display: flex; flex-direction: row; gap: 15px; align-items: center;">
        <!-- 手持ち設定トグル -->
        <div class="hand-collection-toggle">
          <div 
            class="toggle-button" 
            @click="toggleHandCollection"
            :class="{ 'active': useHandCollection }"
          >
            {{ useHandCollection ? t('relation.handCollection') : t('relation.allCards') }}
          </div>
        </div>
        
        <v-checkbox v-model="mutualDuo" :label="$t('relation.duo')" @change="recomputeDuos"></v-checkbox>
        <v-checkbox v-model="tripleDuo" :label="$t('relation.duo3')" @change="recomputeDuos"></v-checkbox>
        <v-checkbox
          v-model="allowEqualMultiplier"
          :label="$t('relation.allowEqual')"
          :disabled="selectedAttribute === 'all'"
          @change="recomputeDuos"
        ></v-checkbox>
      </div>
    </div>


    <v-container class="container" style="width: 95%;">
      <v-row>
        <v-col cols="12" v-for="rowIndex in Math.ceil(filteredCharacters.length / 10)" :key="rowIndex">
          <v-row>
            <v-col cols="1"></v-col>
            <v-col cols="1" v-for="(character) in filteredCharacters.slice((rowIndex - 1) * 11, rowIndex * 11)"
              :key="character.name" @click="openModal(character)" style="padding: 1px;">
              <img 
                :src="character.imgUrl" 
                :alt="character.name" 
                class="character-image"
                :style="{ filter: character.hasDuo ? 'none' : 'grayscale(100%) opacity(0.4)', cursor: character.hasDuo ? 'pointer' : 'default' }"
                @click="character.hasDuo ? openModal(character) : null"
              />

            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-container>

    <!-- モーダル -->
    <v-dialog v-model="showModal" max-width="350px">
      <v-card>
        <v-card-text>
          <v-simple-table style="display: flex;justify-content: center;">
            <template v-slot:default>
              <tbody>
                <tr v-for="(value, key) in selectedCharacter" :key="key">
                  <td v-for="imgUrl in value" :key="imgUrl">
                    <CharacterIconWithType 
                      :imgSrc="imgUrl" 
                      :wikiUrl="imgUrl2wikiUrl[imgUrl]" 
                      :cardType="characterInfoMap.get(imgUrl2Name[imgUrl])?.type" 
                      :iconSize="62" 
                    />
                  </td>
                </tr>
              </tbody>
            </template>
          </v-simple-table>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="primary" @click="showModal = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeMount, onMounted, Ref, ref, watch } from 'vue';
import { Character, useCharacterStore } from '@/store/characters';
import { useHandCollectionStore } from '@/store/handCollection';
import { storeToRefs } from 'pinia';
import CharacterIconWithType from '@/components/CharacterIconWithType.vue';
import { createCharacterInfoMap, CharacterCardInfo } from '@/components/common';
import { useI18n } from 'vue-i18n';
import { applyDefaultSort } from '@/utils/sortUtils';

const { t } = useI18n();
const characterStore = useCharacterStore();
const handCollectionStore = useHandCollectionStore();
const { characters } = storeToRefs(characterStore);
// 独自の手持ち設定状態を管理（ストアとは独立）
const useHandCollection = ref(false);
const loadingImgUrl = ref(true);
const showModal = ref(false);
const selectedCharacter: Ref<string[][]> = ref([]);
const chara2name = ref<Record<string, string[]>>({});
const duo2name = ref<Record<string, string[]>>({});
const name2data = ref<Record<string, Character>>({});
const imgUrl2wikiUrl = ref<Record<string, string>>({});
const imgUrl2CharacterData = ref<Record<string, Character>>({});
const imgUrl2Name = ref<Record<string, string>>({});
const characterInfoMap = ref<Map<string, CharacterCardInfo>>(new Map());
const selectedAttribute = ref('all');
const allowEqualMultiplier = ref(false);
const mutualDuo = ref(true);
const tripleDuo = ref(true);

// 手持ち設定の切り替え関数
function toggleHandCollection() {
  useHandCollection.value = !useHandCollection.value;
}

const recomputeDuos = () => {
  filteredCharacters.value.forEach(character => {
    computeDuo(character);
    character.hasDuo = selectedCharacter.value.length > 0;
  });
};

const filteredCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }

  let visibleCharacters = characters.value.filter(character => character.visible && character.rare == "SSR");
  
  // 手持ち設定ONの場合、所持しているカードのみを表示
  if (useHandCollection.value) {
    visibleCharacters = visibleCharacters.filter(character => {
      const handCard = handCollectionStore.getHandCard(character.name);
      return handCard.isOwned;
    });
  }

  // キャラクター順序 → レアリティ → 実装日順でソート
  const sortedCharacters = applyDefaultSort(visibleCharacters);

  sortedCharacters.forEach(character => {
    name2data.value[character.name] = character;
    imgUrl2wikiUrl.value[character.imgUrl as string] = character.wikiURL;
    imgUrl2CharacterData.value[character.imgUrl as string] = character;
    imgUrl2Name.value[character.imgUrl as string] = character.name;
    if (character.chara in chara2name.value) {
      chara2name.value[character.chara].push(character.name);
    } else {
      chara2name.value[character.chara] = [character.name];
    }
    if (character.duo in duo2name.value) {
      duo2name.value[character.duo].push(character.name);
    } else {
      duo2name.value[character.duo] = [character.name];
    }
  });

  return sortedCharacters;
});

// 手持ち設定の変更を監視して再計算を実行
watch(() => useHandCollection.value, () => {
  recomputeDuos();
});

// filteredCharactersの変更を監視してデュオ計算を更新
watch(() => filteredCharacters.value, () => {
  if (!loadingImgUrl.value && filteredCharacters.value.length > 0) {
    recomputeDuos();
  }
}, { deep: true });

// 手持ちコレクションの内容変更を監視
watch(() => handCollectionStore.handCollection, () => {
  if (useHandCollection.value) {
    // 手持ち設定ONの場合のみ再計算
    recomputeDuos();
  }
}, { deep: true });

onBeforeMount(() => {
  const promises = characters.value.map(character => {
    return import(`@/assets/img/${character.name}.webp`)
      .then(module => {
        character.imgUrl = module.default;
      })
      .catch(async () => {
        const module = await import(`@/assets/img/notyet.webp`);
        character.imgUrl = module.default;
      });
  });

  Promise.all(promises).then(() => {
    loadingImgUrl.value = false;

    // filteredCharacters が確定した後に characterInfoMap を初期化
    characterInfoMap.value = createCharacterInfoMap(filteredCharacters.value);

    filteredCharacters.value.forEach(character => {
      computeDuo(character);
      character.hasDuo = selectedCharacter.value.length > 0;
    });
  });
});
function arraysEqualIgnoreOrder(a: string | any[], b: string | any[]) {
  if (a.length !== b.length) return false;

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  return sortedA.every((value, index) => value === sortedB[index]);
}
const computeDuo = (character: Character) => {
  selectedCharacter.value = [];
  const addedCombinations = new Set<string>(); // 重複防止用
  
  // 重複チェック付きで組み合わせを追加するヘルパー関数
  const addUniqueCombo = (combo: string[]) => {
    const key = [...combo].sort().join('|');
    if (!addedCombinations.has(key)) {
      selectedCharacter.value.push(combo);
      addedCombinations.add(key);
    }
  };
  
  // duo相手のカード全てに対してループでチェックする
  for (let name1 of chara2name.value[character.duo] || []) {
    let character1 = name2data.value[name1];
    
    // 手持ち設定ONの場合、デュオ相手も所持している必要がある
    if (useHandCollection.value) {
      const handCard1 = handCollectionStore.getHandCard(character1.name);
      if (!handCard1.isOwned) {
        continue; // デュオ相手を所持していない場合はスキップ
      }
    }
    
    const characterImgUrl = character.imgUrl as unknown as string;
    const character1ImgUrl = character1.imgUrl as unknown as string;
    const duoImg = [characterImgUrl, character1ImgUrl];
    // duo相手のduoが自身の場合
    if (character1.duo == character.chara) {
      // 相互デュオを選択
      if (mutualDuo.value) {
        // 相互デュオとして追加
        const atrs = [character.magic2atr, character1.magic2atr]
        // 全属性の場合は無条件で追加
        if (selectedAttribute.value == 'all') {
          addUniqueCombo(duoImg);

        // 火属性が選択されている場合
        } else if (selectedAttribute.value == 'fire') {
          // 等倍を一つ許容している場合は片方等倍でも追加
          if (allowEqualMultiplier.value) {
            if (arraysEqualIgnoreOrder(atrs, ['火', '火']) || arraysEqualIgnoreOrder(atrs, ['火', '無']) || arraysEqualIgnoreOrder(atrs, ['火', '木'])) {
              addUniqueCombo(duoImg);
            }
          } else {
            if (arraysEqualIgnoreOrder(atrs, ['火', '火'])) {
              addUniqueCombo(duoImg);
            }
          }
        // 水属性が選択されている場合
        } else if (selectedAttribute.value == 'water') {
          // 等倍を一つ許容している場合は片方等倍でも追加
          if (allowEqualMultiplier.value) {
            if (arraysEqualIgnoreOrder(atrs, ['水', '水']) || arraysEqualIgnoreOrder(atrs, ['水', '無']) || arraysEqualIgnoreOrder(atrs, ['水', '火'])) {
              addUniqueCombo(duoImg);
            }
          } else {
            if (arraysEqualIgnoreOrder(atrs, ['水', '水'])) {
              addUniqueCombo(duoImg);
            }
          }
        // 木属性が選択されている場合
        } else if (selectedAttribute.value == 'flora') {
          // 等倍を一つ許容している場合は片方等倍でも追加
          if (allowEqualMultiplier.value) {
            if (arraysEqualIgnoreOrder(atrs, ['木', '木']) || arraysEqualIgnoreOrder(atrs, ['木', '無']) || arraysEqualIgnoreOrder(atrs, ['木', '水'])) {
              addUniqueCombo(duoImg);
            }
          } else {
            if (arraysEqualIgnoreOrder(atrs, ['木', '木'])) {
              addUniqueCombo(duoImg);
            }
          }
        }
      }
      // 3デュオを選択
      if (tripleDuo.value) {
        // duo相手に自身か、相互duoの相手を対象に持つカードをループでチェック（重複除去）
        const name2List = [...new Set([...(duo2name.value[character.chara] || []), ...(duo2name.value[character1.chara] || [])])];
        for (let name2 of name2List) {
          let character2 = name2data.value[name2];
          
          // 手持ち設定ONの場合、3デュオの3番目のキャラも所持している必要がある
          if (useHandCollection.value) {
            const handCard2 = handCollectionStore.getHandCard(character2.name);
            if (!handCard2.isOwned) {
              continue; // 3番目のキャラを所持していない場合はスキップ
            }
          }
          
          const duo3Img = [characterImgUrl, character1ImgUrl, character2.imgUrl as unknown as string];
          const atrs = [character.magic2atr, character1.magic2atr, character2.magic2atr]
          let useMagics: string | string[] = [];
          if (character2.duo == character.chara) {
            useMagics = [character.magic1atr, character.magic3atr];
          } else if (character2.duo == character1.chara) {
            useMagics = [character1.magic1atr, character1.magic3atr];
          }
          // 全属性の場合は無条件で追加
          if (selectedAttribute.value == 'all') {
            addUniqueCombo(duo3Img);

          // 火属性が選択されている場合
          } else if (selectedAttribute.value == 'fire') {
            // 等倍を一つ許容している場合は一つ等倍でも追加
            if (allowEqualMultiplier.value) {
              // DUO魔法が全て火の場合はそれ以外で火、木、無を許容
              if (arraysEqualIgnoreOrder(atrs, ['火', '火', '火']) && ['火','木','無'].some(item => useMagics.includes(item))) {
                addUniqueCombo(duo3Img);
              } else if (arraysEqualIgnoreOrder(atrs, ['火', '火', '木']) || arraysEqualIgnoreOrder(atrs, ['火', '火', '無'])) {
                if (['火'].some(item => useMagics.includes(item))) {
                  addUniqueCombo(duo3Img);
                }
              }
            } else {
              if (arraysEqualIgnoreOrder(atrs, ['火', '火', '火']) && ['火'].some(item => useMagics.includes(item))) {
                  addUniqueCombo(duo3Img);
              }
            }
          // 水属性が選択されている場合
          } else if (selectedAttribute.value == 'water') {
            // 等倍を一つ許容している場合は一つ等倍でも追加
            if (allowEqualMultiplier.value) {
              // DUO魔法が全て水の場合はそれ以外で水、火、無を許容
              if (arraysEqualIgnoreOrder(atrs, ['水', '水', '水']) && ['水','火','無'].some(item => useMagics.includes(item))) {
                addUniqueCombo(duo3Img);
              } else if (arraysEqualIgnoreOrder(atrs, ['水', '水', '火']) || arraysEqualIgnoreOrder(atrs, ['水', '水', '無'])) {
                if (['水'].some(item => useMagics.includes(item))) {
                  addUniqueCombo(duo3Img);
                }
              }
            } else {
              if (arraysEqualIgnoreOrder(atrs, ['水', '水', '水']) && ['水'].some(item => useMagics.includes(item))) {
                  addUniqueCombo(duo3Img);
              }
            }
          // 木属性が選択されている場合
          } else if (selectedAttribute.value == 'flora') {
            // 等倍を一つ許容している場合は一つ等倍でも追加
            if (allowEqualMultiplier.value) {
              // DUO魔法が全て木の場合はそれ以外で木、水、無を許容
              if (arraysEqualIgnoreOrder(atrs, ['木', '木', '木']) && ['木','水','無'].some(item => useMagics.includes(item))) {
                addUniqueCombo(duo3Img);
              } else if (arraysEqualIgnoreOrder(atrs, ['木', '木', '水']) || arraysEqualIgnoreOrder(atrs, ['木', '木', '無'])) {
                if (['木'].some(item => useMagics.includes(item))) {
                  addUniqueCombo(duo3Img);
                }
              }
            } else {
              if (arraysEqualIgnoreOrder(atrs, ['木', '木', '木']) && ['木'].some(item => useMagics.includes(item))) {
                  addUniqueCombo(duo3Img);
              }
            }
          }
        }
      }
    // duo相手のduoが自身以外の場合
    } else {
      if (tripleDuo.value) {
        // duo相手のduo相手を探索
        for (let name2 of chara2name.value[character1.duo] || []) {
          let character2 = name2data.value[name2];
          
          // 手持ち設定ONの場合、3デュオの3番目のキャラも所持している必要がある
          if (useHandCollection.value) {
            const handCard2 = handCollectionStore.getHandCard(character2.name);
            if (!handCard2.isOwned) {
              continue; // 3番目のキャラを所持していない場合はスキップ
            }
          }
          
          const duo3Img = [characterImgUrl, character1ImgUrl, character2.imgUrl as unknown as string];
          // 循環3デュオの場合
          if (character2.duo == character.chara) {
            // 全属性の場合は無条件で追加
            if (selectedAttribute.value == 'all') {
              addUniqueCombo(duo3Img);
            // 火属性が選択されている場合
            } else if (selectedAttribute.value == 'fire') {
              // 等倍を一つ許容している場合は一つ等倍でも追加
              if (allowEqualMultiplier.value) {
                const useMagics = [];
                // M2の属性をチェック
                if (character.magic2atr == '火') {
                  useMagics.push(character.magic2atr);
                } else if (character.magic2atr == '水') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character1.magic2atr == '火') {
                  useMagics.push(character1.magic2atr);
                } else if (character1.magic2atr == '水') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character2.magic2atr == '火') {
                  useMagics.push(character2.magic2atr);
                } else if (character2.magic2atr == '水') {
                  continue;
                } else {
                  useMagics.push('等');
                }

                // M1,M3の属性をチェック
                // 火属性があればそれを使用
                if (character.magic1atr == '火' || character.magic3atr == '火') {
                  useMagics.push('火');
                // 等倍しか無ければ等倍を使用
                } else if (character.magic1atr == '木' || character.magic3atr == '無') {
                  useMagics.push('等');
                } else {
                  continue;
                }
                // 火属性があればそれを使用
                if (character1.magic1atr == '火' || character1.magic3atr == '火') {
                  useMagics.push('火');
                // 等倍しか無ければ等倍を使用
                } else if (character1.magic1atr == '木' || character1.magic3atr == '無') {
                  useMagics.push('等');
                } else {
                  continue;
                }
                // 火属性があればそれを使用
                if (character2.magic1atr == '火' || character2.magic3atr == '火') {
                  useMagics.push('火');
                // 等倍しか無ければ等倍を使用
                } else if (character2.magic1atr == '木' || character2.magic3atr == '無') {
                  useMagics.push('等');
                } else {
                  continue;
                }
                if (useMagics.filter(item => item === '等').length <= 1) {
                  addUniqueCombo(duo3Img);
                }

              // 等倍を許容しない場合は全て火のみ追加
              } else {
                // M2は全て火であることが前提
                if (!(character.magic2atr == '火' && character1.magic2atr == '火' && character2.magic2atr == '火')) {
                  continue;
                }
                // 全てのキャラのM1かM3に火が必要
                if (!(character.magic1atr == '火' || character.magic3atr == '火')) {
                  continue;
                }
                if (!(character1.magic1atr == '火' || character1.magic3atr == '火')) {
                  continue;
                }
                if (!(character2.magic1atr == '火' || character2.magic3atr == '火')) {
                  continue;
                }
                addUniqueCombo(duo3Img);                
              }
            } else if (selectedAttribute.value == 'water') {
              // 等倍を一つ許容している場合は一つ等倍でも追加
              if (allowEqualMultiplier.value) {
                const useMagics = [];
                // M2の属性をチェック
                if (character.magic2atr == '水') {
                  useMagics.push(character.magic2atr);
                } else if (character.magic2atr == '木') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character1.magic2atr == '水') {
                  useMagics.push(character1.magic2atr);
                } else if (character1.magic2atr == '木') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character2.magic2atr == '水') {
                  useMagics.push(character2.magic2atr);
                } else if (character2.magic2atr == '木') {
                  continue;
                } else {
                  useMagics.push('等');
                }

                // M1,M3の属性をチェック
                // 水属性があればそれを使用
                if (character.magic1atr == '水' || character.magic3atr == '水') {
                  useMagics.push('水');
                // 等倍しか無ければ等倍を使用
                } else if (character.magic1atr == '火' || character.magic3atr == '無') {
                  useMagics.push('等');
                } else {
                  continue;
                }
                // 水属性があればそれを使用
                if (character1.magic1atr == '水' || character1.magic3atr == '水') {
                  useMagics.push('水');
                // 等倍しか無ければ等倍を使用
                } else if (character1.magic1atr == '火' || character1.magic3atr == '無') {
                  useMagics.push('等');
                } else {
                  continue;
                }
                // 水属性があればそれを使用
                if (character2.magic1atr == '水' || character2.magic3atr == '水') {
                  useMagics.push('水');
                // 等倍しか無ければ等倍を使用
                } else if (character2.magic1atr == '火' || character2.magic3atr == '無') {
                  useMagics.push('等');
                } else {
                  continue;
                }
                if (useMagics.filter(item => item === '等').length <= 1) {
                  addUniqueCombo(duo3Img);
                }

              // 等倍を許容しない場合は全て水のみ追加
              } else {
                // M2は全て水であることが前提
                if (!(character.magic2atr == '水' && character1.magic2atr == '水' && character2.magic2atr == '水')) {
                  continue;
                }
                // 全てのキャラのM1かM3に水が必要
                if (!(character.magic1atr == '水' || character.magic3atr == '水')) {
                  continue;
                }
                if (!(character1.magic1atr == '水' || character1.magic3atr == '水')) {
                  continue;
                }
                if (!(character2.magic1atr == '水' || character2.magic3atr == '水')) {
                  continue;
                }
                addUniqueCombo(duo3Img);                
              }
            } else if (selectedAttribute.value == 'flora') {
              // 等倍を一つ許容している場合は一つ等倍でも追加
              if (allowEqualMultiplier.value) {
                const useMagics = [];
                // M2の属性をチェック
                if (character.magic2atr == '木') {
                  useMagics.push(character.magic2atr);
                } else if (character.magic2atr == '火') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character1.magic2atr == '木') {
                  useMagics.push(character1.magic2atr);
                } else if (character1.magic2atr == '火') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character2.magic2atr == '木') {
                  useMagics.push(character2.magic2atr);
                } else if (character2.magic2atr == '火') {
                  continue;
                } else {
                  useMagics.push('等');
                }

                // M1,M3の属性をチェック
                // 木属性があればそれを使用
                if (character.magic1atr == '木' || character.magic3atr == '木') {
                  useMagics.push('木');
                // 等倍しか無ければ等倍を使用
                } else if (character.magic1atr == '水' || character.magic3atr == '無') {
                  useMagics.push('等');
                } else {
                  continue;
                }
                // 木属性があればそれを使用
                if (character1.magic1atr == '木' || character1.magic3atr == '木') {
                  useMagics.push('木');
                // 等倍しか無ければ等倍を使用
                } else if (character1.magic1atr == '水' || character1.magic3atr == '無') {
                  useMagics.push('等');
                } else {
                  continue;
                }
                // 木属性があればそれを使用
                if (character2.magic1atr == '木' || character2.magic3atr == '木') {
                  useMagics.push('木');
                // 等倍しか無ければ等倍を使用
                } else if (character2.magic1atr == '水' || character2.magic3atr == '無') {
                  useMagics.push('等');
                } else {
                  continue;
                }
                if (useMagics.filter(item => item === '等').length <= 1) {
                  addUniqueCombo(duo3Img);
                }

              // 等倍を許容しない場合は全て木のみ追加
              } else {
                // M2は全て木であることが前提
                if (!(character.magic2atr == '木' && character1.magic2atr == '木' && character2.magic2atr == '木')) {
                  continue;
                }
                // 全てのキャラのM1かM3に木が必要
                if (!(character.magic1atr == '木' || character.magic3atr == '木')) {
                  continue;
                }
                if (!(character1.magic1atr == '木' || character1.magic3atr == '木')) {
                  continue;
                }
                if (!(character2.magic1atr == '木' || character2.magic3atr == '木')) {
                  continue;
                }
                addUniqueCombo(duo3Img);                
              }
            }

          // 対象キャラ以外が相互デュオの場合
          } else if (character2.duo == character1.chara) {
            // 全属性の場合は無条件で追加
            if (selectedAttribute.value == 'all') {
              addUniqueCombo(duo3Img);
            } else if (selectedAttribute.value == 'fire') {
              // 等倍を一つ許容している場合は一つ等倍でも追加
              if (allowEqualMultiplier.value) {
                // kokokara
                const useMagics = [];
                // M2の属性をチェック
                if (character.magic2atr == '火') {
                  useMagics.push(character.magic2atr);
                } else if (character.magic2atr == '水') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character1.magic2atr == '火') {
                  useMagics.push(character1.magic2atr);
                } else if (character1.magic2atr == '水') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character2.magic2atr == '火') {
                  useMagics.push(character2.magic2atr);
                } else if (character2.magic2atr == '水') {
                  continue;
                } else {
                  useMagics.push('等');
                }

                // キャラとキャラ1がDUOパターン
                if (character.duo == character1.chara) {
                  if (character1.magic1atr == '火' || character1.magic3atr == '火') {
                    useMagics.push('火');
                  } else if (character1.magic1atr == '水' && character1.magic3atr == '水') {
                    continue;
                  } else {
                    useMagics.push('等');
                  }
                // キャラとキャラ2がDUOパターン
                } else if (character.duo == character2.chara) {
                  if (character2.magic1atr == '火' || character2.magic3atr == '火') {
                    useMagics.push('火');
                  } else if (character2.magic1atr == '水' && character2.magic3atr == '水') {
                    continue;
                  } else {
                    useMagics.push('等');
                  }
                }
                if (useMagics.filter(item => item === '等').length <= 1) {
                  addUniqueCombo(duo3Img);
                }
              // 等倍を許容しない場合 
              } else {
                // M2は全て火が前提
                if (!(character.magic2atr == '火' && character1.magic2atr == '火' && character2.magic2atr == '火')) {
                  continue;
                }
                // キャラとキャラ1がDUOパターン
                if (character.duo == character1.chara) {
                  if (character1.magic1atr == '火' || character1.magic3atr == '火') {
                    addUniqueCombo(duo3Img);
                  }
                // キャラとキャラ2がDUOパターン
                } else if (character.duo == character2.chara) {
                  if (character2.magic1atr == '火' || character2.magic3atr == '火') {
                    addUniqueCombo(duo3Img);
                  }
                }
              }
            } else if (selectedAttribute.value == 'water') {
              // 等倍を一つ許容している場合は一つ等倍でも追加
              if (allowEqualMultiplier.value) {
                const useMagics = [];
                // M2の属性をチェック
                if (character.magic2atr == '水') {
                  useMagics.push(character.magic2atr);
                } else if (character.magic2atr == '木') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character1.magic2atr == '水') {
                  useMagics.push(character1.magic2atr);
                } else if (character1.magic2atr == '木') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character2.magic2atr == '水') {
                  useMagics.push(character2.magic2atr);
                } else if (character2.magic2atr == '木') {
                  continue;
                } else {
                  useMagics.push('等');
                }

                // キャラとキャラ1がDUOパターン
                if (character.duo == character1.chara) {
                  if (character1.magic1atr == '水' || character1.magic3atr == '水') {
                    useMagics.push('水');
                  } else if (character1.magic1atr == '木' && character1.magic3atr == '木') {
                    continue;
                  } else {
                    useMagics.push('等');
                  }
                // キャラとキャラ2がDUOパターン
                } else if (character.duo == character2.chara) {
                  if (character2.magic1atr == '水' || character2.magic3atr == '水') {
                    useMagics.push('水');
                  } else if (character2.magic1atr == '木' && character2.magic3atr == '木') {
                    continue;
                  } else {
                    useMagics.push('等');
                  }
                }
                if (useMagics.filter(item => item === '等').length <= 1) {
                  addUniqueCombo(duo3Img);
                }
              // 等倍を許容しない場合 
              } else {
                // M2は全て水が前提
                if (!(character.magic2atr == '水' && character1.magic2atr == '水' && character2.magic2atr == '水')) {
                  continue;
                }
                // キャラとキャラ1がDUOパターン
                if (character.duo == character1.chara) {
                  if (character1.magic1atr == '水' || character1.magic3atr == '水') {
                    addUniqueCombo(duo3Img);
                  }
                // キャラとキャラ2がDUOパターン
                } else if (character.duo == character2.chara) {
                  if (character2.magic1atr == '水' || character2.magic3atr == '水') {
                    addUniqueCombo(duo3Img);
                  }
                }
              }
            } else if (selectedAttribute.value == 'flora') {
              // 等倍を一つ許容している場合は一つ等倍でも追加
              if (allowEqualMultiplier.value) {
                const useMagics = [];
                // M2の属性をチェック
                if (character.magic2atr == '木') {
                  useMagics.push(character.magic2atr);
                } else if (character.magic2atr == '火') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character1.magic2atr == '木') {
                  useMagics.push(character1.magic2atr);
                } else if (character1.magic2atr == '火') {
                  continue;
                } else {
                  useMagics.push('等');
                }
                if (character2.magic2atr == '木') {
                  useMagics.push(character2.magic2atr);
                } else if (character2.magic2atr == '火') {
                  continue;
                } else {
                  useMagics.push('等');
                }

                // キャラとキャラ1がDUOパターン
                if (character.duo == character1.chara) {
                  if (character1.magic1atr == '木' || character1.magic3atr == '木') {
                    useMagics.push('木');
                  } else if (character1.magic1atr == '火' && character1.magic3atr == '火') {
                    continue;
                  } else {
                    useMagics.push('等');
                  }
                // キャラとキャラ2がDUOパターン
                } else if (character.duo == character2.chara) {
                  if (character2.magic1atr == '木' || character2.magic3atr == '木') {
                    useMagics.push('木');
                  } else if (character2.magic1atr == '火' && character2.magic3atr == '火') {
                    continue;
                  } else {
                    useMagics.push('等');
                  }
                }
                if (useMagics.filter(item => item === '等').length <= 1) {
                  addUniqueCombo(duo3Img);
                }
              // 等倍を許容しない場合 
              } else {
                // M2は全て木が前提
                if (!(character.magic2atr == '木' && character1.magic2atr == '木' && character2.magic2atr == '木')) {
                  continue;
                }
                // キャラとキャラ1がDUOパターン
                if (character.duo == character1.chara) {
                  if (character1.magic1atr == '木' || character1.magic3atr == '木') {
                    addUniqueCombo(duo3Img);
                  }
                // キャラとキャラ2がDUOパターン
                } else if (character.duo == character2.chara) {
                  if (character2.magic1atr == '木' || character2.magic3atr == '木') {
                    addUniqueCombo(duo3Img);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

const openModal = (character: Character) => {
  computeDuo(character);
  if (selectedCharacter.value.length > 0) {
    showModal.value = true;
  }
};


onMounted(() => {
  characterStore.handlePageChange('relationPage');
});
</script>
<style scoped>
.controls-container {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  align-items: center;
}

.container {
  height: 100vh;
  padding: 0;
  padding-top: 15px;
  margin: 0;
  justify-content: center;
  align-items: center;
}

.character-image {
  width: 100%;
  height: auto;
  cursor: pointer;
  padding: 0;
}

.new-row {
  flex-basis: 100%;
}

.hand-collection-toggle {
  display: flex;
  align-items: center;
}

.toggle-button {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: bold;
  font-size: 0.875rem;
  color: #666;
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  white-space: nowrap;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-button:hover {
  background-color: #e3f2fd;
  border-color: #1976d2;
  color: #1976d2;
}

.toggle-button.active {
  background-color: #1976d2;
  border-color: #1976d2;
  color: white;
}

/* ラジオボタンとチェックボックスの高さとスタイルを調整 */
:deep(.v-input) {
  grid-template-rows: min-content 0 !important;
  padding: 1px;
}

:deep(.v-input__details) {
  display: none !important;
  min-height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
}

/* ラジオボタンとチェックボックスのラベル部分の高さをトグルボタンと合わせる */
:deep(.v-selection-control) {
  min-height: 40px !important;
  align-items: center;
}

:deep(.v-selection-control__wrapper) {
  height: auto;
  align-items: center;
}

/* ラジオボタングループの調整 */
:deep(.v-radio-group) {
  align-items: center;
}

:deep(.v-radio) {
  margin-right: 16px;
}
</style>
