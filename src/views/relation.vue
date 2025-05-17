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

      <div style="display: flex; flex-direction: row; gap: 15px;">
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
                  <td v-for="tmp in value" :key="tmp">
                    <a :href="imgUrl2wikiUrl[tmp]" target="_blank" rel="noopener noreferrer">
                      <img :src=tmp class="character-image" />
                    </a>
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
import { computed, onBeforeMount, onMounted, Ref, ref } from 'vue';
import { Character, useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
import characterData from '@/assets/characters_info.json';

interface CharacterInfo {
  name_ja: string;
  name_en: string;
  dorm: string;
  theme_1: string;
  theme_2: string;
}

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const loadingImgUrl = ref(true);
const showModal = ref(false);
const selectedCharacter: Ref<string[][]> = ref([]);
const chara2name = ref<Record<string, string[]>>({});
const duo2name = ref<Record<string, string[]>>({});
const name2data = ref<Record<string, Character>>({});
const imgUrl2wikiUrl = ref<Record<string, string>>({});
const selectedAttribute = ref('all');
const allowEqualMultiplier = ref(false);
const mutualDuo = ref(true);
const tripleDuo = ref(true);
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

  const visibleCharacters = characters.value.filter(character => character.visible && character.imgUrl && character.rare == "SSR");

  // characters_info.jsonの順序に基づいてソート
  const sortedCharacters = [...visibleCharacters].sort((a, b) => {
    const indexA = (characterData as CharacterInfo[]).findIndex(char => char.name_ja === a.chara);
    const indexB = (characterData as CharacterInfo[]).findIndex(char => char.name_ja === b.chara);
    return indexA - indexB;
  });

  sortedCharacters.forEach(character => {
    name2data.value[character.name] = character;
    imgUrl2wikiUrl.value[character.imgUrl] = character.wikiURL;
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
onBeforeMount(() => {
  const promises = characters.value.map(character => {
    return import(`@/assets/img/${character.name}.png`)
      .then(module => {
        character.imgUrl = module.default;
      })
      .catch(() => {
        character.imgUrl = '';
      });
  });

  Promise.all(promises).then(() => {
    loadingImgUrl.value = false;

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
  // duo相手のカード全てに対してループでチェックする
  for (let name1 of chara2name.value[character.duo] || []) {
    let character1 = name2data.value[name1];
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
          selectedCharacter.value.push(duoImg);

        // 火属性が選択されている場合
        } else if (selectedAttribute.value == 'fire') {
          // 等倍を一つ許容している場合は片方等倍でも追加
          if (allowEqualMultiplier.value) {
            if (arraysEqualIgnoreOrder(atrs, ['火', '火']) || arraysEqualIgnoreOrder(atrs, ['火', '無']) || arraysEqualIgnoreOrder(atrs, ['火', '木'])) {
              selectedCharacter.value.push(duoImg);
            }
          } else {
            if (arraysEqualIgnoreOrder(atrs, ['火', '火'])) {
              selectedCharacter.value.push(duoImg);
            }
          }
        // 水属性が選択されている場合
        } else if (selectedAttribute.value == 'water') {
          // 等倍を一つ許容している場合は片方等倍でも追加
          if (allowEqualMultiplier.value) {
            if (arraysEqualIgnoreOrder(atrs, ['水', '水']) || arraysEqualIgnoreOrder(atrs, ['水', '無']) || arraysEqualIgnoreOrder(atrs, ['水', '火'])) {
              selectedCharacter.value.push(duoImg);
            }
          } else {
            if (arraysEqualIgnoreOrder(atrs, ['水', '水'])) {
              selectedCharacter.value.push(duoImg);
            }
          }
        // 木属性が選択されている場合
        } else if (selectedAttribute.value == 'flora') {
          // 等倍を一つ許容している場合は片方等倍でも追加
          if (allowEqualMultiplier.value) {
            if (arraysEqualIgnoreOrder(atrs, ['木', '木']) || arraysEqualIgnoreOrder(atrs, ['木', '無']) || arraysEqualIgnoreOrder(atrs, ['木', '水'])) {
              selectedCharacter.value.push(duoImg);
            }
          } else {
            if (arraysEqualIgnoreOrder(atrs, ['木', '木'])) {
              selectedCharacter.value.push(duoImg);
            }
          }
        }
      }
      // 3デュオを選択
      if (tripleDuo.value) {
        // duo相手に自身か、相互duoの相手を対象に持つカードをループでチェック
        for (let name2 of [...(duo2name.value[character.chara] || []), ...(duo2name.value[character1.chara] || [])]) {
          let character2 = name2data.value[name2];
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
            selectedCharacter.value.push(duo3Img);

          // 火属性が選択されている場合
          } else if (selectedAttribute.value == 'fire') {
            // 等倍を一つ許容している場合は一つ等倍でも追加
            if (allowEqualMultiplier.value) {
              // DUO魔法が全て火の場合はそれ以外で火、木、無を許容
              if (arraysEqualIgnoreOrder(atrs, ['火', '火', '火']) && ['火','木','無'].some(item => useMagics.includes(item))) {
                selectedCharacter.value.push(duo3Img);
              } else if (arraysEqualIgnoreOrder(atrs, ['火', '火', '木']) || arraysEqualIgnoreOrder(atrs, ['火', '火', '無'])) {
                if (['火'].some(item => useMagics.includes(item))) {
                  selectedCharacter.value.push(duo3Img);
                }
              }
            } else {
              if (arraysEqualIgnoreOrder(atrs, ['火', '火', '火']) && ['火'].some(item => useMagics.includes(item))) {
                  selectedCharacter.value.push(duo3Img);
              }
            }
          // 水属性が選択されている場合
          } else if (selectedAttribute.value == 'water') {
            // 等倍を一つ許容している場合は一つ等倍でも追加
            if (allowEqualMultiplier.value) {
              // DUO魔法が全て水の場合はそれ以外で水、火、無を許容
              if (arraysEqualIgnoreOrder(atrs, ['水', '水', '水']) && ['水','火','無'].some(item => useMagics.includes(item))) {
                selectedCharacter.value.push(duo3Img);
              } else if (arraysEqualIgnoreOrder(atrs, ['水', '水', '火']) || arraysEqualIgnoreOrder(atrs, ['水', '水', '無'])) {
                if (['水'].some(item => useMagics.includes(item))) {
                  selectedCharacter.value.push(duo3Img);
                }
              }
            } else {
              if (arraysEqualIgnoreOrder(atrs, ['水', '水', '水']) && ['水'].some(item => useMagics.includes(item))) {
                  selectedCharacter.value.push(duo3Img);
              }
            }
          // 木属性が選択されている場合
          } else if (selectedAttribute.value == 'flora') {
            // 等倍を一つ許容している場合は一つ等倍でも追加
            if (allowEqualMultiplier.value) {
              // DUO魔法が全て木の場合はそれ以外で木、水、無を許容
              if (arraysEqualIgnoreOrder(atrs, ['木', '木', '木']) && ['木','水','無'].some(item => useMagics.includes(item))) {
                selectedCharacter.value.push(duo3Img);
              } else if (arraysEqualIgnoreOrder(atrs, ['木', '木', '水']) || arraysEqualIgnoreOrder(atrs, ['木', '木', '無'])) {
                if (['木'].some(item => useMagics.includes(item))) {
                  selectedCharacter.value.push(duo3Img);
                }
              }
            } else {
              if (arraysEqualIgnoreOrder(atrs, ['木', '木', '木']) && ['木'].some(item => useMagics.includes(item))) {
                  selectedCharacter.value.push(duo3Img);
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
          const duo3Img = [characterImgUrl, character1ImgUrl, character2.imgUrl as unknown as string];
          // 循環3デュオの場合
          if (character2.duo == character.chara) {
            // 全属性の場合は無条件で追加
            if (selectedAttribute.value == 'all') {
              selectedCharacter.value.push(duo3Img);
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
                  selectedCharacter.value.push(duo3Img);
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
                selectedCharacter.value.push(duo3Img);                
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
                  selectedCharacter.value.push(duo3Img);
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
                selectedCharacter.value.push(duo3Img);                
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
                  selectedCharacter.value.push(duo3Img);
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
                selectedCharacter.value.push(duo3Img);                
              }
            }

          // 対象キャラ以外が相互デュオの場合
          } else if (character2.duo == character1.chara) {
            // 全属性の場合は無条件で追加
            if (selectedAttribute.value == 'all') {
              selectedCharacter.value.push(duo3Img);
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
                  selectedCharacter.value.push(duo3Img);
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
                    selectedCharacter.value.push(duo3Img);
                  }
                // キャラとキャラ2がDUOパターン
                } else if (character.duo == character2.chara) {
                  if (character2.magic1atr == '火' || character2.magic3atr == '火') {
                    selectedCharacter.value.push(duo3Img);
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
                  selectedCharacter.value.push(duo3Img);
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
                    selectedCharacter.value.push(duo3Img);
                  }
                // キャラとキャラ2がDUOパターン
                } else if (character.duo == character2.chara) {
                  if (character2.magic1atr == '水' || character2.magic3atr == '水') {
                    selectedCharacter.value.push(duo3Img);
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
                  selectedCharacter.value.push(duo3Img);
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
                    selectedCharacter.value.push(duo3Img);
                  }
                // キャラとキャラ2がDUOパターン
                } else if (character.duo == character2.chara) {
                  if (character2.magic1atr == '木' || character2.magic3atr == '木') {
                    selectedCharacter.value.push(duo3Img);
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
</style>
