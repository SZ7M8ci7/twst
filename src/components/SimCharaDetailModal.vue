<template>
  <v-dialog v-model="isOpen" max-width="800px">
    <v-card>
      <v-card-title class="text-h5">
        キャラクター詳細設定
      </v-card-title>

      <v-card-text class="pa-1">
        <v-container class="pa-0">
          <v-row dense no-gutters>
            <v-col cols="12">
              <v-select
                v-model="character.chara"
                :items="characterOptions"
                label="キャラクター名"
                variant="outlined"
                density="compact"
              ></v-select>
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
              <v-card elevation="2" class="mb-1">
                <v-card-title class="text-subtitle-1 py-1">魔法レベル設定</v-card-title>
                <v-card-text class="pa-1">
                  <v-row dense>
                    <v-col cols="4">
                      <v-select
                        v-model="character.magic1Lv"
                        :items="magicLevelOptions"
                        label="魔法1"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                    </v-col>
                    <v-col cols="4">
                      <v-select
                        v-model="character.magic2Lv"
                        :items="magicLevelOptions"
                        label="魔法2"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                    </v-col>
                    <v-col cols="4">
                      <v-select
                        v-model="character.magic3Lv"
                        :items="magicLevelOptions"
                        label="魔法3"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- バディ設定 -->
            <v-col cols="12">
              <v-card elevation="2" class="mb-1">
                <v-card-title class="text-subtitle-1 py-1">バディ設定</v-card-title>
                <v-card-text class="pa-1">
                  <v-row dense>
                    <v-col cols="12" sm="4" class="buddy-item">
                      <v-select
                        v-model="character.buddy1c"
                        :items="characterOptions"
                        label="バディ1キャラ"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                      <v-select
                        v-model="character.buddy1s"
                        :items="buddySkillOptions"
                        label="バディ1スキル"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                      <v-select
                        v-model="character.buddy1Lv"
                        :items="buddyLevelOptions"
                        label="バディ1レベル"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                    </v-col>
                    <v-col cols="12" sm="4" class="buddy-item">
                      <v-select
                        v-model="character.buddy2c"
                        :items="characterOptions"
                        label="バディ2キャラ"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                      <v-select
                        v-model="character.buddy2s"
                        :items="buddySkillOptions"
                        label="バディ2スキル"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                      <v-select
                        v-model="character.buddy2Lv"
                        :items="buddyLevelOptions"
                        label="バディ2レベル"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                    </v-col>
                    <v-col cols="12" sm="4" class="buddy-item">
                      <v-select
                        v-model="character.buddy3c"
                        :items="characterOptions"
                        label="バディ3キャラ"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                      <v-select
                        v-model="character.buddy3s"
                        :items="buddySkillOptions"
                        label="バディ3スキル"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                      <v-select
                        v-model="character.buddy3Lv"
                        :items="buddyLevelOptions"
                        label="バディ3レベル"
                        variant="outlined"
                        density="compact"
                      ></v-select>
                    </v-col>
                  </v-row>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- バフ設定 -->
            <v-col cols="12">
              <v-card elevation="2">
                <v-card-title class="text-subtitle-1 py-1">バフ設定</v-card-title>
                <v-card-text class="pa-1">
                  <div v-for="(buff, index) in character.buffs" :key="index" class="buff-item mb-1">
                    <v-row dense>
                      <v-col cols="6">
                        <v-select
                          v-model="buff.magicOption"
                          :items="['M1', 'M2', 'M3']"
                          label="魔法"
                          variant="outlined"
                          density="compact"
                        ></v-select>
                      </v-col>
                      <v-col cols="6">
                        <v-select
                          v-model="buff.buffOption"
                          :items="['ATKUP', 'ダメージUP', '属性ダメUP', '継続回復', '回復']"
                          label="バフ種類"
                          variant="outlined"
                          density="compact"
                        ></v-select>
                      </v-col>
                      <v-col cols="6">
                        <v-select
                          v-model="buff.powerOption"
                          :items="['極小', '小', '中', '大', '極大']"
                          label="威力"
                          variant="outlined"
                          density="compact"
                        ></v-select>
                      </v-col>
                      <v-col cols="4">
                        <v-text-field
                          v-model="buff.levelOption"
                          type="number"
                          label="レベル"
                          variant="outlined"
                          density="compact"
                        ></v-text-field>
                      </v-col>
                      <v-col cols="2" class="d-flex align-center">
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
                    class="mt-1"
                    size="small"
                  >
                    バフを追加
                  </v-btn>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-card-actions class="pa-1">
        <v-spacer></v-spacer>
        <v-btn color="primary" variant="text" @click="saveChanges" size="small">
          保存
        </v-btn>
        <v-btn color="error" variant="text" @click="closeModal" size="small">
          キャンセル
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import charactersInfo from '@/assets/characters_info.json';

const props = defineProps({
  modelValue: Boolean,
  character: Object
});

const emit = defineEmits(['update:modelValue', 'save']);

const isOpen = ref(props.modelValue);
const character = ref({ ...props.character });

watch(() => props.character, (newCharacter) => {
  if (newCharacter) {
    character.value = { ...newCharacter };
  }
}, { deep: true });

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

// キャラクター選択肢
const characterOptions = computed(() => 
  charactersInfo.map(char => char.name_ja)
);

// バディスキル選択肢
const buddySkillOptions = [
  'ATKUP(小)',
  'ATKUP(中)',
  'HPUP(小)',
  'HPUP(中)',
  'HP&ATKUP(小)',
  'HP&ATKUP(中)'
];

// バディレベル選択肢
const buddyLevelOptions = Array.from({length: 10}, (_, i) => i + 1);

// 魔法レベル選択肢
const magicLevelOptions = Array.from({length: 10}, (_, i) => i + 1);
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
.buff-item {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 8px;
}
.buddy-item {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 8px;
}
</style> 