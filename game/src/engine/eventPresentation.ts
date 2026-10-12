// 이벤트 표시 변이 — 학교급 × 절대주차 로테이션. RNG 없음.
//
// 축:
//   1) 학교급(초/중/고) — getSchoolLevel(year). 배경 classroom_{school}과 같은 뼈대.
//   2) 같은 학교급 안 로테이션 — (absWeek(year, week) + YEAR_MIX * year) % variants.length
//      (학년 항을 섞지 않으면 48의 배수라 상쇄돼 축이 죽는다 — pickVariantIndex 주석 참조)
//   3) 계절 — 변이의 season 태그. 로테이션 전에 계절이 안 맞는 변이를 뺀다(seasonVariants).
//      변이가 없는 장면(도달형)은 vacationText — 방학 주에 바꿀 칸만 덮는다(withVacationText).
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

import type { EventChoice, EventTextVariant, GameEvent, GameState, SchoolBand, VacationText } from './types';
import { getSchoolLevel } from './backgrounds';
import { presentRomanceEvent } from './romance';
import { absWeek, getSeason } from './weekMath';

export type EventPresentationCtx = Pick<GameState, 'year' | 'gender'> & Partial<Pick<GameState, 'relationship'>> & {
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
// 13인 이유는 61이 소수라서다 — 13 자체가 유일한 답은 아니다(19 → 67도 같은 성질).
// 바꾸려면 (48 + 새 값)이 소수인지부터 확인할 것.
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

// 방학 판본 — 성별 판본을 고른 **뒤에** 적힌 칸(문장)만 덮는다. 효과·조건은 건드리지 않고 femaleChoices의 유무도 그대로라
// resolvedFemale(엔딩 해시)도 학기와 같은 길로 정해진다.
// 카탈로그에 femaleDescription이 있는데 방학 판본엔 남성 지문만 있으면 여성은 학기 지문을 본다 —
// 남성 지문을 여성에게 얹지 않는다(presentEvent 머리 주석의 '축이 섞인다'와 같은 이유).
// 그 상태 자체는 schoolSceneVacationGate.test.ts가 막는다.
function withVacationText(shown: GameEvent, vt: VacationText, isFemale: boolean, hasFemaleDesc: boolean): GameEvent {
  const description = isFemale
    ? (vt.femaleDescription ?? (hasFemaleDesc ? undefined : vt.description) ?? shown.description)
    : (vt.description ?? shown.description);
  const overlay = (list: EventChoice[]) => list.map((c, i) => {
    const v = vt.choices?.[i];
    if (!v) return c;
    return {
      ...c,
      text: (isFemale ? v.femaleText : undefined) ?? v.text ?? c.text,
      message: (isFemale ? v.femaleMessage : undefined) ?? v.message ?? c.message,
    };
  });
  return {
    ...shown,
    description,
    choices: overlay(shown.choices),
    // 여성 경로는 resolveEvent·GameScreen이 femaleChoices를, EventScene이 femaleDescription을 직접 집는다 —
    // 거기에도 같은 문장을 둬야 방학 판본이 화면과 기록에 닿는다. femaleChoices는 **자기 원본 위에** 덮는다:
    // femaleDescription 없이 femaleChoices만 있는 사건은 choices가 남성 판본이라, 그걸 복사하면 여성 효과가 바뀐다.
    ...(isFemale && shown.femaleDescription !== undefined ? { femaleDescription: description } : {}),
    ...(isFemale && shown.femaleChoices ? { femaleChoices: overlay(shown.femaleChoices) } : {}),
  };
}

// 계절이 안 맞는 변이를 뺀다. 학기에는 'vacation' 변이만 빠지고 나머지는 원래 순서라
// **방학 판본을 더해도 학기 문장은 인덱스까지 그대로다**.
// 거른 뒤 비면 원래 목록을 쓴다 — 빈 칸이 카탈로그 폴백으로 새는 것보다 낫다.
// 그 상태 자체는 schoolSceneVacationGate.test.ts가 데이터 층에서 막는다.
function seasonVariants(list: EventTextVariant[] | undefined, week: number): EventTextVariant[] | undefined {
  if (!list) return list;
  const season = getSeason(week);
  const fit = list.filter(v => !v.season || v.season === season);
  return fit.length > 0 ? fit : list;
}

export function presentEvent(event: GameEvent, ctx: EventPresentationCtx): GameEvent {
  event = presentRomanceEvent(event, ctx);
  const week = event.week ?? ctx.week;
  const isFemale = ctx.gender === 'female';

  if (!event.schoolVariants) {
    const shown = withGenderFallback(event, isFemale);
    return event.vacationText && getSeason(week) === 'vacation'
      ? withVacationText(shown, event.vacationText, isFemale, !!event.femaleDescription)
      : shown;
  }

  const band = schoolBandForYear(ctx.year);
  const list = seasonVariants(event.schoolVariants[band], week);
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
