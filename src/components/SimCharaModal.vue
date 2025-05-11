<template>
  <v-container class="container" style="width: 95%;">
  <div class="modal-overlay" @click.self="closeModal">
    <div class="modal-content">
      <div class="character-grid">
        <v-row>
          <v-col cols="12" v-for="rowIndex in Math.ceil(filteredCharacters.length / 5)" :key="rowIndex">
            <v-row>
              <v-col cols="1"></v-col>
              <v-col cols="2" v-for="(character) in filteredCharacters.slice((rowIndex - 1) * 5, rowIndex * 5)"
                :key="character.name" @click="selectImage(character)" style="padding: 1px;">
                <img :src="character.imgUrl" :alt="character.name" class="character-image" />
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </div>
    </div>
  </div>
</v-container>
</template>

<script setup>
import { computed, onBeforeMount, ref} from 'vue';
import { useCharacterStore } from '@/store/characters';
import { storeToRefs } from 'pinia';
const characterStore = useCharacterStore();
const { characters } = storeToRefs(characterStore);
const loadingImgUrl = ref(true);
const filteredCharacters = computed(() => {
  if (loadingImgUrl.value) {
    return []; // 画像URLの読み込み中は空の配列を返す
  }

  const visibleCharacters = characters.value.filter(character => character.visible && character.imgUrl);


  return visibleCharacters;
});

const emit = defineEmits(['close', 'select']);  // emit関数を定義
const closeModal = () => {
  emit('close');
};

const selectImage = (img) => {
  emit('select', img);
};
import defaultImg from '@/assets/img/default.png';

onBeforeMount(() => {
  // 画像の読み込みを最適化するために、表示されるキャラクターのみを処理
  const visibleCharacters = characters.value.filter(character => character.visible);
  
  // 画像の読み込みを小さなバッチに分割して処理
  const batchSize = 10;
  const batches = [];
  
  for (let i = 0; i < visibleCharacters.length; i += batchSize) {
    batches.push(visibleCharacters.slice(i, i + batchSize));
  }
  
  // バッチごとに順次処理
  const processBatch = async (index) => {
    if (index >= batches.length) {
      loadingImgUrl.value = false; // すべての画像のロードが完了
      return;
    }
    
    const batch = batches[index];
    const promises = batch.map(character => {
      return import(`@/assets/img/${character.name}.png`)
        .then(module => {
          character.imgUrl = module.default;
        })
        .catch(() => {
          console.log(`Image not found for ${character.name}, using default`);
          character.imgUrl = defaultImg; // デフォルト画像を使用
        });
    });
    
    await Promise.all(promises);
    // 次のバッチを処理
    setTimeout(() => processBatch(index + 1), 0);
  };
  
  // 最初のバッチから処理開始
  processBatch(0);
});
</script>

<style scoped>
.character-image {
  width: 100%;
  height: auto;
  cursor: pointer;
  padding: 0;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
}

.modal-content {
  background: white;
  padding: 2%;
  max-height: 80vh;
  overflow-y: auto;
}

.character-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.character-thumbnail {
  cursor: pointer;
  object-fit: cover;
}
</style>
