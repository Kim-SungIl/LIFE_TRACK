import { StatKey, GameEvent } from '../../engine/types';

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
