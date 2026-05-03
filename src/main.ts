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

const registerAssetCacheWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  window.addEventListener('load', () => {
    const scopes = window.location.pathname.startsWith('/twst/')
      ? ['/twst/', '/']
      : ['/']

    const register = async () => {
      for (const scope of scopes) {
        try {
          const registration = await navigator.serviceWorker.register(
            `${scope}twst-cache-sw.js`,
            { scope }
          )
          void registration.update().catch(() => undefined)
          return
        } catch {
          continue
        }
      }
    }

    void register()
  })
}

registerAssetCacheWorker()
