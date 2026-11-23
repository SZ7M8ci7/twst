<template>
  <section>
    <h3>{{ $t('infoModal.about') }}</h3>
    <p>{{ $t('infoModal.text1') }}</p>
    <p>{{ $t('infoModal.text2') }}</p>
    <p>{{ $t('infoModal.text6') }}</p>
    <p>{{ $t('infoModal.text7') }}</p>
  </section>
  <section>
    <h3>{{ $t('infoModal.setting') }}</h3>
    <ol>
      <li v-for="step in ['chooseRoster', 'choosePreset', 'chooseSupport', 'start']" :key="step">
        {{ $t('infoModal.' + step) }}
      </li>
    </ol>
    <p>{{ $t('infoModal.text11') }}</p>
    <p>{{ $t('infoModal.text12') }}</p>
  </section>
</template>

<style scoped>
section {
  margin-top: 1rem;
}
ol {
  padding-inline-start: 1.5em;
}
p, ol, li + li {
  margin-top: .5rem;
}
</style>
