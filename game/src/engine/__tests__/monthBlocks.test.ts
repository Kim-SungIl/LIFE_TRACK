// 월 블록 표 — 월 단위 계획(docs/monthly-plan-design-2026-10.md §2)의 달력이 문서와 같은가.
//
// 블록의 학기/방학 구분은 weekMath의 학기 구조에서 **파생**된다. 그래서 여기서 문서 표를 리터럴로
// 박아 두면, 누가 학기 경계(W19/20 등)를 옮겼을 때 "계획 화면의 달 모양이 바뀐다"는 사실이 빨간색으로 드러난다.
import { describe, expect, it } from 'vitest';
import {
  MONTH_BLOCKS, MONTHS_PER_YEAR, WEEKS_PER_MONTH, getMonthBlock, getWeekInfo, getWeekOfMonth,
} from '../weekMath';
import { getMonthLabel } from '../gameEngine';
import { getExamSchedule, getExamsInMonth, getNextMonthOpeningExam, isExamPeriod } from '../examSystem';

// 설계안 §2의 표 그대로. [라벨, 시작주, 끝주, 화면형, 학기 주, 방학 주]
const DOC_TABLE: [string, number, number, 'semester' | 'vacation' | 'mixed', number, number][] = [
  ['3월', 1, 4, 'semester', 4, 0],
  ['4월', 5, 8, 'semester', 4, 0],
  ['5월', 9, 12, 'semester', 4, 0],
  ['6월', 13, 16, 'semester', 4, 0],
  ['7월', 17, 20, 'mixed', 3, 1],
  ['8월', 21, 24, 'vacation', 0, 4],
  ['9월', 25, 28, 'semester', 4, 0],
  ['10월', 29, 32, 'semester', 4, 0],
  ['11월', 33, 36, 'semester', 4, 0],
  ['12월', 37, 40, 'semester', 4, 0],
  ['1월', 41, 44, 'mixed', 2, 2],
  ['2월', 45, 48, 'vacation', 0, 4],
];

describe('블록 표 — 설계안 §2와 같다', () => {
  it('12블록 × 4주, 문서 표와 칸마다 같다', () => {
    expect(MONTHS_PER_YEAR * WEEKS_PER_MONTH).toBe(48);
    expect(MONTH_BLOCKS.map(b => [b.label, b.startWeek, b.endWeek, b.kind, b.semesterWeeks, b.vacationWeeks]))
      .toEqual(DOC_TABLE);
    expect(MONTH_BLOCKS.map(b => b.index)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it('48주가 빈틈·겹침 없이 정확히 한 블록에 속하고, 블록의 학기/방학 수가 주 단위 판정과 맞는다', () => {
    const seen = new Map<number, number>();
    for (const b of MONTH_BLOCKS) {
      let vac = 0;
      for (let w = b.startWeek; w <= b.endWeek; w++) {
        seen.set(w, (seen.get(w) ?? 0) + 1);
        expect(getMonthBlock(w)).toBe(b);
        if (getWeekInfo(w).isVacation) vac++;
      }
      expect(b.vacationWeeks, b.label).toBe(vac);
    }
    expect([...seen.keys()].sort((a, b) => a - b)).toEqual(Array.from({ length: 48 }, (_, i) => i + 1));
    expect([...seen.values()].every(n => n === 1)).toBe(true);
  });

  it('섞인 달은 7월·1월 둘뿐이고, 방학이 그 달 **뒤쪽**에 붙는다(학기 → 방학 순서)', () => {
    const mixed = MONTH_BLOCKS.filter(b => b.kind === 'mixed');
    expect(mixed.map(b => b.label)).toEqual(['7월', '1월']);
    for (const b of mixed) {
      const flags = Array.from({ length: 4 }, (_, i) => getWeekInfo(b.startWeek + i).isVacation);
      expect(flags, b.label).toEqual([...Array(b.semesterWeeks).fill(false), ...Array(b.vacationWeeks).fill(true)]);
    }
  });

  it('getWeekOfMonth — 블록 안 1~4주', () => {
    expect([1, 4, 5, 17, 20, 41, 48].map(getWeekOfMonth)).toEqual([1, 4, 1, 1, 4, 1, 4]);
  });

  it('getMonthBlock은 범위 밖·비정수를 거부한다(조용히 3월로 떨어지지 않는다)', () => {
    for (const bad of [0, 49, -1, 1.5, Number.NaN]) expect(() => getMonthBlock(bad)).toThrow(RangeError);
  });
});

describe('getMonthLabel — HUD 달 이름은 블록에서 읽는다', () => {
  it('48주 전부 블록 라벨과 같다', () => {
    for (let w = 1; w <= 48; w++) expect(getMonthLabel(w), `W${w}`).toBe(getMonthBlock(w).label);
  });

  it('옛 3~6주 표에서 바뀐 주는 W21·W41·W42·W45 넷뿐이다 — 양방향으로 잠근다', () => {
    // 옛 표(main 2c3e1b6 gameEngine.getMonthLabel)를 그대로 옮긴 것. 바뀌어야 할 칸이 바뀌고, 나머지는 그대로인가.
    const OLD = [3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7, 8, 8, 8,
      9, 9, 9, 9, 10, 10, 10, 10, 11, 11, 11, 11, 12, 12, 12, 12, 12, 12, 1, 1, 1, 2, 2, 2];
    const changed: string[] = [];
    for (let w = 1; w <= 48; w++) {
      if (getMonthLabel(w) !== `${OLD[w - 1]}월`) changed.push(`W${w} ${OLD[w - 1]}월→${getMonthLabel(w)}`);
    }
    expect(changed).toEqual(['W21 7월→8월', 'W41 12월→1월', 'W42 12월→1월', 'W45 1월→2월']);
  });

  it('렌더 경로라 범위 밖에서도 throw하지 않는다 — W49는 학년말(정상), 0·NaN은 손상값', () => {
    // W49는 정상 플레이의 학년말 화면 좌표다(W48 처리 뒤 week=49, advanceFromYearEnd가 다음 학년 W1로).
    // 그때 "2월"은 맞는 말이다. getMonthBlock은 이 상태를 거부하고 이유를 말한다 — "이번 달" 판정은 학년 전환을 먼저 가를 것.
    expect(getMonthLabel(49)).toBe('2월');
    expect(() => getMonthBlock(49)).toThrow(/학년 전환 대기/);
    expect(getMonthLabel(0)).toBe('3월');
    expect(getMonthLabel(Number.NaN)).toBe('3월');
  });
});

describe('블록 × 시험 — 📝 배지와 다음 달 예고', () => {
  const exams = (year: number) =>
    MONTH_BLOCKS.flatMap(b => getExamsInMonth(year, b).map(e => `${b.label}${e.weekOfMonth}주 ${e.type}`));

  it('학년별 시험이 문서 표의 달·주에 앉는다', () => {
    expect(exams(1)).toEqual(['7월1주 unit-test', '12월2주 unit-test']);
    expect(exams(2)).toEqual(['4월4주 midterm', '7월1주 final', '10월2주 midterm', '12월2주 final']);
    expect(exams(5)).toEqual(['4월4주 midterm', '5월4주 mock', '7월1주 final', '10월2주 midterm', '11월1주 mock', '12월2주 final']);
    expect(exams(7)).toEqual(['4월4주 midterm', '5월4주 mock', '7월1주 final', '10월2주 midterm', '11월1주 mock', '11월3주 suneung']);
  });

  it('블록별 시험의 합이 시험표 전체와 같다(빠지거나 두 번 세지 않는다)', () => {
    for (let y = 1; y <= 7; y++) {
      const fromBlocks = MONTH_BLOCKS.flatMap(b => getExamsInMonth(y, b).map(e => e.week));
      expect(fromBlocks, `Y${y}`).toEqual(Object.keys(getExamSchedule(y)).map(Number).sort((a, b) => a - b));
    }
  });

  it('준비 주가 달을 넘는 자리 — 6월 → 7월 기말(전 학년), 10월 → 11월 모의고사(Y5+)', () => {
    const openings = (year: number) => MONTH_BLOCKS
      .map(b => [b.label, getNextMonthOpeningExam(year, b)] as const)
      .filter(([, e]) => e)
      .map(([l, e]) => `${l}→W${e!.week} ${e!.type}`);
    expect(openings(1)).toEqual(['6월→W17 unit-test']);
    expect(openings(2)).toEqual(['6월→W17 final']);
    expect(openings(5)).toEqual(['6월→W17 final', '10월→W33 mock']);
    expect(openings(7)).toEqual(['6월→W17 final', '10월→W33 mock']);
  });

  it('예고는 "이번 달 마지막 주가 시험 준비 주"인 경우와 정확히 같다 (시험 기간 가드와 한 근거)', () => {
    for (let y = 1; y <= 7; y++) {
      for (const b of MONTH_BLOCKS) {
        if (b.index === MONTH_BLOCKS.length) {
          expect(getNextMonthOpeningExam(y, b), `Y${y} 2월 — 다음 학년 W1엔 시험이 없다`).toBeNull();
          continue;
        }
        const lastWeekIsPrep = isExamPeriod(y, b.endWeek) && !getExamSchedule(y)[b.endWeek];
        expect(!!getNextMonthOpeningExam(y, b), `Y${y} ${b.label}`).toBe(lastWeekIsPrep);
      }
    }
  });
});
