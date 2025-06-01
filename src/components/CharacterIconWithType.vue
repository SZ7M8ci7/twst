<template>
  <component :is="rootTag" v-bind="linkAttributes" class="character-icon-wrapper">
    <div class="character-image-container">
      <img :src="finalImgSrc" class="character-image" :style="imageStyle" />
      <span v-if="cardType && shouldShowCardType" class="character-card-type" :style="cardTypeStyle">{{ cardType }}</span>
    </div>
  </component>
</template>

<script setup lang="ts">
import { defineProps, computed, StyleValue } from 'vue';

const props = defineProps<{
  imgSrc?: string;      // 既存:直接画像URLを指定する場合
  wikiUrl?: string;
  cardType?: string;
  iconSize?: number; 
  iconKey?: string;     // 新規:アイコン辞書から引くためのキー
  iconDictionary?: Record<string, string>; // 新規:アイコンURL辞書
}>();

const DEFAULT_ICON_SIZE = 40;
const MIN_SIZE_TO_SHOW_TYPE = 30; // カードタイプを表示する最小アイコンサイズ

const rootTag = computed(() => (props.wikiUrl ? 'a' : 'div'));

const linkAttributes = computed(() => {
  if (props.wikiUrl) {
    return {
      href: props.wikiUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
    };
  }
  return {};
});

const currentIconSize = computed(() => props.iconSize || DEFAULT_ICON_SIZE);

// 表示する画像URLを決定するcomputedプロパティ
const finalImgSrc = computed(() => {
  if (props.iconKey && props.iconDictionary && props.iconDictionary[props.iconKey]) {
    return props.iconDictionary[props.iconKey];
  }
  return props.imgSrc || ''; // iconKey/DictionaryがなければimgSrcを使用、どちらもなければ空文字
});

const shouldShowCardType = computed(() => currentIconSize.value >= MIN_SIZE_TO_SHOW_TYPE);

const imageStyle = computed((): StyleValue => ({
  width: `${currentIconSize.value}px`,
  height: `${currentIconSize.value}px`,
  objectFit: 'cover',
  display: 'block',
  borderRadius: '6px',
}));

const cardTypeStyle = computed((): StyleValue => {
  const size = currentIconSize.value;
  let fontSize = 9;
  let bottom = 1;
  let right = 1;
  let padding = '0px 2px';

  if (size < 35) {
    fontSize = 7;
    bottom = 1;
    right = 1;
    padding = '0px 1px';
  } else if (size < 45) {
    fontSize = 8;
    bottom = 1;
    right = 1;
  } // 45px以上はデフォルトの9px, bottom 8px, right 1px

  return {
    position: 'absolute',
    bottom: `${bottom}px`,
    right: `${right}px`,
    backgroundColor: 'rgba(0, 0, 0, 0.8)', // 少し濃くする
    color: 'white',
    padding: padding,
    fontSize: `${fontSize}px`,
    borderTopLeftRadius: '3px',
    lineHeight: '1',
    whiteSpace: 'nowrap',
  };
});

</script>

<style scoped>
.character-icon-wrapper {
  display: inline-block; /* aタグの時と同じ挙動を維持するため */
  text-decoration: none; /* リンクの下線を消す */
}

.character-image-container {
  position: relative;
  display: inline-block;
}

/* .character-image と .character-card-type の固定スタイルは script の computed style に移行 */
</style> 