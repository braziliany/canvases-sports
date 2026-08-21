const CACHE_KEY = "canvases-sports:jiangsu:v1";

export function loadCache(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(CACHE_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function saveCache(data, storage = globalThis.localStorage) {
  try {
    storage?.setItem(CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data }));
    return true;
  } catch {
    return false;
  }
}
