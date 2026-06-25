// 관계 UI "신호" — 표시 레이어 전용 순수 함수.
// 친밀도 바(숫자)만으로 안 보이는 관계의 온도(방치/최근/임박)를 한 줄 신호로 노출한다.
// 밸런스 불변: 읽기만 하고 seededRandom 미호출. 설계: docs/strategy-signals-design.md (#4)
import { NpcState } from './types';

// 절대주차 SSOT — 한 학년 48주 가정(W48 전환). "몇 주 전" 비교용이라 ±1주 오차는 무해.
export function absWeek(year: number, week: number): number {
  return (year - 1) * 48 + week;
}

export type RelationSignal = { text: string; tone: 'warn' | 'good' | 'info' } | null;

// 우선순위: 임박 > 방치 > 최근 (하나만 노출).
// 임박: smalltalk 깊이 티어(talkSystem 30/50/70) 5점 이내 아래 → 곧 더 깊은 대화가 열림.
// 방치/최근: lastInteractionWeek가 있을 때만. 감쇠 하한 20·약함이라 "잃는다"가 아니라 "멀어지는 중" 톤.
export function relationshipSignal(npc: NpcState, absNow: number): RelationSignal {
  const TIERS = [30, 50, 70];
  if (TIERS.some(t => npc.intimacy >= t - 5 && npc.intimacy < t)) {
    return { text: '✨ 곧 더 가까워질 듯', tone: 'good' };
  }
  if (npc.lastInteractionWeek !== undefined) {
    const weeksSince = absNow - npc.lastInteractionWeek;
    if (weeksSince >= 8 && npc.intimacy > 20) return { text: '🍂 요즘 뜸하다', tone: 'warn' };
    if (weeksSince <= 2) return { text: '💛 최근 함께함', tone: 'good' };
  }
  return null;
}
