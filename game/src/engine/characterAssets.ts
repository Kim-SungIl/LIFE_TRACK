import { getSchoolLevel } from './backgrounds';

// 캐릭터 이미지 자산 네이밍 SSOT.
// 학년(year) → stage 프리픽스 규칙을 한 곳에서 정의해, EventScene / Portrait /
// EventResultScreen / GameScreen prefetch 가 동일 규칙을 쓰도록 한다.
//
// 네이밍 (명시적 3-stage):
//   elementary: {id}_elementary_*   (Y1)
//   middle    : {id}_middle_*        (Y2~Y4)  ← 과거 무접미사 base 였음
//   high      : {id}_high_*          (Y5~Y7)
//
// 폴백 바닥은 _middle (대부분 NPC가 중학 자산을 가짐). high 전용 NPC(junha)는
// _middle 이 없지만 해당 year(Y5+)에서 stage 프리픽스가 _high 이므로 1차에서 로드됨.

type SchoolLevel = 'elementary' | 'middle' | 'high';

/**
 * 학교급(level)별 stage 프리픽스.
 */
export function characterStagePrefixByLevel(id: string, level: SchoolLevel): string {
  if (level === 'elementary') return `${id}_elementary`;
  if (level === 'high') return `${id}_high`;
  return `${id}_middle`;
}

/**
 * 주어진 year의 stage 프리픽스. year 미지정 시 _middle(중학)로 간주.
 */
export function characterStagePrefix(id: string, year?: number): string {
  return characterStagePrefixByLevel(id, year === undefined ? 'middle' : getSchoolLevel(year));
}

/**
 * 폴백 바닥 프리픽스 — staged 자산이 없을 때 떨어질 공통 베이스(중학).
 */
export function characterFallbackPrefix(id: string): string {
  return `${id}_middle`;
}
