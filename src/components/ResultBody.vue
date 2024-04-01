<template>
  <v-app>
    <v-container>
      <v-data-table
        :headers="headers"
        :items="results"
        class="elevation-1"
        :items-per-page="-1"
      >
        <!-- カスタムコンテンツのスロットを使用 -->
        <template v-slot:item="{ item }">
          <tr>
            <td>{{ item.hp }}</td>
            <td>{{ item.ehp }}</td>
            <td>{{ item.evasion }}</td>
            <td>{{ item.hpBuudy }}</td>
            <td>{{ item.buddy }}</td>
            <td>{{ item.noHpBuddy }}</td>
            <!-- キャラ1～5の画像を表示 -->
            <td v-for="n in 5" :key="`chara${n}`">
              <v-img :src="item[`chara${n}`]" max-width="50"></v-img>
            </td>
          </tr>
        </template>
      </v-data-table>
    </v-container>
  </v-app>
</template>

<script setup lang="ts">
import { useSearchResultStore } from '@/store/searchResult';
import { storeToRefs } from 'pinia';
const searchResultStore = useSearchResultStore();
const { results } = storeToRefs(searchResultStore);
const headers = [
  { title: '実HP', value: 'hp', sortable: false },
  { title: '実質HP', value: 'ehp', sortable: false },
  { title: '回避', value: 'evasion', sortable: false },
  { title: 'HPバディ', value: 'hpBuudy', sortable: false },
  { title: 'バディ', value: 'buddy', sortable: false },
  { title: '無バディ', value: 'noHPBuudy', sortable: false },
  { title: 'キャラ1', value: 'chara1', sortable: false  },
  { title: 'キャラ2', value: 'chara2', sortable: false  },
  { title: 'キャラ3', value: 'chara3', sortable: false  },
  { title: 'キャラ4', value: 'chara4', sortable: false  },
  { title: 'キャラ5', value: 'chara5', sortable: false  },
];

</script>
<style scoped>
.table-top {
  display: flex;
  align-items: center;
  gap: 10px; /* ボタンとの間隔を設定 */
}
.level-input {
  max-width: 80px; /* 最大横幅を80pxに設定 */
  min-width: 70px;
}
.v-data-table :deep(.v-data-table-footer) {
   display: none; /* NOTE: フッタを非表示にする為 */
}
.right-align {
  margin-left: auto; /* 左側の余白を自動で最大にして右寄せにする */
}
</style>