// 테스트용 — **키 하나의 쓰기만** 터뜨리는 하네스. (T57)
//
// 이 게임의 저장은 두 키로 갈린다: `lifetrack_save`(지금 진행 중인 한 판)와
// `lifetrack_archive`(지금까지의 모든 판). T57이 고친 결함의 도달 조건이 바로
// **기록 키만 실패하는** 구간이라, 하네스도 키 단위로 터뜨려야 한다.
//
// ===== 왜 Storage 인스턴스를 안 건드리나 =====
// 인스턴스를 패치하면 **환경에 따라 조용히 안 먹는다.** 실제로 그렇게 당했다:
//
//   · Node 25(로컬) — setup.ts가 Node의 깨진 localStorage 전역을 감지해 평범한 객체로
//     갈아끼운다. 그 객체에는 own 속성 패치가 먹는다. 그래서 로컬은 2,633개 전부 초록이었다.
//   · Node 22(CI) — 그 감지가 거짓이라 **jsdom의 진짜 Storage(프록시)**가 남는다. 거기서
//     `Object.defineProperty(localStorage, 'setItem', …)`는 메서드를 가리는 게 아니라
//     **'setItem'이라는 이름의 항목을 저장한다**(Storage의 named property 규약). 패치가
//     통째로 무시되고, 터질 줄 알았던 쓰기가 그냥 성공한다.
//
// CI에서 15건이 그렇게 빨개졌다. 값진 건 **자기검사가 그걸 잡았다**는 것이다 — 하네스가
// 안 물면 뒤따르는 단언이 전부 "실패가 안 일어났다"로 조용히 통과해 파일 전체가 공허해진다.
//
// 그래서 인스턴스가 아니라 **전역 바인딩을 갈아끼운다.** 두 모양 모두에서 같게 동작하고,
// setup.ts가 쓰는 방식과 같다. 제품 코드(`archive.ts`·`store.ts`)는 bare `localStorage`를
// 호출 시점에 읽으므로 교체가 그대로 보인다.

/** 전역(그리고 window)의 localStorage 바인딩을 갈아끼운다. */
export function installStorage(s: Storage): void {
  Object.defineProperty(globalThis, 'localStorage', { value: s, configurable: true, writable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: s, configurable: true, writable: true });
  }
}

/**
 * `key`의 쓰기만 던지게 만든다. 나머지 키는 그대로 통과한다.
 * 돌려받은 함수를 부르면 원래 저장소로 되돌아간다(복원이 새면 이후 테스트가 전부
 * "저장이 죽은" 환경을 본다).
 */
export function failWritesTo(key: string): () => void {
  const real = globalThis.localStorage;
  const fake: Storage = {
    get length() { return real.length; },
    key: (i: number) => real.key(i),
    getItem: (k: string) => real.getItem(k),
    setItem: (k: string, v: string) => {
      if (k === key) throw new Error('QuotaExceededError');
      real.setItem(k, v);
    },
    removeItem: (k: string) => real.removeItem(k),
    clear: () => real.clear(),
  };
  installStorage(fake);

  // **여기서 물었는지 확인한다.** 교체가 안 먹은 채로 돌려주면 하네스가 무의미해지는데,
  // 그 상태는 "아무 일도 안 일어남"이라 호출부의 단언으로는 안 잡힌다(CI가 그 모양이었다).
  // 실패 키로 쏘므로 성공해도 쓰이는 값은 없다.
  let bit = false;
  try { globalThis.localStorage.setItem(key, '__probe__'); } catch { bit = true; }
  if (!bit) {
    installStorage(real);
    throw new Error('failWritesTo: 전역 localStorage 교체가 안 먹었다 — 하네스가 무의미하다');
  }
  return () => installStorage(real);
}
