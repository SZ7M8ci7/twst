// Plugins
import vue from '@vitejs/plugin-vue'
import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'
import ViteFonts from 'unplugin-fonts/vite'

// Utilities
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { examAutoBestWorkerHostPlugin } from './build/examAutoBestWorkerHostPlugin.mts'

// https://vitejs.dev/config/
export default defineConfig({
  base: (process.env.NODE_ENV === 'production')
  ? './' : './',
  plugins: [
    examAutoBestWorkerHostPlugin(),
    vue({
      template: { transformAssetUrls }
    }),
    // https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vite-plugin
    vuetify({
      autoImport: true,
    }),
    ViteFonts({
      google: {
        families: [{
          name: 'Roboto',
          styles: 'wght@100;300;400;500;700;900',
        }],
      },
    }),
  ],
  define: { 'process.env': {} },
  optimizeDeps: {
    include: [
      // The OCR client and OpenCV Worker are first requested after file selection.
      // Prebundle them at startup so late dependency discovery cannot reload the
      // page and discard the selected File objects and in-progress recognition.
      '@techstark/opencv-js',
      'tesseract.js',
      // Vuetify's auto-import transform is not visible to the dependency scanner.
      // Include the components used by lazy routes and their import dialogs too.
      'vuetify/components/VApp',
      'vuetify/components/VAppBar',
      'vuetify/components/VAutocomplete',
      'vuetify/components/VAlert',
      'vuetify/components/VBtn',
      'vuetify/components/VBtnToggle',
      'vuetify/components/VCard',
      'vuetify/components/VCheckbox',
      'vuetify/components/VChip',
      'vuetify/components/VDialog',
      'vuetify/components/VGrid',
      'vuetify/components/VIcon',
      'vuetify/components/VList',
      'vuetify/components/VMain',
      'vuetify/components/VNavigationDrawer',
      'vuetify/components/VProgressCircular',
      'vuetify/components/VProgressLinear',
      'vuetify/components/VSelect',
      'vuetify/components/VSnackbar',
      'vuetify/components/VSwitch',
      'vuetify/components/VTable',
      'vuetify/components/VTabs',
      'vuetify/components/VTextarea',
      'vuetify/components/VTextField',
      'vuetify/components/VMenu',
      'vuetify/components/transitions',
    ],
  },
  worker: {
    format: 'es',
    plugins: () => [examAutoBestWorkerHostPlugin()],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
    extensions: [
      '.js',
      '.json',
      '.jsx',
      '.mjs',
      '.ts',
      '.tsx',
      '.vue',
    ],
  },
  server: {
    port: 3000,
  },
  build: {
    assetsInlineLimit: 0,
  },
})
