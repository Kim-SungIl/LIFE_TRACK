// applyActivity 입력 격자 지문 — 활동 한 번의 적용 결과를 넓은 입력 격자에서 바이트로 고정한다.
//
// 주간 골든(weeklyDriverGolden)은 정해진 페르소나 6판만 돈다. 번아웃·만성 tired·체력<20·무료 소프트캡·방학 따라잡기·
// 동일 축 중복·주당 상한 같은 가지를 그 6판이 지나는지는 보장이 없다(2026-10 리팩토링 점검). applyActivity를 단계
// 함수로 쪼개는 동안 동작이 그대로인지 보려면 그 가지들을 **직접** 지나는 그물이 필요하다 — 이 파일이 그 그물이다.
// 격자는 결정론적으로 고른다(난수 없음). 지문이 바뀌면 applyActivity의 동작이 바뀐 것이다: 의도된 변경이면
// 원인 귀속을 적고 EXPECTED를 갈아 끼울 것.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { applyActivity, createInitialState } from '../gameEngine';
import { ACTIVITIES } from '../activities';
import type { GameState, ParentStrength, StatKey, WeekLog } from '../types';

const STAT_KEYS: StatKey[] = ['academic', 'social', 'talent', 'mental', 'health'];
// 경계값을 일부러 넣는다 — 방학 따라잡기 발동선(초 25·중 35), 무료 소프트캡(80) 바로 아래·위.
const LEVELS = [5, 24, 25, 34, 35, 45, 79, 80, 86, 99];
const FATIGUES = [0, 55, 92];
// 연속 tired 주수 경계(10·16) 양쪽.
const MINDS: [GameState['mentalState'], number][] = [['normal', 0], ['tired', 9], ['tired', 10], ['tired', 15], ['tired', 16], ['burnout', 0]];
const HEALTHS = [15, 25, 45, 70];
const PARENTS: [ParentStrength, ParentStrength][] = [['info', 'wealth'], ['resilience', 'strict'], ['emotional', 'freedom']];
const YEARS = [1, 4, 7];
// 그 주에 이미 오른 양 — 동일 축 중복 문턱(0.5·2)과 주당 상한(2)의 양쪽.
const PRIOR_GAINS = [0, 0.5, 0.51, 1, 2, 2.01, 2.5];
const prior = (g: number): Partial<Record<StatKey, number>> | null => g === 0 ? null : { academic: g, talent: g, social: g, health: g };

function freshLog(prior: Partial<Record<StatKey, number>> | null): WeekLog {
  return {
    statChanges: { ...(prior ?? {}) }, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [], milestoneMessages: [],
    parentBonusesApplied: [],
  } as unknown as WeekLog;
}

function* cases() {
  let i = 0;
  for (const act of ACTIVITIES) {
    for (const level of LEVELS) {
      for (const [mind, ctw] of MINDS) {
        // 나머지 축은 i로 돌려 조합을 고루 섞는다(전 곱은 수백만 칸이라 격자를 대각선으로 훑는다).
        i++;
        yield {
          act, level, mind, ctw,
          fatigue: FATIGUES[i % FATIGUES.length],
          health: HEALTHS[(i >> 1) % HEALTHS.length],
          parents: PARENTS[(i >> 2) % PARENTS.length],
          year: YEARS[(i >> 3) % YEARS.length],
          vacation: (i % 5) < 2,
          routineBonus: (i % 7) === 0 ? 0.15 : 0,
          efficiency: (i % 11) === 0 ? 0.5 : 1,
          prepaid: (i % 13) === 0,
          prior: prior(PRIOR_GAINS[i % PRIOR_GAINS.length]),
          buff: (i % 9) === 0,
          idle: [0, 2, 3][i % 3],   // 무기력 휴식 문턱(3) 양쪽
          intimacy: [40, 59, 60, 70][i % 4],   // 가족 저녁 보너스 문턱(60) 양쪽
          money: (i % 6) === 0 ? 0 : 300,
        };
      }
    }
  }
}

function runGrid(): { digest: string; n: number; hits: Record<string, number> } {
  const h = createHash('sha256');
  let n = 0;
  const hits: Record<string, number> = {};
  const hit = (k: string) => { hits[k] = (hits[k] ?? 0) + 1; };
  type Case = ReturnType<typeof cases> extends Generator<infer T> ? T : never;
  const build = (c: Case): GameState => {
    const s = createInitialState('male', c.parents, { rngSeed: 7 });
    for (const k of STAT_KEYS) s.stats[k] = c.level;
    s.stats.health = c.health;
    s.fatigue = c.fatigue;
    s.mentalState = c.mind;
    s.consecutiveTiredWeeks = c.ctw;
    s.year = c.year;
    s.isVacation = c.vacation;
    s.idleWeeks = c.idle;
    s.parentIntimacy = c.intimacy;
    s.money = c.money;
    s.activeBuffs = c.buff ? [{ id: 'b', name: 'b', target: 'all', amount: 0.1, remainingWeeks: 2 }] : [];
    return s;
  };
  const run = (c: Case, tweak?: (s: GameState) => void) => {
    const s = build(c);
    tweak?.(s);
    const log = freshLog(c.prior);
    applyActivity(s, c.act.id, log, c.routineBonus, c.efficiency, c.prepaid);
    return { s, log };
  };
  for (const c of cases()) {
    const { s, log } = run(c);
    n++;
    // 상태 **전체**와 로그를 지문에 넣는다 — 고른 칸만 넣으면 그 밖의 칸에 생긴 변화를 놓친다.
    h.update(JSON.stringify({ id: c.act.id, state: s, log }));

    // 가지가 **실제로 실행됐는지**를 결과로 잰다 — 입력이 후보인지만 세면 가지를 지워도 초록이다(3자 검수).
    // (a) 성장 장부가 손실 요인을 적은 가지, (b) 그 가지의 조건만 끄고 다시 돌려 결과가 달라지는 가지.
    const drag = log.growthLedger?.drag ?? {};
    if (drag.crowded) hit('crowded');
    if (drag.freeCeiling) hit('free-softcap');
    if (drag.weeklyCap) hit('weekly-cap');
    const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
    if (c.mind === 'burnout' && differs(s.stats, run(c, x => { x.mentalState = 'normal'; }).s.stats)) hit('burnout');
    if (c.mind === 'tired' && c.ctw >= 16 && differs(s.stats, run(c, x => { x.consecutiveTiredWeeks = 15; }).s.stats)) hit('chronic-tired');
    if (c.health < 20 && differs(s.fatigue, run(c, x => { x.stats.health = 20; }).s.fatigue)) hit('low-health-fatigue');
    if (c.vacation && c.act.catchupBonus && differs(s.stats, run(c, x => { x.isVacation = false; }).s.stats)) hit('catchup');
    if (c.idle >= 3 && differs(s.stats.mental, run(c, x => { x.idleWeeks = 2; }).s.stats.mental)) hit('idle-rest');
    if (c.parents.includes('resilience') && differs(s.fatigue, run(c, x => { x.parents = ['info', 'wealth']; }).s.fatigue)) hit('resilience-fatigue');
    if (log.parentEffectAppliedIds?.includes(c.act.id)) hit('parent-effect');
    if (c.act.id === 'family-dinner' && differs(s.stats.mental, run(c, x => { x.parentIntimacy = 40; }).s.stats.mental)) hit('family-dinner-bonus');
  }
  return { digest: h.digest('hex').slice(0, 32), n, hits };
}

// 착지값 — 단계 분해 **전** main(07fdaff)의 applyActivity로 계산했다. 분해 뒤 코드가 같은 값을 낸다.
const EXPECTED = { digest: '67ed8ef1bf1b724c5222b17d9a986645', n: 2460 };

describe('applyActivity 입력 격자 지문', () => {
  const r = runGrid();
  it('격자가 위험한 가지를 전부 실제로 실행한다(결과로 판정)', () => {
    for (const k of ['crowded', 'free-softcap', 'weekly-cap', 'burnout', 'chronic-tired', 'low-health-fatigue', 'catchup',
      'idle-rest', 'resilience-fatigue', 'parent-effect', 'family-dinner-bonus']) {
      expect(r.hits[k] ?? 0, k).toBeGreaterThan(0);
    }
  });
  it('지문이 고정값과 같다', () => {
    expect(r.n).toBe(EXPECTED.n);
    expect(r.digest).toBe(EXPECTED.digest);
  });
});
