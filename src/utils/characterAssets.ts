type ImageNameAccessor<T> = keyof T | ((item: T) => string);
type ImageModuleRegistry = Record<string, string>;

const mainImageModules = import.meta.glob('../assets/img/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as ImageModuleRegistry;
const iconImageModules = import.meta.glob('../assets/img/icon/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as ImageModuleRegistry;

const imageUrlCache = new Map<string, string>();

function resolveImageName<T>(item: T, accessor: ImageNameAccessor<T>): string {
  if (typeof accessor === 'function') {
    return accessor(item);
  }

  const value = item?.[accessor];
  return typeof value === 'string' ? value : '';
}

function resolveModuleKey(imageName: string, prefix: string): string {
  if (prefix === 'icon/') {
    return `../assets/img/icon/${imageName}.webp`;
  }

  if (prefix) {
    return `../assets/img/${prefix}${imageName}.webp`;
  }

  return `../assets/img/${imageName}.webp`;
}

function getModuleRegistry(prefix: string): ImageModuleRegistry {
  if (prefix === 'icon/') {
    return iconImageModules;
  }

  return mainImageModules;
}

function loadImageModuleUrl(imageName: string, prefix = ''): string {
  const cacheKey = `${prefix}${imageName}`;
  const cached = imageUrlCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const moduleKey = resolveModuleKey(imageName, prefix);
  const registry = getModuleRegistry(prefix);
  const imageUrl = registry[moduleKey];
  if (!imageUrl) {
    imageUrlCache.set(cacheKey, '');
    return '';
  }

  imageUrlCache.set(cacheKey, imageUrl);
  return imageUrl;
}

export async function loadCachedImageUrl(imageName: string, prefix: string = ''): Promise<string> {
  return loadImageModuleUrl(imageName, prefix);
}

export async function loadCharacterImageUrl(imageName: string, fallbackName = 'notyet'): Promise<string> {
  const imageUrl = await loadImageModuleUrl(imageName);
  if (imageUrl || !fallbackName) {
    return imageUrl;
  }

  return loadImageModuleUrl(fallbackName);
}

export async function loadImageUrls<T>(
  items: T[],
  nameAccessor: ImageNameAccessor<T>,
  prefix: string = '',
  fallbackName?: string
): Promise<Record<string, string>> {
  const dictionary: Record<string, string> = {};

  const fallbackUrl =
    fallbackName && prefix !== 'icon/'
      ? loadImageModuleUrl(fallbackName, prefix)
      : '';

  items.forEach((item) => {
    const imageName = resolveImageName(item, nameAccessor);
    if (!imageName) {
      return;
    }

    const imageUrl = loadImageModuleUrl(imageName, prefix);
    dictionary[imageName] = imageUrl || fallbackUrl || '';
  });

  if (fallbackName) {
    dictionary[fallbackName] = fallbackUrl || '';
  }

  return dictionary;
}

export async function hydrateCharacterImageUrls<T extends Record<string, any>>(
  items: T[],
  nameAccessor: ImageNameAccessor<T>,
  options?: {
    targetKey?: keyof T;
    fallbackName?: string;
    prefix?: string;
  }
) {
  const targetKey = options?.targetKey ?? ('imgUrl' as keyof T);
  const prefix = options?.prefix ?? '';
  const fallbackName = options?.fallbackName;
  const imageUrls = await loadImageUrls(items, nameAccessor, prefix, fallbackName);

  items.forEach((item) => {
    const imageName = resolveImageName(item, nameAccessor);
    item[targetKey] = (imageName ? imageUrls[imageName] : '') as T[keyof T];
  });

  return imageUrls;
}
