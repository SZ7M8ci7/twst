/* eslint-env serviceworker */

const CACHE_PREFIX = 'twst-runtime-cache-'
const CACHE_NAME = `${CACHE_PREFIX}v1`
const CACHE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const CACHE_MAX_AGE_MS = CACHE_MAX_AGE_SECONDS * 1000
const CACHE_TIMESTAMP_HEADER = 'sw-cache-timestamp'
const CACHEABLE_EXTENSION_PATTERN = /\.(?:css|js|webp|png|jpe?g|svg|ico|woff2?|ttf)$/i

const isCacheableRequest = (request) => {
  if (request.method !== 'GET') return false

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return false

  return url.pathname.includes('/recognition-runtime/v7/') ||
    url.pathname.includes('/assets/') ||
    CACHEABLE_EXTENSION_PATTERN.test(url.pathname)
}

const isFresh = (response) => {
  const cachedAt = Number(response.headers.get(CACHE_TIMESTAMP_HEADER) || 0)
  return cachedAt > 0 && Date.now() - cachedAt < CACHE_MAX_AGE_MS
}

const withCacheMetadata = (response) => {
  const headers = new Headers(response.headers)
  headers.set(CACHE_TIMESTAMP_HEADER, String(Date.now()))
  headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE_SECONDS}`)

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const cacheFirst = async (request) => {
  let cache, cachedResponse
  try {
    cache = await caches.open(CACHE_NAME)
    cachedResponse = await cache.match(request)
  } catch {
    return fetch(request)
  }

  if (cachedResponse && isFresh(cachedResponse)) {
    return cachedResponse
  }

  let response
  try {
    response = await fetch(request)
  } catch (error) {
    if (cachedResponse) return cachedResponse
    throw error
  }
  if (response.ok) {
    try {
      await cache.put(request, withCacheMetadata(response.clone()))
    } catch { /* The network response is usable even when the cache is full. */ }
  }
  return response
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE_NAME))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
        .map((cacheName) => caches.delete(cacheName))
    )
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (!isCacheableRequest(event.request)) return
  event.respondWith(cacheFirst(event.request))
})
