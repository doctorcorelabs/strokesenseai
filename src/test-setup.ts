import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Node's global Storage can shadow jsdom storage. Use an isolated browser double.
const values = new Map<string, string>();
const storage: Storage = {
  get length() {
    return values.size;
  },
  clear: () => values.clear(),
  getItem: (key) => values.get(key) ?? null,
  key: (index) => [...values.keys()][index] ?? null,
  removeItem: (key) => {
    values.delete(key);
  },
  setItem: (key, value) => {
    values.set(key, String(value));
  },
};
Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
afterEach(() => {
  cleanup();
  storage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { writable: true, value: vi.fn() });
