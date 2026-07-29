// vitest 공통 셋업 — jest-dom 매처(toBeVisible/toBeDisabled 등) 등록 + RTL cleanup.
// RTL 자동 cleanup은 vitest globals 없이는 등록되지 않아 렌더가 테스트 간 누적된다 → 명시 등록.
// node 환경(엔진 테스트)에서도 로드되지만 matcher 확장 + no-op cleanup뿐이라 무해하다.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(cleanup);

// jsdom은 offsetParent를 항상 null로 둔다(레이아웃 미구현) — Dialog 포커스 트랩의
// "보이는 요소" 필터(n.offsetParent !== null)가 전부 걸러져 트랩이 무력화된다.
// 부모 요소를 돌려주는 근사로 대체(테스트에서 display:none 조상은 다루지 않는다).
if (typeof document !== 'undefined') {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    get(this: HTMLElement) { return this.parentElement; },
  });
}

// Node 22+가 메서드 없는 자체 localStorage 전역(--localstorage-file 필요)을 노출하고,
// 이게 vitest의 jsdom 전역 주입과 충돌해 jsdom 환경에서도 진짜 Storage가 없다
// (window.localStorage === undefined 확인). bare `localStorage` 참조(store.ts 저장/로드)가
// 스텁으로 흘러 조용히 실패하므로, 메서드가 없으면 인메모리 Storage로 교체한다.
function makeMemoryStorage(): Storage {
  let map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map = new Map(); },
  };
}
const brokenLocalStorage = (() => {
  try { return typeof localStorage === 'undefined' || typeof localStorage.setItem !== 'function'; }
  catch { return true; }
})();
if (brokenLocalStorage) {
  const storage = makeMemoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true });
  }
}
