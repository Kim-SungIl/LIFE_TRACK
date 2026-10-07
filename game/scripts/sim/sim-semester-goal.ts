/**
 * T68 학기 목표 — **도달 가능성** 실측 (픽 가능성 말고).
 *
 * "목표를 고를 수 있다"만 재면 실플레이에서 영영 못 채우는 목표도 초록이다(#409 교훈). 그래서
 * 제품과 같은 엔진(processWeek)과 같은 판정 함수(semesterGoal.ts)로 7년을 끝까지 돌리고,
 * 학기마다 목표를 실제로 골라 **판정 기록(semesterGoalLog)의 결과**를 센다.
 *
 * 정책 셋:
 *   · pursue      — 학기 첫 주에 고르고, 주말 첫 칸을 목표 활동(무료)으로 바꾼다. 나머지 칸은 루틴 그대로.
 *   · pursue-late — 고를 수 있는 **마지막 주**(학기 8주차)에 고른다. 남은 주가 가장 적은 최악의 경우.
 *   · ignore      — 고르기만 하고 계획은 안 바꾼다. 목표가 '저절로' 채워지는 비율(=목표가 무의미한 정도).
 *
 * 제품 UI가 막는 것은 하네스도 막는다: 주말 활동은 `getAvailableActivities`로 고를 수 있는 것만,
 * 동행 친구는 `offerSemesterGoals`가 준 후보(동행 후보와 같은 조건)만 쓴다.
 * 학년 전환은 하네스가 대신한다(year-end → 다음 학년), 이벤트는 첫 선택지로 해결한다
 * (하네스는 학년을 스스로 못 넘긴다 — phase가 event/result면 advanceWeek이 멈춘다).
 *
 * 실행: npx tsx scripts/sim/sim-semester-goal.ts [시드수=8]
 */
import { createInitialState, processWeek, getWeekInfo } from '../../src/engine/gameEngine';
import { getAvailableActivities } from '../../src/engine/activities';
import { resolveEventLikeStore } from '../lib/y1-sim-resolve';
import { SIM_ROUTINES, assertRoutineIds, type Routine } from '../lib/sim-routines';
import {
  GOAL_FREE_ACTIVITY, GOAL_PICK_WINDOW, SEMESTER_BOUNDS, offerSemesterGoals, pickSemesterGoal, type GoalOffer,
} from '../../src/engine/semesterGoal';
import type { GameState, SemesterGoalKind, SemesterGoalRecord } from '../../src/engine/types';

type Policy = 'pursue' | 'pursue-late' | 'ignore';
const KINDS: SemesterGoalKind[] = ['exercise', 'study', 'craft', 'friend'];

export interface RunResult {
  records: SemesterGoalRecord[];
  unoffered: number;      // 그 학기에 이 종류가 후보에 없었다(친구 후보 없음 등)
  finalStats: GameState['stats'];
  eventIds: string[];
}

function pickWeekFor(policy: Policy, semester: 1 | 2): number {
  const start = SEMESTER_BOUNDS[semester].start;
  return policy === 'pursue-late' ? start + GOAL_PICK_WINDOW - 1 : start;
}

/** 한 판을 끝까지. kind=null이면 목표를 아예 안 고른다(불변식 대조군). */
export function runOne(r: Routine, seed: number, kind: SemesterGoalKind | null, policy: Policy): RunResult {
  let s = createInitialState('male', r.parents, { rngSeed: seed });
  s.routineSlot2 = r.slot2;
  s.routineSlot3 = r.slot3;
  let unoffered = 0;
  let guardWeeks = 0;
  while (s.phase !== 'ending' && guardWeeks++ < 420) {
    s.phase = 'weekday';
    const wi = getWeekInfo(s.week);
    // ── 고르기 ──
    if (kind && !wi.isVacation && s.week === pickWeekFor(policy, wi.semester)) {
      const offer = offerSemesterGoals(s).find(o => o.kind === kind);
      if (offer) pickSemesterGoal(s, offer as GoalOffer);
      else unoffered++;
    }
    // ── 계획 ──
    const pickable = new Set(getAvailableActivities(s).map(a => a.id));
    const ui = (id: string, fb: string) => (pickable.has(id) ? id : fb);
    let weekend = r.weekend.map(id => ui(id, 'self-study'));
    let map: Record<string, string> | undefined;
    const g = s.semesterGoal;
    const pursuing = policy !== 'ignore' && g && g.year === s.year && !wi.isVacation;
    if (pursuing && g) {
      if (g.kind === 'friend') {
        weekend = ['club', weekend[1] ?? 'rest'];
        map = { 'club:0': g.npcId! };
      } else {
        weekend = [GOAL_FREE_ACTIVITY[g.kind], weekend[1] ?? 'rest'];
      }
      weekend = weekend.map(id => ui(id, 'rest'));
    }
    s.weekendChoices = weekend;
    s.vacationChoices = r.vacation.map(id => ui(id, 'rest'));
    s = processWeek(s, map);
    let guard = 0;
    while (s.currentEvent && guard++ < 20) s = resolveEventLikeStore(s, 0);
    // 제품의 advanceFromYearEnd와 같은 한 걸음 — 학기/방학 상태까지 갱신해야 한다(안 하면 W1이
    // 직전 W48의 '방학'으로 남아 학기 첫 주 고르기가 통째로 빠진다 — 첫 실측에서 14학기 중 6이 사라졌다).
    if (s.phase === 'year-end') {
      s.week = 1; s.year++; s.phase = 'weekday';
      const wi = getWeekInfo(1); s.semester = wi.semester; s.isVacation = wi.isVacation;
    }
  }
  return {
    records: s.semesterGoalLog ?? [],
    unoffered,
    finalStats: s.stats,
    eventIds: s.events.map(e => `${e.year}:${e.week}:${e.id}:${e.resolvedChoice}`),
  };
}

function main() {
  assertRoutineIds();
  const seeds = Number(process.argv[2]) || 8;
  // ── 불변식: 같은 계획이면 목표 유무와 무관하게 같은 판(스탯·사건 열) ──
  let diverged = 0;
  for (const r of SIM_ROUTINES) {
    for (let i = 0; i < Math.min(seeds, 3); i++) {
      const a = runOne(r, 1000 + i * 7919, null, 'ignore');
      for (const kind of KINDS) {
        const b = runOne(r, 1000 + i * 7919, kind, 'ignore');
        if (JSON.stringify(a.finalStats) !== JSON.stringify(b.finalStats)
          || JSON.stringify(a.eventIds) !== JSON.stringify(b.eventIds)) diverged++;
      }
    }
  }
  console.log(`불변식(목표 없음 vs 고르기만 함, 같은 계획): 갈린 판 ${diverged}건\n`);
  if (diverged > 0) process.exitCode = 1;
  console.log(`# T68 학기 목표 도달성 — 루틴 ${SIM_ROUTINES.length}종 × 시드 ${seeds} × 학기 14\n`);
  for (const policy of ['pursue', 'pursue-late', 'ignore'] as Policy[]) {
    console.log(`## 정책: ${policy}`);
    console.log('| 목표 | 판정 학기 | 해냈다 | 몇 번은 | 잊음 | 접음 | 후보 없음 |');
    console.log('|---|---|---|---|---|---|---|');
    for (const kind of KINDS) {
      const tally = { achieved: 0, partial: 0, missed: 0, lapsed: 0 };
      let unoffered = 0;
      for (const r of SIM_ROUTINES) {
        for (let i = 0; i < seeds; i++) {
          const res = runOne(r, 1000 + i * 7919, kind, policy);
          for (const rec of res.records) tally[rec.outcome]++;
          unoffered += res.unoffered;
        }
      }
      const total = tally.achieved + tally.partial + tally.missed + tally.lapsed;
      const pct = (n: number) => (total ? `${((n / total) * 100).toFixed(1)}%` : '-');
      console.log(`| ${kind} | ${total} | ${pct(tally.achieved)} | ${pct(tally.partial)} | ${pct(tally.missed)} | ${pct(tally.lapsed)} | ${unoffered} |`);
    }
    console.log('');
  }
}

if (process.argv[1] && import.meta.url === (await import('url')).pathToFileURL(process.argv[1]).href) {
  main();
}
