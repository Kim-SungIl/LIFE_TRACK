// 절대주차 SSOT — 한 학년 48주 가정(W48 전환). "몇 주 전" 비교용이라 ±1주 오차는 무해.
// 관계 신호(relationshipSignals)·이벤트 페이싱(events/selection) 공용. 의존 없는 순수 leaf 모듈.
export function absWeek(year: number, week: number): number {
  return (year - 1) * 48 + week;
}

// ===== 학기 구조 SSOT =====
// 1학기: W1~W19, 여름방학: W20~W24, 2학기: W25~W42, 겨울방학: W43~W48.
// gameEngine에 있던 것을 leaf로 내렸다 — 계절을 읽어야 하는 층(말걸기·관계 신호)이
// gameEngine을 끌어오면 순환이 된다(gameEngine → relationshipSignals → …).
// gameEngine은 기존 import 경로 유지를 위해 재노출한다(absWeek과 같은 방식).
export function getWeekInfo(week: number) {
  if (week <= 19) return { semester: 1 as const, isVacation: false, label: `1학기 ${week}주차` };
  if (week <= 24) return { semester: 1 as const, isVacation: true, label: `여름방학 ${week - 19}주차` };
  if (week <= 42) return { semester: 2 as const, isVacation: false, label: `2학기 ${week - 24}주차` };
  return { semester: 2 as const, isVacation: true, label: `겨울방학 ${week - 42}주차` };
}

// ===== 월 블록 SSOT (월 단위 계획, docs/monthly-plan-design-2026-10.md §2) =====
// 한 학년 48주 = 12블록 × 4주. 계획·용돈의 단위이고, 엔진은 여전히 주 단위로 돈다.
// 블록이 학기인지 방학인지는 **위 학기 구조에서 파생한다** — 경계(W19/20, W24/25, W42/43)를
// 여기 따로 적으면 두 표가 갈린다(#441). 그래서 섞인 달(7월 = 학기 3 + 방학 1, 1월 = 2 + 2)도 계산으로 나온다.

/** 한 블록(달)의 주 수. */
export const WEEKS_PER_MONTH = 4;
/** 한 학년의 블록 수 — 48 / 4. */
export const MONTHS_PER_YEAR = 12;
/** 블록 번호(1~12) → 달 이름의 숫자. 학년은 3월에 시작한다. */
const MONTH_NUMBERS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2] as const;

export interface MonthBlock {
  /** 1~12 — 학년 안에서 몇 번째 달인가. */
  index: number;
  /** "4월" 같은 표시 이름. */
  label: string;
  startWeek: number;
  endWeek: number;
  /** 블록 안의 학기 주 수(0~4). 루틴비는 이 주 수만큼만 청구한다(설계안 §4). */
  semesterWeeks: number;
  /** 블록 안의 방학 주 수(0~4). */
  vacationWeeks: number;
  /** 계획 화면의 모양 — 학기형 / 방학형 / 섞인 달(학기 부분 + 방학 부분). */
  kind: 'semester' | 'vacation' | 'mixed';
}

function buildMonthBlock(index: number): MonthBlock {
  const startWeek = (index - 1) * WEEKS_PER_MONTH + 1;
  const endWeek = startWeek + WEEKS_PER_MONTH - 1;
  let vacationWeeks = 0;
  for (let w = startWeek; w <= endWeek; w++) if (getWeekInfo(w).isVacation) vacationWeeks++;
  const semesterWeeks = WEEKS_PER_MONTH - vacationWeeks;
  const kind = vacationWeeks === 0 ? 'semester' : semesterWeeks === 0 ? 'vacation' : 'mixed';
  return { index, label: `${MONTH_NUMBERS[index - 1]}월`, startWeek, endWeek, semesterWeeks, vacationWeeks, kind };
}

/** 학년 하나의 12블록. 학년마다 같다(학기 구조가 학년과 무관). */
export const MONTH_BLOCKS: readonly MonthBlock[] = Array.from({ length: MONTHS_PER_YEAR }, (_, i) => buildMonthBlock(i + 1));

/**
 * 주차(1~48)가 속한 블록. 범위 밖이면 throw한다 — 조용히 3월로 떨어지면 라벨이 거짓말한다.
 *
 * ⚠️ **W49는 손상값이 아니라 정상 상태다.** W48을 처리하면 `week`가 49가 된 채 학년말 화면(phase
 * 'year-end')에 머물고, `advanceFromYearEnd`가 다음 학년 W1로 넘긴다(Y1~Y6 매년, 3자 검수 재현).
 * 그래서 `state.week`를 그대로 넘기는 호출처는 학년말에서 터진다. "이번 달" 판정이 필요한 쪽
 * (월초 용돈 등)은 학년 전환 대기를 먼저 갈라야 한다 — 그 상태는 어느 달에도 속하지 않는다.
 */
export function getMonthBlock(week: number): MonthBlock {
  if (!Number.isInteger(week) || week < 1 || week > WEEKS_PER_MONTH * MONTHS_PER_YEAR) {
    throw new RangeError(`getMonthBlock: 주차는 1~48 정수여야 한다 (받은 값 ${week}` +
      `${week === WEEKS_PER_MONTH * MONTHS_PER_YEAR + 1 ? ' — 학년 전환 대기(year-end)는 어느 달에도 속하지 않는다' : ''})`);
  }
  return MONTH_BLOCKS[Math.ceil(week / WEEKS_PER_MONTH) - 1];
}

/** 블록 안에서 몇 번째 주인가(1~4). */
export function getWeekOfMonth(week: number): number {
  return week - getMonthBlock(week).startWeek + 1;
}

/** 계절 — 잡담·미니이벤트 게이트가 공유하는 단일 근거. state.isVacation(저장 필드)을 읽지 않는다. */
export function getSeason(week: number): 'semester' | 'vacation' {
  return getWeekInfo(week).isVacation ? 'vacation' : 'semester';
}
