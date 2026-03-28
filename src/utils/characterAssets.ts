type ImageNameAccessor<T> = keyof T | ((item: T) => string);

const mainImageModules = import.meta.glob('../assets/img/*.webp', {
  import: 'default',
});
const iconImageModules = import.meta.glob('../assets/img/icon/*.webp', {
  import: 'default',
});

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

function getModuleRegistry(prefix: string) {
  if (prefix === 'icon/') {
    return iconImageModules;
  }

  return mainImageModules;
}

async function loadImageModuleUrl(imageName: string, prefix = ''): Promise<string> {
  const cacheKey = `${prefix}${imageName}`;
  const cached = imageUrlCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const moduleKey = resolveModuleKey(imageName, prefix);
  const registry = getModuleRegistry(prefix);
  const importer = registry[moduleKey];
  if (!importer) {
    imageUrlCache.set(cacheKey, '');
    return '';
  }

  try {
    const imageUrl = await importer() as string;
    imageUrlCache.set(cacheKey, imageUrl);
    return imageUrl;
  } catch {
    imageUrlCache.set(cacheKey, '');
    return '';
  }
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
      ? await loadImageModuleUrl(fallbackName, prefix)
      : '';

  await Promise.all(
    items.map(async (item) => {
      const imageName = resolveImageName(item, nameAccessor);
      if (!imageName) {
        return;
      }

      const imageUrl = await loadImageModuleUrl(imageName, prefix);
      dictionary[imageName] = imageUrl || fallbackUrl || '';
    })
  );

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
