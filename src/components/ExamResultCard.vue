<template>
  <figure :title="label">
    <div class="result-card-image">
      <img :src="src || defaultImg" :alt="label" loading="lazy" />
      <span v-if="card.support" class="support-badge">S</span>
      <span v-if="card.level !== undefined" class="card-level">Lv{{ card.level }}</span>
    </div>
    <figcaption class="selected-magic-icons" :aria-label="`M${card.selectedMagic.join('/M')}`">
      <span v-for="magic in [1, 2, 3]" :key="magic" class="magic-icon" :class="{ selected: card.selectedMagic.includes(magic as 1 | 2 | 3) }">M{{ magic }}</span>
    </figcaption>
  </figure>
</template>

<script setup lang="ts">
import type { SearchCard } from '@/domain/examSearch/types';
import defaultImg from '@/assets/img/default.webp';
defineProps<{ card: Pick<SearchCard, 'support' | 'selectedMagic'> & { level?: number }; label: string; src?: string }>();
</script>

<style scoped>
.card-level {
  position: absolute; right: 0; bottom: 0;
  color: #fff; font-size: 10px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums;
  text-shadow: -1px -1px 0 #14202b, 0 -1px 0 #14202b, 1px -1px 0 #14202b,
    -1px 0 0 #14202b, 1px 0 0 #14202b,
    -1px 1px 0 #14202b, 0 1px 0 #14202b, 1px 1px 0 #14202b;
}
figure { margin: 0; min-width: 0; border: 1px solid #ccd8e2; border-radius: 5px; overflow: hidden; }
.result-card-image { position: relative; aspect-ratio: 1; overflow: hidden; background: #eef3f7; }
.result-card-image img { display: block; width: 100%; height: auto; object-fit: cover; }
.selected-magic-icons { display: flex; gap: 2px; padding: 2px; background: #152336c9; }
.magic-icon { flex: 1; border-radius: 2px; text-align: center; font-size: 9px; line-height: 14px; color: #ffffff66; }
.magic-icon.selected { background: #fff; color: #173e65; font-weight: 800; }
.support-badge { position: absolute; left: 3px; top: 3px; padding: 0 3px; border-radius: 3px; background: #14202bcc; color: #fff; font-size: 10px; font-weight: 800; }
</style>
