// 이벤트 표시 변이 — 학교급 × 절대주차 로테이션. RNG 없음.
//
// 축:
//   1) 학교급(초/중/고) — getSchoolLevel(year). 배경 classroom_{school}과 같은 뼈대.
//   2) 같은 학교급 안 로테이션 — absWeek(year, week) % variants.length
//
// 난수를 쓰지 않는 이유: seededRandom(state)는 rngSeed를 mutate한다(rng.ts).
// 변이 뽑기에 쓰면 이후 모든 굴림이 한 칸씩 밀려 시드 재현·sim 수치가 같이 흔들린다.
// 주차 모듈로 고르면 저장/로드·재렌더·시드 재현이 자동으로 안정된다.
//
// 성별 교차 규칙:
//   schoolVariants가 있으면 그 변이의 femaleDescription/femaleText/femaleMessage가 이긴다.
//   변이에 여성 필드가 없으면 변이 기본 문장을 남녀 모두 본다(카탈로그 femaleDescription은 쓰지 않는다 —
//   기본 장면용 여성 문장을 다른 학교급 장면에 얹으면 축이 섞인다).
//   schoolVariants가 없으면 기존 femaleDescription/femaleChoices.

import type { EventChoice, EventTextVariant, GameEvent, GameState, SchoolBand } from './types';
import { getSchoolLevel } from './backgrounds';
import { absWeek } from './weekMath';

export type EventPresentationCtx = Pick<GameState, 'year' | 'gender'> & {
  week: number;
};

export function schoolBandForYear(year: number): SchoolBand {
  return getSchoolLevel(year);
}

export function pickVariantIndex(year: number, week: number, length: number): number {
  if (length <= 0) return 0;
  return absWeek(year, week) % length;
}

function overlayChoices(
  base: EventChoice[],
  variant: EventTextVariant,
  isFemale: boolean,
): EventChoice[] {
  return base.map((choice, i) => {
    const v = variant.choices[i];
    if (!v) return { ...choice };
    return {
      ...choice,
      text: isFemale && v.femaleText ? v.femaleText : v.text,
      message: isFemale && v.femaleMessage ? v.femaleMessage : v.message,
    };
  });
}

function withGenderFallback(event: GameEvent, isFemale: boolean): GameEvent {
  if (isFemale && event.femaleDescription) {
    return {
      ...event,
      description: event.femaleDescription,
      choices: (event.femaleChoices ?? event.choices).map(c => ({ ...c })),
    };
  }
  return {
    ...event,
    choices: event.choices.map(c => ({ ...c })),
  };
}

export function presentEvent(event: GameEvent, ctx: EventPresentationCtx): GameEvent {
  const week = event.week ?? ctx.week;
  const isFemale = ctx.gender === 'female';

  if (!event.schoolVariants) {
    return withGenderFallback(event, isFemale);
  }

  const band = schoolBandForYear(ctx.year);
  const list = event.schoolVariants[band];
  if (!list || list.length === 0) {
    return withGenderFallback(event, isFemale);
  }

  const variant = list[pickVariantIndex(ctx.year, week, list.length)];
  const description = isFemale && variant.femaleDescription
    ? variant.femaleDescription
    : variant.description;

  return {
    ...event,
    description,
    choices: overlayChoices(event.choices, variant, isFemale),
    // 변이 문장이 이미 choices에 반영됐다. 카탈로그 성별 필드가 남으면
    // resolveEvent/GameScreen이 원본 femaleChoices를 집어 변이가 사라진다.
    femaleDescription: undefined,
    femaleChoices: undefined,
  };
}

// currentEvent 대입 단일 진입점 — gameEngine 주 발동 · store followup · chain · first-week.
// 한 곳만 고치면 그 경로에서만 변이가 나온다.
export function assignCurrentEvent(state: GameState, event: GameEvent, week: number): void {
  state.currentEvent = presentEvent({ ...event, week }, state);
  state.phase = 'event';
}
