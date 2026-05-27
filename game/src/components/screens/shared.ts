import { StatKey, GameEvent, GameState, EXAM_TYPE_LABELS } from '../../engine/types';
import { getExamSchedule } from '../../engine/examSystem';

export const STAT_ICONS: Record<StatKey, string> = {
  academic: '📚', social: '⭐', talent: '💡', mental: '🍀', health: '⚡',
};

export const PARENT_ICONS: Record<string, string> = {
  emotional: '🫂', wealth: '🏠', info: '📱',
  strict: '📐', resilience: '⭐', freedom: '🌿',
};

// 이벤트 선택 결과 페이로드 — GameScreen 의 eventResultData state 와 EventResultScreen props 가 공유.
export type EventResultData = {
  message: string;
  effects: Record<string, string>[];
  event?: GameEvent;
  choiceIndex?: number;
};

// 결과 메시지 자동 줄바꿈 — 문장 끝(`.` `?` `!`, 따옴표 포함) 다음 공백에서 줄바꿈.
// 말줄임표(`...`)는 문장 경계가 아니므로 앞이 `[.!?]`인 경우 분할 제외.
export function breakSentences(text: string): string {
  return text.replace(/(?<![.!?])([.!?]"?)\s+(?=\S)/g, '$1\n');
}

// 피로도 → 라벨/색. 메인 HUD 와 주간 결산이 동일 기준을 쓰도록 SSOT.
export function getFatigueDisplay(fatigue: number): { label: string; color: string } {
  const label = fatigue < 20 ? '좋음' : fatigue < 35 ? '경미' : fatigue < 50 ? '주의' : fatigue < 70 ? '위험' : '극한!';
  const color = fatigue < 20 ? 'var(--green)' : fatigue < 35 ? 'var(--yellow)' : fatigue < 50 ? 'orange' : 'var(--red)';
  return { label, color };
}

// 다가오는 이벤트 — 시험 스케줄 SSOT(getExamSchedule) + 방학 임박 안내.
// 메인 화면 배너와 주간 결산 미리보기가 공유.
export function getUpcomingEvents(state: GameState): string[] {
  const upcoming: string[] = [];
  for (const [weekStr, examType] of Object.entries(getExamSchedule(state.year))) {
    const diff = Number(weekStr) - state.week;
    if (diff > 0 && diff <= 4) upcoming.push(`${EXAM_TYPE_LABELS[examType]}까지 ${diff}주`);
  }
  if (state.week >= 18 && state.week < 20) upcoming.push('여름방학이 다가온다');
  if (state.week >= 40 && state.week < 43) upcoming.push('겨울방학이 다가온다');
  return upcoming;
}
