<template>
  <v-container>
    <v-row>
      <v-col class="d-inline-flex justify-center">
        <div>
          <p class="text-h6">{{ $t('sam.notice') }}</p>
          <v-text-field v-model="LessonItem" :label="$t('sam.LessonItem')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="SnackS" :label="$t('sam.SnackS')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="SnackM" :label="$t('sam.SnackM')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="SnackL" :label="$t('sam.SnackL')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="TeaS" :label="$t('sam.TeaS')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="TeaM" :label="$t('sam.TeaM')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="TeaL" :label="$t('sam.TeaL')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="HoneyS" :label="$t('sam.HoneyS')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="HoneyM" :label="$t('sam.HoneyM')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="HoneyL" :label="$t('sam.HoneyL')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="HoneyXL" :label="$t('sam.HoneyXL')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="PerfumeR" :label="$t('sam.PerfumeR')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="PerfumeSR" :label="$t('sam.PerfumeSR')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="Notepad" :label="$t('sam.Notepad')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="Textbook" :label="$t('sam.Textbook')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="Grimoire" :label="$t('sam.Grimoire')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="EventItem" :label="$t('sam.EventItem')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="Candy" :label="$t('sam.Candy')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="AlchemyToken" :label="$t('sam.AlchemyToken')" type="number" @keydown="checkNumber" hide-details/>
          <v-text-field v-model="ExamToken" :label="$t('sam.ExamToken')" type="number" @keydown="checkNumber" hide-details/>
        </div>
      </v-col>
    </v-row>
    <v-row>
      <v-col class="d-flex justify-center">
        <div>
          <v-row>
            <v-col cols="12">
              <p class="text-h6">{{ $t('sam.totalRecycleMedal') }}: {{ totalRecycleMedal.toLocaleString() }}</p>
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
                      {{ $t('sam.item') }}
                    </th>
                    <th class="text-left">
                      {{ $t('sam.num') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ $t('sam.MagicalKey') }}</td>
                    <td class="text-right">{{ result_magical_key.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.SSRPerfume') }}</td>
                    <td class="text-right">{{ result_perfume_ssr.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.SRPerfume') }}</td>
                    <td class="text-right">{{ result_perfume_sr.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.RPerfume') }}</td>
                    <td class="text-right">{{ result_perfume_r.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.StarshardsL') }}</td>
                    <td class="text-right">{{ result_starshards_l.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.MoonshardsL') }}</td>
                    <td class="text-right">{{ result_moonshards_l.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.StarshardsS') }}</td>
                    <td class="text-right">{{ result_starshards_s.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.MoonshardsS') }}</td>
                    <td class="text-right">{{ result_moonshards_s.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.Grimoire') }}</td>
                    <td class="text-right">{{ result_grimoire.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.Textbook') }}</td>
                    <td class="text-right">{{ result_textbook.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.HoneyL') }}</td>
                    <td class="text-right">{{ result_honey_l.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.HoneyM') }}</td>
                    <td class="text-right">{{ result_honey_m.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.SugerCube') }}</td>
                    <td class="text-right">{{ result_suger_cube.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.Popcorn') }}</td>
                    <td class="text-right">{{ result_popcorn.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.Cupcake') }}</td>
                    <td class="text-right">{{ result_cupcake.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.Waffles') }}</td>
                    <td class="text-right">{{ result_waffles.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.Cookies') }}</td>
                    <td class="text-right">{{ result_cookies.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
                  </tr>
                  <tr>
                    <td>{{ $t('sam.Macarons') }}</td>
                    <td class="text-right">{{ result_macarons.toLocaleString(undefined, { maximumFractionDigits: 1 }) }}</td>
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
const LessonItem = ref(0);
const SnackS = ref(0);
const SnackM = ref(0);
const SnackL = ref(0);
const TeaS = ref(0);
const TeaM = ref(0);
const TeaL = ref(0);
const HoneyS = ref(0);
const HoneyM = ref(0);
const HoneyL = ref(0);
const HoneyXL = ref(0);
const PerfumeR = ref(0);
const PerfumeSR = ref(0);
const Notepad = ref(0);
const Textbook = ref(0);
const Grimoire = ref(0);
const EventItem = ref(0);
const Candy = ref(0);
const AlchemyToken = ref(0);
const ExamToken = ref(0);

const totalRecycleMedal = computed(() =>
  2 * LessonItem.value
  + 1 * SnackS.value
  + 2 * SnackM.value
  + 3 * SnackL.value
  + 1 * TeaS.value
  + 2 * TeaM.value
  + 3 * TeaL.value
  + 1 * HoneyS.value
  + 2 * HoneyM.value
  + 3 * HoneyL.value
  + 5 * HoneyXL.value
  + 4 * PerfumeR.value
  + 8 * PerfumeSR.value
  + 1 * Notepad.value
  + 5 * Textbook.value
  + 15 * Grimoire.value
  + 0.2 * EventItem.value
  + 2 * Candy.value
  + 1 * AlchemyToken.value
  + 0.25 * ExamToken.value);
const result_magical_key = ref(0);
const result_perfume_ssr = ref(0);
const result_perfume_sr = ref(0);
const result_perfume_r = ref(0);
const result_starshards_l = ref(0);
const result_moonshards_l = ref(0);
const result_starshards_s = ref(0);
const result_moonshards_s = ref(0);
const result_grimoire = ref(0);
const result_textbook = ref(0);
const result_honey_l = ref(0);
const result_honey_m = ref(0);
const result_suger_cube = ref(0);
const result_popcorn = ref(0);
const result_cupcake = ref(0);
const result_waffles = ref(0);
const result_cookies = ref(0);
const result_macarons = ref(0);


watchEffect((): void => {
  result_magical_key.value = 0.05 * totalRecycleMedal.value * 0.15 * 0.01;
  result_perfume_ssr.value = 0.05 * totalRecycleMedal.value * 0.05 * 0.01;
  result_perfume_sr.value = 0.05 * totalRecycleMedal.value * 0.8 * 0.01;
  result_perfume_r.value = 0.05 * totalRecycleMedal.value * 4 * 0.01;
  result_starshards_l.value = 0.05 * totalRecycleMedal.value * 1.5 * 0.01;
  result_moonshards_l.value = 0.05 * totalRecycleMedal.value * 1.5 * 0.01;
  result_starshards_s.value = 0.05 * totalRecycleMedal.value * 5 * 0.01;
  result_moonshards_s.value = 0.05 * totalRecycleMedal.value * 5 * 0.01;
  result_grimoire.value = 0.05 * totalRecycleMedal.value * 5.5 * 4 * 0.01;
  result_textbook.value = 0.05 * totalRecycleMedal.value * 6.5 * 4 * 0.01;
  result_honey_l.value = 0.05 * totalRecycleMedal.value * 8 * 0.01;
  result_honey_m.value = 0.05 * totalRecycleMedal.value * 8 * 0.01;
  result_suger_cube.value = 0.05 * totalRecycleMedal.value * 3 * 0.01;
  result_popcorn.value = 0.05 * totalRecycleMedal.value * 3 * 0.01;
  result_cupcake.value = 0.05 * totalRecycleMedal.value * 3 * 0.01;
  result_waffles.value = 0.05 * totalRecycleMedal.value * 3 * 0.01;
  result_cookies.value = 0.05 * totalRecycleMedal.value * 3 * 0.01;
  result_macarons.value = 0.05 * totalRecycleMedal.value * 3 * 0.01;

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