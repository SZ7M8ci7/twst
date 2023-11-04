// Composables
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'top',
    component: () => import('@/views/top.vue'),
  },
  {
    path: '/top',
    name: 'top',
    component: () => import('@/views/top.vue'),
  },
  {
    path: '/drop',
    name: 'drop',
    component: () => import('@/views/drop.vue'),
  },
  {
    path: '/grow',
    name: 'grow',
    component: () => import('@/views/grow.vue'),
  },
  {
    path: '/other',
    name: 'other',
    component: () => import('@/views/other.vue'),
  },
  {
    path: '/comfort',
    name: 'comfort',
    component: () => import('@/views/redirect.vue'),
  },
  {
    path: '/invite',
    name: 'invite',
    component: () => import('@/views/redirect.vue'),
  },
  {
    path: '/simulator',
    name: 'simulator',
    component: () => import('@/views/redirect.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
