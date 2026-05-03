<template>
  <img
    ref="imageElement"
    :src="currentSrc"
    :alt="alt"
    loading="lazy"
    decoding="async"
    @error="handleImageError"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import defaultImg from '@/assets/img/default.webp';

const props = withDefaults(defineProps<{
  src?: string;
  alt?: string;
  rootMargin?: string;
}>(), {
  src: '',
  alt: '',
  rootMargin: '300px',
});

const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
const imageElement = ref<HTMLImageElement | null>(null);
const currentSrc = ref(transparentPixel);
let observer: IntersectionObserver | null = null;
let hasLoaded = false;

function resolveImageSrc() {
  return props.src || defaultImg;
}

function loadImage() {
  hasLoaded = true;
  currentSrc.value = resolveImageSrc();
  observer?.disconnect();
  observer = null;
}

function handleImageError() {
  const fallbackSrc = new URL(defaultImg, window.location.href).href;
  if (currentSrc.value === fallbackSrc) {
    return;
  }
  currentSrc.value = fallbackSrc;
}

watch(() => props.src, () => {
  if (hasLoaded) {
    currentSrc.value = resolveImageSrc();
  }
});

onMounted(() => {
  if (!imageElement.value || !('IntersectionObserver' in window)) {
    loadImage();
    return;
  }

  observer = new IntersectionObserver((entries) => {
    if (entries.some(entry => entry.isIntersecting)) {
      loadImage();
    }
  }, {
    rootMargin: props.rootMargin,
  });

  observer.observe(imageElement.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>
