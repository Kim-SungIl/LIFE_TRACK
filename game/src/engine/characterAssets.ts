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

/**
 * 후보 목록에서 **실재하는 첫 파일**을 고른다. 없으면 null(→ CSS 아바타).
 *
 * 이전엔 첫 후보를 그냥 요청하고 `onError`로 다음으로 넘어갔다. 그래서 실물이 없는
 * 축(표정·성별 변주)에서 **매번 헛 왕복이 났다.** dev는 SPA 폴백이 200 text/html을 주고
 * 디코드가 깨지며, 배포는 404다. 어느 쪽이든 요청 1회 + 디코드 실패 + 리렌더가 붙는다.
 *
 * `has`는 build 시점 manifest다(`CHARACTER_MANIFEST`). dev에서 새 파일을 넣으면
 * predev 훅이 다시 돌아야 보인다 — CG manifest와 같은 규약이다.
 */
export function pickExisting(
  candidates: readonly string[],
  has: ReadonlySet<string>,
): string | null {
  for (const f of candidates) if (has.has(f)) return f;
  return null;
}

/**
 * 초상 파일명 후보 — staged 표정 → staged neutral → base 표정 → base neutral.
 * **파일명만 돌려준다**(경로·webp 스왑은 호출부 책임).
 */
export function portraitCandidates(id: string, expr: string, year?: number): string[] {
  const stage = characterStagePrefix(id, year);
  const base = characterFallbackPrefix(id);
  const out = [`${stage}_${expr}.png`, `${stage}_neutral.png`];
  if (stage !== base) out.push(`${base}_${expr}.png`, `${base}_neutral.png`);
  return [...new Set(out)];
}

/**
 * 이벤트 전신 스프라이트 후보 — 여주는 `_f` 변주를 먼저 본다.
 * 전신이 아예 없으면 neutral(파스텔 배경)이라도 세우는 기존 동작을 유지한다.
 */
export function spriteCandidates(id: string, gender: 'male' | 'female', year?: number): string[] {
  const stage = characterStagePrefix(id, year);
  const base = characterFallbackPrefix(id);
  const g = gender === 'female' ? '_f' : '';
  const out = [
    ...(g ? [`${stage}_fullbody${g}.png`] : []),
    `${stage}_fullbody.png`,
    `${stage}_neutral.png`,
    ...(g ? [`${base}_fullbody${g}.png`] : []),
    `${base}_fullbody.png`,
    `${base}_neutral.png`,
  ];
  return [...new Set(out)];
}
