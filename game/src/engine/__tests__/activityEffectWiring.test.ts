import { describe, expect, it } from 'vitest';
import { ACTIVITIES, getActivityCost } from '../activities';
import { processWeek } from '../gameEngine';
import { makeState } from '../../test/fixtures';
import type { Activity, GameState, StatKey } from '../types';

// 활동 데이터의 **선택 필드가 실제로 소비되는지**를 잠근다.
//
// activityBalanceLiterals.test.ts는 `catchupBonus`·`parentEffect` 같은 필드의 **선언값**을
// 잠근다. 그것만으로는 "필드는 그대로인데 엔진이 그 값을 안 쓴다"를 못 잡는다 — 실측으로
// 확인된 구멍이었다(3자 검수, PR #410):
//   · `applyActivity`의 catchup 블록을 통째로 무력화 → 763개 전부 통과
//   · `bonus` 값을 무시(`before + 0`) → 전부 통과
//   · `parentEffect` 블록을 무력화 → 전부 통과
//   · "유료는 80+ 소프트캡 면제"(리터럴 파일이 rationale 근거로 삼는 설계) → 전부 통과
// 이 리포에서 반복된 층위 착오다(선언 잠금 ≠ 배선 잠금). 그래서 값이 **결과에 나타나는지**를
// 엔진 경로(processWeek)로 본다.

const pick = (id: string): Activity => {
  const found = ACTIVITIES.find(a => a.id === id);
  if (!found) throw new Error(`${id} 없음 — 활동이 사라졌거나 id가 바뀜`);
  return found;
};

// 엔진이 주차에서 방학을 재계산한다(getWeekInfo). 픽스처의 isVacation과 week이 어긋나면
// vacation-only 활동이 계절 게이트로 스킵돼 "효과가 없다"와 구분이 안 된다.
const VACATION_WEEK = 21;
const SEMESTER_WEEK = 3;

/**
 * 한 주를 돌리고 **실제 스탯 증분**과 로그 기록을 함께 돌려준다.
 *
 * 로그(`statChanges`)만 보면 안 된다 — catchup 코드는 `state.stats` 대입과
 * `log.statChanges += bonus`가 별개 줄이라, 대입만 지워도 로그에는 보너스가 남는다
 * (실측으로 확인: 로그만 보는 단언은 그 변형을 통과시켰다). 그래서 스탯 쪽을 기준으로 본다.
 */
function weekStat(
  patch: Partial<GameState>,
  choices: string[],
  stat: StatKey,
): { gain: number; logged: number } {
  const s = makeState(patch);
  s.vacationChoices = choices;
  s.weekendChoices = choices;
  const before = s.stats[stat];
  const after = processWeek(s);
  return {
    gain: after.stats[stat] - before,
    logged: after.weekLog?.statChanges[stat] ?? 0,
  };
}

/** 같은 활동을 slots만큼 인접 배치 — collapseActivityChoices가 1 인스턴스로 접는다. */
const slotsOf = (id: string): string[] => Array.from({ length: pick(id).slots }, () => id);

describe('catchupBonus — 선언값이 실제로 스탯에 더해진다', () => {
  // catchup은 **본 효과가 적용된 뒤의 스탯**으로 임계를 판정한다(`applyActivity`의 순서).
  // 그래서 "임계 −1 / 임계" 같은 픽스처는 무의미하다 — 본 효과가 이미 임계를 넘겨버린다.
  // 아래 시작값은 발동/미발동이 실제로 갈리는 지점을 스윕으로 찾은 것이고, 두 경우의 차이가
  // 정확히 `bonus`여야 한다. 절대값이 아니라 **차이**를 보므로 본 효과 계수가 바뀌어도
  // (감쇠·피로·학교급 효율) 이 단언은 살아 있다.
  //
  // 학교급별 발동선은 엔진이 덮어쓴다 — 초 25 / 중 35 / 고는 활동 데이터의 threshold
  // (`gameEngine.ts`의 주석에 명시된 의도). 즉 리터럴 파일이 잠근 `threshold: 50`은
  // **고등에서만 쓰이는 숫자**다. 아래 고등 케이스가 그 마지막 소비 경로를 잠근다.
  const LEVELS = [
    { label: '초등(발동선 25)', year: 1, fires: 22, quiet: 24 },
    { label: '중등(발동선 35)', year: 4, fires: 32, quiet: 34 },
    { label: '고등(발동선 = 선언된 threshold)', year: 5, fires: 46, quiet: 48 },
  ] as const;

  const CASES = [
    { id: 'intensive-academy', stat: 'academic' as StatKey },
    { id: 'sports-camp', stat: 'health' as StatKey },
  ];

  for (const { id, stat } of CASES) {
    describe(`${id} (${stat})`, () => {
      const bonus = pick(id).catchupBonus?.bonus;

      it('선언에 bonus가 있다 — 없으면 아래 단언이 공허해진다', () => {
        expect(bonus, `${id}.catchupBonus.bonus`).toBeGreaterThan(0);
        expect(pick(id).catchupBonus?.targetStat).toBe(stat);
      });

      for (const { label, year, fires, quiet } of LEVELS) {
        it(`${label} — 뒤처진 구간에서만 정확히 bonus만큼 더 오른다`, () => {
          const base = makeState({}).stats;
          const week = (v: number) => (
            { week: VACATION_WEEK, isVacation: true, money: 999, year, stats: { ...base, [stat]: v } }
          );
          const hit = weekStat(week(fires), slotsOf(id), stat);
          const miss = weekStat(week(quiet), slotsOf(id), stat);

          // 발동 구간이 더 많이 오르고, 그 차이가 선언된 bonus와 같다 — **실제 스탯 기준**.
          expect(hit.gain, `${label} 발동(${fires}) vs 미발동(${quiet})`).toBeGreaterThan(miss.gain);
          expect(Number((hit.gain - miss.gain).toFixed(6))).toBe(bonus);

          // 로그와 스탯이 어긋나면 안 된다 — 한쪽만 갱신하는 변형(대입 누락)을 잡는다.
          expect(Number(hit.logged.toFixed(6)), `${label} 발동 로그 vs 스탯`).toBe(Number(hit.gain.toFixed(6)));
          expect(Number(miss.logged.toFixed(6)), `${label} 미발동 로그 vs 스탯`).toBe(Number(miss.gain.toFixed(6)));
        });
      }
    });
  }

  // 주의: catchupBonus를 가진 활동은 현재 전부 `seasonGate: 'vacation-only'`다. 그래서 엔진의
  // `state.isVacation &&` 가드는 계절 게이트와 중복이고, 이 파일로는 따로 잠글 수 없다
  // (학기 주에 넣으면 활동 자체가 게이트로 스킵돼 "catchup이 안 뜬 것"과 구분되지 않는다).
  // vacation-only가 아닌 catchup 활동이 생기면 그때 학기 대조군을 추가할 것.
  it('catchup 활동은 전부 vacation-only다 — 위 주의사항의 전제', () => {
    const catchupIds = ACTIVITIES.filter(a => a.catchupBonus).map(a => a.id);
    expect(catchupIds.length).toBeGreaterThan(0);
    for (const id of catchupIds) {
      expect(pick(id).seasonGate, `${id}.seasonGate`).toBe('vacation-only');
    }
  });
});

describe('parentEffect — 선언된 baseDelta가 실제 친밀도로 간다', () => {
  const intimacyDelta = (patch: Partial<GameState>, choices: string[]) => {
    const s = makeState(patch);
    s.vacationChoices = choices;
    s.weekendChoices = choices;
    const before = s.parentIntimacy ?? 50;
    const after = processWeek(s);
    return { delta: (after.parentIntimacy ?? 0) - before, ids: after.weekLog?.parentEffectAppliedIds ?? [] };
  };

  it('가족 여행이 부모 친밀도를 올린다 (소비 경로가 살아 있다)', () => {
    const trip = pick('family-trip');
    expect(trip.parentEffect?.baseDelta, '선언이 없으면 이 테스트가 공허하다').toBeGreaterThan(0);
    const { delta, ids } = intimacyDelta(
      { week: VACATION_WEEK, isVacation: true, money: 999, year: 4 },
      slotsOf('family-trip'),
    );
    expect(delta, '가족 여행이 친밀도를 1도 안 올린다').toBeGreaterThan(0);
    expect(ids).toContain('family-trip');
  });

  it('친밀도 증가가 baseDelta에 비례한다 — 값이 무시되면 잡힌다', () => {
    // 같은 태그(familyTime)·같은 주차로 비교해 반응 계수를 상쇄시킨다.
    // 가족 여행 1.5 : 가족 저녁 0.5 = 3 : 1.
    const trip = pick('family-trip').parentEffect!;
    const dinner = pick('family-dinner').parentEffect!;
    expect(dinner.tag, '태그가 다르면 반응 계수가 달라 비교가 성립하지 않는다').toBe(trip.tag);

    const week = { week: VACATION_WEEK, isVacation: true, money: 999, year: 4 } as const;
    const tripDelta = intimacyDelta(week, slotsOf('family-trip')).delta;
    const dinnerDelta = intimacyDelta(week, slotsOf('family-dinner')).delta;

    expect(dinnerDelta).toBeGreaterThan(0);
    const declaredRatio = trip.baseDelta / dinner.baseDelta;
    expect(tripDelta / dinnerDelta).toBeCloseTo(declaredRatio, 5);
  });

  it('선언된 tag가 실제 반응에 쓰인다 — 태그를 바꾸면 부모 성향 반응이 역전된다', () => {
    // `familyTime`은 emotional에 1.4 / strict에 0.6으로 반응한다(parentIntimacy의 반응 테이블).
    // `gradeImprove` 같은 다른 태그는 **정반대**(0.6 / 1.4)라, 태그가 무시되거나 다른 값으로
    // 바뀌면 아래 대소가 뒤집힌다 — 양방향으로 잡히는 단언이다.
    // (baseDelta 비례 단언은 양쪽이 같이 스케일되면 태그 변경을 못 본다. 실측으로 확인한 구멍.)
    expect(pick('family-trip').parentEffect?.tag).toBe('familyTime');
    // 사춘기 골짜기(Y3~4 × familyTime ×0.75)를 피해 Y6에서 본다 — 양쪽에 같이 걸리므로
    // 대소는 안 바뀌지만, 교란 요인을 픽스처에서 빼 두는 편이 읽기 쉽다.
    const week = { week: VACATION_WEEK, isVacation: true, money: 999, year: 6 } as const;
    const sensitive = intimacyDelta(
      { ...week, parents: ['emotional', 'info'] }, slotsOf('family-trip'),
    ).delta;
    const dull = intimacyDelta(
      { ...week, parents: ['strict', 'info'] }, slotsOf('family-trip'),
    ).delta;
    expect(sensitive, '감성적 부모가 가족 여행에 더 크게 반응하지 않는다').toBeGreaterThan(dull);
  });

  it('같은 활동이 루틴과 주말에 동시에 있어도 한 번만 적용된다', () => {
    // 활동 id별 주 1회 — `log.parentEffectAppliedIds` 가드. 가족 여행은 방학 전용이라
    // 루틴 슬롯에 못 들어가므로(방학엔 루틴이 안 돈다) 계절 제약이 없는 가족 저녁으로 잠근다.
    const semester = { week: SEMESTER_WEEK, isVacation: false, money: 999, year: 4 } as const;
    const once = intimacyDelta({ ...semester, routineSlot2: null, routineSlot3: null }, ['family-dinner']);
    const twice = intimacyDelta({ ...semester, routineSlot2: 'family-dinner', routineSlot3: null }, ['family-dinner']);

    expect(once.delta).toBeGreaterThan(0);
    expect(twice.delta, '루틴+주말 중복이 친밀도를 두 번 올린다').toBeCloseTo(once.delta, 6);
    expect(twice.ids.filter(id => id === 'family-dinner')).toHaveLength(1);
  });
});

describe('80+ 소프트캡 면제 — 유료 활동만 면제된다', () => {
  // 리터럴 파일의 rationale이 근거로 내세우는 설계다("유료라 80+ 소프트캡 면제").
  // `applyActivity`의 `getActivityCost(...) === 0 && stats >= 80` 에서 `=== 0 &&`만 지우면
  // 유료 활동도 ×0.1이 되는데, 그 변형이 763개 전부 통과했다.
  //
  // 학업 1.5는 독학(무료)과 학원(유료)이 같다 — 그래서 같은 축을 같은 크기로 비교할 수 있다.
  // 85 이상을 쓰는 이유: 80~84 구간은 "최저 보장"(baseValue×0.1)이 소프트캡 결과와 같은 값으로
  // 되돌려 놓아 둘이 구분되지 않는다.
  const HIGH_STAT = 86;
  const SOFT_CAP_FACTOR = 0.1;   // gameEngine의 `value *= 0.1` — 이 숫자 자체를 잠근다

  /**
   * 활동이 순수하게 올린 양 — 활동을 뺀 대조군과의 차이.
   *
   * `statChanges`를 그대로 쓰면 안 된다: 자연 감소가 academic·social·talent·health 키를
   * **활동과 무관하게 항상** 채우므로("활동 0개인 주에도 4개 축이 기록된다" 실측), 절대값은
   * 활동 기여를 나타내지 못한다.
   */
  // 여기서는 실제 스탯이 아니라 **로그(statChanges)** 를 쓴다. 스탯은 0.1 단위로 반올림돼
  // 이 구간의 작은 증분에서 정밀도를 잃는다(무료 0.0495 → 0.0으로 뭉개져 비율이 0.2로 보인다).
  // catchup 쪽과 달리 여기는 로그/스탯이 갈라질 위험이 없다 — 소프트캡 계수는 `value` 하나에
  // 곱해지고 그 값이 스탯과 로그에 함께 들어간다.
  function netGain(academic: number, id: string | null): number {
    const base = makeState({}).stats;
    const week = {
      week: SEMESTER_WEEK, isVacation: false, money: 999, year: 4,
      routineSlot2: null, routineSlot3: null,
      stats: { ...base, academic },
    };
    const logged = (choices: string[]) => weekStat(week, choices, 'academic').logged;
    return logged(id ? [id] : []) - logged([]);
  }

  it('전제 — 독학과 학원의 학업 기본값이 같고, 하나는 무료 하나는 유료다', () => {
    expect(pick('self-study').effects.academic).toBe(pick('academy').effects.academic);
    expect(getActivityCost(pick('self-study'), 4)).toBe(0);
    expect(getActivityCost(pick('academy'), 4)).toBeGreaterThan(0);
  });

  it(`학업 86에서 무료는 유료의 ${SOFT_CAP_FACTOR}배만 오른다 (계수 자체를 잠근다)`, () => {
    const free = netGain(HIGH_STAT, 'self-study');
    const paid = netGain(HIGH_STAT, 'academy');

    // 둘 다 실제로 올라야 비율이 의미를 갖는다(0/0 방지).
    expect(free, '무료 활동의 순증이 0 이하 — 비율이 무의미해진다').toBeGreaterThan(0);
    expect(paid).toBeGreaterThan(free);
    // 격차가 아니라 **비율**을 본다 — 격차만 보면 계수를 0.2로 완화해도 통과한다(실측).
    expect(free / paid).toBeCloseTo(SOFT_CAP_FACTOR, 6);
  });

  it('학업이 낮은 구간에서는 무료와 유료가 같이 오른다 (소프트캡 고유 효과)', () => {
    // 대조군 — 위 비율이 "유료가 원래 더 좋아서"가 아니라 80+ 소프트캡 때문임을 보인다.
    const free = netGain(40, 'self-study');
    const paid = netGain(40, 'academy');
    expect(free).toBeGreaterThan(0);
    expect(free / paid, '낮은 구간에서도 비율이 1이 아니면 위 테스트가 소프트캡을 안 본다').toBeCloseTo(1, 6);
  });
});
