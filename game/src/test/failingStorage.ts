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
const PROBE = '__failWritesTo_probe__';

export function failWritesTo(key: string): () => void {
  const real = globalThis.localStorage;
  // 확인용 쓰기가 혹시라도 진짜 저장소에 떨어지면 되돌리기 위해 잡아둔다.
  const before = real.getItem(key);
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
  //
  // 순서가 중요하다. **먼저 동일성을 보고**, 그게 맞을 때만 실제로 쏜다 — 교체가 안 먹은 채로
  // 쏘면 그 쓰기가 **진짜 저장소에 떨어져 기록을 덮어쓴다**. 초안이 그랬다(주석은 "쓰이는 값은
  // 없다"고 했는데 사실은 반대였고, 실패 분기는 바인딩만 되돌리고 덮어쓴 값은 그대로 뒀다).
  //
  // 아래 두 방어(동일성 검사·되돌리기)는 **이 환경에서 만들 수 없는 상태**를 막는다 —
  // 전역 교체는 여기선 늘 성공하므로 뮤테이션으로 못 잠근다. 그래도 둔다: 조용히 안 먹는
  // 교체가 정확히 이 파일이 존재하는 이유이기 때문이다(CI에서 한 번 당했다).
  if (globalThis.localStorage !== fake) {
    installStorage(real);
    throw new Error('failWritesTo: 전역 localStorage 교체가 안 먹었다 — 하네스가 무의미하다');
  }
  let bit = false;
  try { globalThis.localStorage.setItem(key, PROBE); } catch { bit = true; }
  if (!bit) {
    // fake가 그 키를 안 물고 흘려보낸 경우 — 진짜 저장소에 PROBE가 앉았으니 되돌린다.
    if (real.getItem(key) === PROBE) {
      if (before === null) real.removeItem(key); else real.setItem(key, before);
    }
    installStorage(real);
    throw new Error(`failWritesTo: '${key}' 쓰기가 안 터졌다 — 하네스가 무의미하다`);
  }
  return () => installStorage(real);
}
