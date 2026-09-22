// 활동 게이트 SSOT — passesActivityGates / getAvailableActivities / canApplyActivity /
// isVacationLimitReached / collapseActivityChoices 순수 계약.
// 전역 ACTIVITIES만 읽으므로 리터럴 Activity 주입 금지 — 데이터에서 조건으로 파생.
import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  canApplyActivity,
  collapseActivityChoices,
  FINAL_YEAR,
  getActivityCost,
  getAvailableActivities,
  isVacationLimitReached,
  NPC_COMPANION_ACTIVITIES,
  POST_SUNEUNG_WEEK,
} from '../activities';
import { getExamSchedule } from '../examSystem';
import { canBuyItem, limitKey, SHOP_ITEMS } from '../shopSystem';
import type { Activity } from '../types';
import { makeState } from '../../test/fixtures';

// unlockYear를 가진 활동 **전수**. 하드코딩 목록이면 새 활동이 조용히 무검사가 된다 —
// 실제로 그랬다: 목록은 6개였는데 데이터에는 9개였고(private-tutoring·part-time·short-term-job
// 누락) 아무도 몰랐다. 데이터에서 파생하면 활동을 추가하는 것만으로 검사 대상이 된다.
const UNLOCK_ACTIVITIES = ACTIVITIES.filter(a => a.unlockYear !== undefined);

/** corpus 퇴화 방지 — 필터가 0건이 되면 아래 for문이 전부 공허하게 통과한다. */
const UNLOCK_FLOOR = 12;

/**
 * 나머지 게이트(방학·돈)를 전부 열어 준 상태. 학년·주차만 바꿔 가며 해금 경계를 본다.
 * `isVacation`을 활동의 seasonGate에 맞추는 이유: vacation-only 활동은 방학이 아니면
 * 학년과 무관하게 빠지므로, 그대로 두면 "해금됐다"를 영영 관측할 수 없다.
 */
function openStateFor(a: Activity, year: number, week: number) {
  return makeState({ year, week, money: 9999, isVacation: a.seasonGate === 'vacation-only' });
}

/** 그 학년에서 활동이 열리는 가장 이른 주차. 없으면 null(= 그 학년엔 안 열린다). */
function earliestOpenWeek(a: Activity, year: number): number | null {
  for (let week = 1; week <= 48; week++) {
    if (canApplyActivity(openStateFor(a, year, week), a.id)) return week;
  }
  return null;
}

function pickActivity(pred: (a: Activity) => boolean, why: string): Activity {
  const found = ACTIVITIES.find(pred);
  if (!found) throw new Error(why);
  return found;
}

describe('getAvailableActivities — work 학년 게이트', () => {
  const work = pickActivity(a => a.category === 'work', 'work 카테고리 활동 없음');

  it('year 3에서는 work가 목록에 없고 year 4에서는 있다 (경계 양방향)', () => {
    const y3 = getAvailableActivities(makeState({ year: 3, money: 999, isVacation: false }));
    const y4 = getAvailableActivities(makeState({ year: 4, money: 999, isVacation: false }));
    expect(y3.some(a => a.id === work.id)).toBe(false);
    expect(y4.some(a => a.id === work.id)).toBe(true);
  });
});

describe('getAvailableActivities — seasonGate', () => {
  const vacationOnly = pickActivity(
    a => a.seasonGate === 'vacation-only',
    'vacation-only 활동 없음',
  );

  it('vacation-only는 학기 중(false)에 빠지고 방학(true)에 나온다', () => {
    const semester = getAvailableActivities(makeState({ isVacation: false, money: 999, year: 4 }));
    const vacation = getAvailableActivities(makeState({ isVacation: true, money: 999, year: 4 }));
    expect(semester.some(a => a.id === vacationOnly.id)).toBe(false);
    expect(vacation.some(a => a.id === vacationOnly.id)).toBe(true);
  });

  it('semester-only는 방학에 빠지고 학기 중에 나온다 (데이터에 있을 때)', () => {
    const semesterOnly = ACTIVITIES.find(a => a.seasonGate === 'semester-only');
    if (!semesterOnly) {
      // 관측 불가 — ACTIVITIES에 semester-only 활동이 없어 게이트 분기를 데이터로 잠글 수 없음.
      // (소스에는 분기가 있으나 현재 카탈로그에 해당 seasonGate 없음)
      expect(ACTIVITIES.every(a => a.seasonGate !== 'semester-only')).toBe(true);
      return;
    }
    const semester = getAvailableActivities(makeState({ isVacation: false, money: 999, year: 4 }));
    const vacation = getAvailableActivities(makeState({ isVacation: true, money: 999, year: 4 }));
    expect(semester.some(a => a.id === semesterOnly.id)).toBe(true);
    expect(vacation.some(a => a.id === semesterOnly.id)).toBe(false);
  });
});

describe('getAvailableActivities — requires', () => {
  it('requires가 false면 빠지고 충족하면 나온다 (양성 짝)', () => {
    // emotional 전용 parent 활동 — 부모 구성만 바꿔 requires 진위를 분리
    const gated = pickActivity(
      a => typeof a.requires === 'function'
        && a.requires(makeState({ parents: ['emotional', 'info'], money: 999 }))
        && !a.requires(makeState({ parents: ['strict', 'info'], money: 999 })),
      '부모 구성으로 requires가 갈리는 활동 없음',
    );
    const ok = getAvailableActivities(makeState({ parents: ['emotional', 'info'], money: 999 }));
    const no = getAvailableActivities(makeState({ parents: ['strict', 'info'], money: 999 }));
    expect(ok.some(a => a.id === gated.id)).toBe(true);
    expect(no.some(a => a.id === gated.id)).toBe(false);
  });
});

describe('목록 vs 적용 — vacationLimit 의도적 차이', () => {
  it('한도 도달 활동은 getAvailableActivities에 남지만 canApplyActivity는 false', () => {
    const limited = pickActivity(
      a => a.seasonGate === 'vacation-only' && typeof a.vacationLimit === 'number' && a.vacationLimit >= 1,
      'vacationLimit 있는 vacation-only 활동 없음',
    );
    const limit = limited.vacationLimit!;
    const state = makeState({
      isVacation: true,
      money: 999,
      year: 4,
      vacationActivityCounts: { [limited.id]: limit },
    });
    // 목록에는 남김(UI 비활성 표시용)
    expect(getAvailableActivities(state).some(a => a.id === limited.id)).toBe(true);
    // 엔진 적용은 거부
    expect(canApplyActivity(state, limited.id)).toBe(false);
    // 양성: 한도 미만이면 둘 다 통과
    const under = makeState({
      isVacation: true,
      money: 999,
      year: 4,
      vacationActivityCounts: { [limited.id]: limit - 1 },
    });
    expect(getAvailableActivities(under).some(a => a.id === limited.id)).toBe(true);
    expect(canApplyActivity(under, limited.id)).toBe(true);
  });
});

describe('canApplyActivity', () => {
  it('미등록 id는 false', () => {
    expect(canApplyActivity(makeState(), '없는-id')).toBe(false);
  });

  it('getAvailableActivities에 없는 활동은 canApplyActivity도 false (단방향)', () => {
    const state = makeState({ year: 1, isVacation: false, money: 0, parents: ['strict', 'info'] });
    const availableIds = new Set(getAvailableActivities(state).map(a => a.id));
    for (const a of ACTIVITIES) {
      if (!availableIds.has(a.id)) {
        expect(canApplyActivity(state, a.id)).toBe(false);
      }
    }
  });
});

describe('isVacationLimitReached', () => {
  it('vacationLimit이 없는 활동은 항상 false', () => {
    const unlimited = pickActivity(
      a => a.vacationLimit == null,
      'vacationLimit 없는 활동 없음',
    );
    const state = makeState({
      isVacation: true,
      vacationActivityCounts: { [unlimited.id]: 99 },
    });
    expect(isVacationLimitReached(unlimited, state)).toBe(false);
    expect(isVacationLimitReached(unlimited, state, 99)).toBe(false);
  });

  it('isVacation=false면 카운트와 무관하게 항상 false', () => {
    const limited = pickActivity(
      a => typeof a.vacationLimit === 'number' && a.vacationLimit >= 1,
      'vacationLimit 활동 없음',
    );
    const state = makeState({
      isVacation: false,
      vacationActivityCounts: { [limited.id]: limited.vacationLimit! },
    });
    expect(isVacationLimitReached(limited, state)).toBe(false);
    expect(isVacationLimitReached(limited, state, limited.vacationLimit!)).toBe(false);
  });

  it('used = counts + pendingUse가 limit에 도달하면 true (경계 양방향, pendingUse 기본 0)', () => {
    const limited = pickActivity(
      a => a.vacationLimit === 2,
      'vacationLimit===2 활동 없음',
    );
    const limit = limited.vacationLimit!;
    const vac = (counts: Record<string, number>, pending?: number) =>
      isVacationLimitReached(
        limited,
        makeState({ isVacation: true, vacationActivityCounts: counts }),
        pending,
      );

    // pendingUse 기본 0 — counts만으로 경계
    expect(vac({ [limited.id]: limit - 1 })).toBe(false);
    expect(vac({ [limited.id]: limit })).toBe(true);

    // pendingUse 합산 경계
    expect(vac({ [limited.id]: limit - 1 }, 0)).toBe(false);
    expect(vac({ [limited.id]: limit - 1 }, 1)).toBe(true);
    expect(vac({}, limit - 1)).toBe(false);
    expect(vac({}, limit)).toBe(true);
  });
});

describe('collapseActivityChoices', () => {
  it('인접한 같은 id N칸(slots) → 1 인스턴스', () => {
    const multi = pickActivity(a => a.slots >= 2, 'slots>=2 활동 없음');
    const run = Array.from({ length: multi.slots }, () => multi.id);
    expect(collapseActivityChoices(run)).toEqual([multi.id]);
  });

  it('떨어져 있는 같은 id는 각각 인스턴스 (2칸×2 = 2 인스턴스)', () => {
    const twoSlot = pickActivity(a => a.slots === 2, 'slots===2 활동 없음');
    const ids = [twoSlot.id, twoSlot.id, twoSlot.id, twoSlot.id];
    expect(collapseActivityChoices(ids)).toEqual([twoSlot.id, twoSlot.id]);
  });

  it('falsy·미등록 id는 skip', () => {
    const one = pickActivity(a => a.slots === 1, 'slots===1 활동 없음');
    expect(collapseActivityChoices(['', one.id, '미등록-활동-xyz', one.id])).toEqual([
      one.id,
      one.id,
    ]);
  });

  it('꼬리 잘림(2칸 활동의 마지막 칸만 남은 배열) → 1회만', () => {
    const twoSlot = pickActivity(a => a.slots === 2, 'slots===2 활동 없음');
    // timeCost로 뒷칸이 잘린 형태: [id]만 남음
    expect(collapseActivityChoices([twoSlot.id])).toEqual([twoSlot.id]);
  });
});

describe('학년 해금 활동 — 게이트 계약 (데이터 파생 전수)', () => {
  it('검사 모수가 살아 있다', () => {
    expect(UNLOCK_ACTIVITIES.length).toBeGreaterThanOrEqual(UNLOCK_FLOOR);
  });

  it('해금 학년 경계 양방향: unlockYear-1에는 어느 주차에도 없고, unlockYear에는 열리는 주차가 있다', () => {
    for (const a of UNLOCK_ACTIVITIES) {
      const year = a.unlockYear!;
      expect(earliestOpenWeek(a, year - 1), `${a.id} year ${year - 1}에서 열린 주차`).toBeNull();
      expect(earliestOpenWeek(a, year), `${a.id} year ${year}에서 열린 주차`).not.toBeNull();
    }
  });

  it('unlockYear와 requires의 year 조건이 일치한다 (배지만 달고 차단 없는 상태 금지)', () => {
    for (const a of UNLOCK_ACTIVITIES) {
      expect(typeof a.requires, `${a.id} requires`).toBe('function');
      const year = a.unlockYear!;
      // 어느 주차로도 열리지 않아야 한다 — 주차 게이트가 있는 활동도 같은 기준으로 잡힌다.
      expect(earliestOpenWeek(a, year - 1), `${a.id} year ${year - 1}`).toBeNull();
    }
  });

  it('유료 해금 활동은 잔액 cost-1이면 빠지고 cost이면 나온다', () => {
    const paid = UNLOCK_ACTIVITIES.filter(a => getActivityCost(a, a.unlockYear!) > 0);
    expect(paid.length, '유료 해금 활동이 0건 — 이 검사가 공허하다').toBeGreaterThan(0);
    for (const a of paid) {
      const year = a.unlockYear!;
      const cost = getActivityCost(a, year);
      const week = earliestOpenWeek(a, year);
      expect(week, `${a.id} 열리는 주차`).not.toBeNull();
      const at = (money: number) => getAvailableActivities(
        makeState({ year, week: week!, money, isVacation: a.seasonGate === 'vacation-only' }),
      ).some(x => x.id === a.id);
      expect(at(cost - 1), `${a.id} money ${cost - 1}`).toBe(false);
      expect(at(cost), `${a.id} money ${cost}`).toBe(true);
    }
  });

  it('자율학습(night-study)은 2칸이고 사회성 효과가 있다', () => {
    const night = pickActivity(a => a.id === 'night-study', 'night-study 없음');
    expect(night.slots).toBe(2);
    expect(night.effects.social).toBe(1);
  });
});

describe('Y7 수능 이후 활동 — 주차 게이트 계약', () => {
  const POST_IDS = ['license-course', 'admission-prep', 'overdue-meetup'] as const;

  it('POST_SUNEUNG_WEEK는 시험 일정에서 파생된다 (하드코딩 금지)', () => {
    const suneung = Object.entries(getExamSchedule(FINAL_YEAR)).find(([, t]) => t === 'suneung');
    expect(suneung, `Y${FINAL_YEAR} 일정에 수능이 없다`).toBeDefined();
    expect(POST_SUNEUNG_WEEK).toBe(Number(suneung![0]) + 1);
  });

  it('수능 주에는 닫혀 있고 그 다음 주에 열린다', () => {
    for (const id of POST_IDS) {
      const before = makeState({ year: FINAL_YEAR, week: POST_SUNEUNG_WEEK - 1, money: 9999 });
      const after = makeState({ year: FINAL_YEAR, week: POST_SUNEUNG_WEEK, money: 9999 });
      expect(canApplyActivity(before, id), `${id} W${POST_SUNEUNG_WEEK - 1}`).toBe(false);
      expect(canApplyActivity(after, id), `${id} W${POST_SUNEUNG_WEEK}`).toBe(true);
    }
  });

  it('겨울방학(W43+)에도 열려 있다 — seasonGate로 학기에 묶이지 않는다', () => {
    for (const id of POST_IDS) {
      const winter = makeState({ year: FINAL_YEAR, week: 45, money: 9999, isVacation: true });
      expect(canApplyActivity(winter, id), `${id} 겨울방학`).toBe(true);
    }
  });

  it('이전 학년에서는 어느 주차에도 열리지 않는다', () => {
    for (const id of POST_IDS) {
      const a = pickActivity(x => x.id === id, `${id} 없음`);
      for (let year = 1; year < FINAL_YEAR; year++) {
        expect(earliestOpenWeek(a, year), `${id} Y${year}`).toBeNull();
      }
    }
  });

  it('무료 선택지가 하나는 있다 — 돈 0으로도 이 구간에 할 게 있어야 한다', () => {
    const broke = makeState({ year: FINAL_YEAR, week: POST_SUNEUNG_WEEK, money: 0 });
    const open = POST_IDS.filter(id => canApplyActivity(broke, id));
    expect(open, '수능 이후 무료 활동 0건 — 가난한 플레이어는 13주가 그대로 빈다').not.toHaveLength(0);
  });

  it('셋 다 루틴 슬롯 후보 자격을 갖는다 (slots 1 · 비-rest)', () => {
    for (const id of POST_IDS) {
      const a = pickActivity(x => x.id === id, `${id} 없음`);
      expect(a.slots, `${id} slots`).toBe(1);
      expect(a.category, `${id} category`).not.toBe('rest');
    }
  });

  it('밀린 약속은 NPC 동행 활동이다 — 동행이 아니면 관계 회복이 안 붙는다', () => {
    expect(NPC_COMPANION_ACTIVITIES).toContain('overdue-meetup');
  });
});

describe('상점 게이트 — admission-briefing', () => {
  const briefing = SHOP_ITEMS.find(i => i.id === 'admission-briefing');
  if (!briefing) throw new Error('admission-briefing 없음');

  it('Y4에서는 requireYear 사유로 구매 불가, Y5에서는 가능', () => {
    const y4 = canBuyItem(briefing, makeState({ year: 4, money: 999 }), {});
    expect(y4).toEqual({ ok: false, reason: '고1부터 구매 가능' });
    const y5 = canBuyItem(briefing, makeState({ year: 5, money: 999 }), {});
    expect(y5).toEqual({ ok: true });
  });

  it('maxPerWeek: 1이 두 번째 구매를 막는다', () => {
    const y5 = makeState({ year: 5, money: 999 });
    expect(canBuyItem(briefing, y5, {})).toEqual({ ok: true });
    expect(canBuyItem(briefing, y5, { [limitKey(briefing)]: 1 })).toEqual({
      ok: false,
      reason: '이번 주 구매 한도 초과',
    });
  });
});
