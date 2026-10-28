// 피로·지침 규칙 — 엔진(applyActivity·checkMentalStateTransition)과 활동 카드 경고(activityHints)가 **같은 식**을 쓴다.
//
// 예전엔 activityHints가 엔진 식을 손으로 옮겨 두었는데, 피로 보정 다섯 중 하나(부모 resilience)만 옮기고
// 지침·번아웃 감쇠·체력 저항·체력<20 가중 넷을 빠뜨려서 "⚠ 지금 피로 위험" 경고가 엔진이 실제로 올릴 피로와
// 달랐다(2026-10 리팩토링 점검). 경고는 엔진의 진입 판정을 미리 보여 주는 장치라, 판정과 같은 함수를 읽어야 한다.
import type { Activity, GameState } from './types';
import { getParentMods } from './parentModifiers';

/** tired 진입 게이트 — 멘탈이 낮은데 피로가 쌓였거나, 피로 85+ 단독. */
export function isTiredEntry(mental: number, fatigue: number): boolean {
  return (mental < 40 && fatigue > 45) || fatigue >= 85;
}

/**
 * 이 활동을 지금 하면 오르는 피로. `resilienceApplied`는 resilience 부모 보정이 실제로 걸렸는지
 * (applyActivity가 그 주 로그에 "체질" 칩을 한 번 남기는 데 쓴다).
 */
export function activityFatigueDelta(
  state: Pick<GameState, 'mentalState' | 'stats' | 'parents'>,
  activity: Pick<Activity, 'fatigue'>,
): { delta: number; resilienceApplied: boolean } {
  const pMods = getParentMods(state.parents);
  let fatigueDelta = activity.fatigue;
  // v6.3: tired/burnout 중 활동 피로 감소 (tired 함정 방지)
  if (fatigueDelta > 0 && state.mentalState === 'burnout') {
    fatigueDelta = Math.round(fatigueDelta * 0.5);  // 번아웃: 50% 감소
  } else if (fatigueDelta > 0 && state.mentalState === 'tired') {
    fatigueDelta = Math.round(fatigueDelta * 0.75); // tired: 25% 감소
  }
  // v6.4: 체력 기반 피로 저항 (체력이 높으면 같은 활동도 덜 힘들다)
  if (fatigueDelta > 0) {
    if (state.stats.health >= 60) fatigueDelta = Math.max(1, fatigueDelta - 2);
    else if (state.stats.health >= 30) fatigueDelta = Math.max(1, fatigueDelta - 1);
  }
  // v5.2: 체력 < 20이면 피로 증가량 1.5배
  if (fatigueDelta > 0 && state.stats.health < 20) {
    fatigueDelta = Math.round(fatigueDelta * 1.5);
  }
  // v7.2: resilience 부모 — 피로 증가 -15% (타고난 체질)
  let resilienceApplied = false;
  if (fatigueDelta > 0 && pMods.fatigueIncreaseMult < 1.0) {
    fatigueDelta = Math.max(1, Math.round(fatigueDelta * pMods.fatigueIncreaseMult));
    resilienceApplied = true;
  }
  return { delta: fatigueDelta, resilienceApplied };
}
