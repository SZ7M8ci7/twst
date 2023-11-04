<template>
  <v-container>
    <v-row>
      <v-col cols="12" class="d-flex justify-center">
        <div>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>レア度</th>
              <th>属性</th>
              <th>Fr</th>
              <th>To</th>
              <th>数</th>
              <th>削除</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(member, index) in grow_members" v-bind:key="index">
              <td :style="{ width: 'fit-content' ,maxWidth:'1em' }">{{ index + 1 }}</td>
              <td><v-select :items="rare" menu-icon="" v-model="member.rare" solo :style="{ width: 'fit-content' ,minWidth:'4em'}" hide-details></v-select></td>
              <td><v-select :items="type" menu-icon="" v-model="member.type" solo :style="{ width: 'fit-content' ,minWidth:'3.1em'}" hide-details></v-select></td>
              <td><v-select :items="level" menu-icon="" v-model="member.from" solo :style="{ width: 'fit-content' ,minWidth:'3em'}" hide-details></v-select></td>
              <td><v-select :items="level" menu-icon="" v-model="member.to" solo :style="{ width: 'fit-content' ,minWidth:'3.3em'}" hide-details></v-select></td>
              <td><v-text-field v-model="member.num" type="number" @keydown="checkNumber"
                  :style="{ width: 'fit-content',maxWidth:'6em',minWidth:'3.3em' }" hide-details></v-text-field></td>
              <td><v-btn v-on:click="deleteRow(index)" icon="mdi-minus" size="x-small"></v-btn></td>
            </tr>
          </tbody>
        </table>
        <v-btn v-on:click="addRow()" icon="mdi-plus" size="x-small"></v-btn>
      </div>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col cols="12" class="d-flex justify-center">
        <div>
        <v-simple-table>
          <thead>
            <tr>
              <th class="text-left">
                属性
              </th>
              <th class="text-left">
                メモ帳
              </th>
              <th class="text-left">
                教科書
              </th>
              <th class="text-left">
                魔導書
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style="background-color: #EAAABD;">
              <td class="text-center">火</td>
              <td class="text-right">{{ fire.memo }}</td>
              <td class="text-right">{{ fire.textbook }}</td>
              <td class="text-right">{{ fire.grimoire }}</td>
            </tr>
            <tr style="background-color: #B2DFEB;">
              <td class="text-center">水</td>
              <td class="text-right">{{ water.memo }}</td>
              <td class="text-right">{{ water.textbook }}</td>
              <td class="text-right">{{ water.grimoire }}</td>
            </tr>
            <tr style="background-color: #B5EBBB;">
              <td class="text-center">木</td>
              <td class="text-right">{{ tree.memo }}</td>
              <td class="text-right">{{ tree.textbook }}</td>
              <td class="text-right">{{ tree.grimoire }}</td>
            </tr>
            <tr style="background-color: #F6F7FA;">
              <td class="text-center">無</td>
              <td class="text-right">{{ none.memo }}</td>
              <td class="text-right">{{ none.textbook }}</td>
              <td class="text-right">{{ none.grimoire }}</td>
            </tr>
            <tr>
              <td colspan="2" class="text-center">マドル</td>
              <td colspan="2" class="text-center">{{ madol.toLocaleString() }}</td>
            </tr>
          </tbody>
        </v-simple-table>
      </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { watchEffect } from "vue";
import { checkNumber } from "@/components/common";

class need_item {
  grimoire: number;
  textbook: number;
  memo: number;
  constructor() {
    this.grimoire = 0;
    this.textbook = 0;
    this.memo = 0;
  }
}
class grow_member {
  rare: string;
  type: string;
  from: number;
  to: number;
  num: number;
  constructor(rare: string, type: string) {
    this.rare = rare;
    this.type = type;
    this.from = 1;
    this.to = 10;
    this.num = 1;
  }
}
const grow_members = ref(Array<grow_member>());
grow_members.value.push(new grow_member('SSR', '火'));
const rare = ['SSR', 'SR', 'R',];
const type = ['火', '水', '木', '無'];
const level = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const fire = ref(new need_item());
const water = ref(new need_item());
const tree = ref(new need_item());
const none = ref(new need_item());
const madol = ref(0);
function deleteRow(index: number) {
  grow_members.value.splice(index, 1);
}
function addRow() {
  grow_members.value.push(new grow_member('SSR', '火'));
}
const ssr: Array<Array<number>> = [];
ssr.push([6, 2, 0, 1000]);
ssr.push([10, 6, 0, 2000]);
ssr.push([15, 10, 1, 5000]);
ssr.push([20, 15, 3, 10000]);
ssr.push([30, 20, 5, 20000]);
ssr.push([40, 30, 7, 30000]);
ssr.push([50, 40, 15, 50000]);
ssr.push([80, 50, 30, 80000]);
ssr.push([100, 80, 50, 120000]);
const sr: Array<Array<number>> = [];
sr.push([6, 2, 0, 700]);
sr.push([10, 6, 0, 1400]);
sr.push([15, 10, 0, 3000]);
sr.push([20, 15, 1, 6000]);
sr.push([25, 20, 2, 10000]);
sr.push([30, 30, 4, 15000]);
sr.push([40, 40, 6, 24000]);
sr.push([50, 50, 8, 35000]);
sr.push([80, 80, 10, 50000]);
const r: Array<Array<number>> = [];
r.push([6, 0, 0, 400]);
r.push([10, 0, 0, 800]);
r.push([15, 2, 0, 1200]);
r.push([20, 6, 0, 2500]);
r.push([30, 8, 1, 5000]);
r.push([40, 10, 2, 7500]);
r.push([50, 15, 2, 12000]);
r.push([80, 20, 3, 20000]);
r.push([100, 25, 5, 30000]);

watchEffect((): void => {
  let tmp_fire = new need_item();
  let tmp_water = new need_item();
  let tmp_tree = new need_item();
  let tmp_none = new need_item();
  let tmp_madol = 0
  for (let now_member of grow_members.value) {
    let tmp = new need_item();
    let counters = [];
    if (now_member.rare == 'SSR') {
      counters = ssr;
    } else if (now_member.rare == 'SR') {
      counters = sr;
    } else {
      counters = r;
    }
    for (let i = now_member.from - 1; i < now_member.to - 1; i++) {
      tmp.memo += counters[i][0] * now_member.num;
      tmp.textbook += counters[i][1] * now_member.num;
      tmp.grimoire += counters[i][2] * now_member.num;
      tmp_madol += counters[i][3] * now_member.num;
    }
    if (now_member.type == '火') {
      tmp_fire.memo += tmp.memo;
      tmp_fire.textbook += tmp.textbook;
      tmp_fire.grimoire += tmp.grimoire;
    } else if (now_member.type == '水') {
      tmp_water.memo += tmp.memo;
      tmp_water.textbook += tmp.textbook;
      tmp_water.grimoire += tmp.grimoire;
    } else if (now_member.type == '木') {
      tmp_tree.memo += tmp.memo;
      tmp_tree.textbook += tmp.textbook;
      tmp_tree.grimoire += tmp.grimoire;
    } else {
      tmp_none.memo += tmp.memo;
      tmp_none.textbook += tmp.textbook;
      tmp_none.grimoire += tmp.grimoire;
    }
  }
  fire.value = tmp_fire;
  water.value = tmp_water;
  tree.value = tmp_tree;
  none.value = tmp_none;
  madol.value = tmp_madol;
})
</script>
<style scoped>
#app{

    transform: scale(0.5);
    transform-origin: left top;
    height: calc(100% / 0.5);
    width: calc(100% / 0.5);
}
v-simple-table {
  width: 100%;
  border-spacing: 0;
}

table th {

  padding: 10px 10px;
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
</style>