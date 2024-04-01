/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Plugins
import vuetify from './vuetify'
import pinia from '../store'
import router from '../router'

// Types
import type { App } from 'vue'
import VueGTag from 'vue-gtag'
export function registerPlugins (app: App) {
  app
    .use(vuetify)
    .use(router)
    .use(pinia)
    .use(  VueGTag,
      {
        config: {
          id: '{ G-4RSRD920TZ }'
        }
      },)
}
