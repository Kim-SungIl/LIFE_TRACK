// @vitest-environment jsdom
// 기록(archive) 저장 실패 신호 — T57.
//
// 결함의 모양(실측 재현): 기록 키의 쓰기만 실패시키고 본 게임 세이브는 성공시키면
//   commitRun 반환 runs 1 / 디스크 runs 0 / 세이브 성공 true / 예외 없음
// 이었다. persist가 예외를 통째로 삼키고 반환값도 없었고, store의 storageSaveFailed는
// 세이브 경로에서만 서므로 **화면이 볼 신호가 하나도 없었다**. 그래서 엔딩 요약은
// 메모리로 계산한 delta를 근거로 "완주했다"고 말했고, 기록실은 비어 있었다.
//
// 도달 경로가 대칭이 아니라는 게 핵심이다: 세이브는 매번 **같은 키를 덮어써서** 총량이
// 제자리인 반면 기록은 판마다 커진다. 그래서 한도 근처에서 기록 쓰기만 골라 실패한다.
// 아래는 그 상황을 **키 단위로** 만든다.
//
// jsdom 환경인 이유: store.ts의 세이브 경로까지 같이 봐야 "두 신호가 구분되는가"를
// 잠글 수 있고, 그 경로는 localStorage를 직접 쓴다.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  accrueFromState, accrueParentEvent, accrueResolvedEvent, accrueTalk,
  beginRun, clearArchive, commitRun, isArchiveSaveFailed, loadArchive,
} from '../archive';
import { isStorageSaveFailed, useGameStore } from '../store';
import { failWritesTo, installStorage } from '../../test/failingStorage';
import { createInitialState } from '../gameEngine';
import type { GameEvent, GameState, ParentStrength } from '../types';

const ARCHIVE_KEY = 'lifetrack_archive';
const SAVE_KEY = 'lifetrack_save';
const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

const ev = (id: string): GameEvent =>
  ({ id, title: id, description: '', choices: [] }) as GameEvent;

function runState(overrides: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 12345 });
  s.events = [];
  s.talkEventsFired = [];
  return Object.assign(s, overrides);
}


/**
 * jsdom의 Storage와 **같은 성질**을 갖는 스탠드인: `defineProperty`가 JS 속성 정의가 아니라
 * **항목 저장**으로 처리된다. CI에서 옛 하네스를 무력화시킨 바로 그 성질이다.
 */
function jsdomLikeStorage(): Storage {
  const map = new Map<string, string>();
  const base = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  };
  return new Proxy(base, {
    defineProperty(_t, prop, desc) {
      // 메서드를 가리지 않는다 — 이름을 가진 항목으로 삼킨다.
      map.set(String(prop), String((desc as PropertyDescriptor).value));
      return true;
    },
  }) as unknown as Storage;
}

/** 본 게임 세이브를 한 번 일으킨다 — store의 subscribe가 state 교체마다 동기로 쓴다. */
function forceMainSave(): void {
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  useGameStore.setState({ state: runState(), runDelta: null, npcActivityMap: {} });
}

beforeEach(() => {
  clearArchive();
  localStorage.clear();
  // 두 플래그 모두 **모듈 전역**이라 성공한 쓰기로만 내려간다. 앞 테스트의 실패가
  // 뒤 테스트의 전제를 조용히 바꾸지 않게, 매번 성공 쓰기를 한 번씩 일으켜 되돌린다
  // (store.ts 쪽 선례: endingRestartWiring.test.tsx의 beforeEach).
  beginRun();
  forceMainSave();
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('하네스 자기검사 — 키 하나만 골라 터뜨린다', () => {
  // 이게 없으면 아래 전부가 "아무것도 안 터진 환경"을 재는 것일 수 있다.
  // 양성(기록 키가 실제로 던진다) + 음성(세이브 키는 멀쩡하다)을 같이 건다.
  // **CI 모양에서도 무는가.** 로컬(Node 25)은 setup.ts가 localStorage를 평범한 객체로
  // 갈아끼우지만 CI(Node 22)에는 jsdom의 진짜 Storage(프록시)가 남는다. 그 프록시는
  // `defineProperty`를 "메서드 가리기"가 아니라 **항목 저장**으로 받는다 — 옛 하네스가
  // 거기서 조용히 무력화돼 15건이 빨개졌다. 여기서 그 모양을 직접 만들어 재현한다.
  it('하네스가 환경 모양에 안 기댄다 — jsdom 프록시 모양에서도 문다', () => {
    const original = globalThis.localStorage;
    installStorage(jsdomLikeStorage());
    try {
      // 옛 방식이 정말로 안 먹는 모양인지 먼저 보인다(이게 거짓이면 이 대조가 공허하다).
      Object.defineProperty(globalThis.localStorage, 'setItem', {
        configurable: true, writable: true, value: () => { throw new Error('should not bite'); },
      });
      expect(() => localStorage.setItem(ARCHIVE_KEY, 'x'), '이 모양에서 인스턴스 패치가 먹으면 대조가 무의미하다').not.toThrow();

      const restore = failWritesTo(ARCHIVE_KEY);
      try {
        expect(() => localStorage.setItem(ARCHIVE_KEY, 'x'), '전역 교체 하네스가 안 물었다').toThrow();
        expect(() => localStorage.setItem(SAVE_KEY, 'x'), '엉뚱한 키까지 막았다').not.toThrow();
        expect(localStorage.getItem(SAVE_KEY)).toBe('x');
      } finally { restore(); }
    } finally { installStorage(original); }
  });

  it('기록 키만 던지고 세이브 키는 통과한다', () => {
    const restore = failWritesTo(ARCHIVE_KEY);
    try {
      expect(() => localStorage.setItem(ARCHIVE_KEY, 'x'), '하네스가 안 물었다').toThrow();
      expect(() => localStorage.setItem(SAVE_KEY, 'x'), '엉뚱한 키까지 막았다').not.toThrow();
      expect(localStorage.getItem(SAVE_KEY)).toBe('x');
    } finally {
      restore();
    }
    expect(() => localStorage.setItem(ARCHIVE_KEY, 'x'), '복원이 안 됐다').not.toThrow();
  });
});

describe('기록 쓰기만 실패할 때 (T57 결함)', () => {
  it('완주가 디스크에 안 남는데도 예외는 새지 않고 요약은 그대로 나온다', () => {
    const restore = failWritesTo(ARCHIVE_KEY);
    try {
      let delta;
      expect(() => { delta = commitRun(runState({ events: [ev('a')] }), '수도권 대학'); },
        '기록 실패가 엔딩을 끊었다 — 이 성질은 유지되어야 한다').not.toThrow();
      // 성취는 숨기지 않는다: 플레이어가 그 판을 산 것은 사실이다.
      expect(delta, 'commitRun이 요약을 안 돌려줬다').toMatchObject({ runs: 1, newEndingTitle: true });
      // 그리고 디스크에는 없다 — 이 간극이 결함의 정체다.
      expect(loadArchive().runs, '쓰기가 실패했는데 디스크에 완주가 남았다 = 하네스가 무의미').toBe(0);
    } finally {
      restore();
    }
  });

  it('신호가 서고, 본 게임 세이브 실패 신호와 구분된다', () => {
    const restore = failWritesTo(ARCHIVE_KEY);
    try {
      forceMainSave();   // 세이브는 같은 키를 덮어쓰므로 이 환경에서도 성공한다
      commitRun(runState({ events: [ev('a')] }), '수도권 대학');

      expect(isArchiveSaveFailed(), '기록이 안 써졌는데 기록 신호가 안 섰다').toBe(true);
      expect(isStorageSaveFailed(),
        '세이브는 성공했는데 세이브 신호가 섰다 — 두 축이 한 덩어리로 접혔다').toBe(false);
    } finally {
      restore();
    }
  });

  // 반대 방향. 두 신호가 같은 값을 따라다니면 "구분된다"는 단언이 우연히 통과한다.
  it('세이브만 죽으면 세이브 신호만 선다 (기록 신호는 안 선다)', () => {
    const restore = failWritesTo(SAVE_KEY);
    try {
      forceMainSave();
      commitRun(runState({ events: [ev('a')] }), '수도권 대학');

      expect(isStorageSaveFailed(), '세이브가 안 써졌는데 세이브 신호가 안 섰다').toBe(true);
      expect(isArchiveSaveFailed(),
        '기록은 성공했는데 기록 신호가 섰다 — 세이브 실패를 기록 실패로 읽는다').toBe(false);
      expect(loadArchive().runs, '기록 쓰기는 멀쩡해야 하는 환경이다').toBe(1);
    } finally {
      restore();
    }
  });
});

// 양성 짝. 경고가 상시 켜져 있으면 경고가 아니다 — 그리고 부정형 단언만 두면
// 플래그를 상수 false로 박아도 초록이 된다.
describe('정상 환경 대조군', () => {
  it('완주가 디스크에 남고 신호는 안 선다', () => {
    const delta = commitRun(runState({ events: [ev('a')] }), '수도권 대학');
    expect(delta.runs).toBe(1);
    expect(loadArchive().runs, '정상 환경인데 디스크에 안 남았다 = 대조군이 무의미').toBe(1);
    expect(isArchiveSaveFailed()).toBe(false);
  });

  it('판 중 적립도 디스크에 남고 신호는 안 선다', () => {
    accrueResolvedEvent(runState({ events: [ev('a')] }));
    expect(loadArchive().events, '정상 환경인데 적립이 디스크에 안 갔다').toContain('a');
    expect(isArchiveSaveFailed()).toBe(false);
  });
});

describe('복구 — 다음 쓰기가 성공하면 신호가 내려간다', () => {
  it('실패 뒤 성공한 쓰기 하나로 내려간다', () => {
    const restore = failWritesTo(ARCHIVE_KEY);
    try {
      commitRun(runState({ events: [ev('a')] }), '수도권 대학');
      expect(isArchiveSaveFailed(), '전제: 신호가 서 있어야 한다').toBe(true);
    } finally {
      restore();
    }
    accrueResolvedEvent(runState({ events: [ev('b')] }));
    expect(isArchiveSaveFailed(),
      '용량이 풀렸는데도 경고가 남아 있다 — 상시 경고는 경고가 아니다').toBe(false);
    expect(loadArchive().events, '내려갔다는데 실제로는 안 써졌다').toContain('b');
  });

  // 지우기는 쓰기가 아니다. 용량 초과가 정확히 그 모양이다(removeItem은 통과, setItem만 터진다) —
  // clearArchive로 신호가 내려가면 "이제 써진다"는 거짓 보증이 된다.
  it('clearArchive로는 안 내려간다', () => {
    const restore = failWritesTo(ARCHIVE_KEY);
    try {
      commitRun(runState({ events: [ev('a')] }), '수도권 대학');
      expect(isArchiveSaveFailed(), '전제: 신호가 서 있어야 한다').toBe(true);
      clearArchive();
      expect(isArchiveSaveFailed(), '지우기를 성공한 쓰기로 셌다').toBe(true);
    } finally {
      restore();
    }
  });
});

// runs만의 문제가 아니다. 판 중 적립도 같은 persist를 쓰므로, 한도 근처에서는 그 판의
// 이야기·앨범 적립이 통째로 조용히 사라진다. 호출지점마다 같은 신호가 서야 한다 —
// 한 곳만 잡으면 나머지 경로로 새는 손실은 끝까지 안 보인다.
describe('판 중 적립도 같은 신호를 세운다', () => {
  const state = runState({
    events: [ev('e1')],
    talkEventsFired: [],
    parentEventsFired: [{ id: 'parent-mini-a', week: 3 }],
  });

  const CASES: [string, () => void][] = [
    ['정규 이벤트', () => accrueResolvedEvent(runState({ events: [ev('e1')] }))],
    ['말걸기 미니이벤트', () => accrueTalk(runState(), 't-alpha')],
    ['부모 이벤트', () => accrueParentEvent(runState(), 'parent-mini-a')],
    ['세이브 백필', () => accrueFromState(state)],
    ['새 판 기준선 리셋', () => beginRun()],
  ];

  it.each(CASES)('%s 적립이 실패하면 신호가 선다 (예외는 안 샌다)', (_label, accrue) => {
    const before = localStorage.getItem(ARCHIVE_KEY);
    const restore = failWritesTo(ARCHIVE_KEY);
    try {
      expect(() => accrue(), '적립 실패가 플레이를 끊었다').not.toThrow();
      expect(isArchiveSaveFailed()).toBe(true);
      expect(localStorage.getItem(ARCHIVE_KEY),
        '쓰기가 실패했는데 디스크가 바뀌었다 = 하네스가 무의미').toBe(before);
    } finally {
      restore();
    }
  });

  // 같은 호출지점의 양성 짝 — 정상 환경에서 실제로 디스크에 닿는지 확인하지 않으면,
  // 위 it.each는 "아무 일도 안 하는 함수"에서도 전부 초록이다.
  it.each(CASES)('%s 적립은 정상 환경에서 디스크에 닿는다', (_label, accrue) => {
    localStorage.removeItem(ARCHIVE_KEY);
    accrue();
    expect(localStorage.getItem(ARCHIVE_KEY), '정상 환경인데 쓰기가 아예 없었다').not.toBe(null);
    expect(isArchiveSaveFailed()).toBe(false);
  });
});
