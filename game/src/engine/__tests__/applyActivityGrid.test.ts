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
const PRIOR: (Partial<Record<StatKey, number>> | null)[] = [null, { academic: 1, talent: 1, social: 1, health: 1 }, { academic: 2.5, talent: 2.5, social: 2.5, health: 2.5 }];

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
          prior: PRIOR[i % PRIOR.length],
          buff: (i % 9) === 0,
          idle: (i % 4) === 0 ? 3 : 0,
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
  for (const c of cases()) {
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
    const log = freshLog(c.prior);
    applyActivity(s, c.act.id, log, c.routineBonus, c.efficiency, c.prepaid);
    n++;
    h.update(JSON.stringify({
      id: c.act.id, stats: s.stats, fatigue: s.fatigue, money: s.money, log, vac: s.vacationActivityCounts ?? null,
      pi: s.parentIntimacy, acted: s.actedWithParentThisWeek ?? null, spent: s.moneySpentByYear ?? null,
    }));
    // 가지가 실제로 지나갔는지 — 0이면 그 가지는 이 격자로 잠기지 않는 것이다.
    if (c.mind === 'burnout') hit('burnout');
    if (c.mind === 'tired' && c.ctw >= 16) hit('chronic-tired');
    if (c.health < 20 && c.act.fatigue > 0) hit('low-health-fatigue');
    if (c.vacation && c.act.catchupBonus) hit('catchup-candidate');
    if (c.level >= 80 && !c.prepaid) hit('softcap-zone');
    if (c.prior && Object.values(c.prior)[0]! > 2) hit('weekly-cap-zone');
    if (c.parents.includes('resilience') && c.act.fatigue > 0) hit('resilience-fatigue');
    if (c.idle >= 3 && c.act.category === 'rest') hit('idle-rest');
    if (c.act.parentEffect) hit('parent-effect');
    if (c.act.id === 'family-dinner' && c.intimacy >= 60) hit('family-dinner-bonus');
  }
  return { digest: h.digest('hex').slice(0, 32), n, hits };
}

// 착지값 — 단계 분해 **전** main(07fdaff)의 applyActivity로 계산했다. 분해 뒤 코드가 같은 값을 낸다.
const EXPECTED = { digest: '4b6c10c946be37154cf5818f456df691', n: 2460 };

describe('applyActivity 입력 격자 지문', () => {
  const r = runGrid();
  it('격자가 위험한 가지를 전부 지난다', () => {
    for (const k of ['burnout', 'chronic-tired', 'low-health-fatigue', 'catchup-candidate', 'softcap-zone', 'weekly-cap-zone',
      'resilience-fatigue', 'idle-rest', 'parent-effect', 'family-dinner-bonus']) {
      expect(r.hits[k] ?? 0, k).toBeGreaterThan(0);
    }
  });
  it('지문이 고정값과 같다', () => {
    expect(r.n).toBe(EXPECTED.n);
    expect(r.digest).toBe(EXPECTED.digest);
  });
});
