export interface KvStore {
  get<T>(key: string, fallback: T): Promise<T>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

function makeLocalStore(): KvStore {
  return {
    async get<T>(key: string, fallback: T): Promise<T> {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
    },
    async set(key, value) { window.localStorage.setItem(key, JSON.stringify(value)); },
    async remove(key) { window.localStorage.removeItem(key); },
  };
}

// chrome.storage.sync wrapper; falls back to localStorage when unavailable (web).
function makeSyncStore(): KvStore {
  const chromeStorage = (globalThis as any).chrome?.storage?.sync;
  if (!chromeStorage) return makeLocalStore();
  return {
    get<T>(key: string, fallback: T): Promise<T> {
      return new Promise((res) => chromeStorage.get({ [key]: fallback }, (r: any) => res(r[key])));
    },
    set(key, value) { return new Promise((res) => chromeStorage.set({ [key]: value }, () => res())); },
    remove(key) { return new Promise((res) => chromeStorage.remove(key, () => res())); },
  };
}

export const localStore: KvStore = makeLocalStore();
export const syncStore: KvStore = makeSyncStore();
