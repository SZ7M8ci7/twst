<template>
  <div ref="dropdown" class="select-wrapper">
    <button
      type="button"
      class="dropdown-trigger"
      :class="{ 'show-target-trigger': showTargetOptions, 'mobile-expanded': showTargetOptions && dropdownOpen }"
      @click.stop="toggleDropdown"
    >
      <div class="trigger-slot">
        <img :src="selectedMagicOption.image" class="dropdown-image" alt="selected magic attribute" />
      </div>
      <div v-if="showTargetOptions" class="trigger-slot target-slot" :class="{ empty: !selectedTargetOption }">
        <img
          v-if="selectedTargetOption"
          :src="selectedTargetOption.image"
          class="dropdown-image"
          alt="selected opponent attribute"
        />
      </div>
    </button>

    <div v-if="dropdownOpen" ref="dropdownMenu" class="dropdown-menu">
      <div class="dropdown-columns" :class="{ 'single-column': !showTargetOptions }">
        <div class="option-column">
          <button
            v-for="option in magicOptions"
            :key="option.value"
            type="button"
            class="dropdown-item icon-item"
            :class="{ active: option.value === magicAttribute }"
            @click.stop="selectMagicOption(option)"
          >
            <img :src="option.image" class="dropdown-image" :alt="option.label" />
          </button>
        </div>

        <div v-if="showTargetOptions" class="option-column target-column">
          <button
            type="button"
            class="dropdown-item icon-item clear-item"
            :class="{ active: !magicTargetAttribute }"
            @click.stop="clearTargetOption"
          >
            <div class="empty-option-slot"></div>
          </button>
        <button
          v-for="option in targetOptions"
          :key="option.value"
          type="button"
            class="dropdown-item icon-item"
          :class="{ active: option.value === magicTargetAttribute }"
          @click.stop="selectTargetOption(option)"
        >
          <img :src="option.image" class="dropdown-image" :alt="option.label" />
        </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import fire from '@/assets/img/fire.webp';
import water from '@/assets/img/water.webp';
import flora from '@/assets/img/flora.webp';
import cosmic from '@/assets/img/cosmic.webp';
import { useSimulatorStore } from '@/store/simulatorStore';
import { getMagicTargetAttribute, SIMULATOR_TARGET_ATTRIBUTES } from '@/utils/simulatorAttributes';

const simulatorStore = useSimulatorStore();

const props = defineProps({
  charaIndex: {
    type: Number,
    required: true
  },
  elementIndex: {
    type: Number,
    required: true
  },
  selectedAttribute: {
    type: String,
    default: '対全'
  }
});

const magicOptions = [
  { label: '火', value: '火', image: fire },
  { label: '水', value: '水', image: water },
  { label: '木', value: '木', image: flora },
  { label: '無', value: '無', image: cosmic }
];

const targetOptions = [
  { label: '対火', value: SIMULATOR_TARGET_ATTRIBUTES[0], element: '火', image: fire },
  { label: '対水', value: SIMULATOR_TARGET_ATTRIBUTES[1], element: '水', image: water },
  { label: '対木', value: SIMULATOR_TARGET_ATTRIBUTES[2], element: '木', image: flora },
  { label: '対無', value: SIMULATOR_TARGET_ATTRIBUTES[3], element: '無', image: cosmic }
];

const dropdown = ref(null);
const dropdownMenu = ref(null);
const dropdownOpen = ref(false);

const magicAttribute = computed(() => (
  simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}Attribute`]
));

const magicTargetAttribute = computed(() => (
  getMagicTargetAttribute(simulatorStore.deckCharacters[props.charaIndex], props.elementIndex)
));

const selectedMagicOption = computed(() => (
  magicOptions.find(option => option.value === magicAttribute.value) || magicOptions[0]
));

const showTargetOptions = computed(() => props.selectedAttribute === '対全');

const selectedTargetOption = computed(() => {
  if (!showTargetOptions.value) return null;
  return targetOptions.find(option => option.value === magicTargetAttribute.value) || null;
});

if (!magicAttribute.value) {
  simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}Attribute`] = magicOptions[0].value;
}

const updateMenuPosition = () => {
  const trigger = dropdown.value;
  const menu = dropdownMenu.value;
  if (!trigger || !menu) return;

  const rect = trigger.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
};

const toggleDropdown = () => {
  dropdownOpen.value = !dropdownOpen.value;
  if (dropdownOpen.value) {
    nextTick(updateMenuPosition);
  }
};

const selectMagicOption = (option) => {
  simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}Attribute`] = option.value;
  dropdownOpen.value = false;
};

const selectTargetOption = (option) => {
  simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}TargetAttribute`] = option.value;
  dropdownOpen.value = false;
};

const clearTargetOption = () => {
  simulatorStore.deckCharacters[props.charaIndex][`magic${props.elementIndex}TargetAttribute`] = '';
  dropdownOpen.value = false;
};

const handleClickOutside = (event) => {
  if (dropdown.value && !dropdown.value.contains(event.target)) {
    dropdownOpen.value = false;
  }
};

const handleWindowChange = () => {
  if (!dropdownOpen.value) return;
  updateMenuPosition();
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', handleWindowChange);
  window.addEventListener('scroll', handleWindowChange, true);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleWindowChange);
  window.removeEventListener('scroll', handleWindowChange, true);
});
</script>

<style scoped>
.select-wrapper {
  position: relative;
  display: inline-flex;
}

.dropdown-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 18px;
  height: 18px;
  padding: 1px;
  border-radius: 3px;
  border: 1px solid #ccc;
  background-color: white;
  cursor: pointer;
  gap: 2px;
}

.dropdown-trigger.show-target-trigger {
  width: 36px;
}

.dropdown-menu {
  position: fixed;
  z-index: 9999;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background-color: white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
}

.dropdown-columns {
  display: flex;
  gap: 4px;
}

.dropdown-columns.single-column {
  gap: 0;
}

.option-column {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 2px;
}

.target-column {
  padding-left: 4px;
  border-left: 1px solid #e0e0e0;
}

.trigger-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}

.target-slot {
  border-radius: 2px;
}

.target-slot.empty {
  border: 1px dashed #ccc;
  box-sizing: border-box;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 1px;
  border: 1px solid transparent;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
}

.dropdown-item:hover {
  background-color: #f5f5f5;
}

.dropdown-item.active {
  border-color: #90caf9;
  background-color: #e3f2fd;
}

.dropdown-image {
  width: 12px;
  height: 12px;
  object-fit: contain;
  display: block;
}

.empty-option-slot {
  width: 10px;
  height: 10px;
  border: 1px dashed #999;
  border-radius: 2px;
  box-sizing: border-box;
}

:deep(.v-theme--dark) .dropdown-trigger,
:deep(.v-theme--dark) .dropdown-menu,
:deep(.v-theme--dark) .dropdown-item {
  background-color: #303030;
  border-color: #666;
}

:deep(.v-theme--dark) .dropdown-item:hover {
  background-color: #3a3a3a;
}

:deep(.v-theme--dark) .dropdown-item.active {
  background-color: rgba(25, 118, 210, 0.2);
}

:deep(.v-theme--dark) .target-column {
  background-color: #555;
}

:deep(.v-theme--dark) .target-slot.empty,
:deep(.v-theme--dark) .empty-option-slot {
  border-color: #888;
}

@media (max-width: 767px) {
  .dropdown-trigger.show-target-trigger {
    width: 18px;
  }

  .dropdown-trigger.show-target-trigger .target-slot {
    display: none;
  }

  .dropdown-trigger.show-target-trigger.mobile-expanded {
    width: 36px;
  }

  .dropdown-trigger.show-target-trigger.mobile-expanded .target-slot {
    display: flex;
  }
}
</style>
