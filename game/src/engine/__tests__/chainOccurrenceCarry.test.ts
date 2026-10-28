// @vitest-environment jsdom
// 연쇄 판정 좌표 = 발생주, 그리고 여름방학 임계 통과 이월.
//
// 결함(2026-10 장르 진단 후속): resolveEventChain(당시 store.ts, 지금 eventResolution.ts)의 연쇄 픽은 processWeek의 week++ **뒤** state로 조건을 봤다.
//   · W24(여름방학 마지막 주) 연쇄가 W25 학기 좌표로 평가돼 `!s.isVacation` 가드가 샜다 — 기록·화면은 "여름방학 5주차".
//   · W19·W42(학기 마지막 주) 연쇄는 반대로 W20·W43 방학 좌표라 정당한 학기 장면이 막혔다.
//   · 쿨다운(10주 조건부·도달형 48÷N)도 연쇄에서만 1주 짧았다(실효 간격 N−1).
// 그 누수가 방학 가드 도달형의 일부를 우연히 살리고 있었다(W24 연쇄에서 임계를 넘은 컷이 학기 좌표로 떴다).
// 누수만 막으면 그 컷들은 2학기에 pre-met이 돼 같은 NPC 앞 컷의 쿨다운에 걸려 유실된다 — 그래서 이월 장치가 짝이다.
//
// 잠그는 계약 (전부 제품 store 경로 advanceWeek → resolveEvent → resolveEventChain, 단위 묶음 U 제외):
//   S1. W24 연쇄에서 임계를 넘은 방학 가드 컷은 W24에 안 뜨고 2학기 첫 2주 안에 뜬다(이월). 방학 주에 뜬 방학 가드 사건 0.
//       이 픽스처(Y1 시드 7)에선 W26이다 — W25는 2학기 반장 선거·연설·결과·followup이 chain cap을 다 써서
//       도달형 판정이 안 돈다(창이 1주면 여기서 유실된다 — 창 길이 2의 근거).
//   S2. W19·W42 연쇄(학기 마지막 주)에선 학기 가드 컷이 그 주에 뜬다.
//   S3. 방학 중 메인 슬롯 교차도 같은 창으로 이월된다(쿨다운이 W43 방학까지 막는 판 — 이월이 없으면 그 해 유실).
//   S4. 겨울방학 교차는 이월하지 않는다(다음 학기 = 다음 학년, 학년 한정 컷은 의도대로 그 해로 끝난다).
//   S5. followup 연쇄도 같은 좌표다(W24 연쇄에서 학기 전용 followup이 안 샌다).
//   S6. 이어하기 — 방학 중에 저장·로드해도 스냅샷이 살아 이월된다.
//   U.  이월 창의 양 끝(W25·W26 예, W27 아니오), 방학 가드 없는 컷은 이월 없음, 학년이 다른 스냅샷은 안 읽음, sanitize.
import { beforeEach, describe, expect, it } from 'vitest';
import { FOLLOWUP_EVENT_IDS, GAME_EVENTS } from '../events';
import { atOccurrence, inVacationCarryWindow, pickReachForWeek } from '../events/selection';
import { assignCurrentEvent } from '../eventPresentation';
import { createInitialState, getWeekInfo } from '../gameEngine';
import { seededRandom } from '../rng';
import { sanitizeSummerIntimacySnapshot } from '../stateMigration';
import { useGameStore } from '../store';
import type { GameEvent, GameState } from '../types';

const ALL = GAME_EVENTS as GameEvent[];
const byId = (id: string) => {
  const e = ALL.find(x => x.id === id);
  if (!e) throw new Error(`${id} 없음 — 이 잠금은 공허하다`);
  return e;
};
const isGuarded = (e: GameEvent) => /isVacation/.test(String(e.condition ?? ''));

// 도윤 Y1은 도달형이 두 개(40·60)라 쿨다운이 24주다 — W19에 앞 컷을 보면 W43(겨울방학)까지 pre-met이 막힌다.
// 그래서 방학 중에 60을 넘으면 이월 없이는 그 해 안에 산술적으로 못 뜬다. 픽스처가 그 성질에 기대므로 먼저 확인한다.
const LOW = 'doyun-secret-spot';   // tier 40
const HIGH = 'doyun-window-school'; // tier 60
// 연쇄를 만들려고 끼워 넣는 사건 — 집 장면이라 방학에도 정당하고, followup·연애 이어짐이 없다.
const FILLER = 'fatigue-warning';

function setWeek(s: GameState, year: number, week: number): void {
  s.year = year;
  s.week = week;
  const info = getWeekInfo(week);
  s.semester = info.semester;
  s.isVacation = info.isVacation;
}

interface Plan {
  start: number;            // 시작 주(주중)
  until: number;            // 이 주 결산까지
  raiseAt: number;          // 임계를 넘기는 발생주
  path: 'main' | 'chain';   // main = 그 주 주중(메인 슬롯 판정 전), chain = 그 발생주의 사건 국면(연쇄 판정 전)
  lo: number;               // 넘기기 전 친밀도 상한
  hi: number;               // 넘긴 뒤 친밀도 하한
  history?: { id: string; week: number }[];
  extra?: (s: GameState) => void;
  midSaveAt?: number;       // 이 주 주중에 저장 → 상태 비움 → 로드
}

interface Played { shown: Map<string, number>; vacGuarded: string[]; final: GameState }

/** 제품 store로 Y1을 산다. chain 교차가 필요한 주에 사건이 없으면 FILLER를 그 발생주 사건으로 끼운다. */
function playStore(p: Plan): Played {
  const s0 = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 7 });
  s0.routineSlot2 = 'self-study';
  s0.routineSlot3 = 'light-exercise';
  setWeek(s0, 1, p.start);
  s0.phase = 'weekday';
  s0.events = (p.history ?? []).map(h => ({ ...byId(h.id), condition: undefined, year: 1, week: h.week }));
  const d0 = s0.npcs.find(n => n.id === 'doyun')!;
  d0.met = true;
  d0.intimacy = p.lo;
  p.extra?.(s0);
  useGameStore.setState({ state: s0 });
  let raised = false;
  for (let guard = 0; guard < 300; guard++) {
    let st = useGameStore.getState().state!;
    if (st.year !== 1 || st.phase === 'ending' || st.phase === 'year-end') break;
    if (st.phase === 'weekday' && st.week > p.until) break;
    if (st.phase === 'weekday' && st.week === p.midSaveAt) {
      useGameStore.setState({ state: null });
      expect(useGameStore.getState().loadSavedGame(), '이어하기 로드').toBe(true);
      st = useGameStore.getState().state!;
    }
    // 연쇄 교차: 그 발생주에 사건이 없으면 하나 끼운다(결산 화면으로 가기 전에).
    if (p.path === 'chain' && !raised && st.phase === 'result' && st.weekLog?.week === p.raiseAt) {
      const next = { ...st };
      assignCurrentEvent(next, byId(FILLER), p.raiseAt);
      useGameStore.setState({ state: next });
      st = useGameStore.getState().state!;
    }
    if (st.phase === 'weekday' || st.phase === 'event') {
      const occ = st.phase === 'event' ? st.currentEvent!.week : st.week;
      const hit = p.path === 'main' ? st.phase === 'weekday' && st.week === p.raiseAt : st.phase === 'event' && occ === p.raiseAt;
      const npcs = st.npcs.map(n => ({ ...n }));
      const n = npcs.find(x => x.id === 'doyun')!;
      n.met = true;
      if (!raised && hit) raised = true;
      n.intimacy = raised ? Math.max(n.intimacy, p.hi) : Math.min(n.intimacy, p.lo);
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
  expect(raised, '픽스처가 교차 지점에 닿았다').toBe(true);
  const final = useGameStore.getState().state!;
  const shown = new Map<string, number>();
  for (const e of final.events) if (e.year === 1 && !shown.has(e.id)) shown.set(e.id, e.week!);
  const vacGuarded = final.events
    .filter(e => e.year === 1 && getWeekInfo(e.week!).isVacation && isGuarded(ALL.find(x => x.id === e.id) ?? e))
    .map(e => `${e.id}@W${e.week}`);
  return { shown, vacGuarded, final };
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null });
});

describe('픽스처 전제 — 도윤 Y1 두 컷은 방학 가드, 쿨다운 24주', () => {
  it('두 컷 모두 방학 가드이고 FILLER는 방학에도 뜨는 집 장면이다', () => {
    expect(isGuarded(byId(LOW))).toBe(true);
    expect(isGuarded(byId(HIGH))).toBe(true);
    expect(ALL.filter(e => e.reach?.npc === 'doyun' && e.reach.year === 1).map(e => e.reach!.tier).sort()).toEqual([40, 60]);
    expect(isGuarded(byId(FILLER))).toBe(false);
  });
});

describe('S1. W24 연쇄 — 방학 가드가 새지 않고, 넘은 임계는 2학기 첫 주(들)로 이월된다', () => {
  it('도윤 60을 W24 사건 국면에 넘기면 W24엔 안 뜨고 W26에 뜬다(W25는 반장 선거 연쇄)', { timeout: 30_000 }, () => {
    const r = playStore({ start: 20, until: 30, raiseAt: 24, path: 'chain', lo: 45, hi: 61, history: [{ id: LOW, week: 19 }] });
    expect(r.shown.get(HIGH), '도윤 60 표시 발생주').toBe(26);
    expect(r.shown.get('class-president-2'), 'W25가 선거 주라는 픽스처 전제').toBe(25);
    expect(r.vacGuarded, '방학 주에 뜬 방학 가드 사건').toEqual([]);
    // 스냅샷은 여름방학 첫 주 시작에 찍힌다(이월의 기준점).
    expect(r.final.summerIntimacySnapshot?.year).toBe(1);
    expect(r.final.summerIntimacySnapshot?.byNpc.doyun).toBe(45);
    // 방학 끝 기록은 W24 연쇄가 닫힐 때 찍힌다(연쇄 안에서 넘긴 61이 들어가 있다).
    expect(r.final.summerIntimacySnapshot?.endByNpc?.doyun).toBeGreaterThanOrEqual(61);
  });
});

describe('S2. 학기 마지막 주(W19·W42) 연쇄 — 학기 가드 컷이 그 주에 뜬다', () => {
  for (const w of [19, 42]) {
    it(`도윤 40을 W${w} 사건 국면에 넘기면 W${w}에 뜬다`, { timeout: 30_000 }, () => {
      const r = playStore({ start: w - 1, until: w + 1, raiseAt: w, path: 'chain', lo: 30, hi: 41 });
      expect(r.shown.get(LOW), `도윤 40 표시 발생주(W${w})`).toBe(w);
      expect(r.vacGuarded).toEqual([]);
    });
  }
});

describe('S3. 방학 중 메인 슬롯 교차도 같은 창으로 이월된다', () => {
  for (const w of [21, 22, 24]) {
    it(`W${w} 주중에 도윤 60을 넘기면 W26에 뜬다(이월 없으면 쿨다운이 W43까지 막아 그 해 유실)`, { timeout: 30_000 }, () => {
      const r = playStore({ start: 20, until: 30, raiseAt: w, path: 'main', lo: 45, hi: 61, history: [{ id: LOW, week: 19 }] });
      expect(r.shown.get(HIGH), '도윤 60 표시 발생주').toBe(26);
      expect(r.vacGuarded).toEqual([]);
    });
  }

  // W20 주중(방학 첫 주 확정 전) 변화는 스냅샷에 들어간다 — 학기에도 주 시작 전 변화는 fresh가 아니다(pre-met).
  it('음성 대조 — 방학 전에 이미 넘어 있던 임계는 이월하지 않는다(쿨다운대로 W43 → 방학 → 그 해 없음)', { timeout: 30_000 }, () => {
    // 여름 스냅샷이 61이면 방학 중 교차가 아니다. 이월은 "방학 동안 넘은 것"만이다.
    const r = playStore({ start: 20, until: 48, raiseAt: 20, path: 'main', lo: 61, hi: 61, history: [{ id: LOW, week: 19 }] });
    expect(r.final.summerIntimacySnapshot?.byNpc.doyun).toBe(61);
    expect(r.shown.has(HIGH), '도윤 60').toBe(false);
  });
});

describe('S3b. 개학 뒤 주중 교차는 이월하지 않는다 — 학기 규칙대로 pre-met 쿨다운', () => {
  // 3자 검수 지적: 기준점이 방학 시작 스냅샷뿐이면 W25·W26 주중(processWeek 전)에 처음 오른 친밀도까지 fresh가 됐다.
  // 학기 중이었다면 그 주 시작 스냅샷에 들어가 pre-met — 같은 NPC 앞 컷(W19) 쿨다운 24주로 W43(방학)까지 막혀 그 해 없음.
  for (const w of [25, 26]) {
    it(`W${w} 주중에 도윤 60을 넘기면 Y1 안에 안 뜬다`, { timeout: 30_000 }, () => {
      const r = playStore({ start: 20, until: 48, raiseAt: w, path: 'main', lo: 45, hi: 61, history: [{ id: LOW, week: 19 }] });
      expect(r.final.summerIntimacySnapshot?.endByNpc?.doyun, '방학 끝 기록 = 아직 임계 아래').toBeLessThan(60);
      expect(r.shown.has(HIGH), '도윤 60').toBe(false);
    });
  }
});

describe('S4. 겨울방학 교차는 이월하지 않는다 — 학년 한정 컷의 의도된 끝', () => {
  it('W44 주중에 도윤 40을 넘기면 Y1 안에 안 뜬다', { timeout: 30_000 }, () => {
    const r = playStore({ start: 43, until: 48, raiseAt: 44, path: 'main', lo: 30, hi: 41 });
    expect(r.shown.has(LOW)).toBe(false);
    expect(r.vacGuarded).toEqual([]);
  });
});

describe('S5. followup 연쇄도 발생주 좌표', () => {
  // subin-lonely: followup, `!s.isVacation`, 수빈 35, Y2+. W24 연쇄에서 week++ 뒤 좌표로 보면 샌다.
  // 다른 followup이 먼저 잡히지 않게 전원을 만난 상태·친밀도 0으로 두고 수빈만 40.
  function onlySubin(s: GameState): void {
    for (const n of s.npcs) { n.met = true; n.intimacy = 0; }
    s.npcs.find(n => n.id === 'subin')!.intimacy = 40;
  }
  it('W24 사건 국면의 followup 판정은 방학이다 — 학기 전용 followup이 W24에 안 뜬다', { timeout: 30_000 }, () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 7 });
    setWeek(s, 2, 25); // processWeek가 W24를 끝내고 week++한 뒤의 좌표
    onlySubin(s);
    assignCurrentEvent(s, byId(FILLER), 24);
    useGameStore.setState({ state: s });
    useGameStore.getState().resolveEvent(0);
    const after = useGameStore.getState().state!;
    const w24 = after.currentEvent ? byId(after.currentEvent.id) : null;
    expect(w24 && FOLLOWUP_EVENT_IDS.has(w24.id) && isGuarded(w24) ? w24.id : null, 'W24 연쇄에 뜬 학기 전용 followup').toBeNull();
    // 양성 대조 — 같은 상태를 학기 마지막 주(W19) 연쇄로 돌리면 뜬다.
    const t = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 7 });
    setWeek(t, 2, 20);
    onlySubin(t);
    assignCurrentEvent(t, byId(FILLER), 19);
    useGameStore.setState({ state: t });
    useGameStore.getState().resolveEvent(0);
    // 같은 조건에서 수빈 학기 followup(subin-bridge·subin-lonely)이 W19 연쇄에 뜬다 — 우선순위상 bridge가 먼저다.
    const w19 = useGameStore.getState().state!.currentEvent;
    expect(w19?.id, 'W19 연쇄 followup').toBe('subin-bridge');
    expect(FOLLOWUP_EVENT_IDS.has(w19!.id) && isGuarded(byId(w19!.id))).toBe(true);
    expect(w19!.week, '기록 발생주').toBe(19);
  });
});

describe('S6. 이어하기 — 방학 중 저장·로드해도 이월된다', () => {
  it('W22에 저장·로드한 판도 W24 교차가 이월된다', { timeout: 30_000 }, () => {
    const r = playStore({ start: 20, until: 30, raiseAt: 24, path: 'chain', lo: 45, hi: 61, history: [{ id: LOW, week: 19 }], midSaveAt: 22 });
    expect(r.shown.get(HIGH)).toBe(26);
  });
});

describe('S7. 손상된 스냅샷 세이브 — 로드가 버린다', () => {
  // 3자 검수 실측: stateMigration의 sanitize 배선 줄을 지워도(원값 통과) 전부 초록이었다. 손상값 null·'45'는
  // freshBaseline에서 `null < 60`·`'45' < 60`이 참이라 가짜 fresh가 된다. 저장 → 로드 실경로로 잠근다.
  function playLoaded(byNpcDoyun: unknown): boolean {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 7 });
    s.routineSlot2 = 'self-study';
    s.routineSlot3 = 'light-exercise';
    setWeek(s, 1, 26);
    s.phase = 'weekday';
    const d = s.npcs.find(n => n.id === 'doyun')!;
    d.met = true;
    d.intimacy = 61; // 주 시작 전부터 61 — 스냅샷이 없으면 pre-met(쿨다운 진행 중)
    s.events = [{ ...byId(LOW), condition: undefined, year: 1, week: 19 }];
    (s as unknown as { summerIntimacySnapshot: unknown }).summerIntimacySnapshot = { year: 1, byNpc: { doyun: byNpcDoyun }, endByNpc: { doyun: 61 } };
    useGameStore.setState({ state: s }); // 자동저장 구독이 localStorage에 쓴다
    useGameStore.setState({ state: null });
    expect(useGameStore.getState().loadSavedGame(), '이어하기 로드').toBe(true);
    const api = useGameStore.getState();
    api.setWeekendChoices(['self-study', 'club']);
    api.advanceWeek();
    for (let g = 0; g < 20; g++) {
      const st = useGameStore.getState().state!;
      if (st.phase !== 'event') break;
      useGameStore.getState().resolveEvent(0);
    }
    return useGameStore.getState().state!.events.some(e => e.id === HIGH);
  }

  it('null·문자열 기준점은 버려져 이월이 안 생긴다', { timeout: 30_000 }, () => {
    expect(playLoaded(null), 'null').toBe(false);
    expect(playLoaded('45'), "'45'").toBe(false);
  });

  it('양성 짝 — 정상 기준점(45)이면 같은 판에서 W26에 뜬다', { timeout: 30_000 }, () => {
    expect(playLoaded(45)).toBe(true);
  });
});

describe('U. 이월 창·대상·스냅샷 학년 (페이싱 엔진 직접)', () => {
  /** 방학 동안 넘었고(스냅샷 < tier ≤ 주 시작) 쿨다운 진행 중인 W 상태. */
  function carried(id: string, week: number, snapYearOffset = 0): GameState {
    const e = byId(id);
    const { npc, tier, year } = e.reach!;
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 1 });
    setWeek(s, year, week);
    const n = s.npcs.find(x => x.id === npc)!;
    n.met = true;
    n.intimacy = tier + 1;
    n.weekStartIntimacy = tier + 1;
    // 같은 NPC 같은 학년 다른 컷은 W19에 본 것으로 — 쿨다운 진행 중(pre-met은 막힌다).
    s.events = ALL.filter(x => x.reach?.npc === npc && x.reach.year === year && x.id !== id)
      .map(x => ({ ...x, condition: undefined, year, week: 19 }));
    // 방학 시작엔 tier−5, 방학 끝(W24 결산 직전)엔 tier+1 — 방학 동안 넘었다.
    s.summerIntimacySnapshot = { year: year + snapYearOffset, byNpc: { [npc]: tier - 5 }, endByNpc: { [npc]: tier + 1 } };
    return s;
  }

  it('창은 2학기 첫 2주다 — W25·W26 예, W24·W27 아니오', () => {
    expect([24, 25, 26, 27].map(inVacationCarryWindow)).toEqual([false, true, true, false]);
    expect(pickReachForWeek(carried(HIGH, 25)).event?.id, 'W25 이월 fresh').toBe(HIGH);
    expect(pickReachForWeek(carried(HIGH, 26)).event?.id, 'W26 이월 fresh').toBe(HIGH);
    expect(pickReachForWeek(carried(HIGH, 27)).event, 'W27은 창 밖 — pre-met 쿨다운').toBeNull();
  });

  it('방학 가드 없는 컷은 이월하지 않는다', () => {
    // jihun-mirror-height(Y2 55)는 가드도 주차 게이트도 없다 — 방학에 넘으면 방학에 fresh로 떴어야 했다.
    // 이 장치 몫이 아니다. (주차 게이트가 있는 컷을 고르면 W25에 원래 막혀 이 대조가 공허해진다 — 먼저 확인한다.)
    const id = 'jihun-mirror-height';
    expect(isGuarded(byId(id))).toBe(false);
    const s = carried(id, 25);
    expect(byId(id).condition!(s), 'W25에 조건 자체는 통과한다(공허 방지)').toBe(true);
    expect(pickReachForWeek(s).event).toBeNull();
    // 양성 짝 — 같은 상태에서 스냅샷 대신 주 시작 친밀도가 임계 아래면(평범한 fresh) 뜬다.
    const t = carried(id, 25);
    t.npcs.find(n => n.id === 'jihun')!.weekStartIntimacy = 50;
    expect(pickReachForWeek(t).event?.id).toBe(id);
  });

  it('학년이 다른 스냅샷은 읽지 않는다', () => {
    // Y2 컷을 Y1 스냅샷으로(작년), Y1 컷을 Y2 스냅샷으로(내년) — 양쪽 다 막혀야 `year ± 1` 허용 회귀가 잡힌다.
    // jihun-locker-code(Y2 45)는 방학 가드 컷 — 양성 짝(올해 스냅샷)으로 픽스처가 닿는지 먼저 본다.
    expect(pickReachForWeek(carried('jihun-locker-code', 25, 0)).event?.id, 'Y2 양성 짝').toBe('jihun-locker-code');
    expect(pickReachForWeek(carried('jihun-locker-code', 25, -1)).event, '작년 스냅샷').toBeNull();
    expect(pickReachForWeek(carried(HIGH, 25, 1)).event, '내년 스냅샷').toBeNull();
    expect(pickReachForWeek(carried(HIGH, 25, 0)).event?.id, '양성 짝 — 올해 스냅샷').toBe(HIGH);
  });

  it('방학 끝에 임계 아래였으면 이월하지 않는다 — 개학 뒤 주중에 오른 친밀도는 pre-met', () => {
    const s = carried(HIGH, 25);
    s.summerIntimacySnapshot!.endByNpc = { doyun: 59 };
    expect(pickReachForWeek(s).event).toBeNull();
    const t = carried(HIGH, 25);
    delete t.summerIntimacySnapshot!.endByNpc;
    expect(pickReachForWeek(t).event, '방학 끝 기록이 없으면(구세이브·방학 중 시작) 이월 없음').toBeNull();
  });

  it('sanitize — 판정할 수 없는 스냅샷은 버린다', () => {
    expect(sanitizeSummerIntimacySnapshot(undefined)).toBeUndefined();
    expect(sanitizeSummerIntimacySnapshot([1])).toBeUndefined();
    expect(sanitizeSummerIntimacySnapshot({ year: 0, byNpc: {} })).toBeUndefined();
    expect(sanitizeSummerIntimacySnapshot({ year: 1.5, byNpc: {} })).toBeUndefined();
    expect(sanitizeSummerIntimacySnapshot({ year: 2, byNpc: null })).toBeUndefined();
    expect(sanitizeSummerIntimacySnapshot({ year: 2, byNpc: { a: 3, b: 'x', c: Number.NaN } })).toEqual({ year: 2, byNpc: { a: 3 } });
    expect(sanitizeSummerIntimacySnapshot({ year: 2, byNpc: { a: 3 }, endByNpc: { a: null, b: '45', c: 61 } }))
      .toEqual({ year: 2, byNpc: { a: 3 }, endByNpc: { c: 61 } });
    expect(sanitizeSummerIntimacySnapshot({ year: 2, byNpc: { a: 3 }, endByNpc: [1] })).toEqual({ year: 2, byNpc: { a: 3 } });
  });
});

describe('atOccurrence — 좌표만 잠시 바꾸고 RNG는 같은 state에서 흐른다', () => {
  it('끝나면 week·semester·isVacation을 되돌리고, 안에서 굴린 rngSeed는 남는다', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 9 });
    setWeek(s, 1, 25);
    const seed0 = s.rngSeed;
    const seen = atOccurrence(s, 24, () => { seededRandom(s); return [s.week, s.isVacation, s.semester] as const; });
    expect(seen).toEqual([24, true, 1]);
    expect([s.week, s.isVacation, s.semester]).toEqual([25, false, 2]);
    expect(s.rngSeed).not.toBe(seed0);
  });

  it('콜백이 던져도 예외는 그대로 나가고, 좌표는 되돌아오고, 그 전에 굴린 rngSeed는 남는다', () => {
    const s = createInitialState('male', ['wealth', 'freedom'], { rngSeed: 9 });
    setWeek(s, 1, 25);
    const seed0 = s.rngSeed;
    expect(() => atOccurrence(s, 24, () => { seededRandom(s); throw new Error('boom'); })).toThrow('boom');
    expect([s.week, s.isVacation, s.semester]).toEqual([25, false, 2]);
    expect(s.rngSeed).not.toBe(seed0);
  });
});
