<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="1">
      </v-col>
      <v-col cols="12" md="10">
        <HandSimulator />
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" md="1">
      </v-col>
      <v-col cols="12" md="3">
          <HandHeader/>
      </v-col>
    </v-row>
    <HandBody />
  </v-container>
</template>

<script setup lang="ts">
import HandHeader from '@/components/HandHeader.vue';
import HandBody from '@/components/HandBody.vue';
import HandSimulator from '@/components/HandSimulator.vue';

</script>
