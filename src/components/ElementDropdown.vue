<template>
  <div ref="dropdown" class="dropdown select-wrapper">
    <div @click="toggleDropdown" class="dropdown">
      <div class="selected-option">
        <img :src="selectedOption.image" class="dropdown-image" alt="selected" />
      </div>
      <ul v-if="dropdownOpen" ref="dropdownMenu" class="dropdown-menu">
        <li v-for="option in options" :key="option.value" @click="selectOption(option)" class="dropdown-item">
          <img :src="option.image" class="dropdown-image" alt="option"/>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
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

const dropdown = ref(null);
const dropdownMenu = ref(null);

const element = computed(() => simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}Attribute`]);

const selectedOption = computed(() => {
  if (element.value) {
    return options.value.find(option => option.value === element.value);
  } else {
    return options.value[0];
  }
});

if (selectedOption.value) {
  simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}Attribute`] = selectedOption.value.value;
}
if (!selectedOption.value) {
  selectedOption.value = options.value[0];
}
const dropdownOpen = ref(false);

const toggleDropdown = () => {
  dropdownOpen.value = !dropdownOpen.value;
  if (dropdownOpen.value) {
    nextTick(() => {
      const rect = dropdown.value.getBoundingClientRect();
      const menu = dropdownMenu.value;
      if (menu) {
        menu.style.position = 'absolute';
        menu.style.top = `${rect.top - menu.offsetHeight - 5}px`;
        menu.style.left = `${rect.left}px`;
      }
    });
  }
};

const selectOption = (option) => {
  simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}Attribute`] = option.value;
  dropdownOpen.value = false;
};

const handleClickOutside = (event) => {
  if (dropdown.value && !dropdown.value.contains(event.target)) {
    dropdownOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.dropdown {
  position: relative;
  display: inline-block;
  cursor: pointer;
  width: 16px;
  height: 16px;
  vertical-align: middle;
  margin-right: 2px;
}

.selected-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  position: relative;
}

.dropdown-menu {
  position: fixed;
  transform: translateY(-100%);
  right: auto;
  background-color: white;
  border: 1px solid #ccc;
  z-index: 9999;
  list-style-type: none;
  padding: 1px;
  margin: 0;
  width: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: max-content;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.dropdown-item {
  padding: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  width: 14px;
  height: 14px;
  background-color: white;
}

.dropdown-item:hover {
  background-color: #f0f0f0;
}

.dropdown-image {
  width: 12px;
  height: 12px;
  object-fit: contain;
  display: block;
  margin: 0;
  padding: 0;
}

.select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  appearance: none;
  margin: 0;
  padding: 1px;
  margin-left: 3px;
  border-radius: 3px;
  border: 1px solid #ccc;
  background-color: white;
  cursor: pointer;
  font-size: 0.8em;
  height: 18px;
  margin-right: 1px;
}

/* ▼マークを削除するため、after疑似要素を削除 */
/* .select-wrapper::after {
  content: '';
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-size: 0.8em;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid #666;
} */
</style>
