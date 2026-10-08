// **T66 — 회복을 인정하는 한 줄.** 행복 등급은 그대로 두고(궤적 캡은 의도된 설계), 학년별 궤적이
// "무너졌다가 다시 일어나 끝났다"를 뒷받침하는 판에만 관찰 문장을 낸다.
//
// 잠그는 것:
//   · 근거는 학년별 궤적이다 — 마지막 스냅샷이 좋아도 궤적이 회복을 말하지 않으면 미출력.
//   · 문턱 양방향: 단단한 꼬리 1해/2해, 무너진 해 C/B 경계(저멘탈 10주/9주, 바닥 2주/1주, 번아웃 3/2),
//     단단한 해 A/B 경계(저멘탈 3주/4주), 졸업 순간 mental 40/39.9.
//   · 근거 없는 구세이브(로드가 배열을 메운 판 — 전부 없음·일부 없음·칸 손상)는 미출력. 제품 경로(migrateLoadedState)로 본다.
//   · 등급·타이틀·진로 불변 — 회복 판과 같은 판에서 회복 근거만 지운 판의 판정 층이 같다.
import { describe, expect, it } from 'vitest';
import {
  calculateEnding, recoveryClaimOf, recoveryNoteOf, RECOVERY_FINAL_MENTAL, RECOVERY_MIN_CLEAN_YEARS, RECOVERY_NOTE,
} from '../ending';
import { createInitialState, processWeek } from '../gameEngine';
import { migrateLoadedState } from '../stateMigration';
import { judgmentLine } from './endingStateGrid';
import type { GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];

interface Traj { low?: readonly number[]; vlow?: readonly number[]; bo?: readonly number[]; mental?: number }
const Z = [0, 0, 0, 0, 0, 0, 0];

function st(t: Traj): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 3 });
  s.stats = { academic: 70, talent: 50, social: 60, mental: t.mental ?? 85, health: 70 };
  s.lowMentalWeeksByYear = [...(t.low ?? Z)];
  s.veryLowMentalWeeksByYear = [...(t.vlow ?? Z)];
  s.burnoutCountByYear = [...(t.bo ?? Z)];
  return s;
}

describe('recoveryClaimOf — 궤적이 회복을 뒷받침할 때만', () => {
  it('중2에 크게 무너지고(저멘탈 20주) 고1~고3을 단단하게 보낸 판 → 출력', () => {
    const c = recoveryClaimOf(st({ low: [0, 0, 20, 5, 0, 0, 0] }));
    expect(c).toEqual({ lastFallenYear: 3, cleanTailYears: 3 });
    expect(recoveryNoteOf(st({ low: [0, 0, 20, 5, 0, 0, 0] }))).toBe(RECOVERY_NOTE);
  });

  it('한 번도 무너지지 않은 판 → 미출력(회복할 게 없다)', () => {
    expect(recoveryClaimOf(st({}))).toBeNull();
    expect(recoveryClaimOf(st({ low: [3, 9, 0, 0, 0, 0, 0] }))).toBeNull(); // B·A만 있는 판
  });

  it('끝까지 무너져 있던 판 → 미출력', () => {
    expect(recoveryClaimOf(st({ low: [0, 20, 20, 20, 20, 20, 20], mental: 85 }))).toBeNull();
  });

  // 꼬리 길이 문턱 — 양방향.
  it(`단단한 꼬리 ${RECOVERY_MIN_CLEAN_YEARS}해 → 출력 / ${RECOVERY_MIN_CLEAN_YEARS - 1}해 → 미출력`, () => {
    expect(RECOVERY_MIN_CLEAN_YEARS).toBe(2);
    expect(recoveryClaimOf(st({ low: [0, 0, 0, 0, 20, 0, 0] }))?.cleanTailYears).toBe(2);
    expect(recoveryClaimOf(st({ low: [0, 0, 0, 0, 0, 20, 0] }))).toBeNull();
  });

  // 무너진 해 = 그 해 궤적 C 이상(학년말 카드와 같은 산식). 경계 양쪽.
  it.each([
    ['저멘탈 10주(20.8%) → 무너진 해', { low: [0, 0, 10, 0, 0, 0, 0] }, true],
    ['저멘탈 9주(18.8%) → 흔들린 해(B)일 뿐', { low: [0, 0, 9, 0, 0, 0, 0] }, false],
    ['바닥 2주(4.2%) → 무너진 해', { low: [0, 0, 2, 0, 0, 0, 0], vlow: [0, 0, 2, 0, 0, 0, 0] }, true],
    ['바닥 1주(2.1%) → 흔들린 해(B)', { low: [0, 0, 1, 0, 0, 0, 0], vlow: [0, 0, 1, 0, 0, 0, 0] }, false],
    ['번아웃 3회 → 무너진 해', { bo: [0, 0, 3, 0, 0, 0, 0] }, true],
    ['번아웃 2회 → 흔들린 해(B)', { bo: [0, 0, 2, 0, 0, 0, 0] }, false],
  ] as const)('%s', (_l, t, shown) => {
    expect(recoveryClaimOf(st(t)) !== null).toBe(shown);
  });

  // 단단한 해 = 그 해 궤적 S·A. A/B 경계 양쪽 — B 한 해가 꼬리를 끊는다.
  it.each([
    ['꼬리에 저멘탈 3주인 해(A) → 꼬리 유지', { low: [0, 20, 0, 0, 0, 3, 3] }, true],
    ['꼬리에 저멘탈 4주인 해(B) → 꼬리가 끊긴다', { low: [0, 20, 0, 0, 0, 0, 4] }, false],
    ['꼬리에 번아웃 1회(B) → 꼬리가 끊긴다', { low: [0, 20, 0, 0, 0, 0, 0], bo: [0, 0, 0, 0, 0, 0, 1] }, false],
  ] as const)('%s', (_l, t, shown) => {
    expect(recoveryClaimOf(st(t)) !== null).toBe(shown);
  });

  it(`졸업 순간 mental ${RECOVERY_FINAL_MENTAL} → 출력 / 39.9 → 미출력(궤적이 좋아도 다시 가라앉아 끝났다)`, () => {
    const t = { low: [0, 20, 0, 0, 0, 0, 0] };
    expect(recoveryClaimOf(st({ ...t, mental: 40 }))).not.toBeNull();
    expect(recoveryClaimOf(st({ ...t, mental: 39.9 }))).toBeNull();
  });

  it('스냅샷만으로는 주장하지 않는다 — mental 100이어도 궤적에 무너진 해가 없으면 미출력', () => {
    expect(recoveryClaimOf(st({ mental: 100 }))).toBeNull();
  });

  // ↓ 구세이브는 **제품 경로(migrateLoadedState)를 거쳐** 본다. 로드는 빠진 배열을 0으로 메우므로
  //   recoveryClaimOf에 원본을 직접 넣는 테스트로는 제품에서 실제로 무슨 일이 나는지 못 본다(3자 검수).
  const roundTrip = (s: GameState, drop: (keyof GameState)[]) => {
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    for (const k of drop) delete raw[k];
    return migrateLoadedState(raw as unknown as GameState);
  };

  it('전제(양성 대조): 배열이 다 있는 세이브는 로드 뒤에도 회복 문장이 나온다', () => {
    const loaded = roundTrip(st({ bo: [0, 3, 0, 0, 0, 0, 0] }), []);
    expect(loaded.happinessTrajectoryBackfilled).toBeUndefined();
    expect(calculateEnding(loaded).recoveryNote).toBe(RECOVERY_NOTE);
  });

  it('일부 배열만 있는 손상 세이브: 번아웃 배열이 무너진 해를 말해도, 메운 저멘탈 0으로 "그 뒤 단단했다"를 지어내지 않는다', () => {
    const loaded = roundTrip(st({ bo: [0, 3, 0, 0, 0, 0, 0] }), ['lowMentalWeeksByYear', 'veryLowMentalWeeksByYear']);
    expect(loaded.lowMentalWeeksByYear, '전제: 로드가 0으로 메웠다').toEqual(Z);
    expect(loaded.happinessTrajectoryBackfilled).toBe(true);
    expect(calculateEnding(loaded).recoveryNote).toBeNull();
  });

  it('칸이 깨진 배열(숫자 아님)도 메운 것으로 본다', () => {
    const s = st({ bo: [0, 3, 0, 0, 0, 0, 0] });
    (s.lowMentalWeeksByYear as unknown[])[5] = 'x';
    const loaded = roundTrip(s, []);
    expect(loaded.happinessTrajectoryBackfilled).toBe(true);
    expect(calculateEnding(loaded).recoveryNote).toBeNull();
  });

  it('T21 이전 세이브(세 배열 모두 없음)는 미출력', () => {
    const loaded = roundTrip(st({ bo: [0, 3, 0, 0, 0, 0, 0] }), ['lowMentalWeeksByYear', 'veryLowMentalWeeksByYear', 'burnoutCountByYear']);
    expect(loaded.happinessTrajectoryBackfilled).toBe(true);
    expect(calculateEnding(loaded).recoveryNote).toBeNull();
  });

  it('메운 표시는 다음 마이그레이션(매주 processWeek)에서도 유지된다 — 메운 배열은 멀쩡해 보이므로', () => {
    const once = roundTrip(st({ bo: [0, 3, 0, 0, 0, 0, 0] }), ['lowMentalWeeksByYear']);
    const twice = migrateLoadedState(JSON.parse(JSON.stringify(once)) as GameState);
    expect(twice.happinessTrajectoryBackfilled).toBe(true);
    expect(calculateEnding(twice).recoveryNote).toBeNull();
  });

  it('새 판은 표시가 없다(processWeek를 거쳐도)', () => {
    const s = processWeek(createInitialState('female', PARENTS, { rngSeed: 5 }));
    expect(s.happinessTrajectoryBackfilled).toBeUndefined();
  });
});

describe('calculateEnding — 회복 층은 판정을 하나도 바꾸지 않는다', () => {
  it('회복 근거만 다른 두 판(무너진 해 저멘탈 10주 vs 9주, 행복은 둘 다 A)은 판정 층이 같고 회복 문장만 다르다', () => {
    // 같은 판정 층을 보려면 행복 궤적 캡이 같아야 한다 — 7년 창에서 둘 다 A가 되는 쌍을 쓴다.
    // 회복 판: 저멘탈 10주 한 해(7년 창 10/336 = 3% → A). 비교 판: 9주(2.7% → A).
    const recovered = calculateEnding(st({ low: [0, 10, 0, 0, 0, 0, 0] }));
    const shaky = calculateEnding(st({ low: [0, 9, 0, 0, 0, 0, 0] }));
    expect(recovered.recoveryNote).toBe(RECOVERY_NOTE);
    expect(shaky.recoveryNote).toBeNull();
    expect(recovered.happiness).toBe('A');
    expect(judgmentLine(recovered)).toBe(judgmentLine(shaky));
  });

  it('엔딩 데이터의 recoveryNote는 recoveryNoteOf와 같은 값이다(두 층이 따로 계산하지 않는다)', () => {
    for (const t of [{}, { low: [0, 0, 20, 0, 0, 0, 0] }, { low: [0, 0, 0, 0, 0, 20, 0] }] as Traj[]) {
      const s = st(t);
      expect(calculateEnding(s).recoveryNote).toBe(recoveryNoteOf(s));
    }
  });
});
