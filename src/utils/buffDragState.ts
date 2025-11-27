import { reactive } from 'vue';

// Shared drag payload for buffs across SimChara instances
export const buffDragPayload = reactive<{
  fromCharaIndex: number | null;
  fromBuffIndex: number | null;
}>({
  fromCharaIndex: null,
  fromBuffIndex: null
});
