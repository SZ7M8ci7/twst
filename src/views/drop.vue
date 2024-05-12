<template>
  <v-container>
    <v-row>
      <v-col class="d-flex justify-center">
        <div>
          <v-row>
            <v-col cols="12">
              <v-radio-group v-model="radios" inline>
                <v-radio :label="$t('drop.normal')" value="normal"></v-radio>
                <v-radio :label="$t('drop.dropIncreasedRate')" value="up"></v-radio>
              </v-radio-group>
            </v-col>
          </v-row>
        </div>
      </v-col>
    </v-row>
    <v-row>
      <v-col class="d-inline-flex justify-center">
        <div>
          <v-text-field v-model="piece_s" :label="$t('drop.kakeraS')" type="number" @keydown="checkNumber"
            hide-details/>
          <v-text-field v-model="piece_l" :label="$t('drop.kakeraL')" type="number" @keydown="checkNumber"
            hide-details/>
          <v-text-field v-model="addition" :label="$t('drop.addition')" type="number" @keydown="checkNumber"
            hide-details/>
        </div>
      </v-col>
    </v-row>
    <v-row>
      <v-col class="d-flex justify-center">
        <div>
          <v-row>
            <v-col cols="12">
              <p class="text-h6">{{ $t('drop.totalAP') }}: {{ total_ap.toLocaleString() }}</p>
            </v-col>
          </v-row>
        </div>
      </v-col>
    </v-row>
    <v-row>
      <v-col class="d-flex justify-center">
        <div>
          <v-row>
            <v-col cols="12">
              <v-simple-table>
                <thead>
                  <tr>
                    <th class="text-left">
                      {{ $t('drop.item') }}
                    </th>
                    <th class="text-left">
                      {{ $t('drop.drop') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ $t('drop.grimoire') }}</td>
                    <td class="text-right">{{ grimoire.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('drop.textbook') }}</td>
                    <td class="text-right">{{ textbook.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('drop.notepad') }}</td>
                    <td class="text-right">{{ memo.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('drop.candy') }}</td>
                    <td class="text-right">{{ candy.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('drop.herbTeaS') }}</td>
                    <td class="text-right">{{ tea_s.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('drop.herbTeaM') }}</td>
                    <td class="text-right">{{ tea_m.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('drop.herbTeaL') }}</td>
                    <td class="text-right">{{ tea_l.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('drop.madol') }}</td>
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
const tea_s = ref(0);
const tea_m = ref(0);
const tea_l = ref(0);

watchEffect((): void => {
  if (radios.value == "normal") {
    grimoire.value = total_ap.value * 0.05;
    textbook.value = total_ap.value * 0.28;
    memo.value = total_ap.value * 0.84;
    medal.value = total_ap.value * 0.66;
    candy.value = total_ap.value * 0.10;
    tea_s.value = total_ap.value * 0;
    tea_m.value = total_ap.value * 0;
    tea_l.value = total_ap.value * 0;
  } else {
    grimoire.value = total_ap.value * 0.62;
    textbook.value = total_ap.value * 0.54;
    memo.value = total_ap.value * 0.17;
    medal.value = total_ap.value * 1.3;
    candy.value = total_ap.value * 0.09;
    tea_s.value = total_ap.value * 0.10;
    tea_m.value = total_ap.value * 0.20;
    tea_l.value = total_ap.value * 0.40;
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