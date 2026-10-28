// 친구 초대(약속) — monthInvites.ts. 수치는 디렉터 결정(2026-10-25): 수락은 동행 +3만, 거절 −1, 못 지킴 −2,
// 한 달 0~2개, 친밀도 30 이상 재학 친구.
import { beforeAll, describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import {
  INVITE_MIN_INTIMACY, MAX_INVITES_PER_MONTH, generateMonthInvites, validateInviteAnswers,
} from '../monthInvites';
import { getWeekInfo } from '../weekMath';
import { inviteVoice } from '../talkData/inviteVoices';
import { installMemoryStorage } from '../../../scripts/lib/week-driver';
import type { useGameStore as UseGameStore } from '../store';
import type { GameState, MonthInvite, MonthPlan } from '../types';

let store: typeof UseGameStore;
beforeAll(async () => {
  installMemoryStorage();
  store = (await import('../store')).useGameStore;
});

/** Y2 4월 첫 주 — 지훈(친밀도 40)·수빈(35)·민재(32) 만남, 유나는 25(후보 아님). */
function at(week: number, rngSeed = 1, patch: Partial<GameState> = {}): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
  Object.assign(s, { year: 2, week, rngSeed, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(week).isVacation, money: 50 }, patch);
  for (const [id, v] of [['jihun', 40], ['subin', 35], ['minjae', 32], ['yuna', 25]] as const) {
    const n = s.npcs.find(x => x.id === id)!;
    n.met = true;
    n.intimacy = v;
  }
  return s;
}

/** 초대가 n개 나오는 첫 시드를 찾는다 — 생성은 rngSeed를 읽는 결정론적 함수라 검색으로 고정할 수 있다. */
function seedWith(week: number, n: number): number {
  for (let seed = 0; seed < 2000; seed++) if (generateMonthInvites(at(week, seed)).length === n) return seed;
  throw new Error(`초대 ${n}개가 나오는 시드가 없다`);
}

describe('초대 생성 — 결정론, 0~2개, 친밀도 30 이상 재학 친구', () => {
  it('같은 상태면 같은 초대이고, 게임 난수를 전진시키지 않는다', () => {
    const s = at(5, 77);
    const a = generateMonthInvites(s);
    expect(generateMonthInvites(s)).toEqual(a);
    expect(s.rngSeed, '초대 생성이 rngSeed를 건드렸다 — 다른 결과가 흔들린다').toBe(77);
  });

  it('시드 600개를 훑으면 0·1·2개가 다 나오고 2개를 넘지 않는다', () => {
    const counts = new Set<number>();
    for (let seed = 0; seed < 600; seed++) {
      const inv = generateMonthInvites(at(5, seed));
      expect(inv.length).toBeLessThanOrEqual(MAX_INVITES_PER_MONTH);
      counts.add(inv.length);
    }
    expect([...counts].sort()).toEqual([0, 1, 2]);
  });

  it('후보는 친밀도 30 이상·만남·재학만 — 25인 유나, 안 만난 친구는 안 나온다', () => {
    for (let seed = 0; seed < 300; seed++) {
      const s = at(5, seed);
      for (const inv of generateMonthInvites(s)) {
        const npc = s.npcs.find(n => n.id === inv.npcId)!;
        expect(npc.met).toBe(true);
        expect(npc.intimacy).toBeGreaterThanOrEqual(INVITE_MIN_INTIMACY);
      }
    }
    const none = at(5, 1);
    for (const n of none.npcs) n.intimacy = 29;
    expect(generateMonthInvites(none)).toEqual([]);
  });

  /** 친구 하나만 만나 둔 판 — 그 친구의 친밀도·학년만 바꿔 문턱과 재학을 겨눈다. */
  function only(id: string, intimacy: number, year = 2): GameState[] {
    return Array.from({ length: 300 }, (_, seed) => {
      const s = at(5, seed, { year });
      for (const n of s.npcs) { n.met = false; n.intimacy = 0; }
      const npc = s.npcs.find(n => n.id === id)!;
      npc.met = true;
      npc.intimacy = intimacy;
      return s;
    });
  }
  const anyInvite = (states: GameState[]) => states.some(s => generateMonthInvites(s).length > 0);

  it('문턱은 정확히 30 — 30이면 초대가 오고 29면 절대 안 온다(양방향)', () => {
    expect(anyInvite(only('subin', 30)), '친밀도 30인데 초대가 한 번도 안 온다').toBe(true);
    expect(anyInvite(only('subin', 29)), '친밀도 29인데 초대가 왔다').toBe(false);
  });

  it('재학하지 않는 친구는 친밀도가 높아도 초대하지 않는다 — 하은은 Y4(졸업 공백)에 없다', () => {
    expect(anyInvite(only('haeun', 70, 3)), '전제: 같은 학교인 Y3엔 초대가 온다').toBe(true);
    expect(anyInvite(only('haeun', 70, 4)), 'Y4 하은이 초대했다').toBe(false);
    expect(anyInvite(only('subin', 70).map(s => { s.npcs.find(n => n.id === 'subin')!.met = false; return s; })), '안 만난 친구가 초대했다').toBe(false);
  });

  it('두 초대는 다른 친구·다른 주이고, 주는 남은 달 안, 칸은 학기면 토(0)·일(1)', () => {
    const s = at(6, seedWith(6, 2)); // 달 중간(W6) — W6~W8만
    const inv = generateMonthInvites(s);
    expect(new Set(inv.map(i => i.npcId)).size).toBe(2);
    expect(new Set(inv.map(i => i.week)).size).toBe(2);
    for (const i of inv) {
      expect(i.week).toBeGreaterThanOrEqual(6);
      expect(i.week).toBeLessThanOrEqual(8);
      expect([0, 1]).toContain(i.slotIdx);
    }
  });

  it('시험 주(와 준비 주)엔 같이 공부하자고, 방학 주는 첫 칸에 놀자고 한다', () => {
    for (let seed = 0; seed < 400; seed++) {
      for (const i of generateMonthInvites(at(5, seed))) {
        // 4월: W7 준비 주, W8 중간고사
        expect(i.activityId).toBe(i.week >= 7 ? 'study-group' : 'hang-out');
      }
      for (const i of generateMonthInvites(at(21, seed))) {
        expect(i.slotIdx).toBe(0);
        expect(i.activityId).toBe('hang-out');
      }
    }
  });

  it('학년 전환 대기(W49)엔 초대가 없다', () => {
    expect(generateMonthInvites(at(49, 5))).toEqual([]);
  });
});

/** 4월 계획 — 지정한 초대를 수락/거절한 답과, 수락한 칸을 반영한 주들. */
function planWith(s: GameState, answers: boolean[]): MonthPlan {
  const inv = generateMonthInvites(s);
  const weeks = [5, 6, 7, 8].filter(w => w >= s.week).map(week => ({ week, activities: ['', ''], npcChoices: {} as Record<string, string> }));
  inv.forEach((i, k) => {
    if (!answers[k]) return;
    const w = weeks.find(x => x.week === i.week)!;
    w.activities[i.slotIdx] = i.activityId;
    w.npcChoices[`${i.activityId}:${i.slotIdx}`] = i.npcId;
  });
  return { year: 2, month: 2, weeks, invites: inv.map((i, k) => ({ ...i, accepted: answers[k] })) };
}

describe('초대 답 검증 — store.setMonthPlan', () => {
  it('받은 초대에 다 답해야 하고, 지어낸 초대는 거부한다', () => {
    const s = at(5, seedWith(5, 2));
    const ok = planWith(s, [true, false]);
    expect(validateInviteAnswers(s, ok)).toBeNull();
    expect(validateInviteAnswers(s, { ...ok, invites: ok.invites!.slice(0, 1) })).toMatch(/맞지 않는다/);
    const forged: MonthInvite & { accepted: boolean } = { npcId: 'yuna', week: 5, slotIdx: 0, activityId: 'hang-out', accepted: false };
    expect(validateInviteAnswers(s, { ...ok, invites: [ok.invites![0], forged] })).toMatch(/맞지 않는다/);
  });

  it('store도 초대 답을 검증한다 — 답 없는 계획은 저장하지 않는다', () => {
    const s = at(5, seedWith(5, 1));
    const plan = planWith(s, [false]);
    store.setState({ state: s });
    expect(store.getState().setMonthPlan({ ...plan, invites: [] })).toMatch(/맞지 않는다/);
    expect(store.getState().state!.monthPlan).toBeUndefined();
  });

  it('수락한 초대의 칸이 계획에 없으면 거부한다', () => {
    const s = at(5, seedWith(5, 1));
    const plan = planWith(s, [true]);
    plan.weeks.forEach(w => { w.activities = ['', '']; w.npcChoices = {}; });
    expect(validateInviteAnswers(s, plan)).toMatch(/칸이 계획에 없다/);
  });

  it('거절한 친구만 친밀도 −1(한 번), 수락한 친구는 그대로', () => {
    const s = at(5, seedWith(5, 2));
    const plan = planWith(s, [true, false]);
    const [acc, dec] = plan.invites!;
    const before = Object.fromEntries(s.npcs.map(n => [n.id, n.intimacy]));
    store.setState({ state: s });
    expect(store.getState().setMonthPlan(plan)).toBeNull();
    const after = store.getState().state!;
    expect(after.npcs.find(n => n.id === dec.npcId)!.intimacy).toBe(before[dec.npcId] - 1);
    expect(after.npcs.find(n => n.id === acc.npcId)!.intimacy).toBe(before[acc.npcId]);
  });
});

describe('약속 — 그 주에 지켰는지(processWeek)', () => {
  /** 수락한 초대 하나를 가진 판을 그 초대의 주로 옮긴다. */
  function promiseWeek() {
    const s0 = at(5, seedWith(5, 1));
    const plan = planWith(s0, [true]);
    const inv = plan.invites![0];
    const s = { ...s0, week: inv.week, monthPlan: plan, routineSlot2: 'self-study' } as GameState;
    const pick = [...plan.weeks.find(w => w.week === inv.week)!.activities].map(x => x || 'rest');
    const map = { [`${inv.activityId}:${inv.slotIdx}`]: inv.npcId };
    return { s, inv, pick, map };
  }
  const intimacy = (s: GameState, id: string) => s.npcs.find(n => n.id === id)!.intimacy;

  it('그 칸을 그 친구와 하면 "지켰다" 한 줄, 친밀도는 동행 몫뿐(약속이 없던 판과 같다)', () => {
    const { s, inv, pick, map } = promiseWeek();
    const kept = processWeek({ ...s, weekendChoices: pick }, map);
    expect(kept.weekLog!.messages.some(m => m.startsWith('📌'))).toBe(true);
    // 그 친구의 말투로 적힌다(talkData/inviteVoices.ts).
    expect(kept.weekLog!.messages.find(m => m.startsWith('📌'))).toContain(inviteVoice(inv.npcId).kept);
    const control = processWeek({ ...s, monthPlan: undefined, weekendChoices: pick }, map);
    expect(intimacy(kept, inv.npcId)).toBe(intimacy(control, inv.npcId));
  });

  it('이벤트 시간 소모로 그 칸이 잘리면 못 지킨 것 — 결과는 정확히 −2(만나지 못한 동행 +3은 없던 일)와 한 줄', () => {
    const { s, inv, pick, map } = promiseWeek();
    // timeCost는 뒤에서부터 지운다 — 약속 칸이 마지막이 되게 둘째 칸 뒤를 비운다.
    const choices = inv.slotIdx === 1 ? pick : [pick[0]];
    const cut = processWeek({ ...s, weekendChoices: choices, eventTimeCost: 1 }, map);
    // 대조군은 **동행이 없던 판**이다. 동행 +3은 실행 여부와 무관하게 먼저 들어가므로, 동행이 있는 판을 대조로 두면
    // 예전 결과(+3 −2 = +1)도 "대조 −2"로 통과했다(3자 검수 — 디렉터 결정 2026-10-26: 깨진 약속은 정산 −2).
    const noCompanion = processWeek({ ...s, monthPlan: undefined, weekendChoices: choices, eventTimeCost: 1 });
    const withCompanion = processWeek({ ...s, monthPlan: undefined, weekendChoices: choices, eventTimeCost: 1 }, map);
    expect(intimacy(withCompanion, inv.npcId), '전제: 동행만으로는 칸이 잘려도 오른다').toBeGreaterThan(intimacy(noCompanion, inv.npcId));
    expect(cut.weekLog!.messages.some(m => m.startsWith('💔'))).toBe(true);
    expect(cut.weekLog!.messages.find(m => m.startsWith('💔'))).toContain(inviteVoice(inv.npcId).broken);
    expect(intimacy(cut, inv.npcId)).toBe(Math.max(0, intimacy(noCompanion, inv.npcId) - 2));
  });

  it('그 활동을 했어도 그 친구와가 아니면 못 지킨 것 — −2', () => {
    const { s, inv, pick } = promiseWeek();
    const alone = processWeek({ ...s, weekendChoices: pick }, {});
    const control = processWeek({ ...s, monthPlan: undefined, weekendChoices: pick }, {});
    expect(alone.weekLog!.messages.some(m => m.startsWith('💔'))).toBe(true);
    expect(intimacy(alone, inv.npcId)).toBe(Math.max(0, intimacy(control, inv.npcId) - 2));
  });

  it('주간 화면에서 그 칸을 빼면 못 지킨 것 — −2', () => {
    const { s, inv } = promiseWeek();
    const broken = processWeek({ ...s, weekendChoices: ['rest', 'rest'] }, {});
    const control = processWeek({ ...s, monthPlan: undefined, weekendChoices: ['rest', 'rest'] }, {});
    expect(intimacy(broken, inv.npcId)).toBe(intimacy(control, inv.npcId) - 2);
  });

  it('약속 주가 아니면 아무 말도 없다', () => {
    const { s, inv } = promiseWeek();
    const other = [5, 6, 7, 8].find(w => w !== inv.week)!;
    const next = processWeek({ ...s, week: other, weekendChoices: ['rest', 'rest'] }, {});
    expect(next.weekLog!.messages.some(m => m.startsWith('📌') || m.startsWith('💔'))).toBe(false);
  });
});
