// 주간 화면의 친구 초대(2026-11-02 사용자 지적 "월간 계획 세울 때는 친구 부름이 있는데 주차별로 하면 같은 주차인데도 안 뜬다").
// 초대는 계획 화면에만 있었다 — 주간 화면이 메인이 된 뒤(#537) 계획을 안 짠 달엔 초대가 아예 없었다.
// 잠그는 것:
//   · 계획을 안 짠 달엔 이번 주에 잡힌 초대가 주간 화면에 뜬다(계획 화면과 같은 초대) · 계획이 있으면 안 뜬다
//   · 주간에서 답하면 바로 확정 — 거절 −1은 한 번, 두 번 답할 수 없다 · 지난달 답은 안 읽는다
//   · 수락한 약속은 계획 없이도 지켰는지 따진다(📌 / 💔 −2)
//   · 그 뒤 계획 화면을 열면 그 주는 그 답으로 고정 — 뒤집으면 거부, 거절 −1을 또 깎지 않는다
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { answeredInvites, generateMonthInvites, planInvites, weekInviteAnswers, weekInviteFor } from '../monthInvites';
import { getMonthBlock, getWeekInfo } from '../weekMath';
import { installMemoryStorage } from '../../../scripts/lib/week-driver';
import type { useGameStore as UseGameStore } from '../store';
import type { GameState, MonthInvite, MonthPlan } from '../types';

let store: typeof UseGameStore;
beforeAll(async () => {
  installMemoryStorage();
  store = (await import('../store')).useGameStore;
});

/** monthInvites.test와 같은 판 — Y2, 지훈 40·수빈 35·민재 32(후보), 유나 25(후보 아님). */
function at(week: number, rngSeed: number): GameState {
  const s = createInitialState('male', ['strict', 'emotional'], { rngSeed: 3 });
  Object.assign(s, { year: 2, week, rngSeed, phase: 'weekday' as const, currentEvent: null, isVacation: getWeekInfo(week).isVacation, money: 50, routineSlot2: 'self-study' });
  for (const [id, v] of [['jihun', 40], ['subin', 35], ['minjae', 32], ['yuna', 25]] as const) {
    const n = s.npcs.find(x => x.id === id)!;
    n.met = true;
    n.intimacy = v;
  }
  return s;
}
function seedWith(week: number, n: number): number {
  for (let seed = 0; seed < 2000; seed++) if (generateMonthInvites(at(week, seed)).length === n) return seed;
  throw new Error(`초대 ${n}개가 나오는 시드가 없다`);
}
/** 4월(W5~8)에 초대 둘인 판을, 첫 초대의 주로 옮긴다. */
function inviteWeek(): { s: GameState; first: MonthInvite; second: MonthInvite } {
  const seed = seedWith(5, 2);
  const [first, second] = generateMonthInvites(at(5, seed));
  return { s: at(first.week, seed), first, second };
}
const intimacy = (s: GameState, id: string) => s.npcs.find(n => n.id === id)!.intimacy;
const now = () => store.getState().state!;

beforeEach(() => store.setState({ state: null }));

describe('계획을 안 짠 달 — 이번 주 초대가 주간 화면에 뜬다', () => {
  it('week_invite_shown: 이번 주에 잡힌 초대는 계획 화면이 받을 초대와 같다', () => {
    const { s, first } = inviteWeek();
    expect(weekInviteFor(s), 'week_invite_shown').toEqual({ invite: first });
  });

  it('week_invite_other_week: 초대가 없는 주엔 안 뜬다', () => {
    const { s, first, second } = inviteWeek();
    const free = [5, 6, 7, 8].find(w => w !== first.week && w !== second.week)!;
    expect(weekInviteFor({ ...s, week: free }), 'week_invite_other_week').toBeNull();
  });

  it('week_invite_plan_hides: 이번 달 계획이 있으면 안 뜬다 — 계획 화면에서 이미 답했다', () => {
    const { s } = inviteWeek();
    const plan: MonthPlan = { year: s.year, month: getMonthBlock(s.week).index, weeks: [], invites: [] };
    expect(weekInviteFor({ ...s, monthPlan: plan })).toBeNull();
  });
});

describe('주간에서 답하기 — 바로 확정', () => {
  it('week_decline_once: 거절은 −1 한 번, 다시 답할 수 없고 카드는 답과 함께 남는다', () => {
    const { s, first } = inviteWeek();
    store.setState({ state: s });
    const before = intimacy(s, first.npcId);
    expect(store.getState().answerWeekInvite(false)).toEqual(first);
    expect(intimacy(now(), first.npcId), 'week_decline_once').toBe(before - 1);
    expect(store.getState().answerWeekInvite(true), '두 번째 답').toBeNull();
    expect(intimacy(now(), first.npcId)).toBe(before - 1);
    expect(weekInviteFor(now())).toEqual({ invite: first, accepted: false });
  });

  it('week_accept_free: 수락은 친밀도를 건드리지 않고 답만 남긴다', () => {
    const { s, first } = inviteWeek();
    store.setState({ state: s });
    const before = intimacy(s, first.npcId);
    expect(store.getState().answerWeekInvite(true)).toEqual(first);
    expect(intimacy(now(), first.npcId)).toBe(before);
    expect(weekInviteAnswers(now())).toEqual([{ ...first, accepted: true }]);
  });

  it('week_answer_planning_only: 계획 단계가 아니면(결산·사건 중) 답하지 않는다', () => {
    const { s } = inviteWeek();
    store.setState({ state: { ...s, phase: 'result' } });
    expect(store.getState().answerWeekInvite(true)).toBeNull();
    expect(now().weekInviteAnswers).toBeUndefined();
  });

  it('week_answers_last_month: 지난달 답은 안 읽는다 — 다음 달엔 그 달 초대가 새로 뜬다', () => {
    const { s, first } = inviteWeek();
    const stale = { ...s, weekInviteAnswers: { year: s.year, month: getMonthBlock(s.week).index - 1, answers: [{ ...first, accepted: false }] } };
    expect(weekInviteAnswers(stale)).toEqual([]);
    expect(weekInviteFor(stale)).toEqual({ invite: first });
  });
});

describe('주간에서 수락한 약속 — 계획 없이도 지켰는지 따진다', () => {
  function accepted() {
    const { s, first } = inviteWeek();
    const withAnswer = { ...s, weekInviteAnswers: { year: s.year, month: getMonthBlock(s.week).index, answers: [{ ...first, accepted: true }] } };
    const pick = first.slotIdx === 0 ? [first.activityId, 'rest'] : ['rest', first.activityId];
    const map = { [`${first.activityId}:${first.slotIdx}`]: first.npcId };
    return { s: withAnswer, first, pick, map };
  }

  it('week_promise_kept: 그 칸을 그 친구와 하면 📌, 친밀도는 동행 몫뿐', () => {
    const { s, first, pick, map } = accepted();
    const kept = processWeek({ ...s, weekendChoices: pick }, map);
    expect(kept.weekLog!.messages.some(m => m.startsWith('📌')), 'week_promise_kept').toBe(true);
    const control = processWeek({ ...s, weekInviteAnswers: undefined, weekendChoices: pick }, map);
    expect(intimacy(kept, first.npcId)).toBe(intimacy(control, first.npcId));
  });

  it('week_promise_broken: 그 칸을 빼면 💔 −2', () => {
    const { s, first } = accepted();
    const broken = processWeek({ ...s, weekendChoices: ['rest', 'rest'] }, {});
    const control = processWeek({ ...s, weekInviteAnswers: undefined, weekendChoices: ['rest', 'rest'] }, {});
    expect(broken.weekLog!.messages.some(m => m.startsWith('💔')), 'week_promise_broken').toBe(true);
    expect(intimacy(broken, first.npcId)).toBe(intimacy(control, first.npcId) - 2);
  });

  it('week_declined_no_promise: 거절한 초대는 약속이 아니다 — 아무 말도 없다', () => {
    const { s, first } = accepted();
    const declined = { ...s, weekInviteAnswers: { ...s.weekInviteAnswers!, answers: [{ ...first, accepted: false }] } };
    const next = processWeek({ ...declined, weekendChoices: ['rest', 'rest'] }, {});
    expect(next.weekLog!.messages.some(m => m.startsWith('📌') || m.startsWith('💔'))).toBe(false);
  });
});

describe('그 뒤 계획 화면 — 주간에서 답한 주는 그 답으로 고정', () => {
  /** 첫 초대를 주간에서 답한 뒤의 판(같은 주). */
  function afterWeekly(accepted: boolean) {
    const { s, first, second } = inviteWeek();
    store.setState({ state: s });
    store.getState().answerWeekInvite(accepted);
    return { s: now(), first, second };
  }
  /** 받은 초대에 답을 단 계획 — 수락한 초대의 칸을 채운다. */
  function planFor(s: GameState, answers: boolean[]): MonthPlan {
    const block = getMonthBlock(s.week);
    const { invites } = planInvites(s);
    const weeks = Array.from({ length: block.endWeek - s.week + 1 }, (_, i) => s.week + i).map(week => {
      const activities = ['rest', 'rest'];
      const npcChoices: Record<string, string> = {};
      invites.forEach((inv, i) => {
        if (inv.week !== week || !answers[i]) return;
        activities[inv.slotIdx] = inv.activityId;
        npcChoices[`${inv.activityId}:${inv.slotIdx}`] = inv.npcId;
      });
      return { week, activities, npcChoices };
    });
    return { year: s.year, month: block.index, weeks, invites: invites.map((inv, i) => ({ ...inv, accepted: answers[i] })) };
  }

  it('plan_fixed_answer: 계획 화면의 초대 목록에 그 초대가 그 답으로 고정돼 들어온다', () => {
    const { s, first, second } = afterWeekly(false);
    const { invites, fixed } = planInvites(s);
    const i = invites.findIndex(x => x.week === first.week);
    expect(invites[i], 'plan_fixed_answer').toEqual(first);
    expect(fixed[i]).toBe(false);
    expect(second.week, '전제: 둘째 초대는 뒤 주다(주 순 정렬)').toBeGreaterThan(s.week);
    expect(fixed[invites.findIndex(x => x.week === second.week)], '다른 주는 새로 답한다').toBeUndefined();
  });

  it('plan_flip_rejected: 주간에서 거절한 초대를 계획에서 수락으로 뒤집으면 저장하지 않는다', () => {
    const { s, first } = afterWeekly(false);
    const { invites } = planInvites(s);
    const answers = invites.map(inv => inv.week === first.week);
    expect(store.getState().setMonthPlan(planFor(s, answers)), 'plan_flip_rejected').toMatch(/주간 화면에서 답한 초대/);
  });

  it('plan_no_double_penalty: 같은 답으로 저장하면 받아들이고, 주간에서 깎은 −1을 또 깎지 않는다', () => {
    const { s, first } = afterWeekly(false);
    const { invites, fixed } = planInvites(s);
    const answers = invites.map((_, i) => fixed[i] ?? true);
    const before = intimacy(s, first.npcId);
    expect(store.getState().setMonthPlan(planFor(s, answers))).toBeNull();
    expect(intimacy(now(), first.npcId), 'plan_no_double_penalty').toBe(before);
  });

  it('plan_new_decline_penalized: 계획에서 새로 거절한 초대는 지금처럼 −1(양성 짝)', () => {
    const { s, first, second } = afterWeekly(true);
    expect(second.week, '전제: 둘째 초대는 뒤 주다(주 순 정렬)').toBeGreaterThan(s.week);
    const { invites, fixed } = planInvites(s);
    const answers = invites.map((_, i) => fixed[i] ?? false);
    const before = intimacy(s, second.npcId);
    expect(store.getState().setMonthPlan(planFor(s, answers))).toBeNull();
    expect(intimacy(now(), second.npcId)).toBe(before - 1);
    expect(intimacy(now(), first.npcId), '주간에서 수락한 친구는 그대로').toBe(intimacy(s, first.npcId));
  });

  it('answered_once: 계획에 실린 주간 답은 약속 판정에서 한 번만 센다', () => {
    const { s } = afterWeekly(true);
    const { invites, fixed } = planInvites(s);
    expect(store.getState().setMonthPlan(planFor(s, invites.map((_, i) => fixed[i] ?? true)))).toBeNull();
    const all = answeredInvites(now());
    expect(all.length, 'answered_once').toBe(new Set(all.map(a => `${a.npcId}:${a.week}`)).size);
  });
});

describe('3자 검수 후속 — 한 달에 같은 친구는 한 번, 손상된 답은 없는 것으로', () => {
  /** 첫 초대에 주간에서 답한 뒤, 말걸기·선물로 유나가 30에 닿아 후보 목록이 바뀐 판들(둘째 초대 주로 옮김). */
  function candidatesGrew(): { s: GameState; first: MonthInvite }[] {
    const out: { s: GameState; first: MonthInvite }[] = [];
    for (let seed = 0; seed < 600; seed++) {
      const inv = generateMonthInvites(at(5, seed));
      if (inv.length !== 2) continue;
      store.setState({ state: at(inv[0].week, seed) });
      store.getState().answerWeekInvite(false);
      const later = structuredClone({ ...now(), week: inv[1].week }) as GameState;
      later.npcs.find(n => n.id === 'yuna')!.intimacy = 30;
      out.push({ s: later, first: inv[0] });
    }
    return out;
  }

  it('dedupe_friend: 주간에서 답한 친구는 같은 달 다른 주에 다시 초대되지 않는다(주간·계획 경로 둘 다)', () => {
    const cases = candidatesGrew();
    expect(cases.length, '전제: 판이 충분하다').toBeGreaterThan(50);
    // 고치기 전엔 이 판들 중 24%에서 같은 친구가 다시 뽑혔다 — 후보 목록이 바뀌면 NPC 고르기가 다시 돈다.
    const regenerated = cases.filter(({ s, first }) => generateMonthInvites(s).some(g => g.week === s.week && g.npcId === first.npcId));
    expect(regenerated.length, '전제(양성 대조): 생성기만 보면 같은 친구가 다시 나오는 판이 있다').toBeGreaterThan(0);
    for (const { s, first } of regenerated) {
      expect(weekInviteFor(s)?.invite.npcId, 'dedupe_friend: 주간').not.toBe(first.npcId);
      expect(planInvites(s).invites.filter(i => i.npcId === first.npcId).length, 'dedupe_friend: 계획(지난 주 답은 안 싣는다)').toBe(0);
    }
  });

  it('corrupt_answers: 모양이 틀린 원소는 걸러 낸다 — 렌더에서 터지지 않는다', () => {
    const { s, first } = inviteWeek();
    const bad = { ...s, weekInviteAnswers: { year: s.year, month: getMonthBlock(s.week).index, answers: [null, { npcId: 'jihun' }, { ...first, accepted: 'yes' }] } } as unknown as GameState;
    expect(weekInviteAnswers(bad), 'corrupt_answers').toEqual([]);
    expect(weekInviteFor(bad), '답이 없는 것으로 보고 초대를 다시 띄운다').toEqual({ invite: first });
    const ok = { ...s, weekInviteAnswers: { year: s.year, month: getMonthBlock(s.week).index, answers: [null, { ...first, accepted: false }] } } as unknown as GameState;
    expect(weekInviteAnswers(ok), '멀쩡한 원소는 남긴다(양성 짝)').toEqual([{ ...first, accepted: false }]);
  });
});
