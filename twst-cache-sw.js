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

  return url.pathname.includes('/assets/') ||
    CACHEABLE_EXTENSION_PATTERN.test(url.pathname)
}

const isFresh = (response) => {
  const cachedAt = Number(response.headers.get(CACHE_TIMESTAMP_HEADER) || 0)
  return cachedAt > 0 && Date.now() - cachedAt < CACHE_MAX_AGE_MS
}

const withCacheMetadata = async (response) => {
  const headers = new Headers(response.headers)
  headers.set(CACHE_TIMESTAMP_HEADER, String(Date.now()))
  headers.set('Cache-Control', `public, max-age=${CACHE_MAX_AGE_SECONDS}`)

  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const fetchAndCache = async (request, cache) => {
  const response = await fetch(request)
  if (!response.ok) return response

  const cachedResponse = await withCacheMetadata(response.clone())
  await cache.put(request, cachedResponse.clone())
  return cachedResponse
}

const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME)
  const cachedResponse = await cache.match(request)

  if (cachedResponse && isFresh(cachedResponse)) {
    return cachedResponse
  }

  try {
    return await fetchAndCache(request, cache)
  } catch (error) {
    if (cachedResponse) return cachedResponse
    throw error
  }
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
