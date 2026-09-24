// "지난주처럼" 1탭 복사의 판정 계약 — 스냅샷을 잡는 규칙과, 그 스냅샷이 **지금도 유효한가**.
//
// 이 파일이 잠그는 것은 순수 판정뿐이다. 버튼이 실제로 그려지고 눌리는지, 확정 경로가
// 스냅샷을 남기는지는 각각 MainWeekScreenRepeat.test.tsx / weekendRepeatWiring.test.tsx가 본다
// (순수함수만 잠그면 아무도 안 부르는 상태가 그린이다 — #397).
import { describe, it, expect } from 'vitest';
import {
  captureWeekendPlan, getRepeatablePlan, getWeekSlotCount,
  SEMESTER_WEEKEND_SLOTS, VACATION_BASE_SLOTS,
} from '../weekendPlan';
import { makeState, withNpc } from '../../test/fixtures';
import { ACTIVITIES, getActivityCost } from '../activities';
import { getParentMods } from '../parentModifiers';
import { isNpcEnrolled } from '../relationshipSignals';
import type { GameState, ParentStrength, WeekendPlanSnapshot } from '../types';

const COST = (id: string, year: number) =>
  getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);

// 엔진이 주차에서 방학을 재계산한다(prepareWeekContext) — 픽스처의 isVacation과 week은 짝을 맞춘다.
const SEMESTER_WEEK = 3;
const VACATION_WEEK = 21;

/** 학기 주 기본 픽스처 — 무료 루틴(루틴 미설정은 확정 자체가 막히는 별개 축이라 채워 둔다). */
function semesterState(patch: Partial<GameState> = {}): GameState {
  return makeState({
    week: SEMESTER_WEEK, isVacation: false, year: 1, money: 10,
    routineSlot2: 'self-study', routineSlot3: 'self-study',
    ...patch,
  });
}

function plan(
  activities: string[],
  npcChoices: Record<string, string> = {},
  isVacation = false,
): WeekendPlanSnapshot {
  return { activities, npcChoices, isVacation };
}

describe('getWeekSlotCount — 슬롯 수 SSOT', () => {
  it('학기 주말은 2칸, 방학은 자유 슬롯', () => {
    expect(getWeekSlotCount(semesterState())).toBe(SEMESTER_WEEKEND_SLOTS);
    const vac = makeState({ week: VACATION_WEEK, isVacation: true });
    expect(getWeekSlotCount(vac)).toBe(VACATION_BASE_SLOTS + getParentMods(vac.parents).vacationSlotBonus);
  });

  it('freedom 부모의 방학 슬롯 보너스가 그대로 반영된다', () => {
    const parents: [ParentStrength, ParentStrength] = ['freedom', 'info'];
    const vac = makeState({ week: VACATION_WEEK, isVacation: true, parents });
    const bonus = getParentMods(parents).vacationSlotBonus;
    expect(bonus, '전제가 깨졌다 — freedom이 방학 슬롯을 안 준다').toBeGreaterThan(0);
    expect(getWeekSlotCount(vac)).toBe(VACATION_BASE_SLOTS + bonus);
  });
});

describe('captureWeekendPlan — 확정 시점의 스냅샷', () => {
  it('고른 활동과 동행을 슬롯 배열 그대로 잡는다', () => {
    const snap = captureWeekendPlan(['reading', 'hang-out'], { 'hang-out:1': 'jihun' }, false);
    expect(snap).toEqual({
      activities: ['reading', 'hang-out'],
      npcChoices: { 'hang-out:1': 'jihun' },
      isVacation: false,
    });
  });

  it('빈 주말은 스냅샷을 남기지 않는다 — "지난주처럼"이 두 주 전을 채우면 거짓말이다', () => {
    expect(captureWeekendPlan([], {}, false)).toBeNull();
    expect(captureWeekendPlan(['', ''], {}, false)).toBeNull();
  });

  it('배열 구멍·꼬리 빈칸을 정규화한다 — 앞 칸의 인덱스는 보존', () => {
    // 일요일만 고르면 selectedActivities는 [<empty>, 'reading'] 이 된다(newArr[1] = id).
    const holed: (string | undefined)[] = [];
    holed[1] = 'reading';
    const snap = captureWeekendPlan(holed, {}, false)!;
    expect(snap.activities).toEqual(['', 'reading']);
    expect(captureWeekendPlan(['reading', ''], {}, false)!.activities).toEqual(['reading']);
  });

  it('2칸 활동의 인접 중복을 접지 않는다 — 슬롯 점유가 곧 계획이다', () => {
    const twoSlot = ACTIVITIES.find(a => a.slots >= 2)!;
    const snap = captureWeekendPlan([twoSlot.id, twoSlot.id], {}, false)!;
    expect(snap.activities).toEqual([twoSlot.id, twoSlot.id]);
  });
});

describe('getRepeatablePlan — 지난주 계획이 지금도 유효한가', () => {
  it('구세이브(필드 부재)는 조용히 없는 것으로 — 거부도 크래시도 아니다', () => {
    const s = semesterState();
    expect(s.lastWeekendPlan, '픽스처가 이미 스냅샷을 갖고 있다').toBeUndefined();
    expect(getRepeatablePlan(s)).toBeNull();
  });

  it('감당되는 계획은 그대로 돌려준다', () => {
    const s = semesterState({ lastWeekendPlan: plan(['reading', 'library']) });
    expect(getRepeatablePlan(s)?.activities).toEqual(['reading', 'library']);
  });

  it('세이브 JSON 왕복을 거쳐도 같은 판정 — 구멍이 null로 저장되는 축', () => {
    const holed: (string | undefined)[] = [];
    holed[1] = 'reading';
    const s = semesterState({ lastWeekendPlan: captureWeekendPlan(holed, {}, false)! });
    const roundTripped = JSON.parse(JSON.stringify(s)) as GameState;
    expect(getRepeatablePlan(roundTripped)?.activities).toEqual(['', 'reading']);
  });

  describe('슬롯 구조', () => {
    it('학기 스냅샷은 방학 주에 안 쓴다 (그 반대도)', () => {
      const semesterPlan = plan(['reading']);
      const vacationPlan = plan(['vacation-library'], {}, true);
      const onVacation = makeState({
        week: VACATION_WEEK, isVacation: true, year: 1, money: 10,
        routineSlot2: 'self-study', routineSlot3: 'self-study',
      });
      expect(getRepeatablePlan({ ...onVacation, lastWeekendPlan: semesterPlan })).toBeNull();
      expect(getRepeatablePlan({ ...onVacation, lastWeekendPlan: vacationPlan })?.activities)
        .toEqual(['vacation-library']);
      // 학기 주에서는 정반대
      const inSemester = semesterState();
      expect(getRepeatablePlan({ ...inSemester, lastWeekendPlan: vacationPlan })).toBeNull();
      expect(getRepeatablePlan({ ...inSemester, lastWeekendPlan: semesterPlan })?.activities)
        .toEqual(['reading']);
    });

    it('슬롯 수를 넘는 계획은 안 채운다', () => {
      const s = semesterState();
      const tooMany = Array.from({ length: getWeekSlotCount(s) + 1 }, () => 'reading');
      expect(getRepeatablePlan({ ...s, lastWeekendPlan: plan(tooMany) })).toBeNull();
      expect(getRepeatablePlan({ ...s, lastWeekendPlan: plan(tooMany.slice(0, -1)) })).not.toBeNull();
    });
  });

  describe('돈 — 판정은 엔진의 skipped 기록', () => {
    const PAID = 'art-lesson';
    it('잔액이 모자라면 안 뜨고, 채우면 다시 뜬다 (양방향)', () => {
      const need = COST(PAID, 1) + COST('academy', 1);
      expect(need, '전제가 깨졌다 — 유료 활동이 공짜다').toBeGreaterThan(0);
      const p = plan([PAID, 'academy']);
      expect(getRepeatablePlan(semesterState({ money: need - 0.5, lastWeekendPlan: p }))).toBeNull();
      expect(getRepeatablePlan(semesterState({ money: need, lastWeekendPlan: p }))?.activities)
        .toEqual([PAID, 'academy']);
    });

    it('유료 루틴이 잔액을 먼저 먹으면 선택 슬롯이 못 돈다 — 그것도 안 뜬다', () => {
      const p = plan([PAID]);
      const money = COST(PAID, 1);
      // 무료 루틴이면 딱 감당된다
      expect(getRepeatablePlan(semesterState({ money, lastWeekendPlan: p }))).not.toBeNull();
      // 같은 잔액인데 루틴이 먼저 차감하면 못 한다(순차 차감은 엔진만 안다)
      expect(getRepeatablePlan(semesterState({
        money, routineSlot2: 'academy', lastWeekendPlan: p,
      }))).toBeNull();
    });
  });

  describe('게이트 — 학년/계절', () => {
    it('아직 안 열린 활동은 안 뜨고, 열린 학년에서는 뜬다 (양방향)', () => {
      const locked = ACTIVITIES.find(a => a.unlockYear === 2)!;
      const p = plan([locked.id]);
      expect(getRepeatablePlan(semesterState({ year: 1, lastWeekendPlan: p })),
        `${locked.name}이 Y1에서 그대로 복사된다`).toBeNull();
      expect(getRepeatablePlan(semesterState({ year: locked.unlockYear!, lastWeekendPlan: p }))?.activities)
        .toEqual([locked.id]);
    });

    it('카탈로그에 없는 활동 id는 거부한다 (변조·삭제된 활동)', () => {
      expect(getRepeatablePlan(semesterState({ lastWeekendPlan: plan(['no-such-activity']) }))).toBeNull();
    });
  });

  describe('동행', () => {
    const COMPANION = 'hang-out';
    const withHaeun = (year: number, lastWeekendPlan: WeekendPlanSnapshot) => {
      const base = semesterState({ year, money: 20, lastWeekendPlan });
      return { ...base, npcs: withNpc(base.npcs, 'haeun', { met: true }) };
    };

    it('같이 갈 수 없게 된 친구(졸업 공백)면 안 뜬다 — 있던 해에는 뜬다 (양방향)', () => {
      const p = plan([COMPANION], { [`${COMPANION}:0`]: 'haeun' });
      const y3 = withHaeun(3, p);
      const y4 = withHaeun(4, p);
      expect(isNpcEnrolled(y3.npcs.find(n => n.id === 'haeun')!, y3),
        '전제가 깨졌다 — 하은이 Y3에 없다').toBe(true);
      expect(isNpcEnrolled(y4.npcs.find(n => n.id === 'haeun')!, y4),
        '전제가 깨졌다 — 하은이 Y4에 있다').toBe(false);
      expect(getRepeatablePlan(y3)?.npcChoices).toEqual({ [`${COMPANION}:0`]: 'haeun' });
      expect(getRepeatablePlan(y4)).toBeNull();
    });

    it('아직 만나지 않은 친구를 가리키면 안 뜬다', () => {
      const p = plan([COMPANION], { [`${COMPANION}:0`]: 'haeun' });
      const s = semesterState({ year: 3, money: 20, lastWeekendPlan: p });  // haeun met=false
      expect(getRepeatablePlan(s)).toBeNull();
    });

    it('동행이 필수인 활동인데 지정이 없으면 안 뜬다', () => {
      expect(getRepeatablePlan(semesterState({ lastWeekendPlan: plan([COMPANION]) }))).toBeNull();
      expect(getRepeatablePlan(semesterState({
        lastWeekendPlan: plan([COMPANION], { [`${COMPANION}:0`]: 'jihun' }),
      }))).not.toBeNull();
    });
  });

  describe('손상된 스냅샷은 정규화하지 않고 거부한다', () => {
    it.each([
      ['객체가 아니다', 'reading'],
      ['activities가 배열이 아니다', { activities: 'reading', npcChoices: {}, isVacation: false }],
      ['activities에 숫자가 섞였다', { activities: [1], npcChoices: {}, isVacation: false }],
      ['npcChoices가 배열이다', { activities: ['reading'], npcChoices: ['jihun'], isVacation: false }],
      ['npcChoices 값이 문자열이 아니다', { activities: ['reading'], npcChoices: { a: 1 }, isVacation: false }],
      ['isVacation이 없다', { activities: ['reading'], npcChoices: {} }],
      ['빈 계획', { activities: ['', ''], npcChoices: {}, isVacation: false }],
    ])('%s', (_label, broken) => {
      const s = semesterState({ lastWeekendPlan: broken as unknown as WeekendPlanSnapshot });
      expect(getRepeatablePlan(s)).toBeNull();
    });
  });
});
