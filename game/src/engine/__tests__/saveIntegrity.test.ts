// @vitest-environment jsdom
// 손상 세이브를 **구조로** 거르는가. (#447 후속)
//
// #447의 try/catch는 마이그레이션 중 실제로 터지는 손상만 걸렀다. 안 터지면 그대로 통과했고,
// 3자 검수에서 네 케이스가 전부 `ret=true state=SET`으로 확인됐다:
//
//   parents: null (rngSeed 정상) / stats: null / npcs: null / stats가 문자열
//
// #447 테스트가 이걸 못 본 이유가 핵심이다 — `parents: null`을 **rngSeed까지 지운 채로만** 넣었다.
// 그러면 rng.ts의 `.join`이 터져 catch에 걸린다. rngSeed가 멀쩡하면 아무 데서도 안 터진다.
// 방어가 아니라 **우연히 터지는 지점**에 기대고 있었던 셈이고, 테스트가 그 우연을 고정했다.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore, loadFromStorage } from '../store';
import { CURRENT_SAVE_VERSION } from '../stateMigration';
import { migrateLoadedState, runSaveMigrations } from '../stateMigration';
import { createInitialState } from '../gameEngine';
import { describeUnplayable, isPlayableState } from '../saveIntegrity';

const KEY = 'lifetrack_save';

function seed(patch: Record<string, unknown>): void {
  const s: Record<string, unknown> = JSON.parse(JSON.stringify(
    createInitialState('male', ['wealth', 'info'], { rngSeed: 5 }),
  ));
  Object.assign(s, { year: 2, week: 10 }, patch);
  localStorage.setItem(KEY, JSON.stringify({
    version: CURRENT_SAVE_VERSION, state: s, savedAt: new Date().toISOString(),
  }));
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
});

describe('예외가 안 나는 손상도 거부한다', () => {
  // **rngSeed를 살려 둔다** — 이게 이 파일의 존재 이유다. 지우면 rng에서 터져
  // 예전 try/catch가 잡아 버리고, 새 방어를 통째로 지워도 테스트가 통과한다.
  const cases: [string, Record<string, unknown>][] = [
    ['parents가 null', { parents: null }],
    ['parents가 1칸', { parents: ['wealth'] }],
    ['parents에 모르는 강점', { parents: ['wealth', 'telepathy'] }],
    ['stats가 null', { stats: null }],
    ['stats가 문자열', { stats: 'broken' }],
    ['stats 한 축이 null', { stats: { academic: 50, social: 50, talent: 50, mental: null, health: 50 } }],
    ['stats 한 축이 NaN 직렬화(null)', { stats: { academic: NaN, social: 50, talent: 50, mental: 50, health: 50 } }],
    ['npcs가 null', { npcs: null }],
    ['npcs가 빈 배열', { npcs: [] }],
    ['gender가 모르는 값', { gender: 'other' }],
    ['phase가 모르는 값', { phase: 'nowhere' }],
    ['year가 상한 밖', { year: 99 }],
    ['year가 하한 밖', { year: 0 }],    // 상한만 두면 반대쪽이 통째로 빈다(실측: 하한을 지워도 초록이었다)
    ['week이 0', { week: 0 }],
    ['week이 상한 밖', { week: 50 }],   // 하한만 두면 단방향 잠금이다 — 상한을 지워도 초록이었다
    ['money가 문자열', { money: '1569' }],
    ['fatigue가 null', { fatigue: null }],
  ];

  for (const [label, patch] of cases) {
    it(`${label} → 던지지 않고 false, state는 그대로 null`, () => {
      seed(patch);
      let threw: unknown = null;
      let ret: boolean | undefined;
      try { ret = useGameStore.getState().loadSavedGame(); } catch (e) { threw = e; }

      expect(threw, `던지면 onClick 밖으로 새어 화면이 침묵한다: ${String(threw)}`).toBeNull();
      expect(ret, '못 열었으면 false여야 호출부가 손상 안내를 띄운다').toBe(false);
      expect(useGameStore.getState().state,
        '거부해 놓고 state를 채우면 자동저장이 깨진 값을 디스크에 다시 쓴다').toBeNull();
      expect(localStorage.getItem(KEY),
        '조용히 지우면 사용자가 무슨 일이 났는지 영영 모른다').not.toBeNull();
    });
  }

  // **양성 짝**이 없으면 "항상 false"가 전부 통과한다.
  it('멀쩡한 세이브는 그대로 열린다', () => {
    seed({});
    expect(useGameStore.getState().loadSavedGame()).toBe(true);
    expect(useGameStore.getState().state!.year).toBe(2);
  });

  // 'gene' 별칭은 마이그레이션이 펴 준다 — 검증이 그걸 **되돌려 거부하면** 구세이브가 죽는다.
  it("레거시 'gene' 부모는 거부되지 않는다 (마이그레이션 뒤에 보므로)", () => {
    seed({ parents: ['gene', 'info'] });
    expect(useGameStore.getState().loadSavedGame(),
      '별칭을 손상으로 읽으면 구세이브를 가진 사람이 판을 잃는다').toBe(true);
    expect(useGameStore.getState().state!.parents[0]).toBe('resilience');
  });

  // 엔딩 세이브는 year=8이다(엔딩 화면이 쓰는 값) — 범위 검사가 이걸 자르면 안 된다.
  it('엔딩 세이브(year=8)도 열린다', () => {
    seed({ phase: 'ending', year: 8, week: 1 });
    expect(useGameStore.getState().loadSavedGame(), 'year 상한을 7로 잡으면 엔딩 다시 보기가 죽는다').toBe(true);
  });
});

describe('판정은 마이그레이션 뒤에만 옳다', () => {
  // 구세이브에는 백필 전이라 빠진 필드가 있다. 검증을 앞당기면 정상 세이브를 거부한다 —
  // 호출 순서 자체가 계약이라 여기서 못을 박는다.
  it('백필 전 구세이브는 통과하지 못하지만 백필 뒤에는 통과한다', () => {
    const raw: Record<string, unknown> = JSON.parse(JSON.stringify(
      createInitialState('male', ['wealth', 'info'], { rngSeed: 5 }),
    ));
    delete raw.examResults; delete raw.activeBuffs; delete raw.weekPurchases;
    delete raw.lowMentalWeeksByYear;

    const migrated = migrateLoadedState(runSaveMigrations(raw as never, 1));
    expect(isPlayableState(migrated), '마이그레이션을 거친 구세이브는 열려야 한다').toBe(true);
  });

  it('타이틀이 읽는 경로(loadFromStorage)는 구조 검증을 하지 않는다', () => {
    seed({ stats: null });
    // 타이틀은 "세이브가 있나"만 본다 — 여기서 거르면 이어하기 버튼이 사라져
    // 사용자가 손상 사실을 안내받을 기회조차 없어진다.
    expect(loadFromStorage(), '타이틀이 못 읽으면 손상 안내 자체가 안 뜬다').not.toBeNull();
  });
});

describe('진단 문자열은 어느 필드가 깨졌는지 말한다', () => {
  it('깨진 필드 이름이 사유에 들어간다', () => {
    expect(describeUnplayable({ ...createInitialState('male', ['wealth', 'info'], {}), stats: null }))
      .toMatch(/stats/);
    expect(describeUnplayable({ ...createInitialState('male', ['wealth', 'info'], {}), npcs: [] }))
      .toMatch(/npcs/);
  });

  it('멀쩡하면 null이다', () => {
    expect(describeUnplayable(createInitialState('male', ['wealth', 'info'], {}))).toBeNull();
  });

  it('객체가 아닌 것도 던지지 않는다', () => {
    for (const v of ['broken', 42, null, undefined, [], true]) {
      expect(() => describeUnplayable(v)).not.toThrow();
      expect(describeUnplayable(v)).not.toBeNull();
    }
  });
});

// 직렬화를 거치면 NaN·Infinity는 `null`이 되어 `typeof v === 'number'`에서 이미 걸린다.
// 그래서 **세이브 경로로는 `Number.isFinite`를 잠글 수 없다** — 실제로 그 호출을 지워도
// 1301개가 전부 통과했다(3자 검수 실측). 픽스처 라벨은 'NaN'인데 디스크에 닿는 값은 null이었다.
// 판정 함수를 직접 태워 못박는다.
describe('NaN·Infinity는 직접 호출로만 잠긴다', () => {
  const base = () => JSON.parse(JSON.stringify(
    createInitialState('male', ['wealth', 'info'], { rngSeed: 5 }),
  )) as Record<string, unknown>;

  const bad: [string, (s: Record<string, unknown>) => void][] = [
    ['stats.academic = NaN', s => { (s.stats as Record<string, number>).academic = NaN; }],
    ['stats.mental = Infinity', s => { (s.stats as Record<string, number>).mental = Infinity; }],
    ['money = NaN', s => { s.money = NaN; }],
    ['fatigue = -Infinity', s => { s.fatigue = -Infinity; }],
    ['year = NaN', s => { s.year = NaN; }],
    ['week = Infinity', s => { s.week = Infinity; }],
  ];

  for (const [label, mutate] of bad) {
    it(`${label} → 거부 (NaN은 막대·등급·엔딩 판정을 조용히 물들인다)`, () => {
      const s = base();
      mutate(s);
      expect(describeUnplayable(s), `${label}이 통과하면 화면 전체가 NaN이 된다`).not.toBeNull();
    });
  }

  it('유한수는 그대로 통과한다 (가드가 과잉거부하지 않는다)', () => {
    expect(describeUnplayable(base())).toBeNull();
  });

  // 직렬화가 왜 이 축을 못 잠그는지 자체를 못박는다 — 라벨과 실제가 갈리면 또 속는다.
  it('JSON 왕복은 NaN을 null로 바꾼다 (세이브 경로로 못 잠그는 이유)', () => {
    expect(JSON.parse(JSON.stringify({ v: NaN })).v).toBeNull();
    expect(JSON.parse(JSON.stringify({ v: Infinity })).v).toBeNull();
  });
});
