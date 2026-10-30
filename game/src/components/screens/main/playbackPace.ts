// 재생 카드가 머무는 시간 — PlaybackCard에서 분리(react-refresh: 컴포넌트 파일은 컴포넌트만 export).
// 왜 글자 수에 맞추나는 PlaybackCard.tsx 머리 주석.
/** 카드가 머무는 시간(ms) — 보통의 하한·상한 / 글자당 / "다음 멈춤까지". */
export const CARD_DWELL_MIN_MS = 4000;
export const CARD_DWELL_MAX_MS = 6500;
export const CARD_DWELL_PER_CHAR_MS = 45;
export const CARD_DWELL_FAST_MS = 600;
/** 이만큼 넘게 누르고 뗐으면 읽으려고 누른 것 — 뒤따르는 click으로 넘기지 않는다. */
export const LONG_PRESS_MS = 300;
/** 누름을 떼고 다시 이어 갈 때의 최소 시간 — 다 된 타이머가 ⏸ click보다 먼저 돌지 않게. */
export const RESUME_MIN_MS = 400;

/** 보통 속도로 카드가 머무는 시간 — 카드에 실린 글자 수(공백 제외)에 비례하고 하한·상한 안에 둔다. */
export function cardDwellMs(textLength: number): number {
  return Math.min(CARD_DWELL_MAX_MS, Math.max(CARD_DWELL_MIN_MS, Math.round(textLength * CARD_DWELL_PER_CHAR_MS)));
}
