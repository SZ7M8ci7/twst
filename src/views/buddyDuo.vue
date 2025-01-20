<template>
  <v-container>
    <div class="matrix">
      <table>
        <thead>
          <tr>
            <th>
              <button @click="toggleMODE" class="mode-toggle-button">{{ mode }}</button>
            </th>
            <th v-for="(header, index) in headers" :key="index">
              <img :src="headerImgs[index]" :alt="header" class="img" />
            </th>
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
          <tr>
            <th>Total</th>
            <td v-for="(total, index) in totals" :key="index">{{ total }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  </v-container>
  <!-- モーダル -->
  <v-dialog v-model="showModal" max-width="50%">
    <v-card>
      <v-card-text>
        <v-simple-table style="display: flex; justify-content: center;">
          <template v-slot:default>
            <div style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;">
              <li v-for="(value, key) in selectedCharacter" :key="key" style="list-style: none;">
                <a :href="value[1]" target="_blank" rel="noopener noreferrer">
                  <img :src="value[0]" class="character-image" />
                </a>
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
import { useCharacterStore } from '@/store/characters';
import charactersInfo from '@/assets/characters_info.json';
import { storeToRefs } from 'pinia';
import characterData from '@/assets/characters_info.json';
import { useImageUrlDictionary } from '@/components/common';
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const headers: Ref<string[]> = ref([]); // 型をstring[]に指定
const headerImgs = ref<string[]>([]);
const selectedCharacter: Ref<string[][]> = ref([]);
const buddyRelations: Ref<Record<string, Record<string, any>>> = ref({});
const duoRelations: Ref<Record<string, Record<string, any>>> = ref({});
const showModal = ref(false);
const mode = ref('DUO');
// Matrix data
const matrix: Ref<(number|undefined)[][]> = ref([]);
const currentRelations = computed(() => {
  return mode.value === 'DUO' ? duoRelations.value : buddyRelations.value;
});
const toggleMODE = () => {
  if (mode.value == 'DUO') {
    mode.value = 'Buddy';
    updateMatrix(buddyRelations.value);
  } else {
    mode.value = 'DUO';
    updateMatrix(duoRelations.value);
  }
}
const imgUrlDictionary: Ref<Record<string, string>> = ref({});
const showCharacterModal = (characterInfo: string | any[]) => {
  selectedCharacter.value = [] as string[][];
  if (Array.isArray(characterInfo) && characterInfo.length > 0) {  // Check if it's an array
    showModal.value = true;
    characterInfo.forEach((character: { imgUrl: string; wikiURL: string; }) => {
      selectedCharacter.value.push([character.imgUrl, character.wikiURL]);
      console.log(character);
    });
  }
};
const updateMatrix = (relations: Record<string, Record<string, any[]>>) => {
  matrix.value = headers.value.map((char) =>
    headers.value.map((otherChar) =>
      relations[char][otherChar] && relations[char][otherChar].length > 0
        ? relations[char][otherChar].length
        : undefined // Replace null with 0 to match number[][] type
    )
  );
};
characters.value.map(character => {
  return import(`@/assets/img/${character.name}.png`)
    .then(module => {
      character.imgUrl = module.default;
    })
    .catch(() => {
      character.imgUrl = ''; // 画像の読み込みに失敗した場合
    });
});
const totals = computed(() => {
  // Check if matrix.value exists, is not null, and is not empty
  if (!matrix.value || matrix.value.length === 0 || matrix.value[0].length === 0) return [];

  return matrix.value[0].map((_, colIndex) =>
    matrix.value.reduce((sum, row) => sum + (row[colIndex] ?? 0), 0) // Default to 0 if cell is null
  );
});


onMounted(async () => {

  imgUrlDictionary.value = await useImageUrlDictionary(characterData);
  headers.value = charactersInfo.map((char) => char.name_ja);
  headerImgs.value = charactersInfo.map((char) => imgUrlDictionary.value[char.name_en]);

  headers.value.forEach((char) => {
    duoRelations.value[char] = {};
    buddyRelations.value[char] = {};
    headers.value.forEach((otherChar) => {
      duoRelations.value[char][otherChar] = 0;
      buddyRelations.value[char][otherChar] = 0;
    });
  });
  duoRelations.value['トレイン'] = {};
    buddyRelations.value['トレイン'] = {};
    headers.value.forEach((otherChar) => {
      duoRelations.value['トレイン'][otherChar] = 0;
      buddyRelations.value['トレイン'][otherChar] = 0;
    });
  // Add character information to duoRelations instead of counting
  characters.value.forEach((character) => {
      if (!duoRelations.value[character.chara][character.duo]) {
        duoRelations.value[character.chara][character.duo] = [];
      }
      if (!buddyRelations.value[character.chara][character.buddy1c]) {
        buddyRelations.value[character.chara][character.buddy1c] = [];
      }
      if (!buddyRelations.value[character.chara][character.buddy2c]) {
        buddyRelations.value[character.chara][character.buddy2c] = [];
      }
      if (!buddyRelations.value[character.chara][character.buddy3c]) {
        buddyRelations.value[character.chara][character.buddy3c] = [];
      }
      duoRelations.value[character.chara][character.duo].push(character);
      buddyRelations.value[character.chara][character.buddy1c].push(character);
      buddyRelations.value[character.chara][character.buddy2c].push(character);
      buddyRelations.value[character.chara][character.buddy3c].push(character);
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
  padding: 0px;
}

.img {
  width: 28px;
  margin: 0;
  padding: 0;
}
.mode-toggle-button {
  background-color: #5de459; /* Choose a color */
  box-shadow: 0 2px 2px rgba(0, 0, 0, .3);
  color: #3b4b27;
  border: none;
  padding: 1px 5px;
  cursor: pointer;
  border-radius: 8px;
  font-size: 12px;
}
.cell-button {
  background-color: #e0e0e0;
  border-radius: 8px;
  padding: 1px 7px;
  border: none;
  color: inherit;
  font-size: inherit;
  cursor: pointer;
  box-shadow: 0 2px 2px rgba(0, 0, 0, .3);
}

.cell-button:hover {
  color: #e25513; /* Highlight color on hover */
}
</style>