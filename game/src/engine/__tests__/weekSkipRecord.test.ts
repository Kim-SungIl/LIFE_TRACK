import { describe, it, expect } from 'vitest';
import { ACTIVITIES, getActivityCost } from '../activities';
import { processWeek, predictWeekOutcome } from '../gameEngine';
import { makeState } from '../../test/fixtures';
import type { GameState, SkippedActivity } from '../types';

// 엔진이 **실행하지 않은 활동**을 기계가 읽을 수 있게 남기는지의 계약(`WeekLog.skipped`).
//
// 왜 이 기록이 있어야 하는가: 계획 화면은 확정 전에 "이건 돈이 모자라 못 한다"고 말한다.
// 그 판정을 화면이 따로 구현했을 때 실제로 두 번 어긋났다 —
//   ① eventTimeCost로 잘리는 꼬리 슬롯을 몰라 "돈 부족"이라 거짓 경고했고,
//   ② 루틴과 id가 같은 선택 슬롯을 걸러내 경고를 통째로 잃었다.
// 그래서 판정 주체를 엔진 하나로 두고 화면은 이 기록만 읽는다. 이 파일은 그 기록이
// **엔진의 실제 동작과 같은 것**을 담고 있는지를 잠근다(문자열 로그와 짝을 맞춰 검증).

const cost = (id: string, year = 1) =>
  getActivityCost(ACTIVITIES.find(a => a.id === id)!, year);

/** 엔진을 한 주 돌리고 기록 + 돈 관련 로그 문장을 함께 돌려준다. */
function run(s: GameState, plan: string[]) {
  const input = { ...s };
  input.weekendChoices = plan;
  input.vacationChoices = plan;
  const after = processWeek(input);
  const log = after.weekLog;
  return {
    skipped: log?.skipped ?? [],
    moneyIds: (log?.skipped ?? []).filter(k => k.reason === 'money').map(k => k.activityId),
    moneyMsgs: (log?.messages ?? []).filter(m => m.includes('돈이 부족해서')),
    gateMsgs: (log?.messages ?? []).filter(m => m.includes('할 수 없어 건너뛰었다')),
  };
}

// 엔진이 주차에서 방학을 재계산한다(getWeekInfo). 픽스처의 isVacation과 week이 어긋나면
// vacation-only 활동이 계절 게이트로 스킵되어 돈이 아닌 이유로 결과가 달라진다.
const VACATION_WEEK = 21;

describe('WeekLog.skipped — 돈 때문에 못 한 활동', () => {
  it('감당되는 주에는 아무것도 기록되지 않는다', () => {
    const s = makeState({ money: 50, isVacation: false, week: 3, routineSlot2: 'academy', routineSlot3: 'gym' });
    expect(run(s, ['art-lesson', 'hang-out']).skipped).toEqual([]);
  });

  // 합계만 비교하는 구현은 이 케이스를 "둘 다 못 한다"로 잘못 말한다.
  it('순차 차감이다 — 잔액 3만에 2만짜리 둘이면 뒤의 하나만 걸린다', () => {
    expect(cost('art-lesson')).toBe(2);
    expect(cost('gym')).toBe(2);
    const s = makeState({ money: 3, isVacation: false, week: 3, routineSlot2: 'self-study', routineSlot3: null });
    expect(run(s, ['art-lesson', 'gym']).moneyIds).toEqual(['gym']);
  });

  it('루틴이 선택 슬롯보다 먼저 차감된다 — 순서를 바꾸면 걸리는 대상이 달라진다', () => {
    const s = makeState({ money: 3, isVacation: false, week: 3, routineSlot2: 'academy', routineSlot3: null });
    // 루틴 학원(2)이 먼저 나가 1만이 남고, 예체능(2)이 못 돈다.
    const r = run(s, ['art-lesson']);
    expect(r.moneyIds).toEqual(['art-lesson']);
    expect(r.skipped[0].origin).toBe('choice');
  });

  it('수입 활동은 잔액을 올려 뒤 슬롯을 살린다', () => {
    // 편의점 알바는 Y4부터 열린다 — 학년을 안 맞추면 게이트로 스킵돼 수입이 안 들어온다.
    expect(cost('part-time', 4)).toBeLessThan(0);
    const s = makeState({ money: 0, year: 4, isVacation: false, week: 3, routineSlot2: 'self-study', routineSlot3: null });
    expect(run(s, ['part-time', 'art-lesson']).moneyIds).toEqual([]);
    // 순서가 뒤바뀌면 앞의 예체능이 못 돈다 — 알바 수입이 아직 안 들어왔으므로.
    expect(run(s, ['art-lesson', 'part-time']).moneyIds).toEqual(['art-lesson']);
  });

  it('origin이 루틴/선택을 구분한다 — 화면이 어느 쪽 문구를 낼지 정하는 근거', () => {
    // 수입 루틴이 섞이면 합계는 0이라 "루틴이 너무 비싸다"가 안 뜨는데, 순차로는 학원이 실패한다.
    const s = makeState({
      money: 1, year: 6, isVacation: false, week: 3,
      routineSlot2: 'academy', routineSlot3: 'part-time',
    });
    expect(cost('academy', 6) + cost('part-time', 6)).toBe(0);   // 합계로는 감당되는 것처럼 보인다
    const r = run(s, []);
    expect(r.moneyIds).toEqual(['academy']);
    expect(r.skipped[0].origin).toBe('routine');
  });

  it('방학에는 루틴이 돌지 않아 기록도 없다', () => {
    const s = makeState({
      money: 1, isVacation: true, week: VACATION_WEEK,
      routineSlot2: 'academy', routineSlot3: 'gym',
    });
    expect(run(s, []).skipped).toEqual([]);
  });

  it('방학 선택 슬롯도 기록된다 — 고액 활동이 몰린 구간', () => {
    const s = makeState({ money: 4, isVacation: true, week: VACATION_WEEK, routineSlot2: null, routineSlot3: null });
    expect(cost('intensive-academy')).toBe(5);
    const r = run(s, ['intensive-academy', 'intensive-academy']);
    expect(r.moneyIds).toEqual(['intensive-academy']);
    expect(r.skipped[0].origin).toBe('choice');
  });

  it('기록과 로그 문장이 짝을 이룬다 — 한쪽만 남으면 화면과 결산이 어긋난다', () => {
    const s = makeState({ money: 3, isVacation: false, week: 3, routineSlot2: 'self-study', routineSlot3: null });
    const r = run(s, ['art-lesson', 'gym']);
    expect(r.moneyIds.length).toBe(r.moneyMsgs.length);
    expect(r.moneyMsgs[0]).toContain(ACTIVITIES.find(a => a.id === 'gym')!.name);
  });
});

describe('WeekLog.skipped — eventTimeCost (계획 화면이 이걸 몰라 거짓 경고를 냈다)', () => {
  // eventTimeCost는 이벤트 선택의 timeCost가 **다음 주** 슬롯을 깎는 값이다(store.ts). 즉 계획
  // 화면에 이미 0이 아닌 상태로 도착한다 — timeCost를 가진 선택지가 300개 이상이라 흔하다.
  //
  // 픽스처 주의: 아래 잔액은 "슬롯이 잘리는지"에 따라 기록이 **달라지도록** 고른 값이다.
  // 넉넉한 잔액을 쓰면 슬롯을 안 잘라도 다 감당되어 timeCost 처리를 지워도 그린이 된다
  // (실제로 처음 이 파일이 그 함정에 빠졌다). 주간 결산 잔액으로 검증하는 것도 안 된다 —
  // 용돈 지급이 활동 적용 뒤(processWeek 9단계)라 차이가 묻힌다.

  it('timeCost=0 — 루틴이 먼저 나가고 남은 잔액으로 선택 슬롯이 걸린다', () => {
    const s = makeState({
      money: 3, year: 1, isVacation: false, week: 3,
      routineSlot2: 'academy', routineSlot3: null, eventTimeCost: 0,
    });
    expect(run(s, ['art-lesson']).moneyIds).toEqual(['art-lesson']);
  });

  it('timeCost=1 — 꼬리 슬롯이 잘려 나가므로 그 활동은 기록되지 않는다', () => {
    // 위와 같은 상태에 timeCost만 1. 슬롯을 자르지 않으면 예체능이 돈 부족으로 걸린다 —
    // 즉 이 단언이 꼬리 슬라이스를 실제로 잠근다.
    const s = makeState({
      money: 3, year: 1, isVacation: false, week: 3,
      routineSlot2: 'academy', routineSlot3: null, eventTimeCost: 1,
    });
    expect(run(s, ['art-lesson']).moneyIds, '잘려 나간 슬롯을 돈 부족으로 잘못 기록했다').toEqual([]);
  });

  it('timeCost=1 — 루틴 저녁 슬롯(slot3)은 아예 시도되지 않는다', () => {
    // 잔액 1만으로는 학원(2)을 못 낸다. slot3 게이트(timeCost < 1)가 사라지면 시도되어
    // money 기록이 생긴다.
    const s = makeState({
      money: 1, year: 1, isVacation: false, week: 3,
      routineSlot2: 'self-study', routineSlot3: 'academy', eventTimeCost: 1,
    });
    expect(cost('self-study')).toBe(0);
    expect(run(s, []).skipped, '저녁 슬롯을 건너뛰지 않았다').toEqual([]);
  });

  it('timeCost=2 — 루틴 방과후 슬롯(slot2)도 아예 시도되지 않는다', () => {
    // 잔액 1만 < 학원 2만. slot2 게이트(timeCost < 2)가 사라지면 money 기록이 생긴다.
    const s = makeState({
      money: 1, year: 1, isVacation: false, week: 3,
      routineSlot2: 'academy', routineSlot3: null, eventTimeCost: 2,
    });
    expect(run(s, []).skipped, '방과후 슬롯을 건너뛰지 않았다').toEqual([]);
  });
});

describe('WeekLog.skipped — 게이트(reason=gate)는 돈과 구분된다', () => {
  it('방학 횟수 한도로 스킵되면 gate로 기록되고 잔액은 안 쓴다', () => {
    const camp = ACTIVITIES.find(a => a.id === 'sports-camp')!;
    expect(camp.vacationLimit).toBe(1);
    const s = makeState({
      money: 5, isVacation: true, week: VACATION_WEEK,
      routineSlot2: null, routineSlot3: null,
      vacationActivityCounts: { 'sports-camp': 1 },
    });
    const r = run(s, ['sports-camp', 'sports-camp', 'sports-camp', 'intensive-academy', 'intensive-academy']);
    // 캠프는 한도로(돈이 아니라) 걸리고, 그래서 잔액이 남아 특강은 정상 실행된다.
    expect(r.skipped.filter(k => k.activityId === 'sports-camp').map(k => k.reason)).toEqual(['gate']);
    expect(r.moneyIds, '한도로 막힌 활동의 비용을 차감해 뒤 슬롯을 거짓으로 막았다').toEqual([]);
    expect(r.gateMsgs.length).toBeGreaterThan(0);
  });

  it('학년 게이트도 gate로 기록된다', () => {
    const s = makeState({ money: 50, year: 1, isVacation: false, week: 3, routineSlot2: 'self-study', routineSlot3: null });
    // 집중 과외는 Y5부터 열린다 — Y1에 넣으면 게이트로 걸린다.
    const r = run(s, ['private-tutoring']);
    const rec: SkippedActivity[] = r.skipped.filter(k => k.activityId === 'private-tutoring');
    expect(rec.map(k => k.reason)).toEqual(['gate']);
    expect(r.moneyIds).toEqual([]);
  });
});

describe('predictWeekOutcome이 그 기록을 화면에 넘긴다', () => {
  it('확정 전 예측이 엔진 기록과 같다 — 화면은 이것만 읽는다', () => {
    const s = makeState({ money: 3, isVacation: false, week: 3, routineSlot2: 'academy', routineSlot3: null });
    const preview = predictWeekOutcome(s, ['art-lesson']);
    expect(preview.skipped.filter(k => k.reason === 'money').map(k => k.activityId)).toEqual(['art-lesson']);
    // 실제 확정과 동일해야 한다.
    expect(preview.skipped).toEqual(run(s, ['art-lesson']).skipped);
  });

  it('감당되는 계획에는 빈 배열을 넘긴다 — 경고가 상시 떠 있으면 신호가 죽는다', () => {
    const s = makeState({ money: 50, isVacation: false, week: 3, routineSlot2: 'academy', routineSlot3: 'gym' });
    expect(predictWeekOutcome(s, ['art-lesson']).skipped).toEqual([]);
  });
});
