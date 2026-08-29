// stateMigration — 두 레이어의 계약:
//  1) runSaveMigrations: 단계형 파이프라인 역학 (순차 적용·결번 중단·스탬프 정규화)
//  2) migrateLoadedState: 버전 무관 정규화의 특성화 (리네임·백필·재수화·phase 정합)
import { describe, it, expect } from 'vitest';
import { runSaveMigrations, migrateLoadedState, CURRENT_SAVE_VERSION } from '../stateMigration';
import { createInitialState } from '../gameEngine';
import { GAME_EVENTS } from '../events';
import { assignCurrentEvent, presentEvent } from '../eventPresentation';
import { absWeek } from '../weekMath';
import { GameState } from '../types';

function baseState(): GameState {
  return createInitialState('male', ['emotional', 'info'], { rngSeed: 42 });
}

// 직렬화 왕복 — localStorage 세이브와 동일하게 함수 필드(condition 등)가 떨어져 나간다.
function roundtrip(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

describe('runSaveMigrations 파이프라인', () => {
  // 마커: step이 milestones에 흔적을 남기게 해 적용 여부·순서를 관찰한다.
  const steps = {
    1: (s: GameState) => ({ ...s, milestones: [...s.milestones, 'v1→v2'] }),
    2: (s: GameState) => ({ ...s, milestones: [...s.milestones, 'v2→v3'] }),
  };

  it('현재 버전 세이브는 step 없이 그대로 반환한다', () => {
    const s = baseState();
    expect(runSaveMigrations(s, CURRENT_SAVE_VERSION)).toBe(s);
  });

  it('과거 버전은 목표 버전까지 step을 순서대로 적용한다', () => {
    const out = runSaveMigrations(baseState(), 1, steps, 3);
    expect(out.milestones).toEqual(['v1→v2', 'v2→v3']);
  });

  it('중간 버전에서 시작하면 이전 step은 건너뛴다', () => {
    const out = runSaveMigrations(baseState(), 2, steps, 3);
    expect(out.milestones).toEqual(['v2→v3']);
  });

  it('결번(step 등록 누락)은 이후 단계를 강행하지 않고 중단한다', () => {
    const gapped = { 2: steps[2] }; // 1→2가 없다
    const out = runSaveMigrations(baseState(), 1, gapped, 3);
    expect(out.milestones).toEqual([]);
  });

  it('스탬프가 없거나 손상된 세이브는 v1로 간주한다', () => {
    const out = runSaveMigrations(baseState(), undefined as unknown as number, steps, 2);
    expect(out.milestones).toEqual(['v1→v2']);
    const out2 = runSaveMigrations(baseState(), 0, steps, 2);
    expect(out2.milestones).toEqual(['v1→v2']);
  });
});

describe('migrateLoadedState 정규화', () => {
  it('gene → resilience 부모 리네임', () => {
    const s = roundtrip(baseState());
    s.parents = ['gene', 'info'] as unknown as GameState['parents'];
    expect(migrateLoadedState(s).parents).toEqual(['resilience', 'info']);
  });

  it('제거된 do-nothing 활동을 방학 선택에서 걸러낸다', () => {
    const s = roundtrip(baseState());
    s.vacationChoices = ['do-nothing', 'deep-rest'];
    expect(migrateLoadedState(s).vacationChoices).toEqual(['deep-rest']);
  });

  it('lastInteractionWeek 누락 시 현재 절대주차로 백필한다 (로드 직후 방치 오탐 방지)', () => {
    const s = roundtrip(baseState());
    s.npcs = s.npcs.map(n => {
      const rest = { ...n };
      delete rest.lastInteractionWeek;
      return rest;
    });
    const out = migrateLoadedState(s);
    const now = absWeek(s.year, s.week);
    expect(out.npcs.every(n => n.lastInteractionWeek === now)).toBe(true);
  });

  it('레거시 단일 routineWeeks를 양 슬롯 카운터로 복제한다', () => {
    const s = roundtrip(baseState()) as GameState & { routineWeeks?: number };
    delete (s as Partial<GameState>).routineSlot2Weeks;
    delete (s as Partial<GameState>).routineSlot3Weeks;
    s.routineWeeks = 7;
    const out = migrateLoadedState(s);
    expect(out.routineSlot2Weeks).toBe(7);
    expect(out.routineSlot3Weeks).toBe(7);
  });

  it('rngSeed 0(구세이브)은 시드를 백필하고, 이미 유효한 시드는 재로드에서 보존한다', () => {
    const s = roundtrip(baseState());
    s.rngSeed = 0;
    s.talkRngSeed = 0;
    const out = migrateLoadedState(s);
    // 백필 자체는 시간 솔트(hashInitialState의 Date.now 기본값)라 1회성 —
    // 이후 세이브에 저장되므로 "유효 시드는 다시 안 건드린다"가 결정론 계약이다.
    expect(out.rngSeed).not.toBe(0);
    expect(out.talkRngSeed).not.toBe(0);
    const reloaded = migrateLoadedState(roundtrip(out));
    expect(reloaded.rngSeed).toBe(out.rngSeed);
    expect(reloaded.talkRngSeed).toBe(out.talkRngSeed);
  });

  it('직렬화로 죽은 currentEvent를 카탈로그 원본으로 재수화하되 발생주는 보존한다', () => {
    // **함수 필드가 실제로 있는 픽스처를 쓴다.** GAME_EVENTS[0](first-week)은 choice.condition이
    // 하나도 없어서, 예전처럼 `choices`를 통째로 toBe로 비교하면 "함수가 살아났다"를 한 번도
    // 실증하지 못한 채(undefined === undefined) 통과한다 — 게다가 그 단언은 재수화가 변이를
    // 굽지 못하도록 참조 동일성을 요구해 결함을 잠그고 있었다.
    const fresh = GAME_EVENTS.find(e => e.choices.some(c => typeof c.condition === 'function'))!;
    const liveIdx = fresh.choices.findIndex(c => typeof c.condition === 'function');
    expect(liveIdx, '픽스처 자체가 함수 필드를 갖고 있어야 이 테스트가 의미를 가진다').toBeGreaterThanOrEqual(0);

    const dead = JSON.parse(JSON.stringify(fresh)) as typeof fresh; // 함수 필드 소실
    expect(dead.choices[liveIdx].condition, '직렬화가 함수를 실제로 지웠다').toBeUndefined();

    const s = roundtrip(baseState());
    s.currentEvent = { ...dead, week: 13 };
    const out = migrateLoadedState(s);

    // 계약의 본질: 참조 동일성이 아니라 **함수 필드가 되살아났는가**다.
    expect(out.currentEvent?.choices[liveIdx].condition).toBe(fresh.choices[liveIdx].condition);
    expect(out.currentEvent?.condition).toBe(fresh.condition);
    expect(out.currentEvent?.week).toBe(13);
    // 참조 동일성을 놓는 대신 **값 불변성**을 명시한다 — 안 그러면 effects 변조가 새 나간다
    // (구 테스트는 toBe(fresh.choices) 하나로 그것까지 덤으로 막고 있었다).
    expect(out.currentEvent?.choices.map(c => c.text)).toEqual(fresh.choices.map(c => c.text));
    expect(out.currentEvent?.choices.map(c => c.message)).toEqual(fresh.choices.map(c => c.message));
    expect(out.currentEvent?.choices.map(c => c.effects)).toEqual(fresh.choices.map(c => c.effects));
    expect(out.currentEvent?.choices.map(c => c.fatigueEffect)).toEqual(fresh.choices.map(c => c.fatigueEffect));
  });

  it('로드 후 state.currentEvent가 화면과 같은 변이 문장을 들고 있다 (결과창 불일치 차단)', () => {
    // 화면(EventScene)은 자기 쪽에서 다시 굽기 때문에 재수화가 원본을 넣어도 변이가 보인다.
    // 그러나 resolveEvent/GameScreen은 **state.currentEvent**를 읽는다 — 여기가 원본이면
    // "방금 읽은 장면"과 "결과창 문구"가 갈린다. 그 소비 지점을 잠근다.
    const chore = GAME_EVENTS.find(e => e.schoolVariants)!;
    expect(chore, '변이를 가진 이벤트가 카탈로그에 있어야 이 테스트가 의미를 가진다').toBeTruthy();

    const st = { ...baseState(), year: 6, week: 10 } as GameState; // 고등 band
    assignCurrentEvent(st, chore, 10);
    const bakedDesc = st.currentEvent!.description;
    const bakedMsg = st.currentEvent!.choices[0].message;
    // 픽스처 유효성: 변이가 실제로 카탈로그와 달라야 비교가 성립한다(양성 바닥).
    expect(bakedDesc, '고등 변이는 카탈로그 본문과 달라야 한다').not.toBe(chore.description);
    expect(bakedMsg, '고등 변이는 카탈로그 결과 문구와 달라야 한다').not.toBe(chore.choices[0].message);

    const out = migrateLoadedState(roundtrip(st));
    expect(out.currentEvent?.description, '로드 후 저장값이 변이 본문이다').toBe(bakedDesc);
    expect(out.currentEvent?.choices[0].message, '로드 후 저장값이 변이 결과 문구다').toBe(bakedMsg);

    // 화면이 그리는 것과도 정확히 같아야 한다(EventScene과 동일한 좌표로 재굽기 = 멱등).
    const shown = presentEvent(out.currentEvent!, {
      year: out.year, week: out.currentEvent!.week ?? out.week, gender: out.gender,
    });
    expect(shown.description, '저장값 == 화면').toBe(out.currentEvent!.description);
    expect(shown.choices[0].message, '저장값 == 화면').toBe(out.currentEvent!.choices[0].message);
    expect(out.currentEvent?.week, '발생주 보존은 그대로다').toBe(10);
  });

  it('카탈로그에서 사라진 currentEvent는 제거하고 phase를 진행 가능 상태로 복구한다 (soft-lock 차단)', () => {
    const s = roundtrip(baseState());
    s.currentEvent = { id: 'ghost-removed-event', title: 'x', description: 'x', choices: [] };
    s.phase = 'event';
    s.weekLog = null;
    const out = migrateLoadedState(s);
    expect(out.currentEvent).toBeNull();
    expect(out.phase).toBe('weekday');
  });

  it("phase='result'인데 weekLog가 없는 손상 세이브는 weekday로 정리한다", () => {
    const s = roundtrip(baseState());
    s.phase = 'result';
    s.weekLog = null;
    expect(migrateLoadedState(s).phase).toBe('weekday');
  });
});
