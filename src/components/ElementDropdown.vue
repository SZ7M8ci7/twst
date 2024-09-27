<template>
  <div ref="dropdown" class="dropdown select-wrapper">
    <div @click="toggleDropdown" class="dropdown">
      <div class="selected-option">
        <img :src="selectedOption.image" class="dropdown-image" alt="selected" />
      </div>
      <ul v-if="dropdownOpen" class="dropdown-menu">
        <li v-for="option in options" :key="option.value" @click="selectOption(option)" class="dropdown-item">
          <img :src="option.image" class="dropdown-image" alt="option"/>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed} from 'vue';
import fire from "@/assets/img/fire.png"
import water from "@/assets/img/water.png"
import flora from "@/assets/img/flora.png"
import cosmic from "@/assets/img/cosmic.png"
import { useSimulatorStore } from '@/store/simulatorStore';
const simulatorStore = useSimulatorStore();

const props = defineProps(['charaIndex', 'elementIndex']);
const options = ref([
  { label: 'fire', value: '火', image: fire },
  { label: 'water', value: '水', image: water },
  { label: 'flora', value: '木', image: flora },
  { label: 'cosmic', value: '無', image: cosmic },
]);

const element = computed(() => simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}atr`]);

// ドロップダウンコンポーネントの参照
const dropdown = ref(null);
const selectedOption = computed(() => {
  if (element.value) {
    return options.value.find(option => option.value === element.value);
  } else {
    return options.value[0];
  }
});
if (selectedOption.value) {
  simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}atr`] = selectedOption.value.value;
}
if (!selectedOption.value) {
  selectedOption.value = options.value[0];
}
const dropdownOpen = ref(false);

const toggleDropdown = () => {
  dropdownOpen.value = !dropdownOpen.value;
};

const selectOption = (option) => {
  simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}atr`] = option.value;
  dropdownOpen.value = false; // 選択後にドロップダウンを閉じる
};
// ドキュメント全体でクリックを監視し、範囲外がクリックされたらドロップダウンを閉じる
const handleClickOutside = (event) => {
  if (dropdown.value && !dropdown.value.contains(event.target)) {
    dropdownOpen.value = false; // 選択後にドロップダウンを閉じる
  }
};

// マウント時にクリックイベントリスナーを追加
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

// アンマウント時にクリックイベントリスナーを削除
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.dropdown {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.selected-option {
  display: flex;
  align-items: center;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: white;
  border: 1px solid #ccc;
  z-index: 10;
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.dropdown-item {
  padding: 5px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.dropdown-item:hover {
  background-color: #f0f0f0;
}

.dropdown-image {
  width: 160%;
  height: 160%;
  padding-right: 15px;
  margin-top: 0px;
  transform: translate(-10%, 20%);
}
.select-wrapper {
  position: relative;
  display: inline-block;
  appearance: none;
  margin-right: 1px;
  padding: 1px 28%;
  border-radius: 5px; /* 角丸を適用 */
  border: 1px solid #ccc;
  background-color: white;
  cursor: pointer;
  font-size: 0.8em;
}


/* ドロップダウンマーク（▼）を表示するためのスタイル */
.select-wrapper::after {
  content: '▼';
  position: absolute;
  right: 5%;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 1em;
}

</style>
