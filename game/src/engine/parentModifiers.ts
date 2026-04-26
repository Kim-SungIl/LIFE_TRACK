// 부모 강점 단일 셀렉터 — 6축의 모든 러닝 효과를 한 곳에서 정의.
// 분기가 gameEngine·examSystem 등에 흩어지지 않도록 하고, M6 선택편향·M7 시너지 추가 시
// 이 파일만 수정하면 되도록 만든 단일 진리의 원천(SSOT).
//
// 서사·UI 분기(예: TitleScreen scene/detail, examSystem 대사)는 별도로 유지.

import type { ParentStrength, Stats } from './types';

export interface ParentMods {
  /** 초기 스탯 보너스 (createInitialState에서 적용) */
  initStatBonus: Partial<Stats>;
  /** 학업 카테고리 활동 효율 가산 (info: +0.1) */
  studyEfficiencyBonus: number;
  /** 운동 카테고리 활동 효율 가산 (resilience: +0.1) */
  exerciseEfficiencyBonus: number;
  /** 활동당 피로 증가 배율 (resilience: 0.85 → 15% 감소) */
  fatigueIncreaseMult: number;
  /** 매주 자연 회복 가산량 (emotional: +2, mental ≥70 시 본문에서 +1로 절감) */
  fatigueRecoveryBonus: number;
  /** 루틴 보너스 도달 가속 (strict: +1주) */
  routineWeeksBoost: number;
  /** 주간 용돈 (wealth: 8 / 그 외: 3) */
  weeklyIncome: number;
  /** 주간 생활비 (wealth: 2.5 / 그 외: 1.2) */
  livingCost: number;
  /** idleWeeks 페널티 배율 (freedom: 0.5 → 절반) */
  idlePenaltyMult: number;
  /** 방학 슬롯 보너스 (freedom: +1) */
  vacationSlotBonus: number;
}

export function getParentMods(parents: readonly ParentStrength[]): ParentMods {
  const has = (p: ParentStrength) => parents.includes(p);

  // 초기 스탯 — 여러 부모 효과 합산
  const initAcademic = (has('resilience') ? 5 : 0) + (has('strict') ? 5 : 0);
  const initMental = (has('emotional') ? 10 : 0) - (has('strict') ? 3 : 0);
  const initHealth = has('resilience') ? 5 : 0;

  return {
    initStatBonus: {
      academic: initAcademic,
      mental: initMental,
      health: initHealth,
    },
    studyEfficiencyBonus: has('info') ? 0.1 : 0,
    exerciseEfficiencyBonus: has('resilience') ? 0.1 : 0,
    fatigueIncreaseMult: has('resilience') ? 0.85 : 1.0,
    fatigueRecoveryBonus: has('emotional') ? 2 : 0,
    routineWeeksBoost: has('strict') ? 1 : 0,
    // wealth 주당 8 → 6 하향 (v8.0): 7년 누적 격차를 1,243만 → ~840만으로 축소
    // (밸런스 시뮬에서 control 대비 +1,198만 측정 — 다른 부모의 6배라 OP 판정)
    weeklyIncome: has('wealth') ? 6 : 3,
    livingCost: has('wealth') ? 2.5 : 1.2,
    idlePenaltyMult: has('freedom') ? 0.5 : 1.0,
    vacationSlotBonus: has('freedom') ? 1 : 0,
  };
}
