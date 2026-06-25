// 활동 카드 "전략 신호" 태그 — 표시 레이어 전용 순수 함수.
// 단기 효과(describeEffect)에 안 드러나는 *장기/맥락* 결과를 라벨로 노출한다.
// 밸런스 불변: state를 읽기만 하고 mutate하지 않으며, seededRandom을 절대 호출하지 않는다(결정론 보존).
// 설계: docs/strategy-signals-design.md (#5)
import { Activity, GameState } from './types';
import { getActivityCost } from './activities';
import { getParentMods } from './parentModifiers';

export type ActivityHint = { text: string; tone: 'warn' | 'good' };

// 우선순위: 위험(피로>돈) > 기회(휴식) > 효율(고구간) > 관계. 최대 2개만 노출.
export function activityHints(a: Activity, s: GameState): ActivityHint[] {
  const hints: ActivityHint[] = [];
  const cost = getActivityCost(a, s.year);
  const weeklyIncome = getParentMods(s.parents).weeklyIncome;
  const hasAcademic = (a.effects.academic ?? 0) > 0;

  // ⚠ 피로 위험 — 실제 tired 진입 게이트(gameEngine checkMentalStateTransition)에 근접할 때만.
  // (mental<40 && fatigue>45) || fatigue>=85. mental 여유가 있으면 오경보 방지.
  if (a.fatigue > 0 && ((s.stats.mental < 40 && s.fatigue > 45) || s.fatigue >= 85)) {
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
  // 고구간 학업 효율 — 무료활동 stat>=80은 ×0.1 소프트캡(전 스탯). 유료는 면제이나 주당+2 캡으로 절대이득은 작음.
  if (hasAcademic && s.stats.academic >= 80) {
    hints.push(cost > 0
      ? { text: '🎯 유료라 효율 유지', tone: 'good' }
      : { text: '📉 고구간 효율 낮음', tone: 'warn' });
  }
  // 💛 관계 유지 — 친구와 함께하는 활동(동행 +3 → 자연감쇠 상쇄).
  if (a.category === 'social') {
    hints.push({ text: '💛 관계 유지', tone: 'good' });
  }

  return hints.slice(0, 2);
}
