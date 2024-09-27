<template>
  <v-row>
    <v-col cols="9">
      <div class="radio-group">
        <label v-for="option in options" :key="option" class="radio-option">
          <input type="radio" :value="option" v-model="selectedOption" />
          {{ option }}
        </label>
      </div>
    </v-col>
    <v-col cols="3">
      <button class="button">別タブ<span class="dli-external-link"><span></span></span></button>
    </v-col>
</v-row>
</template>
  
<script setup>
import { ref } from 'vue';

const options = ['対全', '対火', '対水', '対無'];
const selectedOption = ref(options[0]);
</script>

<style scoped>
.radio-group {
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
}
.button {
  display: flex;
  justify-content: space-between;
  padding-left: 5%;
  padding-right: 5%;
  border-radius: 5px; /* 角丸を追加 */
  border: 1px solid #ccc; /* ボタンに枠線を追加（任意） */
  cursor: pointer; /* カーソルをポインターに変更 */
  font-size: 0.7em;
}
.radio-option {
  margin-right: auto;
}
.dli-external-link {
  display: inline-block;
  vertical-align: middle;
  color: #333;
  line-height: 1;
  width: 0.9em;
  height: 0.9em;
  border: 0.1em solid currentColor;
  border-radius: 0.1em;
  background: #fff;
  box-sizing: content-box;
  position: relative;
}

.dli-external-link > span {
  position: absolute;
  top: -0.2em;
  right: -0.2em;
  width: 45%;
  height: 45%;
  border: 0.1em solid currentColor;
  border-bottom: 0;
  border-left: 0;
  background: #fff;
  box-shadow: -0.1em 0.1em 0 0.1em #fff;
  box-sizing: border-box;
}

.dli-external-link > span::before {
  content: '';
  position: absolute;
  top: -0.05em;
  right: -0.1em;
  width: 0.1em;
  height: 0.9em;
  background: currentColor;
  transform: rotate(45deg);
  transform-origin: top center;
}
</style>
