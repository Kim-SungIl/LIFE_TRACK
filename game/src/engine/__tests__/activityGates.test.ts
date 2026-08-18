// 활동 게이트 SSOT — passesActivityGates / getAvailableActivities / canApplyActivity /
// isVacationLimitReached / collapseActivityChoices 순수 계약.
// 전역 ACTIVITIES만 읽으므로 리터럴 Activity 주입 금지 — 데이터에서 조건으로 파생.
import { describe, expect, it } from 'vitest';
import {
  ACTIVITIES,
  canApplyActivity,
  collapseActivityChoices,
  getAvailableActivities,
  isVacationLimitReached,
} from '../activities';
import { canBuyItem, limitKey, SHOP_ITEMS } from '../shopSystem';
import type { Activity } from '../types';
import { makeState } from '../../test/fixtures';

const GRADE_UNLOCK_IDS = [
  'free-semester',
  'study-room',
  'supplementary-class',
  'night-study',
  'practical-lesson',
  'mentoring',
] as const;

const PAID_GRADE_UNLOCK_IDS = ['study-room', 'supplementary-class', 'practical-lesson'] as const;

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

describe('학년 해금 활동 6종 — 게이트 계약', () => {
  it('해금 학년 경계 양방향: unlockYear-1에는 없고 unlockYear에는 있다', () => {
    for (const id of GRADE_UNLOCK_IDS) {
      const a = pickActivity(x => x.id === id, `${id} 없음`);
      expect(a.unlockYear, `${id} unlockYear`).toEqual(expect.any(Number));
      const year = a.unlockYear!;
      const before = getAvailableActivities(makeState({ year: year - 1, money: 999, isVacation: false }));
      const at = getAvailableActivities(makeState({ year, money: 999, isVacation: false }));
      expect(before.some(x => x.id === id), `${id} year ${year - 1}`).toBe(false);
      expect(at.some(x => x.id === id), `${id} year ${year}`).toBe(true);
    }
  });

  it('unlockYear와 requires의 year 조건이 일치한다 (배지만 달고 차단 없는 상태 금지)', () => {
    // passesActivityGates는 비공개 — 공개면(canApplyActivity)으로 동일 판정을 잠근다.
    for (const id of GRADE_UNLOCK_IDS) {
      const a = pickActivity(x => x.id === id, `${id} 없음`);
      expect(a.unlockYear, `${id} unlockYear`).toEqual(expect.any(Number));
      expect(typeof a.requires, `${id} requires`).toBe('function');
      const year = a.unlockYear!;
      expect(
        canApplyActivity(makeState({ year: year - 1, money: 999, isVacation: false }), id),
        `${id} year ${year - 1}`,
      ).toBe(false);
    }
  });

  it('유료 3종은 해금 학년이어도 잔액 cost-1이면 빠지고 cost이면 나온다', () => {
    for (const id of PAID_GRADE_UNLOCK_IDS) {
      const a = pickActivity(x => x.id === id, `${id} 없음`);
      expect(a.unlockYear, `${id} unlockYear`).toEqual(expect.any(Number));
      const cost = a.moneyCost;
      const year = a.unlockYear!;
      const under = getAvailableActivities(makeState({ year, money: cost - 1, isVacation: false }));
      const exact = getAvailableActivities(makeState({ year, money: cost, isVacation: false }));
      expect(under.some(x => x.id === id), `${id} money ${cost - 1}`).toBe(false);
      expect(exact.some(x => x.id === id), `${id} money ${cost}`).toBe(true);
    }
  });

  it('야자(night-study)는 2칸이고 사회성 효과가 있다', () => {
    const night = pickActivity(a => a.id === 'night-study', 'night-study 없음');
    expect(night.slots).toBe(2);
    expect(night.effects.social).toBe(1);
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
