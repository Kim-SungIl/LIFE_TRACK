// junha 요리사-꿈 컷의 발동 순서 계약.
//
// junha-cook(followup t38, Y7 W>=8)이 "나 요리사 될 거야" + 계기(엄마 식당)로 꿈을 **처음**
// 말하는 컷이고, junha-hs-recipe(reach t42, Y7)는 그 뒤 "이만큼 준비했다"(레시피 노트·부산 가게)를
// 보여주는 심화다. tier도 38 < 42로 그 순서를 전제한다.
//
// 그런데 cook에는 W>=8 게이트가 있고 recipe에는 없다. 그래서 Y7 W2~W7의 조용한 주에 pre-met
// reach가 먼저 열려 recipe가 선행한다 — 준하 집중 플레이 20/20에서 recipe@Y7W2 → cook@Y7W8로
// 실측됐고, 그러면 cook의 첫 고백이 재고백으로 읽힌다(같은 고백 2회).
//
// 이 파일은 순수 조건이 아니라 **getEventForWeek 배선**을 통과시켜 순서를 잠근다.
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../gameEngine';
import { getEventForWeek } from '../events/selection';
import { GAME_EVENTS } from '../events';
import { FOLLOWUP_EVENT_IDS } from '../events/constants';
import type { GameEvent, GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['strict', 'emotional'];
// cook의 W>=8 게이트 **안쪽** 조용한 주 — 고정주차 이벤트가 없어 followup/reach 티어까지 내려간다.
const QUIET_LATE = 26;
// cook의 W>=8 게이트 **바깥쪽** 조용한 주 = 역전 창. 수정 전엔 이 주에 recipe가 떴다.
const QUIET_EARLY = 5;
// junha followup 중 배열 순서상 cook보다 앞선 것들. 소진시켜야 cook 차례가 온다.
const EARLIER_JUNHA_FOLLOWUPS = ['junha-transfer', 'junha-riceball', 'junha-dialect', 'junha-homesick'];

function findEvent(id: string): GameEvent {
  const ev = GAME_EVENTS.find(e => e.id === id);
  if (!ev) throw new Error(`픽스처 전제 붕괴: ${id} 가 GAME_EVENTS에 없다`);
  return ev;
}

/** 준하만 만난 상태 + 앞선 준하 followup 소진 → cook / recipe 경합만 남긴다. */
function fixture(opts: { week: number; intimacy: number; cookWeek?: number }): GameState {
  const s = createInitialState('male', PARENTS, { rngSeed: 42 });
  s.year = 7;
  s.week = opts.week;
  s.isVacation = false;
  // 다른 NPC의 followup이 끼어들지 않게 전원 미면식으로 만든다(지훈은 기본 met:true).
  for (const n of s.npcs) { n.met = false; }
  const junha = s.npcs.find(n => n.id === 'junha')!;
  junha.met = true;
  junha.intimacy = opts.intimacy;
  s.events = EARLIER_JUNHA_FOLLOWUPS.map(id => ({
    ...findEvent(id), condition: undefined, year: 6, week: 10, resolvedChoice: 0,
  }));
  if (opts.cookWeek !== undefined) {
    s.events.push({
      ...findEvent('junha-cook'), condition: undefined,
      year: 7, week: opts.cookWeek, resolvedChoice: 0,
    });
  }
  return s;
}

describe('junha 요리사-꿈 컷 발동 순서', () => {
  it('전제: cook은 followup t38(W>=8), recipe는 reach t42다', () => {
    // 캡스톤이 reach로 바뀌면 tier 정렬이 순서를 대신 잡아주므로 이 계약의 전제가 달라진다.
    expect(findEvent('junha-cook').reach, 'cook이 reach가 되면 이 파일의 전제가 무너진다').toBeUndefined();
    expect(FOLLOWUP_EVENT_IDS.has('junha-cook')).toBe(true);
    expect(findEvent('junha-hs-recipe').reach).toEqual({ npc: 'junha', tier: 42, year: 7 });
  });

  it('cook을 아직 안 봤으면 조용한 주에 recipe가 뜨지 않는다', () => {
    const picked = getEventForWeek(fixture({ week: QUIET_LATE, intimacy: 45 })).event;
    expect(picked?.id, 'cook 없이 recipe가 먼저 뜨면 cook의 첫 고백이 재고백이 된다').not.toBe('junha-hs-recipe');
  });

  it('cook을 아직 안 봤으면 그 자리에 cook이 뜬다', () => {
    // 게이트가 recipe만 막고 cook까지 굶기지는 않는지 — 굶기면 준하 꿈 줄기가 통째로 사라진다.
    const picked = getEventForWeek(fixture({ week: QUIET_LATE, intimacy: 45 })).event;
    expect(picked?.id).toBe('junha-cook');
  });

  it('cook이 W>=8로 막힌 Y7 초반(역전 창)에도 recipe가 뜨지 않는다', () => {
    const picked = getEventForWeek(fixture({ week: QUIET_EARLY, intimacy: 45 })).event;
    expect(picked?.id, `Y7 W${QUIET_EARLY}는 수정 전 recipe가 뜨던 주다`).not.toBe('junha-hs-recipe');
  });

  it('cook과 같은 주에는 recipe가 붙지 않는다', () => {
    // 체인의 reach 추가 픽이 같은 주에 두 컷을 연달아 붙이는 함정(subin-dream 선례).
    const picked = getEventForWeek(fixture({ week: 26, intimacy: 45, cookWeek: 26 })).event;
    expect(picked?.id).not.toBe('junha-hs-recipe');
  });

  it('cook 뒤 3주까지는 recipe가 뜨지 않는다', () => {
    const picked = getEventForWeek(fixture({ week: 15, intimacy: 45, cookWeek: 12 })).event;
    expect(picked?.id).not.toBe('junha-hs-recipe');
  });

  it('cook 뒤 4주가 지나면 recipe가 뜬다', () => {
    const picked = getEventForWeek(fixture({ week: 16, intimacy: 45, cookWeek: 12 })).event;
    expect(picked?.id, '간격을 넓히다 recipe를 죽이면 CG 2장이 영구 미노출이 된다').toBe('junha-hs-recipe');
  });

  it('간격을 채워도 문턱에 못 닿으면 recipe는 뜨지 않는다', () => {
    // 실제 문턱은 condition의 `intimacy >= 42`가 아니라 **reach.tier**다 — 페이싱 엔진이
    // reach.tier로 fresh/pre-met를 판정하므로 condition 쪽 42는 중복 표기다(뮤테이션으로 확인).
    const picked = getEventForWeek(fixture({ week: 16, intimacy: 40, cookWeek: 12 })).event;
    expect(picked?.id).not.toBe('junha-hs-recipe');
  });
});

describe('junha-hs-farewell 시점', () => {
  // recipe에 선행 조건이 걸리면 Y7 초반 reach 자리가 비고, 그 자리를 t50 farewell이 채웠다
  // ("졸업 무렵 짐 가방"이 3월 개학 직후에 뜬다 — 20/20 실측). W>=40 게이트로 막는다.
  it('졸업 컷은 Y7 초반에 뜨지 않는다', () => {
    const picked = getEventForWeek(fixture({ week: QUIET_EARLY, intimacy: 80 })).event;
    expect(picked?.id, '졸업 컷이 학년 시작에 뜨면 뒤 컷 전부가 떠난 사람 얘기가 된다')
      .not.toBe('junha-hs-farewell');
  });

  // 선행 reach(recipe)를 W12에 둔다 — junha Y7 reach 쿨다운이 24주(48÷2)라, 더 늦게 두면
  // W39 거부가 "내 게이트" 때문인지 "쿨다운 미경과" 때문인지 구분되지 않는다(vacuous 방지).
  const afterRecipe = (week: number): GameState => {
    const s = fixture({ week, intimacy: 80, cookWeek: 8 });
    s.events.push({ ...findEvent('junha-hs-recipe'), condition: undefined, year: 7, week: 12, resolvedChoice: 0 });
    return s;
  };

  it('W39까지는 뜨지 않는다', () => {
    expect(getEventForWeek(afterRecipe(39)).event?.id).not.toBe('junha-hs-farewell');
  });

  it('W40부터는 뜬다', () => {
    // 게이트를 더 늦추면(예: W>=46) 졸업식(W46 고정주차)에 밀려 컷이 사라진다 — 상향 뮤테이션 대비.
    expect(getEventForWeek(afterRecipe(40)).event?.id).toBe('junha-hs-farewell');
  });
});

describe('junha 요리사-꿈 컷 대사 소유권', () => {
  it('꿈 선언("요리사 될 거")은 cook만 한다', () => {
    const cook = findEvent('junha-cook');
    const recipe = findEvent('junha-hs-recipe');
    expect(cook.description).toContain('요리사 될 거');
    expect(recipe.description, 'recipe가 다시 선언하면 순서를 맞춰도 같은 고백이 2회다')
      .not.toContain('요리사 될 거');
  });

  it('"1호 손님" 약속은 cook/farewell만 맺는다', () => {
    // endingNpc junha variants: 1호 손님 = cook c2 / farewell c0, 노트 첫 장 이름 = recipe c0.
    const recipeMessages = findEvent('junha-hs-recipe').choices.map(c => c.message).join('\n');
    expect(recipeMessages, 'recipe가 약속을 다시 맺으면 같은 약속이 두 번 생긴다').not.toContain('1호 손님');
    const cookMessages = findEvent('junha-cook').choices.map(c => c.message).join('\n');
    expect(cookMessages).toContain('첫 번째 손님');
  });

  it('recipe c0은 노트 첫 장 이름 기입을 유지한다(엔딩 문장의 근거)', () => {
    // endingNpc: chose(s,'junha-hs-recipe',0) → "레시피 노트 첫 장의 이름은 여전히 안 지웠다"
    expect(findEvent('junha-hs-recipe').choices[0].message).toContain('노트 첫 장에 네 이름을 적는다');
  });
});
