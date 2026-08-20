import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, applyYearTransition } from '../gameEngine';
import { getSchoolLevel } from '../backgrounds';
import {
  clearArchive, commitRun, emptyArchive, loadArchive, CURRENT_ARCHIVE_VERSION,
  accrueFromState, accrueResolvedEvent, accrueTalk, accrueParentEvent,
} from '../archive';
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
  // 아래 이정표 테스트들은 임계·정렬을 보는 것이므로 "전원 만난 기록"을 전제로 깐다.
  // 이 전제를 명시하지 않으면 everMet 게이트에 걸려 전원이 후보에서 빠지고, 그때 통과하는
  // 단언은 정렬이 아니라 게이트를 재는 것이 된다.
  const ALL_MET: Record<string, number> = Object.fromEntries(rows.map(r => [r.id, 50]));

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
      expect(barelyTouchedNames([], ALL_MET, 99)).toHaveLength(rows.length);
    });

    it('많이 본 사람은 후보에서 빠지고, 적게 본 사람만 남는다', () => {
      const full = GAME_EVENTS.filter(e => e.reach?.npc === 'seoa' || e.speakers?.includes('seoa'))
        .map(e => e.id);
      const names = barelyTouchedNames(full, ALL_MET, 99);
      expect(names).not.toContain('서아');
      expect(names.length).toBeGreaterThan(0);   // 나머지는 여전히 남아 있다
    });

    it('개수가 제한된다', () => {
      expect(barelyTouchedNames([], ALL_MET, 3)).toHaveLength(3);
    });

    // 완주하면 전원을 만난다는 건 사실이 아니다 — QA 플레이스루 348판 중 5판(1.4%)이
    // 서아·예린·시우를 못 만난 채 엔딩에 닿는다. 그 판에서 미접촉자는 ratio 0 · total 최소라
    // **정렬 첫 줄을 확정으로 차지한다**(바로 위 테스트가 예린이 1번임을 잠근다).
    it('만난 적 없는 사람은 이름을 대지 않는다', () => {
      const peak = { ...ALL_MET };
      delete peak.yerin;
      const names = barelyTouchedNames([], peak, 99);
      expect(names, '기록실은 감추는데 엔딩 화면이 이름을 쓰면 같은 기록이 서로 다른 말을 한다')
        .not.toContain('예린');
      expect(names, '만난 사람은 그대로 후보로 남아야 한다').toContain('서아');
    });

    // everMet의 OR 가지를 엔진 층에서 직접 잠근다 — 만난 기록이 없어도 그 사람이 나오는
    // 장면을 읽었다면 이름은 스포일러가 아니다.
    it('만난 기록이 없어도 그 사람 이야기를 봤다면 이름이 남는다', () => {
      const seoaIds = GAME_EVENTS.filter(e => e.reach?.npc === 'seoa').slice(0, 1).map(e => e.id);
      expect(seoaIds).toHaveLength(1);
      const names = barelyTouchedNames(seoaIds, {}, 99);
      expect(names).toEqual(['서아']);
    });

    // 전원 동률(전부 0)인 판은 디버그 스킵으로 실제 관측된다. 로스터 순서를 그대로 쓰면
    // 주요 인물 넷이 앞에 서서 소꿉친구를 "스치기만 한 사람"이라 부르게 된다.
    it('비율이 같으면 이야기 수가 적은 쪽을 먼저 가리킨다', () => {
      const names = barelyTouchedNames([], ALL_MET, 4);
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
      const names = barelyTouchedNames(FIXTURE, ALL_MET, 99);
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

  // cg(배경 키)는 v2에서 **동결**됐다 — 담긴 값은 공용 배경 56종이고, 앨범이 쓰는 CG 파일
  // 경로(432장)와 의미 단위가 달라 재해석이 불가능하다. 이 단언이 ['classroom','rooftop']으로
  // 되돌아오면 동결이 풀린 것이고, 그때 앨범에는 플레이어가 본 적 없는 그림이 섞여 들어간다.
  it('한 판을 적립하면 이벤트·미니톡·엔딩·완주수가 남고, 배경 키는 더 쌓이지 않는다', () => {
    const s = runState({
      events: [ev('a', 'classroom'), ev('b', 'rooftop'), ev('c')],
      talkEventsFired: ['t1', 't2'],
    });
    const d = commitRun(s, '수도권 대학');

    const a = loadArchive();
    expect(a.runs).toBe(1);
    expect(a.events.sort()).toEqual(['a', 'b', 'c']);
    expect(a.cg, 'v2에서 동결한 배경 키가 다시 쌓인다').toEqual([]);
    expect(a.talks.sort()).toEqual(['t1', 't2']);
    expect(a.endings).toEqual(['수도권 대학']);
    expect(d).toMatchObject({ newEvents: 3, newTalks: 2, newEndingTitle: true, runs: 1 });
  });

  // 절정 키는 **실제 이벤트 id**여야 한다. 합성 키(`climax:strict`)를 쓰면 CG 리졸버에
  // 매니페스트에 절대 없는 값이 들어가, 나중에 절정 CG가 추가돼도 앨범에 안 쌓인다.
  it('부모 미니이벤트와 절정도 기록에 남는다 (v1에서는 통째로 빠져 있었다)', () => {
    commitRun(runState({
      parentEventsFired: [{ id: 'parent-mini-a', week: 3 }],
      parentClimaxFired: ['strict'],
    }), '수도권 대학');
    expect(loadArchive().parentEvents.sort()).toEqual(['climax_parent_strict', 'parent-mini-a']);
  });

  it('절정 키는 즉시 적립과 백필이 같다', () => {
    const s = runState({ parentClimaxFired: ['emotional'] });
    accrueParentEvent(s, 'climax_parent_emotional');   // 즉시 경로(store가 climax.id를 넘긴다)
    accrueFromState(s);                                 // 백필 경로(강점 → id 역인출)
    expect(loadArchive().parentEvents, '두 경로가 다른 키를 만들어 중복됐다')
      .toEqual(['climax_parent_emotional']);
  });

  // 적립 단위가 이벤트 id도 (id, choiceIndex)도 아닌 이유 — 같은 이벤트가 성별·선택지에 따라
  // 다른 그림이 된다. id로 세면 여주 플레이어의 앨범이 남주 그림을 채웠다고 주장한다.
  it('CG는 실제로 표시된 파일 경로로 적립된다 (성별 분기 보존)', () => {
    const cgEvent = (gender: 'male' | 'female'): GameState => {
      const s = createInitialState(gender, PARENTS, { rngSeed: 12345 });
      s.talkEventsFired = [];
      s.events = [{ ...ev('doyun-graduation-sign'), resolvedChoice: 0, year: 1 } as GameEvent];
      return s;
    };
    accrueFromState(cgEvent('male'));
    expect(loadArchive().cgFiles).toEqual(['elementary/doyun-graduation-sign_c0_m.png']);

    accrueFromState(cgEvent('female'));
    expect(loadArchive().cgFiles.sort(), '성별이 다른데 같은 칸으로 접혔다').toEqual([
      'elementary/doyun-graduation-sign_c0_f.png',
      'elementary/doyun-graduation-sign_c0_m.png',
    ]);
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

  // 더티체크는 즉시 적립의 비용을 0으로 수렴시키는 장치다(2회차부터 새로 보는 건 1~5종).
  // 경로가 넷이므로 넷 다 잠근다 — accrueFromState만 잠그면 나머지 셋의 체크를 지워도 그린이다.
  it('같은 것을 다시 봐도 기록을 다시 쓰지 않는다 (즉시 적립 경로 더티체크)', () => {
    const s = runState({ events: [{ ...ev('doyun-graduation-sign'), resolvedChoice: 0, year: 1 } as GameEvent] });
    accrueResolvedEvent(s);
    accrueTalk(s, 't1');
    accrueParentEvent(s, 'p1');
    expect(loadArchive().events, '첫 적립 자체가 안 됐다면 아래 단언은 공허 참이다').toContain('doyun-graduation-sign');

    let writes = 0;
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (k: string, v: string) => { if (k === ARCHIVE_KEY) writes++; orig(k, v); };
    try {
      accrueResolvedEvent(s);
      accrueTalk(s, 't1');
      accrueParentEvent(s, 'p1');
      expect(writes, '이미 본 것을 다시 적립하면서 기록을 다시 썼다').toBe(0);
    } finally {
      localStorage.setItem = orig;
    }
  });

  // 즉시 경로의 touchPeak — 여기가 안 잠기면 지워도 npcPeak 테스트 4개가 전부 그린이다
  // (그것들은 commitRun 경유). 지우면 v1의 "엔딩 시점 최종 친밀도" 과소기록으로 되돌아간다.
  it('즉시 적립도 최고 친밀도를 갱신한다', () => {
    const s = runState({ events: [ev('a')] });
    withIntimacy(s, { subin: 70 });
    accrueResolvedEvent(s);
    expect(loadArchive().npcPeak.subin, '즉시 경로가 peak을 안 올렸다').toBe(70);

    // 그 뒤 소원해진 상태로 완주해도 최고치가 남아야 한다 — v1이라면 엔딩 값 30이 기록된다.
    withIntimacy(s, { subin: 30 });
    commitRun(s, '수도권 대학');
    expect(loadArchive().npcPeak.subin, '엔딩 시점 값으로 덮였다(v1 회귀)').toBe(70);
  });

  // 편승 전략의 영구 손실 경로 — archive가 포화돼 새로 적립할 게 없으면 쓰기가 안 일어나
  // peak 상승이 저장되지 않았다. touchPeak을 더티에 넣어 막는다.
  it('새로 본 게 없고 친밀도만 올라도 최고치는 저장된다', () => {
    const s = runState({ events: [ev('a')] });
    withIntimacy(s, { subin: 20 });
    accrueResolvedEvent(s);
    expect(loadArchive().npcPeak.subin).toBe(20);

    withIntimacy(s, { subin: 80 });      // 같은 이벤트뿐 = 새 콘텐츠 없음
    accrueFromState(s);
    expect(loadArchive().npcPeak.subin, 'peak만 오른 변경이 저장되지 않았다').toBe(80);
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

    // 버전 분기가 재스탬프보다 먼저 오는지를 잠근다. 순서가 뒤집히면 v1 페이로드가 내용
    // 그대로 v2 상표를 달고 저장되고, 나중의 v2→v3 마이그레이션이 v1을 v2로 착각한다.
    describe('v1 → v2 마이그레이션', () => {
      it('v1의 배경 키는 유지되고 CG 앨범은 빈 상태로 시작한다', () => {
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify({
          version: 1, runs: 3, events: ['a'], talks: ['t'],
          cg: ['classroom'], endings: ['끝'], npcPeak: { subin: 50 },
        }));
        const a = loadArchive();
        expect(a.version).toBe(CURRENT_ARCHIVE_VERSION);
        expect(a.runs).toBe(3);
        expect(a.events).toEqual(['a']);
        expect(a.cg, 'v1 배경 키가 유실됐다').toEqual(['classroom']);
        expect(a.cgFiles, '배경 키가 CG 앨범으로 흘러들었다 — 매핑이 없어 안 본 그림이 된다').toEqual([]);
        expect(a.parentEvents).toEqual([]);
      });

      // v2 신규 필드 **넷 전부**를 픽스처에 넣는다. 둘만 넣으면 나머지 둘의 초기화를 지워도
      // 통과해서 신뢰 경계가 비대칭인 걸 놓친다(검수에서 실제로 그렇게 새 나갔다).
      it('v1 페이로드가 들고 온 v2 필드는 신뢰하지 않는다', () => {
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify({
          version: 1, events: ['a'],
          pendingRun: { events: ['거짓말'], talks: ['거짓말'] },
          lastRunDelta: { newEvents: 99, newTalks: 9, newEndingTitle: true, runs: 9 },
          cgFiles: ['high/본적없는그림.png'],
          parentEvents: ['climax_parent_strict'],
        }));
        const a = loadArchive();
        expect(a.pendingRun.events, 'v1→v2 분기가 pendingRun을 비우지 않았다').toEqual([]);
        expect(a.lastRunDelta, 'v1에는 정산 개념이 없었는데 값이 살아남았다').toBeNull();
        expect(a.cgFiles, 'v1이 쓴 적 없는 cgFiles가 통과했다 — 안 본 그림이 앨범에 들어간다').toEqual([]);
        expect(a.parentEvents, 'v1이 쓴 적 없는 parentEvents가 통과했다').toEqual([]);
      });

      // 짝이 되는 양성 단언 — 위 둘만 두면 분기를 "항상 비우기"로 바꿔도 통과한다.
      it('v2 기록의 pendingRun과 정산 결과는 그대로 되살린다', () => {
        localStorage.setItem(ARCHIVE_KEY, JSON.stringify({
          version: 2, events: ['a', 'b'], cgFiles: ['elementary/x.png'],
          pendingRun: { events: ['b'], talks: [] },
          lastRunDelta: { newEvents: 2, newTalks: 1, newEndingTitle: true, runs: 4 },
        }));
        const a = loadArchive();
        expect(a.pendingRun.events, 'v2 pendingRun이 지워졌다').toEqual(['b']);
        expect(a.lastRunDelta).toEqual({ newEvents: 2, newTalks: 1, newEndingTitle: true, runs: 4 });
        expect(a.cgFiles).toEqual(['elementary/x.png']);
      });
    });

    // 손상 페이로드가 엔딩 요약에 문자열을 그대로 내보내지 않게 — 형제 단언이 기존 필드에만
    // 있어서 v2 신규 필드 둘은 검증이 비어 있었다.
    it('신규 필드도 타입이 어긋나면 걸러낸다', () => {
      localStorage.setItem(ARCHIVE_KEY, JSON.stringify({
        version: 2,
        pendingRun: { events: ['a', 7, null], talks: 'nope' },
        lastRunDelta: { newEvents: '9999', newTalks: null, newEndingTitle: 'yes', runs: 1.9 },
      }));
      const a = loadArchive();
      expect(a.pendingRun.events, 'pendingRun에 문자열 아닌 값이 살아남았다').toEqual(['a']);
      expect(a.pendingRun.talks).toEqual([]);
      expect(a.lastRunDelta, 'lastRunDelta가 검증 없이 통과했다')
        .toEqual({ newEvents: 0, newTalks: 0, newEndingTitle: false, runs: 1 });
    });

    // "기록 실패가 플레이를 막지 않는다"를 즉시 적립 경로에도 적용한다. events가 없는 손상
    // 세이브에서 mergeState의 for-of가 던져 실제로 이어하기가 실패했다.
    it('손상된 state를 적립하려 해도 던지지 않는다', () => {
      const broken = { ...runState(), events: undefined } as unknown as GameState;
      expect(() => accrueFromState(broken), '기록이 이어하기를 막았다').not.toThrow();
      const noNpcs = { ...runState({ events: [ev('a')] }), npcs: undefined } as unknown as GameState;
      expect(() => accrueResolvedEvent(noNpcs), '기록이 이벤트 해결을 막았다').not.toThrow();
      expect(() => accrueTalk(noNpcs, 't1')).not.toThrow();
      expect(() => accrueParentEvent(noNpcs, 'p1')).not.toThrow();
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

  // 결과 화면 CG가 "발생 학년"으로 해석되는 것을 지키는 전제. W48 이벤트는 학년 전환 뒤에
  // 결과 화면이 뜨므로, 전환이 학교급을 바꾸면 그 순간 CG 후보가 0개가 된다(= 그림 없음).
  // 현재는 applyYearTransition이 Y1~Y6에서 학년을 아예 올리지 않고(phase만 year-end),
  // 올리는 Y7→Y8은 둘 다 high라 도달 불가다. year++를 여기로 옮기는 리팩터가 오면 이 단언이
  // 먼저 깨져서, EventResultData.year가 방어용에서 필수로 바뀌었음을 알려준다.
  it('학년 전환은 학교급을 바꾸지 않는다 (W48 CG 해석의 전제)', () => {
    for (let y = 1; y <= 7; y++) {
      const s = runState();
      s.year = y;
      s.week = 49;
      const before = getSchoolLevel(y);
      applyYearTransition(s);
      expect(getSchoolLevel(s.year), `Y${y} 전환이 학교급을 ${before}에서 바꿨다`).toBe(before);
    }
  });

  // ===== v2의 존재 이유 — 완주하지 않아도 본 것은 남는다 =====
  // 이 블록이 없으면 accrue* 호출부를 전부 지워도 위 테스트들은 그대로 그린이다(엔딩까지
  // 가면 commitRun의 백스톱이 같은 결과를 만들기 때문). 즉시 적립은 "중간"을 봐야 잠긴다.
  describe('즉시 적립', () => {
    it('이벤트를 해결한 그 순간 기록에 남고, 완주수는 0이다', () => {
      useGameStore.getState().startGame('male', PARENTS);
      expect(useGameStore.getState().state!.phase, '부팅 장면이 없으면 이 테스트가 무의미하다').toBe('event');
      const firstId = useGameStore.getState().state!.currentEvent!.id;
      useGameStore.getState().resolveEvent(0);

      const a = loadArchive();
      expect(a.events, '이벤트를 봤는데 기록에 없다 — 즉시 적립이 배선되지 않았다').toContain(firstId);
      expect(a.runs, '완주하지 않았는데 완주수가 올랐다').toBe(0);
      expect(a.endings, '엔딩에 도달하지 않았는데 결말이 기록됐다').toEqual([]);
      expect(a.pendingRun.events).toContain(firstId);
    });

    it('그만두고 새 게임을 시작해도 이전 판에서 본 것은 남는다', () => {
      useGameStore.getState().startGame('male', PARENTS);
      useGameStore.getState().resolveEvent(0);
      const seen = loadArchive().events.length;
      expect(seen).toBeGreaterThan(0);

      useGameStore.getState().startGame('female', PARENTS);   // 세이브를 덮어쓴다
      const a = loadArchive();
      expect(a.events.length, '새 게임이 이전 판의 기록을 지웠다').toBeGreaterThanOrEqual(seen);
      expect(a.runs).toBe(0);
    });

    it('새 게임은 "이번 판에서 처음"의 기준선을 리셋한다', () => {
      useGameStore.getState().startGame('male', PARENTS);
      useGameStore.getState().resolveEvent(0);
      expect(loadArchive().pendingRun.events.length).toBeGreaterThan(0);

      useGameStore.getState().startGame('male', PARENTS);
      expect(loadArchive().pendingRun.events, 'beginRun이 기준선을 리셋하지 않았다').toEqual([]);
    });

    it('완주 정산은 판 중에 모인 신규 수를 쓰고 pendingRun을 비운다', () => {
      startNearEnd();
      playToEnding();

      const a = loadArchive();
      expect(a.runs).toBe(1);
      // 첫 판이라 본 것이 전부 신규다. 엔딩 시점 archive 대조로 세면 즉시 적립이 이미
      // 넣어놨으므로 0이 나온다 — 그 회귀를 여기서 잡는다.
      expect(a.lastRunDelta!.newEvents, '판 중 적립분이 정산에 반영되지 않았다').toBe(a.events.length);
      expect(a.lastRunDelta!.newEvents).toBeGreaterThan(0);
      expect(a.pendingRun.events, '정산 후에도 기준선이 남아 있다').toEqual([]);
    });

    // 미니톡·부모 배선 — 이게 없으면 accrueTalk / accrueParentEvent 호출부를 통째로 지워도
    // 전 스위트가 그린이다. 손실은 완주하지 않은 판에서만 나타나므로(엔딩까지 가면 commitRun의
    // 백스톱이 같은 결과를 만든다) 여기서 엔딩 없이 잡아야 한다.
    it('말걸기 미니이벤트도 발동 즉시 기록에 남는다', () => {
      useGameStore.getState().startGame('male', PARENTS);
      useGameStore.getState().resolveEvent(0);          // 부팅 장면 닫기
      // 미니톡 발동 조건을 결정론적으로 만든다(친밀도 30+ / 이번 주 사전 결정 on)
      const s = useGameStore.getState().state!;
      useGameStore.setState({ state: {
        ...s, npcEventPendingThisWeek: true,
        npcs: s.npcs.map(n => n.id === 'jihun' ? { ...n, met: true, intimacy: 60 } : n),
      } });
      const r = useGameStore.getState().talkToNpc('jihun');
      expect(r.kind, '미니톡이 안 떴다 — 이 테스트가 무의미해진다').toBe('event');

      const a = loadArchive();
      expect(a.talks, '미니톡을 봤는데 기록에 없다').toContain(useGameStore.getState().state!.talkEventsFired.at(-1));
      expect(a.runs, '완주하지 않았는데 완주수가 올랐다').toBe(0);
    });

    it('부모 절정도 발동 즉시 기록에 남는다', () => {
      useGameStore.getState().startGame('male', PARENTS);
      useGameStore.getState().resolveEvent(0);
      // strict 절정은 climaxYearMin을 넘기면 결정론적으로 뜬다(pressure RNG 무관)
      const s = useGameStore.getState().state!;
      useGameStore.setState({ state: { ...s, year: 7, week: 40, parentIntimacy: 90 } });
      const r = useGameStore.getState().talkToHome();
      expect(r.kind, '절정이 안 떴다 — 이 테스트가 무의미해진다').toBe('event');

      const a = loadArchive();
      expect(a.parentEvents, '부모 장면을 봤는데 기록에 없다').toHaveLength(1);
      expect(a.parentEvents[0], '합성 키가 아니라 실제 이벤트 id여야 한다').toMatch(/^climax_parent_|^parent/);
      expect(a.runs).toBe(0);
    });

    // newTalks 경로 — newEvents만 단언하면 accrueTalk의 pendingRun 전달을 지워도 그린이고,
    // 엔딩 요약의 "나눈 대화" 신규 수가 항상 0이 된다.
    it('완주 정산은 미니톡 신규 수도 판 중 적립분으로 센다', () => {
      accrueTalk(runState(), 't-alpha');
      accrueTalk(runState(), 't-beta');
      expect(loadArchive().pendingRun.talks.sort()).toEqual(['t-alpha', 't-beta']);

      const d = commitRun(runState({ talkEventsFired: ['t-alpha', 't-beta'] }), '수도권 대학');
      expect(d.newTalks, '판 중에 적립된 미니톡이 정산에 반영되지 않았다').toBe(2);
      expect(loadArchive().lastRunDelta!.newTalks).toBe(2);
    });

    it('새로 본 게 없으면 기록을 다시 쓰지 않는다 (더티체크)', () => {
      useGameStore.getState().startGame('male', PARENTS);
      useGameStore.getState().resolveEvent(0);

      // 같은 판을 그대로 다시 훑는다 — 새로 들어갈 것이 없어야 하고, 그러면 쓰기도 없어야 한다.
      let writes = 0;
      const orig = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (k: string, v: string) => { if (k === ARCHIVE_KEY) writes++; orig(k, v); };
      try {
        accrueFromState(useGameStore.getState().state!);
        expect(writes, '아무것도 새로 안 들어갔는데 기록을 다시 썼다').toBe(0);
      } finally {
        localStorage.setItem = orig;
      }
    });

    // 구세이브 구제 — 즉시 적립이 배포되기 전에 만들어진 판은 이 경로로만 살아난다.
    it('이어하기는 아직 적립되지 않은 판을 백필한다', () => {
      useGameStore.getState().startGame('male', PARENTS);
      useGameStore.getState().resolveEvent(0);
      const before = loadArchive().events;
      expect(before.length).toBeGreaterThan(0);

      // 기록만 날린다(세이브는 그대로) = 즉시 적립을 한 번도 안 지난 세이브와 같은 상태
      clearArchive();
      expect(loadArchive().events).toEqual([]);

      expect(useGameStore.getState().loadSavedGame()).toBe(true);
      expect(loadArchive().events.sort(), '이어하기가 미적립 세이브를 백필하지 않았다')
        .toEqual([...before].sort());
    });
  });
});
