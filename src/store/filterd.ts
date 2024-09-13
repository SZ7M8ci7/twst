// store/filterd.ts
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useFilterdStore = defineStore('filterd', () => {
  const tempSelectedCharacters = ref<string[]>([]);
  const tempSelectedRare = ref<string[]>([]);
  const isFirst = ref(true);
  const tempSelectedType = ref<string[]>([]);
  const tempSelectedAttr = ref<string[]>([]);
  const tempSelectedEffects = ref<string[]>([]);

  return {
    tempSelectedCharacters,
    tempSelectedRare,
    isFirst,
    tempSelectedType,
    tempSelectedAttr,
    tempSelectedEffects,
  };
});
