// 활동 카드 "전략 신호" 태그 — 표시 레이어 전용 순수 함수.
// 단기 효과(describeEffect)에 안 드러나는 *장기/맥락* 결과를 라벨로 노출한다.
// 밸런스 불변: state를 읽기만 하고 mutate하지 않으며, seededRandom을 절대 호출하지 않는다(결정론 보존).
// 설계: docs/strategy-signals-design.md (#5)
import { Activity, GameState } from './types';
import { getActivityCost, NPC_COMPANION_ACTIVITIES } from './activities';
import { getParentMods } from './parentModifiers';

export type ActivityHint = { text: string; tone: 'warn' | 'good' };

// 우선순위: 위험(피로>돈) > 기회(휴식) > 효율(고구간) > 관계. 최대 2개만 노출.
export function activityHints(a: Activity, s: GameState): ActivityHint[] {
  const hints: ActivityHint[] = [];
  const cost = getActivityCost(a, s.year);
  const weeklyIncome = getParentMods(s.parents).weeklyIncome;
  // 이 활동을 하면 도달할 피로 — tired 게이트는 활동 피로 적용 후 검사하므로 예측값으로 비교.
  const projFatigue = s.fatigue + a.fatigue;

  // ⚠ 피로 위험 — 실제 tired 진입 게이트(gameEngine checkMentalStateTransition)에 근접할 때만.
  // (mental<40 && fatigue>45) || fatigue>=85. mental 여유가 있으면 오경보 방지. 활동 피로를 더해 "이 선택으로 넘는" 경우도 포착.
  if (a.fatigue > 0 && ((s.stats.mental < 40 && projFatigue > 45) || projFatigue >= 85)) {
    hints.push({ text: '⚠ 지금 피로 위험', tone: 'warn' });
  }
  // 💸 돈 부담 — 주당소득 2배 이상(고정 임계 대신 상대 기준: wealth 부모는 소득이 높음).
  if (cost >= weeklyIncome * 2) {
    hints.push({ text: '💸 돈 부담 큼', tone: 'warn' });
  }
  // 🌙 회복 필요 — 지친 상태에서의 휴식 권장(엄밀 게이트 아닌 넛지).
  if (a.category === 'rest' && (s.mentalState !== 'normal' || s.fatigue >= 60)) {
    hints.push({ text: '🌙 지금 필요함', tone: 'good' });
  }
  // 고구간 학업 효율 — study 계열만(academic이 부차 효과인 talent 활동 오경보 방지). academic>=80에서:
  // 무료(cost===0)는 ×0.1 소프트캡(gameEngine:234) → 효율 낮음 / 유료(cost>0)는 면제이나 주당+2 캡으로 절대이득은 작음.
  if (a.category === 'study' && s.stats.academic >= 80) {
    if (cost === 0) hints.push({ text: '📉 고구간 효율 낮음', tone: 'warn' });
    else if (cost > 0) hints.push({ text: '🎯 유료라 효율 유지', tone: 'good' });
    // cost<0(용돈 버는 학업 활동)은 소프트캡 면제이나 "유료"도 아니므로 무표시.
  }
  // 💛 관계 유지 — NPC 동행 선택이 열리는 활동만(친밀도 +3 → 자연감쇠 상쇄). category가 아니라 동행 집합 기준.
  if (NPC_COMPANION_ACTIVITIES.includes(a.id)) {
    hints.push({ text: '💛 관계 유지', tone: 'good' });
  }

  return hints.slice(0, 2);
}
