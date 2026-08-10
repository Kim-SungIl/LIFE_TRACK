// 부모 강점 단일 셀렉터 — 6축의 모든 러닝 효과를 한 곳에서 정의.
// 분기가 gameEngine·examSystem 등에 흩어지지 않도록 하고, M6 선택편향·M7 시너지 추가 시
// 이 파일만 수정하면 되도록 만든 단일 진리의 원천(SSOT).
//
// 서사·UI 분기(예: TitleScreen scene/detail, examSystem 대사)는 별도로 유지.

import type { ParentStrength, Stats } from './types';
import { getSchoolLevel } from './backgrounds';

// 주간 용돈 곡선 — 학교급별. 고정비(학원 2/3/4 + PT 2 = 4/5/6)와 같은 경계를 쓴다.
//
// 변동 이력:
//   v8.0: wealth 8→6 하향 (시뮬상 OP)
//   v8.1: livingCost 제거 + wealth 6→5. net 입금 wealth 5만/주, 기본 3만/주
//   v8.2: **학년 고정 → 학교급 곡선.** 7년 내내 3만이었는데 학원비만 2→3→4로 올라,
//         학원+PT를 고정 루틴으로 깔면 무-wealth 기준 169주(전체의 32%)가 막혔다.
//         MainWeekScreen의 routineTooExpensive가 루틴 2칸 합계로 확정 버튼을 잠그므로
//         인게임에서는 "조용한 스킵"이 아니라 "루틴을 바꾸기 전엔 주를 못 넘김"이었다.
//
// 4/5/5를 고른 이유(4시드 시뮬):
//   · 초등을 4로 올려 **수지균형**을 만드는 게 핵심이다. 초등이 -1이면 첫 주부터 잔액이 마이너스라
//     이벤트 수입이 적립되지 않고, 그 상태로 중학교에 들어가면 초기자금을 25만 쥐여줘도 중1의
//     막힘이 안 풀린다(일회성 지급금은 그것이 메우려던 적자에 그대로 먹힌다).
//     반대로 초등만 균형이면 그 해에 쌓인 적립금이 이후 -1만/주를 7년 내내 흡수한다.
//   · 고등에만 -1만원/주를 남긴 건 의도다. 이 구간은 알바(unlockYear 4)가 이미 열려 있어
//     플레이어에게 실제 탈출구가 있다. 잠긴 구간에 적자를 두는 3/4/5와 정반대 성질.
//   · 전 구간 균형(4/5/6)은 마찰이 완전히 사라져 돈이 다시 무의미해진다.
//
// 실측(4시드): 학원+PT 기본 루틴 막힌 주 169→0, 유료루틴+유료주말 239→39주(Y5~Y7만).
const INCOME_BY_LEVEL = { elementary: 4, middle: 5, high: 5 } as const;
const WEALTH_INCOME_BONUS = 2;

/**
 * 주간 용돈 SSOT. **연차가 필요하므로 ParentMods 필드가 아니라 함수다** —
 * 필드로 두면 호출부가 연차를 잊고 학년 고정값을 쓰게 되고, 그게 v8.1의 구조였다.
 */
export function getWeeklyIncome(parents: readonly ParentStrength[], year: number): number {
  return INCOME_BY_LEVEL[getSchoolLevel(year)] + (parents.includes('wealth') ? WEALTH_INCOME_BONUS : 0);
}

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
  /** 주간 생활비 — v8.1에서 0으로 통합 (UI 노출 없는 자동 차감이 사용자 혼란 유발) */
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
    livingCost: 0,
    idlePenaltyMult: has('freedom') ? 0.5 : 1.0,
    vacationSlotBonus: has('freedom') ? 1 : 0,
  };
}
