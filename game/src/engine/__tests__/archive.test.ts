import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { clearArchive, commitRun, emptyArchive, loadArchive, CURRENT_ARCHIVE_VERSION } from '../archive';
import { barelyTouchedNames, npcStoryRows } from '../npcStoryPool';
import { INTIMACY_TIER_LABEL, intimacyTier, type IntimacyTier } from '../npcRoster';
import { useGameStore } from '../store';
import { GAME_EVENTS } from '../events';
import type { GameEvent, GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
const ARCHIVE_KEY = 'lifetrack_archive';

function runState(overrides: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 12345 });
  s.events = [];
  s.talkEventsFired = [];
  return Object.assign(s, overrides);
}

const ev = (id: string, background?: string): GameEvent =>
  ({ id, title: id, description: '', choices: [], background }) as GameEvent;

/** 친밀도만 올린 npcs — met를 같이 켜야 기록에 반영된다(만난 적 없으면 티어가 없다). */
function withIntimacy(s: GameState, map: Record<string, number>): GameState {
  s.npcs = s.npcs.map(n => map[n.id] === undefined ? n : { ...n, met: true, intimacy: map[n.id] });
  return s;
}

// 티어는 관계 패널·상세 모달·기록실이 공유하는 SSOT라 여기서 직접 잠근다.
// 경계값을 바꾸면 세 화면의 라벨이 한꺼번에 바뀌므로 회귀가 조용히 지나가면 안 된다.
describe('친밀도 티어 (npcRoster)', () => {
  it('만나지 않았으면 친밀도와 무관하게 만난 적 없음이다', () => {
    expect(intimacyTier(0, false)).toBe('unmet');
    expect(intimacyTier(99, false)).toBe('unmet');   // 데이터가 남아 있어도 met=false면 unmet
  });

  it('경계값에서 티어가 바뀐다', () => {
    expect(intimacyTier(0)).toBe('acquaintance');
    expect(intimacyTier(39)).toBe('acquaintance');
    expect(intimacyTier(40)).toBe('friend');
    expect(intimacyTier(69)).toBe('friend');
    expect(intimacyTier(70)).toBe('best');
    expect(intimacyTier(100)).toBe('best');
  });

  // 긍정형(존재)과 부정형(수치 없음)을 같이 건다. 부정형만 두면 라벨을 통째로 지웠을 때
  // Object.values가 빈 배열이라 루프가 안 돌고 그냥 통과한다(공허 참).
  it('모든 티어에 라벨이 있고, 라벨은 수치를 노출하지 않는다 (hide-numbers)', () => {
    const TIERS: IntimacyTier[] = ['unmet', 'acquaintance', 'friend', 'best'];
    for (const t of TIERS) {
      expect(INTIMACY_TIER_LABEL[t], `${t} 라벨이 비었다`).toBeTruthy();
      expect(INTIMACY_TIER_LABEL[t]).not.toMatch(/\d/);
    }
    expect(Object.keys(INTIMACY_TIER_LABEL)).toHaveLength(TIERS.length);
  });
});

// 이 게임의 재플레이 가치가 걸린 축. 친밀도가 아니라 "그 사람의 이야기를 봤는가"가
// 판을 가른다 — 친밀도는 동행·말걸기를 쓰느냐에 좌우되는데, 도달형 이벤트는 학년으로
// 게이트돼 그 학년에 곁에 없었으면 나중에 아무리 가까워져도 안 열리기 때문이다.
describe('NPC 이야기 커버리지 (npcStoryPool)', () => {
  const rows = npcStoryRows([]);
  const poolOf = (id: string) => rows.find(r => r.id === id)!.total;

  // 풀이 빈 NPC가 있으면 기록실에 "0 / 0" 줄이 생겨 아무 말도 못 한다.
  it('모든 NPC가 자기 이야기를 가진다', () => {
    for (const r of rows) {
      expect(r.total, `${r.name}에게 귀속된 이벤트가 하나도 없다`).toBeGreaterThan(0);
    }
  });

  // 정확한 수를 박으면 콘텐츠 추가마다 깨진다. 대신 "대량 유실"만 잡는 바닥선을 둔다.
  it('주요 인물의 이야기가 통째로 사라지지 않는다', () => {
    for (const id of ['jihun', 'subin', 'minjae', 'yuna']) {
      expect(poolOf(id), `${id} 풀이 급감했다`).toBeGreaterThanOrEqual(15);
    }
    for (const id of ['haeun', 'seoa', 'siwoo', 'yerin', 'junha', 'doyun']) {
      expect(poolOf(id), `${id} 풀이 급감했다`).toBeGreaterThanOrEqual(5);
    }
  });

  // 명단을 여기 적어 잠근다 — 기댓값을 INITIAL_NPCS에서 끌어오면 동어반복이라 NPC가 통째로
  // 사라져도 통과한다(뮤테이션 검수에서 실제로 놓쳤다). 상위집합 검사라 추가는 막지 않는다.
  it('로스터에서 아무도 조용히 사라지지 않는다', () => {
    const KNOWN = ['jihun', 'subin', 'minjae', 'yuna', 'doyun', 'haeun', 'junha', 'seoa', 'siwoo', 'yerin'];
    const ids = rows.map(r => r.id);
    for (const id of KNOWN) {
      expect(ids, `${id}가 로스터에서 빠졌다`).toContain(id);
    }
    expect(new Set(ids).size, '중복 줄이 생겼다').toBe(ids.length);
  });

  it('본 게 없으면 전원 0이고 비율도 0이다', () => {
    expect(rows.every(r => r.seen === 0 && r.ratio === 0)).toBe(true);
  });

  // 귀속 로직 검증 — 기댓값을 같은 풀에서 끌어오지 않고, "넣은 쪽만 오른다"는 관계로 잠근다.
  it('어떤 사람의 이벤트를 보면 그 사람 것만 오른다', () => {
    const target = 'seoa';
    const targetIds = GAME_EVENTS.filter(e => e.reach?.npc === target).map(e => e.id);
    expect(targetIds.length).toBeGreaterThan(0);

    const after = npcStoryRows(targetIds);
    const seoa = after.find(r => r.id === target)!;
    expect(seoa.seen).toBe(targetIds.length);
    expect(seoa.ratio).toBeGreaterThan(0);
    // 도달형은 대상 한 명에게만 귀속되므로 다른 사람 수치는 그대로여야 한다.
    for (const r of after) {
      if (r.id === target) continue;
      expect(r.seen, `${r.name}이 남의 도달형 이벤트로 올라갔다`).toBe(0);
    }
  });

  it('풀에 없는 id는 세지 않는다', () => {
    const after = npcStoryRows(['존재하지-않는-이벤트', '또-없는-것']);
    expect(after.every(r => r.seen === 0)).toBe(true);
  });

  describe('다음 판의 이정표 (barelyTouchedNames)', () => {
    it('아무것도 안 봤으면 전원이 후보다', () => {
      expect(barelyTouchedNames([], 99)).toHaveLength(rows.length);
    });

    it('많이 본 사람은 후보에서 빠지고, 적게 본 사람만 남는다', () => {
      const full = GAME_EVENTS.filter(e => e.reach?.npc === 'seoa' || e.speakers?.includes('seoa'))
        .map(e => e.id);
      const names = barelyTouchedNames(full, 99);
      expect(names).not.toContain('서아');
      expect(names.length).toBeGreaterThan(0);   // 나머지는 여전히 남아 있다
    });

    it('개수가 제한된다', () => {
      expect(barelyTouchedNames([], 3)).toHaveLength(3);
    });

    // 전원 동률(전부 0)인 판은 디버그 스킵으로 실제 관측된다. 로스터 순서를 그대로 쓰면
    // 주요 인물 넷이 앞에 서서 소꿉친구를 "스치기만 한 사람"이라 부르게 된다.
    it('비율이 같으면 이야기 수가 적은 쪽을 먼저 가리킨다', () => {
      const names = barelyTouchedNames([], 4);
      expect(names[0], '가장 적은 이야기(예린 6종)가 앞에 와야 한다').toBe('예린');
      expect(names, '38종을 가진 지훈이 동률만으로 앞줄에 서면 안 된다').not.toContain('지훈');
    });

    // ↓ 임계·정렬 전용 픽스처. 입력 `[]`로는 전원 ratio가 0이라 어떤 비교자를 써도 순서가 같고
    //   임계를 [0, 1) 어디로 옮겨도 결과가 안 변한다 — 실제로 뮤테이션 3종이 그렇게 새 나갔다.
    //   그래서 0.25를 **정확히 끼고 도는** 비율을 만든다. 기대값은 전부 이름 리터럴이다.
    describe('임계·정렬 (부분 커버리지 픽스처)', () => {
      // 도달형만 고른다 — 대상 한 명에게만 귀속되므로 남의 비율을 오염시키지 않는다.
      const reachIdsOf = (npcId: string, n: number): string[] =>
        GAME_EVENTS.filter(e => e.reach?.npc === npcId).slice(0, n).map(e => e.id);

      // 예린 1/6=0.167 · 서아 2/9=0.222 · 수빈 8/32=0.250(경계 정확히) · 지훈 10/38=0.263(바로 위)
      // · 시우 4/8=0.500 · 나머지 0.000
      const FIXTURE = [
        ...reachIdsOf('yerin', 1), ...reachIdsOf('seoa', 2), ...reachIdsOf('subin', 8),
        ...reachIdsOf('jihun', 10), ...reachIdsOf('siwoo', 4),
      ];
      const names = barelyTouchedNames(FIXTURE, 99);
      const idx = (name: string) => names.indexOf(name);

      it('픽스처가 의도한 비율을 만든다 (전제 확인)', () => {
        const r = new Map(npcStoryRows(FIXTURE).map(x => [x.name, x]));
        expect(r.get('수빈')!.seen / r.get('수빈')!.total).toBeCloseTo(0.25, 5);
        expect(r.get('지훈')!.ratio).toBeGreaterThan(0.25);
        expect(r.get('서아')!.ratio).toBeLessThan(0.25);
      });

      it('경계값(정확히 0.25)은 포함된다', () => {
        expect(names, '수빈 8/32는 경계 위 — <= 가 < 로 바뀌면 빠진다').toContain('수빈');
      });

      it('경계 바로 위는 제외된다', () => {
        expect(names, '지훈 10/38=0.263 — 임계를 올리면 들어온다').not.toContain('지훈');
        expect(names).not.toContain('시우');
      });

      it('적게 본 사람도 후보로 남는다 (임계 하향 금지)', () => {
        expect(names, '예린 1/6=0.167 — 임계를 0으로 내리면 빠진다').toContain('예린');
        expect(names).toContain('서아');
      });

      it('적게 본 순으로 정렬된다', () => {
        expect(idx('예린')).toBeLessThan(idx('서아'));   // 0.167 < 0.222
        expect(idx('서아')).toBeLessThan(idx('수빈'));   // 0.222 < 0.250
        expect(idx('민재')).toBeLessThan(idx('예린'));   // 0.000 < 0.167
      });
    });
  });
});

describe('런간 기록 (archive)', () => {
  beforeEach(() => { clearArchive(); });

  it('기록이 없으면 빈 기록으로 시작한다', () => {
    expect(loadArchive()).toEqual(emptyArchive());
    expect(loadArchive().version).toBe(CURRENT_ARCHIVE_VERSION);
  });

  it('한 판을 적립하면 이벤트·CG·미니톡·엔딩·완주수가 남는다', () => {
    const s = runState({
      events: [ev('a', 'classroom'), ev('b', 'rooftop'), ev('c')],
      talkEventsFired: ['t1', 't2'],
    });
    const d = commitRun(s, '수도권 대학');

    const a = loadArchive();
    expect(a.runs).toBe(1);
    expect(a.events.sort()).toEqual(['a', 'b', 'c']);
    expect(a.cg.sort()).toEqual(['classroom', 'rooftop']);
    expect(a.talks.sort()).toEqual(['t1', 't2']);
    expect(a.endings).toEqual(['수도권 대학']);
    expect(d).toMatchObject({ newEvents: 3, newTalks: 2, newEndingTitle: true, runs: 1 });
  });

  // 이 기능의 존재 이유 — 두 번째 판에서 "무엇이 새로웠는지"가 정확해야 한다.
  it('두 번째 판은 겹치는 건 안 세고 새로운 것만 센다', () => {
    commitRun(runState({ events: [ev('a'), ev('b')], talkEventsFired: ['t1'] }), '수도권 대학');
    const d = commitRun(
      runState({ events: [ev('b'), ev('c'), ev('d')], talkEventsFired: ['t1', 't2'] }), '수도권 대학');

    expect(d.newEvents).toBe(2);        // c, d — b는 이미 봤다
    expect(d.newTalks).toBe(1);         // t2
    expect(d.newEndingTitle).toBe(false);
    expect(d.runs).toBe(2);
    expect(loadArchive().events.sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('같은 엔딩을 또 봐도 목록은 안 늘고 완주 횟수만 는다', () => {
    commitRun(runState(), 'SKY 경영대 합격');
    commitRun(runState(), 'SKY 경영대 합격');
    const a = loadArchive();
    expect(a.endings).toEqual(['SKY 경영대 합격']);
    expect(a.runs).toBe(2);
  });

  // npcPeak은 아직 어느 화면도 렌더하지 않지만 영속 데이터라 적립을 유지한다(지금 안 쌓으면
  // 그 기간은 복구 불가). 대신 쓰기 로직을 여기서 직접 잠근다 — 조회 어댑터를 지웠으므로
  // 이 단언들이 사라지면 "복구 불가라서 지키기로 한 데이터"의 쓰기가 무검증이 된다.
  describe('NPC 최고 친밀도 적립 (npcPeak)', () => {
    it('만난 사람만 기록되고, 못 만난 사람은 키 자체가 안 생긴다', () => {
      commitRun(withIntimacy(runState(), { subin: 75, minjae: 45, yuna: 10 }), '수도권 대학');
      const peak = loadArchive().npcPeak;
      expect(peak.subin).toBe(75);
      expect(peak.minjae).toBe(45);
      expect(peak.yuna).toBe(10);
      expect(peak.seoa, '이 판에서 만난 적 없는 사람이 기록됐다').toBeUndefined();
    });

    it('met=false면 친밀도가 남아 있어도 적립하지 않는다', () => {
      const s = runState();
      s.npcs = s.npcs.map(n => n.id === 'seoa' ? { ...n, met: false, intimacy: 90 } : n);
      commitRun(s, '수도권 대학');
      expect(loadArchive().npcPeak.seoa, 'met 가드가 사라졌다').toBeUndefined();
    });

    it('다음 판에 소원해져도 최고치가 유지된다', () => {
      commitRun(withIntimacy(runState(), { subin: 80 }), '수도권 대학');
      commitRun(withIntimacy(runState(), { subin: 20 }), '수도권 대학');
      expect(loadArchive().npcPeak.subin).toBe(80);
    });

    it('더 가까워진 판이 나오면 갱신된다', () => {
      commitRun(withIntimacy(runState(), { subin: 20 }), '수도권 대학');
      commitRun(withIntimacy(runState(), { subin: 80 }), '수도권 대학');
      expect(loadArchive().npcPeak.subin).toBe(80);
    });
  });

  describe('내구성 — 기록이 게임을 망가뜨리면 안 된다', () => {
    it('손상된 JSON은 빈 기록으로 떨어진다', () => {
      localStorage.setItem(ARCHIVE_KEY, '{이건 JSON이 아니다');
      expect(loadArchive()).toEqual(emptyArchive());
    });

    it('타입이 어긋난 필드는 걸러내고 살아남은 값만 쓴다', () => {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify({
        version: 1, runs: 'many', events: ['a', 42, null, 'b'], talks: null,
        cg: 'nope', endings: ['끝'], npcPeak: { subin: 80, minjae: 'high' },
      }));
      const a = loadArchive();
      expect(a.runs).toBe(0);
      expect(a.events).toEqual(['a', 'b']);
      expect(a.talks).toEqual([]);
      expect(a.cg).toEqual([]);
      expect(a.endings).toEqual(['끝']);
      expect(a.npcPeak).toEqual({ subin: 80 });
    });

    it('저장이 실패해도 엔딩 적립이 던지지 않는다', () => {
      const orig = localStorage.setItem;
      localStorage.setItem = () => { throw new Error('QuotaExceeded'); };
      try {
        expect(() => commitRun(runState({ events: [ev('a')] }), '수도권 대학')).not.toThrow();
      } finally {
        localStorage.setItem = orig;
      }
    });
  });
});

// 이 파일에서 가장 값이 큰 테스트다. 나머지는 전부 순수 함수를 향하고 있어서, 적립이 실제
// 플레이에서 **한 번도 일어나지 않는** 상태(commitRun이 도달 불가 분기에 매달려 있었다)가
// 23개 전부 그린으로 통과했다. 배선은 배선을 지나가 봐야 잠긴다.
describe('적립 배선 — 실제로 엔딩까지 가면 기록이 남는가', () => {
  beforeEach(() => {
    clearArchive();
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  });

  /** UI가 누르는 액션만으로 엔딩까지 진행한다. 내부 함수를 직접 부르면 배선을 건너뛴다. */
  function playToEnding(maxSteps = 800): void {
    for (let i = 0; i < maxSteps; i++) {
      const s = useGameStore.getState().state!;
      if (s.phase === 'ending') return;
      if (s.phase === 'event') useGameStore.getState().resolveEvent(0);
      else if (s.phase === 'year-end') useGameStore.getState().advanceFromYearEnd();
      else if (s.phase === 'weekday' || s.phase === 'weekend' || s.phase === 'vacation') {
        useGameStore.getState().advanceWeek();
      } else useGameStore.getState().setPhase('weekday');
    }
    throw new Error(`${maxSteps}스텝 안에 엔딩에 도달하지 못했다 (phase=${useGameStore.getState().state!.phase})`);
  }

  function startNearEnd(): void {
    const s = createInitialState('male', PARENTS, { rngSeed: 4242 });
    s.year = 7;
    s.week = 44;
    s.phase = 'weekday';
    s.currentEvent = null;
    useGameStore.setState({ state: s, runDelta: null, npcActivityMap: {} });
  }

  it('Y7 마지막 주를 넘기면 완주가 적립된다', () => {
    startNearEnd();
    playToEnding();

    const a = loadArchive();
    expect(a.runs, '엔딩에 도달했는데 적립이 안 됐다').toBe(1);
    expect(a.endings).toHaveLength(1);
    expect(a.events.length, '본 이벤트가 하나도 기록되지 않았다').toBeGreaterThan(0);
    expect(useGameStore.getState().runDelta, '엔딩 요약이 쓸 runDelta가 비었다').not.toBeNull();
  });

  // 엔딩 진입 경로는 둘이고, 어느 쪽으로 끝나는지는 그 판에 W48 이벤트가 남았는지에 달렸다.
  // 위 테스트는 advanceWeek 경로만 지나므로 이 경로는 따로 잠근다 — 실제로 이 테스트가
  // 없을 때 resolveEvent 쪽 적립을 지워도 전부 그린이었다.
  it('W48 이벤트가 남아 이벤트 종료로 학년이 넘어가는 경로에서도 적립된다', () => {
    const s = createInitialState('male', PARENTS, { rngSeed: 4242 });
    s.year = 7;
    s.week = 49;          // processWeek가 주는 넘겼지만 대기 이벤트 때문에 전환이 미뤄진 상태
    s.phase = 'event';
    s.currentEvent = { ...ev('test-w48-pending'), week: 48 };
    useGameStore.setState({ state: s, runDelta: null, npcActivityMap: {} });

    // 이벤트 체인이 이어질 수 있으니 이벤트만 계속 닫는다. advanceWeek는 부르지 않는다 —
    // 그래야 이 테스트가 resolveEvent 경로만 잠근다.
    for (let i = 0; i < 20 && useGameStore.getState().state!.phase === 'event'; i++) {
      useGameStore.getState().resolveEvent(0);
    }

    expect(useGameStore.getState().state!.phase).toBe('ending');
    expect(loadArchive().runs, '이벤트 종료 경로에서 적립이 새 나갔다').toBe(1);
  });

  // 가드(prev.phase !== 'ending')가 사라지면 완주 횟수가 부푼다.
  it('이미 엔딩이면 다시 적립하지 않는다', () => {
    startNearEnd();
    playToEnding();
    expect(loadArchive().runs).toBe(1);

    useGameStore.getState().debugSkipToEnding();   // 엔딩 상태에서 또 엔딩으로 보내본다
    expect(loadArchive().runs, '완주 횟수가 중복 적립됐다').toBe(1);
  });
});
