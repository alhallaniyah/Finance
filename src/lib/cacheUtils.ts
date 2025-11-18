type CacheEntry<T> = { data: T; timestamp: number };

const nowMs = () => Date.now();

export type CachedPayload<T = any> = CacheEntry<T> & Record<string, any>;

export type MemoryCache<T> = {
  get(): T | null;
  set(data: T): void;
  invalidate(): void;
  peek(): CacheEntry<T> | null;
};

export function createMemoryCache<T>(ttlMs: number): MemoryCache<T> {
  let entry: CacheEntry<T> | null = null;

  const isValid = (candidate: CacheEntry<T> | null) => {
    if (!candidate) return false;
    if (ttlMs <= 0) return true;
    return nowMs() - candidate.timestamp < ttlMs;
  };

  return {
    get() {
      return isValid(entry) ? entry!.data : null;
    },
    set(data) {
      entry = { data, timestamp: nowMs() };
    },
    invalidate() {
      entry = null;
    },
    peek() {
      return entry;
    },
  };
}

export type KeyedCache<T> = {
  get(key: string): T | null;
  set(key: string, data: T): void;
  invalidate(key?: string): void;
  peek(key: string): CacheEntry<T> | null;
};

export function createKeyedCache<T>(ttlMs: number): KeyedCache<T> {
  const store = new Map<string, CacheEntry<T>>();

  const isValid = (candidate: CacheEntry<T> | null) => {
    if (!candidate) return false;
    if (ttlMs <= 0) return true;
    return nowMs() - candidate.timestamp < ttlMs;
  };

  return {
    get(key) {
      const entry = store.get(key) || null;
      if (!isValid(entry)) {
        if (entry) store.delete(key);
        return null;
      }
      return entry!.data;
    },
    set(key, data) {
      store.set(key, { data, timestamp: nowMs() });
    },
    invalidate(key) {
      if (typeof key === 'string') {
        store.delete(key);
      } else {
        store.clear();
      }
    },
    peek(key) {
      return store.get(key) || null;
    },
  };
}

export function readLocalCache<T = any>(key: string): CachedPayload<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.timestamp !== 'number') return null;
    return parsed as CachedPayload<T>;
  } catch {
    return null;
  }
}

export function writeLocalCache(key: string, payload: Record<string, any>) {
  try {
    const withTs = { ...payload, timestamp: nowMs() };
    localStorage.setItem(key, JSON.stringify(withTs));
  } catch {
    // Ignore storage write errors (e.g. privacy mode)
  }
}

export function removeLocalCache(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore localStorage access errors
  }
}

export function removeLocalCacheByPrefix(prefix: string) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore localStorage access errors
  }
}
