// Composables
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/twst',
    name: 'top',
    component: () => import('@/views/top.vue'),
  },
  {
    path: '/twst/drop',
    name: 'drop',
    component: () => import('@/views/drop.vue'),
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
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
})

export default router
