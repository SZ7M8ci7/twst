<template>
  <v-dialog v-model="isOpen" max-width="800px">
    <v-card>
      <v-card-title class="text-h5">
        キャラクター詳細設定
      </v-card-title>

      <v-card-text>
        <v-container>
          <v-row>
            <v-col cols="12">
              <v-text-field
                v-model="character.chara"
                label="キャラクター名"
                variant="outlined"
                density="compact"
              ></v-text-field>
            </v-col>

            <v-col cols="4">
              <v-text-field
                v-model="character.level"
                type="number"
                label="レベル"
                variant="outlined"
                density="compact"
                :max="getMaxLevel(character.rare)"
              ></v-text-field>
            </v-col>

            <v-col cols="4">
              <v-text-field
                v-model="character.hp"
                type="number"
                label="HP"
                variant="outlined"
                density="compact"
              ></v-text-field>
            </v-col>

            <v-col cols="4">
              <v-text-field
                v-model="character.atk"
                type="number"
                label="ATK"
                variant="outlined"
                density="compact"
              ></v-text-field>
            </v-col>

            <!-- 魔法レベル設定 -->
            <v-col cols="12">
              <v-card variant="outlined" class="mb-4">
                <v-card-title class="text-subtitle-1">魔法レベル設定</v-card-title>
                <v-card-text>
                  <v-row>
                    <v-col cols="4">
                      <v-text-field
                        v-model="character.magic1Lv"
                        type="number"
                        label="魔法1レベル"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="4">
                      <v-text-field
                        v-model="character.magic2Lv"
                        type="number"
                        label="魔法2レベル"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="4">
                      <v-text-field
                        v-model="character.magic3Lv"
                        type="number"
                        label="魔法3レベル"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- バディ設定 -->
            <v-col cols="12">
              <v-card variant="outlined" class="mb-4">
                <v-card-title class="text-subtitle-1">バディ設定</v-card-title>
                <v-card-text>
                  <v-row>
                    <v-col cols="4">
                      <v-text-field
                        v-model="character.buddy1c"
                        label="バディ1キャラ"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                      <v-text-field
                        v-model="character.buddy1s"
                        label="バディ1スキル"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                      <v-text-field
                        v-model="character.buddy1Lv"
                        type="number"
                        label="バディ1レベル"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="4">
                      <v-text-field
                        v-model="character.buddy2c"
                        label="バディ2キャラ"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                      <v-text-field
                        v-model="character.buddy2s"
                        label="バディ2スキル"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                      <v-text-field
                        v-model="character.buddy2Lv"
                        type="number"
                        label="バディ2レベル"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                    </v-col>
                    <v-col cols="4">
                      <v-text-field
                        v-model="character.buddy3c"
                        label="バディ3キャラ"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                      <v-text-field
                        v-model="character.buddy3s"
                        label="バディ3スキル"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                      <v-text-field
                        v-model="character.buddy3Lv"
                        type="number"
                        label="バディ3レベル"
                        variant="outlined"
                        density="compact"
                      ></v-text-field>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- バフ設定 -->
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">バフ設定</v-card-title>
                <v-card-text>
                  <div v-for="(buff, index) in character.buffs" :key="index" class="mb-2">
                    <v-row>
                      <v-col cols="3">
                        <v-select
                          v-model="buff.magicOption"
                          :items="['M1', 'M2', 'M3']"
                          label="魔法"
                          variant="outlined"
                          density="compact"
                        ></v-select>
                      </v-col>
                      <v-col cols="3">
                        <v-select
                          v-model="buff.buffOption"
                          :items="['ATKUP', 'ダメージUP', '属性ダメUP', '継続回復', '回復']"
                          label="バフ種類"
                          variant="outlined"
                          density="compact"
                        ></v-select>
                      </v-col>
                      <v-col cols="3">
                        <v-select
                          v-model="buff.powerOption"
                          :items="['極小', '小', '中', '大', '極大']"
                          label="威力"
                          variant="outlined"
                          density="compact"
                        ></v-select>
                      </v-col>
                      <v-col cols="2">
                        <v-text-field
                          v-model="buff.levelOption"
                          type="number"
                          label="レベル"
                          variant="outlined"
                          density="compact"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="1" class="d-flex align-center">
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          color="error"
                          @click="removeBuff(index)"
                        ></v-btn>
                      </v-col>
                    </v-row>
                  </div>
                  <v-btn
                    color="primary"
                    variant="text"
                    @click="addBuff"
                    class="mt-2"
                  >
                    バフを追加
                  </v-btn>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="text" @click="saveChanges">
          保存
        </v-btn>
        <v-btn color="error" variant="text" @click="closeModal">
          キャンセル
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: Boolean,
  character: Object
});

const emit = defineEmits(['update:modelValue', 'save']);

const isOpen = ref(props.modelValue);
const character = ref({ ...props.character });

watch(() => props.modelValue, (newValue) => {
  isOpen.value = newValue;
});

watch(() => isOpen.value, (newValue) => {
  emit('update:modelValue', newValue);
});

const getMaxLevel = (rare) => {
  const levelDict = { 'R': 70, 'SR': 90, 'SSR': 110 };
  return levelDict[rare] || 110;
};

const addBuff = () => {
  if (!character.value.buffs) {
    character.value.buffs = [];
  }
  character.value.buffs.push({
    magicOption: '',
    buffOption: '',
    powerOption: '',
    levelOption: 10
  });
};

const removeBuff = (index) => {
  character.value.buffs.splice(index, 1);
};

const saveChanges = () => {
  emit('save', character.value);
  closeModal();
};

const closeModal = () => {
  isOpen.value = false;
};
</script>

<style scoped>
.mb-2 {
  margin-bottom: 8px;
}
.mb-4 {
  margin-bottom: 16px;
}
.mt-2 {
  margin-top: 8px;
}
</style> 