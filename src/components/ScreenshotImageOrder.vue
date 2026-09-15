<template>
  <div ref="list" class="image-order-grid">
    <div v-for="(fileIndex,position) in modelValue" :key="fileIndex" class="order-image" :data-image-id="fileIndex" role="button" :tabindex="disabled ? -1 : 0" :aria-disabled="disabled" :aria-label="t('screenshot.imageNumber',{number:position+1})" :aria-description="t('screenshot.dragKeyboardHelp')" @keydown="moveWithKey($event,position)">
      <img :src="sources[fileIndex].url" alt="" draggable="false" loading="lazy" />
      <span class="order-badge" aria-hidden="true">{{ position+1 }}</span>
      <span class="order-grip" aria-hidden="true">⠿</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Sortable from 'sortablejs';
import { moveImage } from '@/domain/handScreenshot/export';

const props = defineProps<{ modelValue: number[]; sources: { url: string }[]; disabled?: boolean }>();
const emit = defineEmits<{ (event: 'update:modelValue', order: number[]): void }>();
const { t } = useI18n(), list = ref<HTMLElement>();
let sortable: Sortable | undefined;
function move(from: number, to: number) {
  if (props.disabled || from === to) return;
  emit('update:modelValue', moveImage(props.modelValue, from, to-from));
}
async function moveWithKey(event: KeyboardEvent, position: number) {
  if (props.disabled || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  const key = props.modelValue[position];
  move(position, position + (['ArrowUp','ArrowLeft'].includes(event.key) ? -1 : 1));
  await nextTick();
  list.value?.querySelector<HTMLElement>(`[data-image-id="${key}"]`)?.focus();
}
onMounted(() => {
  sortable = new Sortable(list.value!, {
    draggable: '.order-image', animation: 180, disabled: props.disabled,
    forceFallback: true, fallbackOnBody: true, fallbackTolerance: 4,
    delay: 180, delayOnTouchOnly: true, touchStartThreshold: 4,
    scroll: true, scrollSensitivity: 70, scrollSpeed: 12,
    ghostClass: 'order-ghost', chosenClass: 'order-chosen',
    onEnd({ item, from, oldIndex, newIndex }) {
      if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
      // Restore the old DOM before Vue applies the reordered keyed list.
      item.remove(); from.insertBefore(item, from.children[oldIndex] ?? null);
      move(oldIndex, newIndex);
    },
  });
});
watch(() => props.disabled, value => sortable?.option('disabled', !!value));
onBeforeUnmount(() => sortable?.destroy());
</script>

<style scoped>
.image-order-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
.order-image { position:relative; min-width:0; padding:8px; background:#eeeae3; border:2px solid transparent; border-radius:14px; cursor:grab; user-select:none; -webkit-user-select:none; transition:border-color .15s,box-shadow .15s; }
.order-image img { display:block; width:100%; aspect-ratio:16/10; object-fit:contain; pointer-events:none; border-radius:7px; }
.order-image:hover,.order-image:focus-visible { border-color:#9a8550; box-shadow:0 3px 16px #0001; outline:none; }
.order-image[aria-disabled=true] { cursor:default; opacity:.65; }
.order-badge,.order-grip { position:absolute; top:14px; display:grid; place-items:center; height:28px; min-width:28px; border-radius:8px; background:#fffef4ed; color:#51452e; box-shadow:0 1px 5px #0002; pointer-events:none; }
.order-badge { left:14px; font-size:.8rem; font-weight:700; }.order-grip { right:14px; font-size:1.3rem; }
.order-ghost { opacity:.25; border:2px dashed #9a8550; }.order-chosen { cursor:grabbing; border-color:#9a8550; }
@media(max-width:600px) { .image-order-grid { grid-template-columns:minmax(0,1fr); gap:14px; }.order-image { padding:5px; } }
</style>
