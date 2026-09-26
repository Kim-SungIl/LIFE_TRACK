// 주말/방학 슬롯 배열은 **구멍(hole)을 남기지 않는다**. (T53)
//
// 계획 화면의 칸 편집은 원래 `newArr[idx] = id` 였다. 토요일을 비워 두고 일요일만 고르면
// 그 배열은 `[<empty>, 'reading']` — 길이 2에 **키가 하나뿐인** 희소 배열이 된다.
// 같은 계획이 층마다 다른 모양으로 보인다:
//
//   · `JSON.stringify` → `[null, "reading"]`   (세이브를 왕복하면 값이 바뀐다)
//   · `.map`/`.every`/`.filter` → 구멍을 **건너뛴다** (길이는 2인데 1개만 본다)
//   · 스프레드 `[...arr]` → `[undefined, 'reading']` (string[] 타입인데 undefined가 들어 있다)
//
// 그래서 빈 칸의 표현을 `''` 하나로 못박고(`captureWeekendPlan`이 스냅샷에 쓰는 값,
// "지난주처럼"이 슬롯에 도로 채우는 값, 엔진이 falsy로 읽는 값과 같다) 칸 편집을
// `assignSlot` 한 통로로 모았다.
//
// **순수함수만 잠그면 아무도 안 부르는 상태가 그린이다**(#397) — 화면이 실제로 이걸 거치는지는
// SlotEditPopup.test.tsx / MainWeekScreenSlotArray.test.tsx가 본다.
import { describe, it, expect } from 'vitest';
import { assignSlot, captureWeekendPlan } from '../weekendPlan';
import { processWeek } from '../gameEngine';
import { ACTIVITIES } from '../activities';
import { makeState } from '../../test/fixtures';
import type { GameState } from '../types';

const SEMESTER_WEEK = 10;

/** 배열에 구멍이 있으면 사유, 없으면 null. */
function holes(arr: readonly string[]): string | null {
  if (Object.keys(arr).length !== arr.length) {
    return `길이 ${arr.length}인데 키가 ${Object.keys(arr).length}개 — 구멍이 있다`;
  }
  const bad = Array.from(arr).findIndex(v => typeof v !== 'string');
  return bad === -1 ? null : `${bad}번 칸이 문자열이 아니다(${String(arr[bad])})`;
}

describe('assignSlot — 칸 편집은 구멍을 남기지 않는다', () => {
  // **양성 대조군**: 옛 방식이 실제로 이 검사에 걸리는지 먼저 확인한다.
  // 없으면 `holes()`가 아무것도 구별 못 하는 장식이어도 아래가 전부 통과한다.
  it('옛 방식(`arr[idx] = id`)은 이 검사에 걸린다', () => {
    const old: string[] = [];
    old[1] = 'reading';
    expect(holes(old), '이 검사가 구멍을 못 잡으면 아래 단언은 전부 공허하다').not.toBeNull();
    expect(JSON.parse(JSON.stringify(old)),
      '구멍은 세이브 왕복에서 null이 된다 — 빈 칸의 표현이 층마다 달라지는 자리').toEqual([null, 'reading']);
  });

  it('일요일만 고르면 앞 칸이 `\'\'`로 펴진다', () => {
    const arr = assignSlot([], 1, 'reading');
    expect(holes(arr)).toBeNull();
    expect(arr).toEqual(['', 'reading']);
    expect(JSON.parse(JSON.stringify(arr)), '세이브를 왕복해도 같은 모양이다').toEqual(['', 'reading']);
  });

  it('뒤쪽 칸을 건너뛰어 골라도 그 사이가 전부 `\'\'`다', () => {
    const arr = assignSlot([], 4, 'library');
    expect(holes(arr)).toBeNull();
    expect(arr).toEqual(['', '', '', '', 'library']);
  });

  it('이미 찬 칸은 그대로 두고, 같은 칸은 덮어쓴다', () => {
    expect(assignSlot(['reading'], 1, 'library')).toEqual(['reading', 'library']);
    expect(assignSlot(['reading', 'library'], 0, 'rest')).toEqual(['rest', 'library']);
  });

  it('원본 배열을 건드리지 않는다 (React state를 직접 mutate하면 리렌더가 안 온다)', () => {
    const before = ['reading'];
    const after = assignSlot(before, 1, 'library');
    expect(before, '입력 배열이 바뀌면 같은 참조를 setState에 넘긴 화면이 안 갱신된다').toEqual(['reading']);
    expect(after).not.toBe(before);
  });

  it('구멍이 섞인 입력을 받아도 펴서 돌려준다 (구세이브·옛 경로에서 온 배열)', () => {
    const legacy: string[] = [];
    legacy[2] = 'reading';
    const arr = assignSlot(legacy, 0, 'rest');
    expect(holes(arr), 'map이면 구멍을 건너뛰어 그대로 남는다 — Array.from이어야 한다').toBeNull();
    expect(arr).toEqual(['rest', '', 'reading']);
  });

  it('스냅샷(`captureWeekendPlan`)과 같은 모양으로 이어진다', () => {
    const arr = assignSlot([], 1, 'reading');
    const snap = captureWeekendPlan(arr, {}, false);
    expect(snap?.activities, '두 층이 빈 칸을 다르게 적으면 "지난주처럼"이 다른 주를 복사한다')
      .toEqual(['', 'reading']);
  });
});

describe('엔진은 그 배열로 고른 칸만 적용한다', () => {
  const REST = ACTIVITIES.find(a => a.id === 'rest')!;
  const base: Partial<GameState> = {
    year: 3, week: SEMESTER_WEEK, fatigue: 60, money: 100000,
    routineSlot2: 'self-study', routineSlot3: 'self-study',
  };
  const doneCount = (s: GameState) =>
    s.weekLog!.messages.filter(m => m === `${REST.name} 완료`).length;

  it('일요일만 고른 배열 = 그 활동 한 번짜리 계획', () => {
    const sunday = processWeek(makeState({ ...base, weekendChoices: assignSlot([], 1, REST.id) }));
    const oneOnly = processWeek(makeState({ ...base, weekendChoices: [REST.id] }));
    expect(doneCount(sunday), '빈 칸이 활동으로 읽히면 두 번 돈다').toBe(1);
    expect(sunday.fatigue).toBe(oneOnly.fatigue);
  });

  it('두 칸을 다 고른 주와는 다르다 (위 단언이 "아무것도 안 하는 주"가 아니라는 대조군)', () => {
    const sunday = processWeek(makeState({ ...base, weekendChoices: assignSlot([], 1, REST.id) }));
    const both = processWeek(makeState({ ...base, weekendChoices: [REST.id, REST.id] }));
    expect(doneCount(both)).toBe(2);
    expect(both.fatigue, '두 칸이 한 칸과 같은 결과면 이 축은 아무것도 구별 못 한다')
      .not.toBe(sunday.fatigue);
  });

  it('빈 칸이 "할 수 없어 건너뛰었다" 경고가 되지 않는다', () => {
    const sunday = processWeek(makeState({ ...base, weekendChoices: assignSlot([], 1, REST.id) }));
    expect(sunday.weekLog!.skipped, '빈 칸은 스킵 기록이 아니다').toEqual([]);
    expect(sunday.weekLog!.messages.some(m => m.includes('건너뛰었다')),
      '빈 칸을 카탈로그에서 못 찾아 경고를 띄우면 계획 안 한 줄이 결산에 뜬다').toBe(false);
  });
});
