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
// tone: 'warn' 은 컨디션 경고 등 주의 라인 — 배너에서 노란 톤으로 구분 렌더.
export type UpcomingEvent = { text: string; tone?: 'warn' };

export function getUpcomingEvents(state: GameState): UpcomingEvent[] {
  const upcoming: UpcomingEvent[] = [];
  for (const [weekStr, examType] of Object.entries(getExamSchedule(state.year))) {
    const diff = Number(weekStr) - state.week;
    if (diff > 0 && diff <= 4) {
      let text = `${EXAM_TYPE_LABELS[examType]}까지 ${diff}주`;
      // 스테이지 전환 첫 시험 — 평가 방식이 달라졌음을 사전 예고 (내부 수치는 비공개)
      if (state.year === 2 && Number(weekStr) === 8) text += ' — 이제 성적표에 등수가 나온다';
      if (state.year === 5 && Number(weekStr) === 12) text += ' — 첫 모의고사, 전국 기준 등급';
      upcoming.push({ text });
    }
  }
  // 중등+ 시험 임박 컨디션 경고 — 시험 멘탈 페널티(examSystem)의 사전 짝.
  // 사후 총평("컨디션이 최악이었다")만 있으면 이미 늦은 정보라, 쉬기/벼락치기 결정이 가능한 시점에 노출.
  if (state.year >= 2 && state.mentalState !== 'normal') {
    const nearExam = Object.keys(getExamSchedule(state.year))
      .some(w => { const d = Number(w) - state.week; return d > 0 && d <= 2; });
    if (nearExam) {
      upcoming.push({
        text: state.mentalState === 'burnout'
          ? '이 컨디션으로 시험을 보면 실력이 안 나온다'
          : '지친 채로 시험을 보면 아는 것도 놓친다',
        tone: 'warn',
      });
    }
  }
  if (state.week >= 18 && state.week < 20) upcoming.push({ text: '여름방학이 다가온다' });
  if (state.week >= 40 && state.week < 43) upcoming.push({ text: '겨울방학이 다가온다' });
  return upcoming;
}
