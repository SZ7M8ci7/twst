// Composables
import { createRouter, createWebHistory } from 'vue-router'
import { defineAsyncComponent, type AsyncComponentLoader } from 'vue'
import RouteLoading from '@/components/RouteLoading.vue'

const createAsyncRoute = (loader: AsyncComponentLoader) => defineAsyncComponent({
  loader,
  loadingComponent: RouteLoading,
  delay: 0,
  suspensible: false,
})

const routes = [
  {
    path: '/',
    name: 'top',
    component: createAsyncRoute(() => import('@/views/top.vue')),
  },
  {
    path: '/twst/top',
    name: 'twstTop',
    component: createAsyncRoute(() => import('@/views/top.vue')),
  },
  {
    path: '/twst/drop',
    name: 'drop',
    component: createAsyncRoute(() => import('@/views/drop.vue')),
  },
  {
    path: '/twst/sam',
    name: 'sam',
    component: createAsyncRoute(() => import('@/views/sam.vue')),
  },
  {
    path: '/twst/grow',
    name: 'grow',
    component: createAsyncRoute(() => import('@/views/grow.vue')),
  },
  {
    path: '/twst/other',
    name: 'other',
    component: createAsyncRoute(() => import('@/views/other.vue')),
  },
  {
    path: '/twst/comfort',
    name: 'comfort',
    component: createAsyncRoute(() => import('@/views/redirect.vue')),
  },
  {
    path: '/twst/invite',
    name: 'invite',
    component: createAsyncRoute(() => import('@/views/redirect.vue')),
  },
  {
    path: '/twst/simulator',
    name: 'simulator',
    component: createAsyncRoute(() => import('@/views/redirect.vue')),
  },
  {
    path: '/twst/search',
    name: 'search',
    component: createAsyncRoute(() => import('@/views/search.vue')),
  },
  {
    path: '/twst/search1',
    name: 'search1',
    component: createAsyncRoute(() => import('@/views/search1.vue')),
  },
  {
    path: '/twst/search2',
    name: 'search2',
    component: createAsyncRoute(() => import('@/views/search2.vue')),
  },
  {
    path: '/twst/hand',
    name: 'hand',
    component: createAsyncRoute(() => import('@/views/hand.vue')),
  },
  {
    path: '/twst/hand-collection',
    name: 'handCollection',
    component: createAsyncRoute(() => import('@/views/HandCollection.vue')),
  },
  {
    path: '/twst/relation',
    name: 'relation',
    component: createAsyncRoute(() => import('@/views/relation.vue')),
  },
  {
    path: '/twst/calc-atk-exam',
    name: 'calcATK',
    component: createAsyncRoute(() => import('@/views/calcATK.vue')),
  },
  {
    path: '/twst/calc-def-exam',
    name: 'calcDEF',
    component: createAsyncRoute(() => import('@/views/calcDEF.vue')),
  },
  {
    path: '/twst/calc-basic-exam',
    name: 'calcBASIC',
    component: createAsyncRoute(() => import('@/views/calcBASIC.vue')),
  },
  {
    path: '/twst/exam-simulator',
    name: 'examSimulator',
    component: () => import('@/views/examSimulator.vue'),
  },
  {
    path: '/twst/data',
    name: 'data',
    component: createAsyncRoute(() => import('@/views/data.vue')),
  },
  {
    path: '/twst/status-plot',
    name: 'statusPlot',
    component: createAsyncRoute(() => import('@/views/statusPlot.vue')),
  },
  {
    path: '/twst/buddyDuo',
    name: 'buddyDuo',
    component: createAsyncRoute(() => import('@/views/buddyDuo.vue')),
  },
  {
    path: '/twst/finisherDamage',
    name: 'finisherDamage',
    component: createAsyncRoute(() => import('@/views/finisherDamage.vue')),
  },
  {
    path: '/twst/retire',
    name: 'retire',
    component: createAsyncRoute(() => import('@/views/retire.vue')),
  },
  {
    path: '/twst/sim',
    name: 'sim',
    component: createAsyncRoute(() => import('@/views/sim.vue')),
  },
  { path: '/twst/', component: createAsyncRoute(() => import('@/views/top.vue')) },
  // キャッチオールルート - マッチしないパスをトップページにリダイレクト
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

// Google Analytics tracking for route changes
router.afterEach((to) => {
  // Check if gtag is available (Google Analytics loaded)
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-4RSRD920TZ', {
      page_path: to.fullPath,
      page_title: to.name as string || document.title,
    })
  }
})

export default router
