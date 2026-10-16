// @vitest-environment jsdom
// 앵커 도달형 예약 — 졸업·합격 문장이 졸업 무렵에만 뜨고, 컷은 하나도 잃지 않는다.
//
// 결함(2026-10-12 측정, docs/reach-graduation-timing-options-2026-10-12.md): 졸업식·합격자 발표를 전제하는
// 도달형 6건이 조건에 학년만 있어 임계를 넘는 즉시 학기 중에 떴다(하은 졸업식 Y6 W1 48/48판).
// 주차 게이트는 컷을 죽이므로(1,008 기회 중 176~210 유실) 페이싱은 그대로 두고 **표시만 앵커로 미룬다**.
//
// 잠그는 계약:
//   A. 앵커 컷(6건 + 지훈 졸업식)은 발생주 >= 앵커에만 화면에 나온다 — 주입 탐침(교차주 7종)으로 실제 루프를 돌려 행위로 본다.
//      양성 대조: 앵커를 떼면 같은 픽스처가 앵커 전에 띄운다(픽스처가 이른 픽에 실제로 닿는다).
//   B. 예약 주 = 앵커가 없을 때 떴을 주(바이트 동일 경로). 유실 0: 기준선이 띄운 판은 전부 띄운다.
//   C. 표시 때 친밀도를 다시 보지 않는다(얻은 컷은 지킨다). 예약이 없으면 앵커 주에 아무것도 안 뜬다.
//   D. 쿨다운 스탬프는 예약 주다 — 서아 Y4 컷을 W46에 보여 줘도 Y5 학기 전용 컷이 기준선 주에 뜬다.
//   E. 발생주 좌표: chain(week++ 뒤)에서 앵커 N−1주에 새지 않는다.
//   F. 학년 마지막 주엔 chain cap을 넘어서라도 남은 예약을 다 띄운다(학년 전환이 예약을 묻지 않는다).
//   G. 세이브: 구세이브(필드 없음)는 빈 예약, 이어하기 왕복은 보존, 판정 불가 칸은 버린다.
//   H. 관계 신호는 예약된 컷을 "곧 열린다"로 다시 약속하지 않는다.
//   I. 사건 상한(3)이 찬 주에 막 임계를 넘은 앵커 컷은 그 자리에서 예약된다 — 예약은 사건을 안 만들어 상한의 대상이 아니다.
import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_EVENTS } from '../events';
import { getDueReservedReach, getEventForWeek, pickChainForWeek, pickReachForWeek } from '../events/selection';
import { createInitialState, getWeekInfo, processWeek } from '../gameEngine';
import { nextIntimacyThreshold } from '../relationshipSignals';
import { sanitizeReachReservations } from '../stateMigration';
import { useGameStore } from '../store';
import type { GameEvent, GameState } from '../types';
import { resolveEventLikeStore } from '../../../scripts/lib/y1-sim-resolve';

const ALL = GAME_EVENTS as GameEvent[];
const byId = (id: string) => {
  const e = ALL.find(x => x.id === id);
  if (!e) throw new Error(`${id} 없음 — 이 잠금은 공허하다`);
  return e;
};

// 기대값은 리터럴로 박는다 — 데이터에서 읽어 오면 앵커를 지워도 "앵커가 없으니 검사할 게 없다"로 초록이 된다.
const ANCHORS: Record<string, number> = {
  'seoa-torn-endless-line': 46,
  'haeun-hs-leaving': 46,
  'seoa-ending-page': 46,
  'siwoo-where-you-stood': 44,
  'subin-hs-after': 42,
  'yerin-not-a-trade': 41,
  // 2026-10 추가 — 지훈 고교 졸업식. 연애 판본에선 문턱 우회로 Y7 초에 졸업식이 떴다(romance.test.ts).
  'jihun-hs-graduation': 46,
};
const TARGETS = Object.keys(ANCHORS);
const CROSS_WEEKS = [1, 10, 19, 22, 30, 38, 44];
// 앵커 경계 양쪽 — 앵커−1에 골린 컷은 예약(미표시), 앵커에 골린 컷은 그 주 표시. 이게 없으면
// `occurrenceWeek >= anchor - 1` 같은 한 칸 완화가 살아남는다(3자 검수 m5c).
const crossWeeksFor = (id: string) => [...new Set([...CROSS_WEEKS, ANCHORS[id] - 1, ANCHORS[id]])].sort((a, b) => a - b);

function setWeek(s: GameState, year: number, week: number): void {
  s.year = year;
  s.week = week;
  const info = getWeekInfo(week);
  s.semester = info.semester;
  s.isVacation = info.isVacation;
}

/** 앵커를 잠시 떼고(양성 대조·기준선) 돌린 뒤 되돌린다. */
function withoutAnchors<T>(fn: () => T): T {
  const saved = ALL.filter(e => e.reach?.anchorWeek !== undefined).map(e => [e, e.reach!.anchorWeek] as const);
  for (const [e] of saved) e.reach!.anchorWeek = undefined;
  try { return fn(); } finally { for (const [e, a] of saved) e.reach!.anchorWeek = a; }
}

interface YearRun { shown: number | null; reserved: number | null; final: GameState }

/**
 * 주입 탐침 — 대상 학년 한 해를 실제 루프(processWeek + store 미러)로 산다.
 * 교차주 C 전에는 친밀도를 tier−12로 묶고, C 주 시작 전에 tier+1로 올린다(pre-met, 이력 없음 → 그 주 적격).
 * 같은 NPC의 낮은 티어 같은 학년 컷은 지난해에 본 것으로 둔다(안 그러면 그것이 먼저 떠 쿨다운이 흐려진다).
 * hold=true면 학년 끝까지 tier를 바닥으로 유지, false면 교차 직후 0으로 떨어뜨린다(재검사 없음 잠금).
 */
function playTargetYear(id: string, cross: number, hold: boolean, seed = 7): YearRun {
  const target = byId(id);
  const { npc, tier, year } = target.reach!;
  let s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: seed });
  setWeek(s, year, 1);
  s.events = ALL.filter(e => e.reach?.npc === npc && e.reach.year === year && e.id !== id && e.reach.tier < tier)
    .map(e => ({ ...e, year: year - 1, week: 1 }));
  let crossed = false;
  for (let guard = 0; guard < 80 && s.year === year && s.week <= 48; guard++) {
    const n = s.npcs.find(x => x.id === npc)!;
    n.met = true;
    if (!crossed && s.week >= cross) { n.intimacy = tier + 1; crossed = true; }
    else if (!crossed) n.intimacy = Math.min(n.intimacy, tier - 12);
    else if (hold) n.intimacy = Math.max(n.intimacy, tier);
    else n.intimacy = 0;
    s.weekendChoices = ['self-study', 'club'];
    s.vacationChoices = ['self-study', 'creative', 'rest'];
    s = processWeek(s, undefined);
    let g2 = 0;
    while (s.currentEvent && g2++ < 20) {
      const list = s.gender === 'female' && s.currentEvent.femaleChoices ? s.currentEvent.femaleChoices : s.currentEvent.choices;
      s = resolveEventLikeStore(s, Math.max(0, list.findIndex(c => !c.relationshipSelect && !c.romanceConversation)));
    }
  }
  const h = s.events.find(e => e.id === id && e.year === year);
  return { shown: h?.week ?? null, reserved: s.reachReservations?.[id]?.week ?? null, final: s };
}

describe('A·B. 졸업·합격 문장은 앵커 이후에만 — 페이싱은 기준선 그대로', () => {
  it('앵커 표가 데이터와 같다(6건, 다른 컷엔 없다)', () => {
    const anchored = ALL.filter(e => e.reach?.anchorWeek !== undefined);
    expect(Object.fromEntries(anchored.map(e => [e.id, e.reach!.anchorWeek]))).toEqual(ANCHORS);
  });

  for (const id of TARGETS) {
    it(`${id} — 교차주 7종 × hold/free`, { timeout: 30_000 }, () => {
      let earlyInBase = 0;
      for (const cross of crossWeeksFor(id)) {
        for (const hold of [true, false]) {
          const base = withoutAnchors(() => playTargetYear(id, cross, hold));
          const run = playTargetYear(id, cross, hold);
          const where = `C=${cross} ${hold ? 'hold' : 'free'}`;
          if (base.shown !== null && base.shown < ANCHORS[id]) earlyInBase++;
          // 유실 0 — 기준선이 띄운 판은 전부 띄운다.
          if (base.shown !== null) expect(run.shown, `${where}: 기준선 W${base.shown}에 떴는데 유실`).not.toBeNull();
          if (run.shown === null) continue;
          expect(run.shown, `${where}: 앵커 전 표시`).toBeGreaterThanOrEqual(ANCHORS[id]);
          // 예약은 기준선이 띄운 바로 그 주다(원래 뜰 주). 앵커 이후에 골렸으면 예약 없이 그 주에 바로 뜬다.
          if (base.shown! < ANCHORS[id]) expect(run.reserved, `${where}: 예약 주`).toBe(base.shown);
          else {
            expect(run.reserved, `${where}: 앵커 이후 픽은 예약하지 않는다`).toBeNull();
            expect(run.shown, `${where}: 앵커 이후 픽은 기준선 주 그대로`).toBe(base.shown);
          }
        }
      }
      // 양성 대조 — 앵커가 없으면 이 픽스처가 학기 중(앵커 전)에 띄운다. 0이면 위 단언이 전부 공허하다.
      expect(earlyInBase, '앵커 없는 기준선의 앵커 전 표시 판 수').toBeGreaterThanOrEqual(8);
    });
  }
});

describe('C. 표시 때 친밀도를 다시 보지 않는다', () => {
  it('예약 뒤 친밀도 0이어도 앵커 주에 뜬다 — 예약이 없으면 같은 상태에서 아무것도 안 뜬다', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 1 });
    setWeek(s, 7, 46);
    const seoa = s.npcs.find(n => n.id === 'seoa')!;
    seoa.met = true; seoa.intimacy = 0; seoa.weekStartIntimacy = 0;
    expect(pickReachForWeek(s).event, '예약 없음 → 표시 없음(음성 대조)').toBeNull();
    s.reachReservations = { 'seoa-ending-page': { year: 7, week: 10 } };
    expect(pickReachForWeek(s).event?.id).toBe('seoa-ending-page');
    // 앵커 한 주 전엔 안 뜬다.
    setWeek(s, 7, 45);
    expect(pickReachForWeek(s).event).toBeNull();
  });

  it('예약된 컷은 다시 예약·표시 후보가 되지 않는다(1회성)', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 1 });
    setWeek(s, 7, 10);
    const seoa = s.npcs.find(n => n.id === 'seoa')!;
    seoa.met = true; seoa.intimacy = 95; seoa.weekStartIntimacy = 80;
    s.events = [{ ...byId('seoa-name-blank'), year: 6, week: 1 }];
    expect(pickReachForWeek(s).reserve, '임계를 막 넘으면 예약').toEqual(['seoa-ending-page']);
    s.reachReservations = { 'seoa-ending-page': { year: 7, week: 10 } };
    setWeek(s, 7, 11);
    expect(pickReachForWeek(s)).toEqual({ event: null, reserve: [] });
  });
});

describe('A2. 제품 store 경로(advanceWeek → resolveEvent → resolveEventChain)', () => {
  // A·B는 sim 미러(scripts/lib/y1-sim-resolve)로 돈다 — 미러가 같은 pickChainForWeek를 쓰더라도 store의
  // 호출(발생주 전달·예약 기록)을 바꾸면 그쪽은 모른다(3자 검수: store만 고친 m7·m8·m9가 전부 초록이었다).
  // 그래서 같은 계약을 진짜 store로 한 번 더 잠근다. 친밀도는 이벤트 국면에서 올려 chain에서 fresh가 되게 한다
  // (예약이 chain 경로에서 일어나야 store 배선이 걸린다).
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null });
  });

  function playStoreYear(id: string, cross: number, seed = 7): { shown: number | null; reserved: number | null } {
    const target = byId(id);
    const { npc, tier, year } = target.reach!;
    const s0 = createInitialState('male', ['wealth', 'freedom'], { rngSeed: seed });
    s0.routineSlot2 = 'self-study';
    s0.routineSlot3 = 'light-exercise';
    setWeek(s0, year, 1);
    s0.phase = 'weekday';
    s0.events = ALL.filter(e => e.reach?.npc === npc && e.reach.year === year && e.id !== id && e.reach.tier < tier)
      .map(e => ({ ...e, condition: undefined, year: year - 1, week: 1 }));
    useGameStore.setState({ state: s0 });
    let crossed = false;
    for (let guard = 0; guard < 400; guard++) {
      let st = useGameStore.getState().state!;
      if (st.year !== year || st.phase === 'ending' || st.phase === 'year-end') break;
      if (st.phase === 'weekday' || st.phase === 'event') {
        const npcs = st.npcs.map(n => ({ ...n }));
        const n = npcs.find(x => x.id === npc)!;
        n.met = true;
        // 교차는 늦어도 C주 메인 슬롯 전에 — 발생주 C−1의 사건 국면(chain 경로)이 있으면 거기서, 없으면 C주 주중.
        // (예전 규칙 `st.week > cross`는 C−1에 사건이 없으면 C+1로 밀려, 앵커−1 칸이 RNG 흐름에 따라 앵커 칸이 됐다.)
        if (!crossed && st.week >= cross) { n.intimacy = tier + 1; crossed = true; }
        else if (!crossed) n.intimacy = Math.min(n.intimacy, tier - 12);
        else n.intimacy = Math.max(n.intimacy, tier);
        useGameStore.setState({ state: { ...st, npcs } });
        st = useGameStore.getState().state!;
      }
      const api = useGameStore.getState();
      if (st.phase === 'weekday') {
        api.setWeekendChoices(['self-study', 'club']);
        api.setVacationChoices(['self-study', 'creative', 'rest']);
        api.advanceWeek();
      } else if (st.phase === 'event') {
        const ev = st.currentEvent!;
        const list = st.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
        api.resolveEvent(Math.max(0, list.findIndex(c => !c.relationshipSelect && !c.romanceConversation)));
      } else if (st.phase === 'result') api.setPhase('weekday');
      else break;
    }
    const f = useGameStore.getState().state!;
    const h = f.events.find(e => e.id === id && e.year === year);
    return { shown: h?.week ?? null, reserved: f.reachReservations?.[id]?.week ?? null };
  }

  for (const id of TARGETS) {
    it(`${id} — store 실경로, 경계 포함 교차주`, { timeout: 60_000 }, () => {
      const a = ANCHORS[id];
      let reservedCases = 0;
      for (const cross of [1, 22, a - 1, a, a + 1]) {
        const base = withoutAnchors(() => playStoreYear(id, cross));
        const run = playStoreYear(id, cross);
        const where = `C=${cross}`;
        expect(base.shown, `${where}: 기준선이 띄워야 이 칸이 의미가 있다`).not.toBeNull();
        expect(run.shown, `${where}: 유실`).not.toBeNull();
        expect(run.shown!, `${where}: 앵커 전 표시`).toBeGreaterThanOrEqual(a);
        if (base.shown! < a) {
          reservedCases++;
          expect(run.reserved, `${where}: 예약 주 = 기준선 표시 주(원래 뜰 주)`).toBe(base.shown);
        } else {
          expect(run.reserved, `${where}: 앵커 이후 픽은 예약 없이`).toBeNull();
          expect(run.shown, `${where}: 앵커 이후 픽은 기준선 주 그대로`).toBe(base.shown);
        }
      }
      // 양성 대조 — 앵커 전 교차가 실제로 예약 경로를 탔다(최소 C=1·22). 앵커 46짜리는 경계 칸(45~47)의
      // 기준선 표시가 W45 이벤트 유무에 따라 이미 W46이라 2칸, 나머지는 앵커−1 칸까지 3칸이다.
      expect(reservedCases, '예약 경로를 탄 칸 수').toBeGreaterThanOrEqual(a === 46 ? 2 : 3);
    });
  }
});

describe('B2. 예약해도 그 주의 다른 컷은 기준선처럼 소화된다', () => {
  // 기준선은 앵커 컷을 띄우고 그 사건 뒤 chain이 다시 도달형을 골라, 같은 주에 함께 넘은 컷(fresh)을 소화했다.
  // 예약은 사건을 안 만들어 chain이 없다 — 같은 판정에서 이어 고르지 않으면 그 컷이 fresh 창을 놓친다
  // (실측: Y7 여름 4건 동시 교차 판에서 서아 90이 2/168판 유실).
  it('예린(앵커) 예약 → 같은 메인 슬롯에서 시우의 비앵커 컷을 띄우고, 예약은 patch로 넘긴다', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 1 });
    setWeek(s, 7, 12);
    // 다른 NPC는 만나지 않은 채로 — 후속·조건부 사건(지훈 농구 등)이 메인 슬롯을 먼저 가져가지 않게.
    for (const n of s.npcs) { n.met = false; n.intimacy = 0; n.weekStartIntimacy = 0; }
    s.events = ['seoa-name-blank', 'yerin-undroppable-line'].map(id => ({ ...byId(id), year: 6, week: 1 }));
    // 시우 79 = siwoo-hobby-seat(78, 비앵커)만 열리고 siwoo-where-you-stood(80)는 안 열린다.
    for (const [id, now, start] of [['yerin', 69, 60], ['siwoo', 79, 70], ['seoa', 91, 85]] as const) {
      const n = s.npcs.find(x => x.id === id)!;
      n.met = true; n.intimacy = now; n.weekStartIntimacy = start;
    }
    const pick = pickReachForWeek(s);
    expect(pick.reserve, '먼저 예약된 앵커 컷').toEqual(['yerin-not-a-trade']);
    expect(pick.event?.id, '이어 고른 컷').toBe('siwoo-hobby-seat');
    const sel = getEventForWeek(s);
    expect(sel.event?.id).toBe('siwoo-hobby-seat');
    expect(sel.patch?.reachReservations, '표시와 예약이 한 판정에서 같이 나와도 예약이 남는다').toEqual({ 'yerin-not-a-trade': { year: 7, week: 12 } });
  });

  it('앵커 컷 둘이 함께 넘으면 둘 다 그 주로 예약한다', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 1 });
    setWeek(s, 7, 22);
    s.events = ['seoa-name-blank', 'yerin-undroppable-line'].map(id => ({ ...byId(id), year: 6, week: 1 }));
    for (const [id, now, start] of [['yerin', 69, 60], ['seoa', 91, 85]] as const) {
      const n = s.npcs.find(x => x.id === id)!;
      n.met = true; n.intimacy = now; n.weekStartIntimacy = start;
    }
    expect(pickReachForWeek(s)).toEqual({ event: null, reserve: ['yerin-not-a-trade', 'seoa-ending-page'] });
  });
});

describe('D. 쿨다운 스탬프 = 예약 주 — 학년을 넘는 연쇄 유실 0', () => {
  /** Y4 서아 컷을 W10에 넘기고, Y5에서 서아 50을 유지했을 때 seoa-both-earphones-again이 언제 뜨나. */
  function earphonesWeek(): { y4Shown: number | null; y5: number | null } {
    let s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 3 });
    setWeek(s, 4, 1);
    for (let guard = 0; guard < 200 && s.year <= 5; guard++) {
      const n = s.npcs.find(x => x.id === 'seoa')!;
      n.met = true;
      if (s.year === 4) n.intimacy = s.week >= 10 ? 90 : 60;
      else n.intimacy = Math.max(55, Math.min(n.intimacy, 64)); // Y5 컷(50)만 열리고 Y6 컷(65)은 안 열린다
      s.weekendChoices = ['self-study', 'club'];
      s.vacationChoices = ['self-study', 'creative', 'rest'];
      s = processWeek(s, undefined);
      let g2 = 0;
      while (s.currentEvent && g2++ < 20) s = resolveEventLikeStore(s, 0);
      if (s.week > 48) { const y = s.year + 1; s.currentEvent = null; setWeek(s, y, 1); s.phase = 'weekday'; }
    }
    const y4 = s.events.find(e => e.id === 'seoa-torn-endless-line');
    const y5 = s.events.find(e => e.id === 'seoa-both-earphones-again');
    return { y4Shown: y4?.week ?? null, y5: y5 && y5.year === 5 ? y5.week! : null };
  }

  it('서아 Y4 컷은 W46에 뜨고, Y5 학기 전용 컷은 기준선과 같은 주에 뜬다', { timeout: 30_000 }, () => {
    const base = withoutAnchors(earphonesWeek);
    const run = earphonesWeek();
    // 픽스처 착지값 먼저 — 기준선이 실제로 Y4 W10에 띄우고 Y5 학기에 이어 붙는지.
    expect(base.y4Shown, '기준선 서아 Y4 표시 주').toBe(10);
    // 10인 이유: Y4 W10 스탬프 + 48주 쿨다운 = Y5 W10. 예전엔 9였다 — chain이 week++ 뒤 좌표로 쿨다운을 재서
    // 실효 간격이 47주(N−1)였다. 연쇄 판정을 발생주 좌표로 통일(atOccurrence)하면서 메인 경로와 같은 N이 됐다.
    expect(base.y5, '기준선 Y5 표시 주(학기)').toBe(10);
    expect(run.y4Shown, '앵커: 서아 Y4 표시 주').toBe(46);
    expect(run.y5, '앵커: Y5 컷이 같은 주에 뜬다(스탬프가 표시 주면 Y5 W46 = 방학이라 영구 유실)').toBe(base.y5);
  });
});

describe('E. 발생주 좌표 — chain에서 앵커 N−1주에 새지 않는다', () => {
  it('chain(state.week = 발생주+1)은 발생주로 판정한다', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 1 });
    s.reachReservations = { 'seoa-ending-page': { year: 7, week: 10 } };
    // 발생주 45 chain — state.week는 week++ 뒤라 46이다. 조건식 좌표(s.week)로 보면 여기서 샌다.
    setWeek(s, 7, 46);
    expect(pickChainForWeek(s, 45, 1).event?.id ?? null, '발생주 45').toBeNull();
    expect(getDueReservedReach(s, 45)).toBeNull();
    expect(pickChainForWeek(s, 46, 1).event?.id, '발생주 46').toBe('seoa-ending-page');
  });
});

describe('F. 학년 마지막 주 — 예약이 학년 전환에 묻히지 않는다', () => {
  const FOUR = ['seoa-ending-page', 'siwoo-where-you-stood', 'subin-hs-after', 'yerin-not-a-trade'];

  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null });
  });

  it('Y7 W48에 4건이 밀려 있어도 엔딩 전에 전부 뜬다(chain cap 3을 넘는다)', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 5 });
    setWeek(s, 7, 48);
    s.phase = 'weekday';
    s.reachReservations = Object.fromEntries(FOUR.map((id, i) => [id, { year: 7, week: 10 + i }]));
    useGameStore.setState({ state: s });
    const api = useGameStore.getState();
    api.advanceWeek();
    const shown: string[] = [];
    for (let guard = 0; guard < 30; guard++) {
      const st = useGameStore.getState().state!;
      if (st.phase !== 'event' || !st.currentEvent) break;
      shown.push(st.currentEvent.id);
      useGameStore.getState().resolveEvent(0);
    }
    const final = useGameStore.getState().state!;
    expect(FOUR.filter(id => !final.events.some(e => e.id === id)), '못 뜬 예약').toEqual([]);
    for (const id of FOUR) expect(final.events.find(e => e.id === id)?.week, `${id} 발생주`).toBe(48);
    expect(final.events.filter(e => e.week === 48 && e.year === 7).length, 'W48 사건 수 — cap 3을 넘었다').toBeGreaterThanOrEqual(4);
    expect(['ending', 'event']).toContain(final.phase);
  });

  it('마지막 주가 아니면 cap 3에서 멈춘다(비우기는 마지막 주 전용)', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 5 });
    s.reachReservations = { 'siwoo-where-you-stood': { year: 7, week: 10 } };
    setWeek(s, 7, 48);
    expect(pickChainForWeek(s, 47, 3).event).toBeNull();
    expect(pickChainForWeek(s, 48, 3).event?.id).toBe('siwoo-where-you-stood');
  });
});

describe('G. 세이브 — 구세이브 폴백·이어하기 왕복·손상 칸 거부', () => {
  const SAVE_KEY = 'lifetrack_save';
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null });
  });

  function seed(patch: (st: Record<string, unknown>) => void): void {
    const st = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 9 }) as unknown as Record<string, unknown>;
    st.phase = 'weekday';
    patch(st);
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: st }));
  }

  it('구세이브(필드 없음)는 빈 예약으로 열리고, 이어서 앵커 컷을 정상 예약한다', () => {
    seed(st => {
      delete st.reachReservations;
      st.year = 7; st.week = 10; st.semester = 1; st.isVacation = false;
      const npcs = st.npcs as GameState['npcs'];
      const seoa = npcs.find(n => n.id === 'seoa')!;
      seoa.met = true; seoa.intimacy = 95;
      st.events = [{ ...byId('seoa-name-blank'), condition: undefined, year: 6, week: 1 }];
    });
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    const loaded = useGameStore.getState().state!;
    expect(loaded.reachReservations, '구세이브는 예약을 지어내지 않는다').toBeUndefined();
    expect(pickReachForWeek(loaded).reserve, '빈 예약 = 그 주에 정상 예약').toEqual(['seoa-ending-page']);
  });

  it('이어하기 왕복 — 제품 자동저장(saveToStorage) → loadSavedGame이 예약을 그대로 돌려주고 앵커 주에 뜬다', () => {
    const res = { 'haeun-hs-leaving': { year: 6, week: 1 }, 'seoa-ending-page': { year: 7, week: 20 } };
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 9 });
    setWeek(s, 6, 46);
    s.phase = 'weekday';
    s.reachReservations = res;
    // setState가 store의 자동저장 구독(saveToStorage)을 탄다 — 디스크에 손으로 JSON을 쓰지 않는다.
    useGameStore.setState({ state: s });
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!) as { state: GameState };
    expect(raw.state.reachReservations, '디스크에 실제로 적혔다').toEqual(res);
    useGameStore.setState({ state: null });
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    const loaded = useGameStore.getState().state!;
    expect(loaded.reachReservations).toEqual(res);
    expect(pickReachForWeek(loaded).event?.id).toBe('haeun-hs-leaving');
    // 한 주 진행(자동저장) → 다시 로드해도 같다.
    useGameStore.getState().advanceWeek();
    expect(useGameStore.getState().state!.currentEvent?.id, '앵커 주에 화면에 떴다').toBe('haeun-hs-leaving');
    useGameStore.getState().resolveEvent(0);
    expect(useGameStore.getState().state!.events.find(e => e.id === 'haeun-hs-leaving')?.week, '기록 발생주').toBe(46);
    useGameStore.setState({ state: null });
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    expect(useGameStore.getState().state!.reachReservations).toEqual(res);
  });

  it('로드 경로가 손상 칸을 버린다(정규화가 이어하기에 실제로 배선됐다)', () => {
    seed(st => {
      st.year = 7; st.week = 20; st.semester = 1; st.isVacation = true;
      st.reachReservations = { 'seoa-ending-page': { year: 7, week: 12 }, 'siwoo-where-you-stood': { year: 7, week: 'x' }, 'nope': { year: 7, week: 3 } };
    });
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    expect(useGameStore.getState().state!.reachReservations).toEqual({ 'seoa-ending-page': { year: 7, week: 12 } });
  });

  it('판정 불가 칸만 버린다 — 정상 칸은 남는다', () => {
    const good = { year: 7, week: 12 };
    expect(sanitizeReachReservations(undefined)).toBeUndefined();
    expect(sanitizeReachReservations('x')).toBeUndefined();
    expect(sanitizeReachReservations([1])).toBeUndefined();
    expect(sanitizeReachReservations({
      'seoa-ending-page': good,                 // 정상
      'nope': good,                             // 모르는 id
      'seoa-name-blank': good,                  // 앵커 없는 도달형
      'siwoo-where-you-stood': { year: 6, week: 12 }, // 학년 불일치
      'yerin-not-a-trade': { year: 7, week: 49 },     // 주 범위 밖
      'subin-hs-after': { year: 7, week: 2.5 },       // 정수 아님
      'haeun-hs-leaving': null,
    })).toEqual({ 'seoa-ending-page': good });
  });
});

describe('H. 관계 신호 — 예약된 컷은 "곧 열린다"가 아니다', () => {
  it('친밀도가 식어도 예약된 임계를 다시 약속하지 않는다', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 1 });
    setWeek(s, 7, 30);
    const subin = s.npcs.find(n => n.id === 'subin')!;
    subin.met = true; subin.intimacy = 71; // 70엔 미니 이벤트 임계가 있다 — 그 위에서 본다
    expect(nextIntimacyThreshold(subin, s), '예약 전엔 72가 다음 임계(양성 대조)').toBe(72);
    s.reachReservations = { 'subin-hs-after': { year: 7, week: 20 } };
    expect(nextIntimacyThreshold(subin, s)).not.toBe(72);
  });
});

describe('I. 상한이 찬 주 — 막 넘은 앵커 컷은 그 자리에서 예약된다', () => {
  // 결함(2026-10, T64): 그 주 세 번째 사건이 NPC를 앵커 컷 임계 위로 올리면 연쇄가 이미 멈춰 fresh 창이 그 주와 함께
  // 닫혔다. 다음 주엔 주 시작 친밀도가 임계 위라 pre-met → 방금 뜬 같은 NPC 컷의 쿨다운에 막히고 감쇠로 임계 아래로.
  // 실측: main QA 138판 중 8판에서 seoa-ending-page가 이렇게 사라졌고(일반 컷 0), 지훈 졸업식에 앵커를 달자 절친 빌드
  // 13/40판으로 늘었다. 예약은 사건을 안 만드니 주당 사건 상한의 대상이 아니다.
  const SEOA_END = 'seoa-ending-page';

  function cappedWeek(week: number, seoaStart: number, seoaNow: number): GameState {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 3 });
    setWeek(s, 7, week);
    Object.assign(s, { phase: 'weekday', currentEvent: null });
    for (const n of s.npcs) { n.met = false; n.intimacy = 0; n.weekStartIntimacy = 0; }
    const seoa = s.npcs.find(n => n.id === 'seoa')!;
    Object.assign(seoa, { met: true, weekStartIntimacy: seoaStart, intimacy: seoaNow });
    // 서아의 다른 Y7 컷은 이번 주(그 세 번째 사건)에 이미 떴다 — 쿨다운이 바로 이 컷에서 시작한다.
    s.events = ALL.filter(e => e.reach?.npc === 'seoa' && e.reach.year === 7 && e.id !== SEOA_END)
      .map(e => ({ ...e, year: 7, week }));
    return s;
  }

  it('상한이 찬 주에 막 넘었다 → 예약된다(화면엔 아무것도 안 띄운다)', () => {
    const pick = pickChainForWeek(cappedWeek(10, 85, 90.5), 10, 3);
    expect(pick.event, '상한을 넘어 화면에 띄웠다').toBeNull();
    expect(pick.reserve).toEqual([SEOA_END]);
  });

  it('대조 — 그 주에 예약하지 않으면 다음 주엔 fresh가 아니고 막힌다(이 장치가 유일한 구제다)', () => {
    // 다음 주 좌표: 주 시작 친밀도가 이미 임계 위(감쇠 한 주 뒤). 같은 NPC 컷이 지난주에 떠서 쿨다운 안이다.
    const next = cappedWeek(11, 90.3, 90.3);
    next.events = next.events.map(e => ({ ...e, week: 10 }));
    expect(byId(SEOA_END).condition!(next), '전제: 조건은 여전히 통과한다').toBe(true);
    const later = pickReachForWeek(next);
    expect(later.event?.id, '다음 주에 떴다 — 대조가 공허하다').not.toBe(SEOA_END);
    expect(later.reserve, '다음 주에 예약됐다 — 대조가 공허하다').not.toContain(SEOA_END);
  });

  it('상한이 지키는 것은 그대로 — pre-met 컷과 일반(비앵커) 컷은 예약하지 않는다', () => {
    // pre-met: 주 시작부터 임계 위였다 → 이번 주에 창을 잃는 게 아니다.
    expect(pickChainForWeek(cappedWeek(10, 91, 91), 10, 3).reserve, 'pre-met을 예약했다').toEqual([]);
    // 일반 컷: 표시가 미뤄지지 않는 컷이라 예약하면 화면 사건이 는다 — 상한 그대로.
    const s = cappedWeek(10, 0, 0);
    const jihun = s.npcs.find(n => n.id === 'jihun')!;
    Object.assign(jihun, { met: true, weekStartIntimacy: 95, intimacy: 96.5 });
    const lastgame = byId('jihun-hs-lastgame');
    expect(lastgame.reach?.anchorWeek, '전제: 비앵커 컷').toBeUndefined();
    expect(lastgame.condition!(s), '전제: 조건 통과').toBe(true);
    expect(pickChainForWeek(s, 10, 3).reserve, '일반 컷을 예약했다').not.toContain('jihun-hs-lastgame');
  });

  it('학년 마지막 주에 상한이 찼으면 방금 예약한 것까지 그 자리에서 띄운다(학년 전환이 묻지 않게)', () => {
    const pick = pickChainForWeek(cappedWeek(48, 85, 90.5), 48, 3);
    expect(pick.reserve).toEqual([SEOA_END]);
    expect(pick.event?.id, 'W48에 예약만 하고 안 띄웠다 — 그대로 학년이 넘어가면 사라진다').toBe(SEOA_END);
  });
});

describe('I2. 상한 예약 — 제품 store 경로(resolveEvent → resolveEventChain)', () => {
  // 계약 I는 pickChainForWeek 단위다. store가 상한 분기의 reserve를 버리거나 옛 cap 경로로 돌아가도 I와 착지값(sim
  // 미러)은 초록이었다(3자 검수 M10·M12: 3,113개 전부 통과, 실제로는 seoa-ending-page@46 대신 seoa-name-blank@26).
  // 그래서 그 주 세 번째 사건을 진짜 store로 닫고, 예약이 state에 남는지와 앵커 주 표시까지 본다.
  const SEOA_END = 'seoa-ending-page';
  beforeEach(() => {
    localStorage.clear();
    useGameStore.setState({ state: null });
  });

  function cappedStore(): GameState {
    const occ = 25;
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 3 });
    s.routineSlot2 = 'self-study';
    s.routineSlot3 = 'light-exercise';
    // 연쇄는 week++ 뒤에 돈다 — state는 다음 주, 사건은 발생주(occ)를 들고 있다.
    setWeek(s, 7, occ + 1);
    for (const n of s.npcs) { n.met = false; n.intimacy = 0; n.weekStartIntimacy = 0; }
    const seoa = s.npcs.find(n => n.id === 'seoa')!;
    Object.assign(seoa, { met: true, weekStartIntimacy: 85, intimacy: 90.5 });
    // 같은 발생주에 이미 사건 둘 — 지금 닫는 세 번째로 상한(3)이 찬다. 필러는 도달형이 아니다.
    const fillers = ALL.filter(e => !e.reach && !e.condition && e.choices.length > 0).slice(0, 3);
    expect(fillers.length, '전제: 필러 사건').toBe(3);
    s.events = fillers.slice(0, 2).map(e => ({ ...e, year: 7, week: occ }));
    s.currentEvent = { ...fillers[2], week: occ };
    s.phase = 'event';
    return s;
  }

  function playToYearEnd(): GameState {
    for (let guard = 0; guard < 600; guard++) {
      const st = useGameStore.getState().state!;
      if (st.phase === 'ending' || st.year !== 7) break;
      const seoa = st.npcs.find(n => n.id === 'seoa')!;
      if (seoa.intimacy < 90) useGameStore.setState({ state: { ...st, npcs: st.npcs.map(n => n.id === 'seoa' ? { ...n, intimacy: 90 } : n) } });
      const api = useGameStore.getState();
      const cur = useGameStore.getState().state!;
      if (cur.phase === 'event') api.resolveEvent(0);
      else if (cur.phase === 'result') api.setPhase('weekday');
      else if (cur.phase === 'weekday') {
        api.setWeekendChoices(['self-study', 'club']);
        api.setVacationChoices(['self-study', 'creative', 'rest']);
        api.advanceWeek();
      } else break;
    }
    return useGameStore.getState().state!;
  }

  it('세 번째 사건을 store로 닫으면 막 넘은 앵커 컷이 state에 예약되고, 앵커 주에 뜬다', { timeout: 60_000 }, () => {
    useGameStore.setState({ state: cappedStore() });
    useGameStore.getState().resolveEvent(0);
    const after = useGameStore.getState().state!;
    const thisWeek = after.events.filter(e => e.year === 7 && e.week === 25).length;
    expect(thisWeek, '전제: 그 주 사건이 상한(3)에 찼다').toBe(3);
    expect(after.reachReservations?.[SEOA_END], 'store가 상한 예약을 state에 남기지 않았다').toEqual({ year: 7, week: 25 });
    expect(after.currentEvent?.id ?? null, '상한을 넘어 그 주에 화면을 띄웠다').toBeNull();
    const final = playToYearEnd();
    const shown = final.events.find(e => e.id === SEOA_END && e.year === 7);
    expect(shown?.week, '예약된 컷이 그해 안 떴다').not.toBeUndefined();
    expect(shown!.week, '앵커 전에 떴다').toBeGreaterThanOrEqual(ANCHORS[SEOA_END]);
  });
});

