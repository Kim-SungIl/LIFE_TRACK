// 이벤트 표시 변이 — 학교급 × 절대주차 로테이션. RNG 없음.
//
// 축:
//   1) 학교급(초/중/고) — getSchoolLevel(year). 배경 classroom_{school}과 같은 뼈대.
//   2) 같은 학교급 안 로테이션 — (absWeek(year, week) + YEAR_MIX * year) % variants.length
//      (학년 항을 섞지 않으면 48의 배수라 상쇄돼 축이 죽는다 — pickVariantIndex 주석 참조)
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

// 학년이 1 늘 때 인덱스가 움직이는 양 = 48 + YEAR_MIX.
// **이 값이 length의 배수면 학년 축이 죽는다** — 같은 주차의 모든 학년이 같은 변이를 받는다.
//   · YEAR_MIX 없음 → 이동량 48. 48은 2·3·4·6·8·12·16·24로 나누어떨어져서 축이 아예 없었다
//     (band당 변이 2개인 잡무 3종은 Y5·Y6·Y7 W10이 전부 index 0이었다).
//   · YEAR_MIX = 1 → 이동량 49 = 7². length 7·14·49에서 다시 죽거나 부분 퇴화한다.
//   · YEAR_MIX = 13 → 이동량 61(소수). length 2~60 전 구간에서 축이 살아 있다.
// 13을 고른 유일한 이유는 61이 소수라서다. 바꾸려면 (48 + 새 값)이 소수인지부터 확인할 것.
// length 2에서는 61·year와 49·year가 같은 홀짝이라 **지금 나오는 문장은 하나도 바뀌지 않는다.**
const YEAR_MIX = 13;

export function pickVariantIndex(year: number, week: number, length: number): number {
  if (length <= 0) return 0;
  return (absWeek(year, week) + YEAR_MIX * year) % length;
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
  // 여성 문장을 **어느 선택지에서** 집었는가 — femaleChoices를 지우고 나면 복원할 수 없다.
  // 이벤트 단위 boolean으로 두면 과대 판정이 된다: choice[1]에만 여성 문장이 있는데
  // 플레이어가 choice[0]을 고른 경우까지 "여성 경로"로 기록된다. resolvedFemale은
  // (이벤트, 선택지) 짝으로 엔딩을 가르므로(endingNpc) 선택지 단위로 남긴다.
  const femaleChoiceIdx = isFemale
    ? variant.choices.flatMap((c, i) => (c.femaleText || c.femaleMessage ? [i] : []))
    : [];

  return {
    ...event,
    description,
    choices: overlayChoices(event.choices, variant, isFemale),
    // 변이 문장이 이미 choices에 반영됐다. 카탈로그 성별 필드가 남으면
    // resolveEvent/GameScreen이 원본 femaleChoices를 집어 변이가 사라진다.
    femaleDescription: undefined,
    femaleChoices: undefined,
    presentedFemaleChoices: femaleChoiceIdx.length ? femaleChoiceIdx : undefined,
  };
}

// currentEvent 대입 단일 진입점 — gameEngine 주 발동 · store followup · chain · first-week.
// 한 곳만 고치면 그 경로에서만 변이가 나온다.
export function assignCurrentEvent(state: GameState, event: GameEvent, week: number): void {
  state.currentEvent = presentEvent({ ...event, week }, state);
  state.phase = 'event';
}
