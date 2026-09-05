class SimpleCache {
  private readonly cache = new Map<string, { value: any; expiresAt: number }>();

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key: string, value: any, ttlMs: number): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const apiCache = new SimpleCache();
