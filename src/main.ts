/**
 * main.ts
 *
 * Bootstraps Vuetify and other plugins then mounts the App`
 */

// Components
import App from './App.vue'

// Composables
import { createApp } from 'vue'

// Plugins
import { registerPlugins } from '@/plugins'
import { createI18n } from 'vue-i18n'
import ja from "@/i18n/ja.json";
import en from "@/i18n/en.json";

const i18n = createI18n({
    legacy: false,
    locale: "ja",
    messages: {
      ja: ja,
      en: en,
    },
  });

const app = createApp(App)

registerPlugins(app)
app.use(i18n)
app.mount('#app')
