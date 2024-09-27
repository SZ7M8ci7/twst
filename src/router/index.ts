// Composables
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'top',
    component: () => import('@/views/top.vue'),
  },
  {
    path: '/twst/top',
    name: 'top',
    component: () => import('@/views/top.vue'),
  },
  {
    path: '/twst/drop',
    name: 'drop',
    component: () => import('@/views/drop.vue'),
  },
  {
    path: '/twst/sam',
    name: 'sam',
    component: () => import('@/views/sam.vue'),
  },
  {
    path: '/twst/grow',
    name: 'grow',
    component: () => import('@/views/grow.vue'),
  },
  {
    path: '/twst/other',
    name: 'other',
    component: () => import('@/views/other.vue'),
  },
  {
    path: '/twst/comfort',
    name: 'comfort',
    component: () => import('@/views/redirect.vue'),
  },
  {
    path: '/twst/invite',
    name: 'invite',
    component: () => import('@/views/redirect.vue'),
  },
  {
    path: '/twst/simulator',
    name: 'simulator',
    component: () => import('@/views/redirect.vue'),
  },
  {
    path: '/twst/search',
    name: 'search',
    component: () => import('@/views/search.vue'),
  },
  {
    path: '/twst/search1',
    name: 'search1',
    component: () => import('@/views/search1.vue'),
  },
  {
    path: '/twst/search2',
    name: 'search2',
    component: () => import('@/views/search2.vue'),
  },
  {
    path: '/twst/hand',
    name: 'hand',
    component: () => import('@/views/hand.vue'),
  },
  {
    path: '/twst/relation',
    name: 'relation',
    component: () => import('@/views/relation.vue'),
  },
  {
    path: '/twst/calc-atk-exam',
    name: 'calcATK',
    component: () => import('@/views/calcATK.vue'),
  },
  {
    path: '/twst/calc-def-exam',
    name: 'calcDEF',
    component: () => import('@/views/calcDEF.vue'),
  },
  {
    path: '/twst/calc-basic-exam',
    name: 'calcBASIC',
    component: () => import('@/views/calcBASIC.vue'),
  },
  {
    path: '/twst/data',
    name: 'data',
    component: () => import('@/views/data.vue'),
  },
  {
    path: '/twst/buddyDuo',
    name: 'buddyDuo',
    component: () => import('@/views/buddyDuo.vue'),
  },
  {
    path: '/twst/finisherDamage',
    name: 'finisherDamage',
    component: () => import('@/views/finisherDamage.vue'),
  },
  {
    path: '/twst/retire',
    name: 'retire',
    component: () => import('@/views/retire.vue'),
  },
  {
    path: '/twst/sim',
    name: 'sim',
    component: () => import('@/views/sim.vue'),
  },
  { path: '/twst/', component: () => import('@/views/top.vue') }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
