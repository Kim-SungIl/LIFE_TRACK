// 친구 초대(약속) — 월 계획 화면을 열면 친구가 그 달의 특정 주 칸에 같이 하자고 0~2개 제안한다.
// 설계: docs/monthly-plan-design-2026-10.md §6, 수치는 디렉터 결정(2026-10-25):
//   · 수락 → 그 칸이 약속으로 고정되고 동행이 붙는다. 친밀도는 동행 경로 그대로(+3, 80 소프트캡) — 추가 없음.
//   · 거절 → 계획을 저장할 때 친밀도 −1(한 번).
//   · 수락했는데 그 주에 그 칸을 못 하면(이벤트 시간 소모로 잘림·돈 부족·플레이어가 뺌) 그 주 처리 때 −2.
//   · 한 달 0~2개, 친밀도 30 이상이고 같은 학교에 다니는(재학) 친구만.
//
// **생성은 결정론적 순수 함수다.** 게임 난수(rngSeed)를 **읽기만** 하고 전진시키지 않는다 — 같은 상태면 새로고침해도
// 같은 초대가 나오고, 다른 결과(사건 선택 등)가 흔들리지 않는다. 그래서 상태에 "받은 초대"를 따로 저장하지 않고,
// 답만 계획(MonthPlan.invites)에 남긴다. 저장할 때 엔진이 같은 함수로 다시 만들어 대조한다(지어낸 초대 거부).
import { getExamSchedule, isExamPeriod } from './examSystem';
import { josa } from './korean';
import { inviteVoice } from './talkData/inviteVoices';
import { getCurrentMonthPlan } from './monthPlan';
import { isNpcEnrolled } from './relationshipSignals';
import { getMonthBlock, getWeekInfo } from './weekMath';
import type { ActivityInstance } from './activities';
import type { GameState, MonthInvite, MonthPlan, WeekLog } from './types';

/** 초대할 수 있는 친밀도 하한(포함). */
export const INVITE_MIN_INTIMACY = 30;
/** 한 달에 받는 초대 상한. */
export const MAX_INVITES_PER_MONTH = 2;
/** 거절했을 때 친밀도 변화. */
export const INVITE_DECLINE_PENALTY = -1;
/** 수락하고 못 지켰을 때 친밀도 변화. */
export const PROMISE_BROKEN_PENALTY = -2;

/** 32비트 FNV-1a — 결정론적 해시(난수 상태를 건드리지 않는다). */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 지금 달의 남은 주에 대한 초대 0~2개. 지금 주가 달이 아니거나(W49) 후보가 없으면 []. */
export function generateMonthInvites(state: GameState): MonthInvite[] {
  if (state.week < 1 || state.week > 48) return [];
  const block = getMonthBlock(state.week);
  const weeks = Array.from({ length: block.endWeek - state.week + 1 }, (_, i) => state.week + i);
  const candidates = state.npcs
    .filter(n => n.met && n.intimacy >= INVITE_MIN_INTIMACY && isNpcEnrolled(n, state))
    .map(n => n.id)
    .sort();
  if (candidates.length === 0) return [];

  const seed = fnv1a(`${state.year}:${block.index}:${state.week}:${state.rngSeed}`);
  const count = Math.min(seed % (MAX_INVITES_PER_MONTH + 1), candidates.length, weeks.length);
  const invites: MonthInvite[] = [];
  const usedNpc = new Set<string>();
  const usedWeek = new Set<number>();
  for (let i = 0; i < count; i++) {
    const h = fnv1a(`${seed}:${i}`);
    let npcIdx = h % candidates.length;
    while (usedNpc.has(candidates[npcIdx])) npcIdx = (npcIdx + 1) % candidates.length;
    let weekIdx = (h >>> 8) % weeks.length;
    while (usedWeek.has(weeks[weekIdx])) weekIdx = (weekIdx + 1) % weeks.length;
    const week = weeks[weekIdx];
    const vacation = getWeekInfo(week).isVacation;
    const examWeek = !vacation && (isExamPeriod(state.year, week) || !!getExamSchedule(state.year)[week]);
    usedNpc.add(candidates[npcIdx]);
    usedWeek.add(week);
    invites.push({
      npcId: candidates[npcIdx],
      week,
      slotIdx: vacation ? 0 : (h >>> 16) % 2,
      // 시험 주(와 준비 주)엔 같이 공부하자고 한다 — 둘 다 동행 활동이다(NPC_COMPANION_ACTIVITIES).
      activityId: examWeek ? 'study-group' : 'hang-out',
    });
  }
  return invites.sort((a, b) => a.week - b.week);
}

const sameInvite = (a: MonthInvite, b: MonthInvite) =>
  a.npcId === b.npcId && a.week === b.week && a.slotIdx === b.slotIdx && a.activityId === b.activityId;

/**
 * 계획의 초대 답이 맞는지 — null이면 통과. store.setMonthPlan이 부른다.
 *   · 처음 짤 때: 받은 초대(같은 함수로 다시 만든 것)마다 정확히 한 번 답해야 한다. 지어낸 초대는 거부.
 *   · 달 중간에 다시 짤 때(`existing` = 지금 달 계획): 초대는 처음 받은 그대로다 — 새로 받지 않고 답도 못 바꾼다.
 *     다시 만들면 주·난수가 바뀌어 다른 초대가 나오고, 거절을 수락으로 뒤집으면 −1만 내고 빠져나간다.
 *   · 수락한 초대는 (아직 안 지난 주라면) 그 주 그 칸에 그 활동이 있고 그 친구가 동행이어야 한다.
 */
export function validateInviteAnswers(
  state: GameState,
  plan: { weeks: { week: number; activities: string[]; npcChoices: Record<string, string> }[]; invites?: (MonthInvite & { accepted: boolean })[] },
  existing: MonthPlan | null = getCurrentMonthPlan(state),
): string | null {
  const answers = plan.invites ?? [];
  if (existing) {
    const before = existing.invites ?? [];
    if (answers.length !== before.length || !before.every(b => answers.some(a => sameInvite(a, b) && a.accepted === b.accepted))) {
      return '다시 짠 계획의 초대 답이 처음과 다르다';
    }
  } else {
    const expected = generateMonthInvites(state);
    if (answers.length !== expected.length || !expected.every(e => answers.some(a => sameInvite(a, e)))) {
      return `초대 답이 받은 초대와 맞지 않는다 — 받은 ${expected.length}개, 답 ${answers.length}개`;
    }
  }
  for (const a of answers) {
    if (!a.accepted || a.week < state.week) continue;
    const w = plan.weeks.find(x => x.week === a.week);
    if (!w || w.activities[a.slotIdx] !== a.activityId || w.npcChoices[`${a.activityId}:${a.slotIdx}`] !== a.npcId) {
      return `W${a.week}: 수락한 초대(${a.npcId})의 칸이 계획에 없다`;
    }
  }
  return null;
}

/** 거절한 초대마다 친밀도 −1 — 계획을 저장할 때 한 번(store.setMonthPlan). 반환 = 적용한 NPC id들. */
export function applyDeclinedInvites(state: GameState, answers: readonly (MonthInvite & { accepted: boolean })[]): string[] {
  const hit: string[] = [];
  for (const a of answers) {
    if (a.accepted) continue;
    const npc = state.npcs.find(n => n.id === a.npcId);
    if (!npc) continue;
    npc.intimacy = Math.max(0, npc.intimacy + INVITE_DECLINE_PENALTY);
    hit.push(npc.id);
  }
  return hit;
}

/**
 * 이 주에 약속이 있었으면 지켰는지 본다 — processWeek가 주말(방학) 활동을 적용한 직후 부른다.
 * 지켰다 = 그 칸의 그 활동이 실제로 실행됐고(`applied`) 그 친구가 동행이었다. 못 지켰으면 친밀도 −2와 한 줄.
 * 지킨 주의 친밀도는 동행 경로(+3)가 이미 줬으니 여기서는 문장만 남긴다.
 *
 * **못 지킨 약속의 결과는 정확히 −2다(디렉터 결정 2026-10-26).** 동행 +3은 활동이 실행됐는지와 무관하게 동행 맵만
 * 보고 먼저 들어간다 — 그래서 친구가 맵에 남은 채 칸이 잘리면(timeCost·돈) 예전엔 +3 −2 = +1이었다(3자 검수).
 * 그 약속 칸 키로 오른 몫(`companionGained`, 소프트캡 뒤 실제 상승분)을 먼저 되돌리고 −2를 적용한다.
 */
export function settlePromisesForWeek(
  state: GameState, log: WeekLog, applied: readonly ActivityInstance[], npcActivityMap?: Record<string, string>,
  companionGained: Record<string, number> = {},
): void {
  const plan = getCurrentMonthPlan(state);
  if (!plan?.invites) return;
  for (const inv of plan.invites) {
    if (!inv.accepted || inv.week !== state.week) continue;
    const npc = state.npcs.find(n => n.id === inv.npcId);
    if (!npc) continue;
    const key = `${inv.activityId}:${inv.slotIdx}`;
    const ran = applied.some(inst => inst.id === inv.activityId && inst.slots.includes(inv.slotIdx));
    const together = npcActivityMap?.[key] === inv.npcId;
    (log.promises ??= []).push({ npcId: npc.id, kept: ran && together });
    if (ran && together) {
      log.messages.push(`📌 ${josa(npc.name, '와/과')} 한 약속을 지켰다. ${inviteVoice(npc.id).kept}`);
    } else {
      // 만나지 못한 동행 몫은 없던 일이다 — 이 약속 칸 키로 오른 만큼 되돌린 뒤 −2.
      const undo = together ? (companionGained[key] ?? 0) : 0;
      npc.intimacy = Math.max(0, npc.intimacy - undo + PROMISE_BROKEN_PENALTY);
      log.messages.push(`💔 ${josa(npc.name, '와/과')} 한 약속을 못 지켰다. ${inviteVoice(npc.id).broken}`);
    }
  }
}
