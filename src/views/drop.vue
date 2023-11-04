<template>
  <v-container>
    <v-row>
      <v-col class="d-flex justify-center">
        <div>
          <v-row>
            <v-col cols="12">
              <v-radio-group v-model="radios" inline>
                <v-radio label="通常" value="normal"></v-radio>
                <v-radio label="ドロップ率アップ" value="up"></v-radio>
              </v-radio-group>
            </v-col>
          </v-row>
        </div>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col class="d-inline-flex justify-center">
        <div>
          <v-text-field v-model="piece_s" label="かけらS" type="number" @keydown="checkNumber"
            hide-details/>
          <v-text-field v-model="piece_l" label="かけらL" type="number" @keydown="checkNumber"
            hide-details/>
          <v-text-field v-model="addition" label="AP調整" type="number" @keydown="checkNumber"
            hide-details/>
        </div>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col class="d-flex justify-center">
        <div>
          <v-row>
            <v-col cols="12">
              <p class="text-h6">合計AP: {{ total_ap.toLocaleString() }}</p>
            </v-col>
          </v-row>
        </div>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col class="d-flex justify-center">
        <div>
          <v-row>
            <v-col cols="12">
              <v-simple-table>
                <thead>
                  <tr>
                    <th class="text-left">
                      アイテム
                    </th>
                    <th class="text-left">
                      ドロップ数
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>魔導書</td>
                    <td class="text-right">{{ grimoire.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>教科書</td>
                    <td class="text-right">{{ textbook.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>メモ帳</td>
                    <td class="text-right">{{ memo.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>キャンディ</td>
                    <td class="text-right">{{ candy.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>マドル</td>
                    <td class="text-right">{{ madol.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                </tbody>
              </v-simple-table>
            </v-col>
          </v-row>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { watchEffect } from "vue";
import { ref, computed } from "vue"
import { checkNumber } from "@/components/common";
const radios = ref("normal");
const piece_s = ref(0);
const piece_l = ref(0);
const addition = ref(0);
const total_ap = computed(() => 3 * piece_s.value + 10 * piece_l.value + Number(addition.value))
const grimoire = ref(0);
const textbook = ref(0);
const memo = ref(0);
const medal = ref(0);
const candy = ref(0);
const madol = ref(0);

watchEffect((): void => {
  if (radios.value == "normal") {
    grimoire.value = total_ap.value * 0.05;
    textbook.value = total_ap.value * 0.28;
    memo.value = total_ap.value * 0.84;
    medal.value = total_ap.value * 0.66;
    candy.value = total_ap.value * 0.10;
  } else {
    grimoire.value = total_ap.value * 0.20;
    textbook.value = total_ap.value * 0.60;
    memo.value = total_ap.value * 0.90;
    medal.value = total_ap.value * 0.111;
    candy.value = total_ap.value * 0.066;
  }
  madol.value = total_ap.value * 250
})

</script>
<style scoped>
v-simple-table {
  width: 100%;
  border-spacing: 0;
}

v-simple-table th {
  border-bottom: solid 2px #fb5144;
  padding: 10px 10px;
}

v-simple-table td {
  border-bottom: solid 2px #ddd;
  text-align: center;
  padding: 10px 10px;
}

v-text-field{
  width: 3em;
}
</style>