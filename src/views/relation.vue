<template>
  <!-- ロード中に表示するロードスクリーン -->
  <div v-if="loadingImgUrl" class="text-center">
    <v-progress-circular indeterminate></v-progress-circular>
    <p>キャラクター情報を読み込んでいます...</p>
  </div>
  <!-- ロード完了後に表示するメインコンテンツ -->
  <div v-else>
    <v-container class="container" style="width: 95%;">
      <v-row>
        <v-col cols="12" v-for="rowIndex in Math.ceil(filteredCharacters.length / 10)" :key="rowIndex">
          <v-row>
            <v-col cols="1"></v-col>
            <v-col cols="1" v-for="(character) in filteredCharacters.slice((rowIndex - 1) * 11, rowIndex * 11)"
              :key="character.name" @click="openModal(character)" style="padding: 1px;">
              <img :src="character.imgUrl" :alt="character.name" class="character-image" />
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
import { computed, onBeforeMount, Ref, ref } from 'vue';
import { Character, useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';

const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const loadingImgUrl = ref(true);
const showModal = ref(false);
const selectedCharacter: Ref<string[][]> = ref([]);
const chara2name = ref<Record<string, string[]>>({});
const duo2name = ref<Record<string, string[]>>({});
const name2data = ref<Record<string, Character>>({});
const imgUrl2wikiUrl = ref<Record<string, string>>({});
const filteredCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }

  const visibleCharacters = characters.value.filter(character => character.visible && character.imgUrl && character.rare == "SSR");

  visibleCharacters.forEach(character => {
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

  return visibleCharacters;
});

const openModal = (character: Character) => {
  computeDuo(character);
  showModal.value = true;
};

function computeDuo(character: Character) {
  selectedCharacter.value = [] as string[][];
  for (let name1 of chara2name.value[character.duo]) {
    let character1 = name2data.value[name1];
    if (character1.duo == character.chara) {
      selectedCharacter.value.push([character.imgUrl as any, character1.imgUrl]);
      for (let name2 of duo2name.value[character.chara]) {
        let character2 = name2data.value[name2];
        if (character2.duo == character.chara) {
          selectedCharacter.value.push([character.imgUrl as any, character1.imgUrl, character2.imgUrl])
        }
        if (character2.duo == character1.chara) {
          selectedCharacter.value.push([character.imgUrl as any, character1.imgUrl, character2.imgUrl])
        }
      }
      for (let name2 of duo2name.value[character1.chara]) {
        let character2 = name2data.value[name2];
        if (character2.duo == character.chara) {
          selectedCharacter.value.push([character.imgUrl as any, character1.imgUrl, character2.imgUrl])
        }
        if (character2.duo == character1.chara) {
          selectedCharacter.value.push([character.imgUrl as any, character1.imgUrl, character2.imgUrl])
        }
      }
    } else {
      for (let name2 of chara2name.value[character1.duo]) {
        let character2 = name2data.value[name2];
        if (character2.duo == character1.chara) {
          selectedCharacter.value.push([character.imgUrl as any, character1.imgUrl, character2.imgUrl])
        }
        if (character2.duo == character.chara) {
          selectedCharacter.value.push([character.imgUrl as any, character1.imgUrl, character2.imgUrl])
        }
      }
    }
  }
}

onBeforeMount(() => {
  const promises = characters.value.map(character => {
    return import(`@/assets/img/${character.name}.png`)
      .then(module => {
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