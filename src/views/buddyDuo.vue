<template>
  <v-container>
    <div class="matrix">
      <table>
        <thead>
          <tr>
            <th>
              <button @click="toggleMODE" class="mode-toggle-button" v-html="formattedMode"></button>
            </th>
            <th v-for="(header, index) in headers" :key="index">
              <img :src="headerImgs[index]" :alt="header" class="img" />
            </th>
          </tr>
          <tr>
            <th>Total</th>
            <td v-for="(total, index) in totals" :key="index">
              <button @click="showTotalCharacterModal(index)" class="cell-button">{{ total }}</button>
            </td>
          </tr>
        </thead>

        <tbody>
          <tr v-for="(row, rowIndex) in matrix" :key="rowIndex">
            <th><img :src="headerImgs[rowIndex]" class="img" /></th>
            <td v-for="(cell, cellIndex) in row" :key="cellIndex">
              <button
                v-if="cell !== null"
                @click="showCharacterModal(currentRelations[headers[rowIndex]][headers[cellIndex]])"
                class="cell-button"
              >
                {{ cell }}
              </button>
              <span v-else></span> 
            </td>

          </tr>
        </tbody>
        <tfoot>
        </tfoot>
      </table>
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
import { computed, onMounted, Ref, ref } from 'vue';
import { useCharacterStore, Character } from '@/store/characters';
import charactersInfo from '@/assets/characters_info.json';
import { storeToRefs } from 'pinia';
import characterData from '@/assets/characters_info.json';
import { loadImageUrls, createCharacterInfoMap, CharacterCardInfo } from '@/components/common';
import CharacterIconWithType from '@/components/CharacterIconWithType.vue';

const characterStore = useCharacterStore();
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

const characterInfoMap = ref<Map<string, CharacterCardInfo>>(new Map());
const imgUrlDictionary: Ref<Record<string, string>> = ref({});
const iconUrlDictionary: Ref<Record<string, string>> = ref({});

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

const showCharacterModal = (characterInfoArray: any[]) => {
  selectedCharacter.value = [];
  if (Array.isArray(characterInfoArray) && characterInfoArray.length > 0) {
    showModal.value = true;
    characterInfoArray.forEach((charFromRelation: { name:string; imgUrl: string; wikiURL: string; }) => {
      const info = characterInfoMap.value.get(charFromRelation.name);
      selectedCharacter.value.push([charFromRelation.imgUrl, charFromRelation.wikiURL, info?.type]);
    });
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
const showTotalCharacterModal = (colIndex: number) => {
  selectedCharacter.value = [];
  const targetColumnHeader = headers.value[colIndex];
  let charactersToShow: any[] = [];

  headers.value.forEach((rowHeader) => {
    const relation = currentRelations.value[rowHeader][targetColumnHeader];
    if (Array.isArray(relation) && relation.length > 0) {
      charactersToShow = charactersToShow.concat(relation);
    }
  });

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
    return import(`@/assets/img/${char.name}.png`)
      .then(module => {
        char.imgUrl = module.default;
      })
      .catch(() => {
        // console.error(`Failed to load image for ${char.name}. Setting to empty string.`);
        char.imgUrl = '';
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
  headers.value = charactersInfo.map((char) => char.name_ja);
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

  characters.value.forEach((character: Character) => {
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

  updateMatrix(duoRelations.value);
});
</script>
<style scoped>
.matrix {
  text-align: center;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  border: 1px solid #000;
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
  padding: 1px 2px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1; 
  min-width: 40px; 
  text-align: center;
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

/* .character-image-container と .character-card-type は CharacterIconWithType.vue に移動したので削除 */

</style>