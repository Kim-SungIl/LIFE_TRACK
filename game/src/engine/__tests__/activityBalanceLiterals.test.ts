// @vitest-environment jsdom
// 학년 해금 활동 6종 + 입시 설명회 + 고가 4종(집중과외·단기특강·캠프·가족여행)의 "밸런스 수치" 잠금.
//
// activityGates.test.ts는 게이트 계약 SSOT라 규약이 "리터럴 주입 금지 — 데이터에서 파생"이다.
// 그래서 가격 경계를 a.moneyCost로 만들고, moneyCost와 requires를 정합하게 함께 바꾸면 통과한다.
// (뮤테이션 실측: 독서실 3만→1만 MISS, 실기레슨 4만→1만 MISS, 야자 무료→5만 MISS, 설명회 3→30 MISS)
//
// 이 파일은 반대 규약이다 — 기대값을 여기 하드코딩해 수치 자체를 잠근다.
// 수치는 sim 측정으로 도출한 값이라(독서실 3만: 2만이면 무료 대비 우위가 과해짐 / 야자 social 1:
// 80+ 소프트캡이 스탯별이라 후반까지 살아남는 유일한 축) 조용히 드리프트하면 근거가 사라진다.
// 값을 의도적으로 바꿀 때는 아래 표를 같이 고치면 되고, 그때 rationale을 다시 읽게 된다.
//
// jsdom: 고가 방학 3종의 vacationLimit 합산을 ActivityPicker pendingVacUse 경로로 잠그기 위해.
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ActivityPicker } from '../../components/ActivityPicker';
import {
  ACTIVITIES,
  getActivityCost,
  getAvailableActivities,
  isVacationLimitReached,
} from '../activities';
import { createInitialState, processWeek } from '../gameEngine';
import { SHOP_ITEMS } from '../shopSystem';
import type { Activity, GameState } from '../types';
import { getWeeklyIncome } from '../parentModifiers';
import { makeState } from '../../test/fixtures';

interface BalanceSpec {
  name: string;
  slots: number;
  fatigue: number;
  moneyCost: number;
  category: Activity['category'];
  unlockYear: number;
  effects: Record<string, number>;
  rationale: string;
}

const SPEC: Record<string, BalanceSpec> = {
  'free-semester': {
    name: '자유학기 진로체험', slots: 1, fatigue: 4, moneyCost: 0, category: 'talent', unlockYear: 2,
    effects: { talent: 1.5, social: 1 },
    rationale: '자유학기제(중1)는 시험이 없는 해 — 학업 축이 아니라 특기·관계 축이다. 무료라 Y2 저소득도 닿는다.',
  },
  'study-room': {
    name: '독서실 정기권', slots: 1, fatigue: 4, moneyCost: 3, category: 'study', unlockYear: 3,
    effects: { academic: 2 },
    rationale: '독학(1.5/f5/무료)의 유료 상위 — 효율↑ 피로↓를 돈으로 산다. 2만이면 무료 대비 우위가 과해진다.',
  },
  'supplementary-class': {
    name: '보충수업', slots: 1, fatigue: 5, moneyCost: 2, category: 'study', unlockYear: 5,
    effects: { academic: 1.8, social: 0.3 },
    rationale: '고등 방과후 보충 — 유료라 학업 80+ 소프트캡을 면제받는다. 무료 자율학습과 유료/무료 대비를 이룬다.',
  },
  'night-study': {
    name: '학교 자율학습', slots: 2, fatigue: 12, moneyCost: 0, category: 'study', unlockYear: 5,
    effects: { academic: 2, social: 1, mental: -1 },
    rationale: '2칸 무료 — 돈이 아니라 시간으로 값을 치른다. social 1은 소프트캡이 스탯별이라 후반까지 살아남는 통로.',
  },
  'practical-lesson': {
    name: '입시 실기 레슨', slots: 1, fatigue: 7, moneyCost: 4, category: 'talent', unlockYear: 6,
    effects: { talent: 2.8 },
    rationale: '예체능 입시 — art-lesson(2.0/2만)의 상위. 특기 빌드가 80+를 넘는 유일한 통로라 고비용이다.',
  },
  mentoring: {
    name: '후배 멘토링', slots: 1, fatigue: 4, moneyCost: 0, category: 'social', unlockYear: 6,
    effects: { social: 1.2, academic: 0.8, mental: 0.5 },
    rationale: '무료 관계 활동 — Y6 고비용 구간에서 돈 없이 잡을 수 있는 선택지.',
  },
};

function pick(id: string): Activity {
  const found = ACTIVITIES.find(a => a.id === id);
  if (!found) throw new Error(`${id} 없음 — 활동이 사라졌거나 id가 바뀜`);
  return found;
}

// 이 6종의 게이트 계약은 "학년과 돈만 본다"이다. makeState는 ('male', ['emotional','info']) 고정이라
// requires에 부모 강점·성별·스탯 조건을 몰래 끼워도 기본 픽스처가 우연히 충족해 통과할 수 있다
// (실측: `s.parents.includes('emotional')`, `s.gender === 'male'` 둘 다 MISS였다).
// 그래서 경계 판정은 아래 픽스처 변형 전부에서 같은 결과가 나와야 한다.
const FIXTURE_VARIANTS: { label: string; patch: Partial<GameState> }[] = [
  { label: '기본(male·emotional/info)', patch: {} },
  { label: 'female·strict/wealth', patch: { gender: 'female', parents: ['strict', 'wealth'] } },
  { label: 'male·freedom/resilience', patch: { gender: 'male', parents: ['freedom', 'resilience'] } },
];

function availableIn(patch: Partial<GameState>, id: string): boolean {
  return getAvailableActivities(makeState(patch)).some(a => a.id === id);
}

// processWeek는 week으로 isVacation을 덮어쓴다. 어긋나면 계절 게이트로 스킵돼 돈 문제와 구분이 안 된다.
const SEMESTER_WEEK = 3;
const VACATION_WEEK = 21;

function withSeason(isVacation: boolean, patch: Partial<GameState> = {}): Partial<GameState> {
  return {
    ...patch,
    isVacation,
    week: isVacation ? VACATION_WEEK : SEMESTER_WEEK,
  };
}

afterEach(() => {
  cleanup();
});

// 밸런스에 관여하는 선택 필드 — SPEC이 값을 선언하지 않은 것은 "없음"이 계약이다.
// (`yearlyCost`는 getActivityCost가 moneyCost보다 우선 적용하고, seasonGate·vacationLimit·
//  catchupBonus·parentEffect는 노출/효과를 조용히 바꾼다)
const OPTIONAL_BALANCE_FIELDS = [
  'yearlyCost',
  'seasonGate',
  'vacationLimit',
  'catchupBonus',
  'parentEffect',
] as const;

describe('학년 해금 6종 — 밸런스 수치 잠금', () => {
  for (const [id, spec] of Object.entries(SPEC)) {
    describe(`${id} (${spec.name})`, () => {
      it(`수치가 스펙과 정확히 같다 — ${spec.rationale}`, () => {
        const a = pick(id);
        expect(a.name).toBe(spec.name);
        expect(a.slots).toBe(spec.slots);
        expect(a.fatigue).toBe(spec.fatigue);
        expect(a.moneyCost).toBe(spec.moneyCost);
        expect(a.category).toBe(spec.category);
        expect(a.unlockYear).toBe(spec.unlockYear);
        // 축 추가/삭제도 잡는다(야자 mental -1 제거 같은 "대가 삭제").
        // toEqual은 값이 undefined인 키를 무시하므로 toStrictEqual — `{ health: undefined }` 추가가
        // 통과하면 안 된다.
        expect(a.effects).toStrictEqual(spec.effects);
      });

      it('실효 가격(getActivityCost)이 moneyCost와 같다 — yearlyCost로 우회되지 않는다', () => {
        const a = pick(id);
        // 엔진이 차감·소프트캡 판정에 쓰는 값은 moneyCost가 아니라 getActivityCost다.
        // yearlyCost가 붙으면 그쪽이 이기므로, 무료 활동이 조용히 유료가 되어(= 80+ 캡 면제 대상)
        // 이 파일의 rationale이 근거로 삼은 무료/유료 대비가 통째로 뒤집힌다.
        for (let y = spec.unlockYear; y <= 7; y++) {
          expect(getActivityCost(a, y), `${id} year ${y} 실효 가격`).toBe(spec.moneyCost);
        }
      });

      it('SPEC에 없는 선택 필드는 붙어 있지 않다 (노출·비용 은닉 변경 방지)', () => {
        const a = pick(id) as unknown as Record<string, unknown>;
        for (const field of OPTIONAL_BALANCE_FIELDS) {
          expect(a[field], `${id}.${field}`).toBeUndefined();
        }
      });

      it('해금 학년 경계가 스펙 그대로다 (픽스처 변형·학기/방학 전부에서)', () => {
        for (const { label, patch } of FIXTURE_VARIANTS) {
          for (const isVacation of [false, true]) {
            const base = { money: 999, isVacation, ...patch };
            expect(
              availableIn({ year: spec.unlockYear - 1, ...base }, id),
              `${label} / 방학:${isVacation} / Y${spec.unlockYear - 1}`,
            ).toBe(false);
            expect(
              availableIn({ year: spec.unlockYear, ...base }, id),
              `${label} / 방학:${isVacation} / Y${spec.unlockYear}`,
            ).toBe(true);
          }
        }
      });

      if (spec.moneyCost > 0) {
        it(`잔액 ${spec.moneyCost - 1}만이면 빠지고 ${spec.moneyCost}만이면 나온다 (가격 리터럴)`, () => {
          // 기대값이 하드코딩이라 moneyCost와 requires를 정합하게 같이 낮춰도 여기서 걸린다
          for (const { label, patch } of FIXTURE_VARIANTS) {
            const base = { year: spec.unlockYear, isVacation: false, ...patch };
            expect(availableIn({ ...base, money: spec.moneyCost - 1 }, id), label).toBe(false);
            expect(availableIn({ ...base, money: spec.moneyCost }, id), label).toBe(true);
          }
        });
      } else {
        it('무료라 잔액 0에서도 나온다', () => {
          for (const { label, patch } of FIXTURE_VARIANTS) {
            expect(
              availableIn({ year: spec.unlockYear, money: 0, isVacation: false, ...patch }, id),
              label,
            ).toBe(true);
          }
        });
      }
    });
  }
});

describe('학년 해금 6종 — 설계 의도 관계', () => {
  it('독서실은 독학의 유료 상위다 — 효율은 높고 피로는 낮다', () => {
    const room = pick('study-room');
    const solo = pick('self-study');
    expect(room.moneyCost).toBeGreaterThan(solo.moneyCost);
    expect(room.effects.academic!).toBeGreaterThan(solo.effects.academic!);
    expect(room.fatigue).toBeLessThan(solo.fatigue);
  });

  it('예체능 레슨은 창작 활동의 유료 상위다 — 특기는 높고 피로는 낮다', () => {
    // 독서실/독학과 같은 규약을 특기 축에도 건다. T24 전에는 이것만 어겨서
    // 특기 2.0 > 1.5인데 피로도 6 > 3이었고, 18주 누적에서 무료가 이겼다.
    const lesson = pick('art-lesson');
    const free = pick('creative');
    expect(lesson.moneyCost).toBeGreaterThan(free.moneyCost);
    expect(lesson.effects.talent!).toBeGreaterThan(free.effects.talent!);
    // 피로 리터럴을 양쪽 다 잠근다. 무료 쪽만 잠그면 유료를 6으로 되돌려도 통과하고,
    // 유료 쪽만 잠그면 무료를 1로 내려 같은 함정을 다시 만들 수 있다.
    // 5는 독학·코딩 독학이 쓰는 칸이다. 무료 창작(3)보다는 위라 "전문 레슨은 더 고되다"는 결이 남는다.
    expect(lesson.fatigue).toBe(5);
    expect(free.fatigue).toBe(3);
    // 실제 계약은 아래 18주 누적 테스트다 — 수치 부등호만으로는 함정 여부를 알 수 없다.
  });

  it('유료 특기 활동이 무료보다 18주 누적에서 앞선다 — 돈 낼 이유가 실제로 있는가', () => {
    // T24의 진짜 계약. 수치 부등호(특기 2.0 > 1.5)만 보면 유료가 이기는 것처럼 보이지만,
    // 주당 축 상한(+2)·구간 감쇠·피로 누적·멘탈 하락이 얽혀 **누적에서는 뒤집힐 수 있었다**.
    // T24 전 실측: 2칸 배치에서 유료 52.6 vs 무료 54.9로 무료가 이겼다.
    //
    // 부모를 wealth로 두는 건 돈을 변수에서 빼기 위해서다. 일반 가정이면 유료가 스킵돼
    // "돈이 없어 진 것"과 "돌았는데 진 것"이 구별되지 않는다 — 그래서 스킵 0을 먼저 단언한다.
    const play = (slot2: string, weekend: string) => {
      let s = createInitialState('male', ['wealth', 'wealth'], { rngSeed: 42 });
      s.year = 1; s.week = 1;
      let skipped = 0;
      for (let i = 0; i < 18; i++) {
        s.routineSlot2 = slot2; s.routineSlot3 = slot2 === 'academy' ? 'gym' : 'academy';
        s.weekendChoices = [weekend];
        s = processWeek(s);
        skipped += (s.weekLog?.skipped ?? []).filter(k => k.activityId === weekend).length;
      }
      return { talent: s.stats.talent, skipped };
    };

    // 1칸 배치 — 루틴은 학원+헬스, 주말 1칸만 특기 (실플레이 신고의 배치)
    const paid1 = play('academy', 'art-lesson');
    const free1 = play('academy', 'creative');
    expect(paid1.skipped, '유료 1칸이 돈 부족으로 밀린 주').toBe(0);
    expect(paid1.talent, '1칸: 유료가 무료보다 높아야 한다').toBeGreaterThan(free1.talent);

    // 2칸 배치 — T24 전에 역전이 일어나던 곳
    const paid2 = play('art-lesson', 'art-lesson');
    const free2 = play('creative', 'creative');
    expect(paid2.skipped, '유료 2칸이 돈 부족으로 밀린 주').toBe(0);
    expect(paid2.talent, '2칸: 유료가 무료보다 높아야 한다').toBeGreaterThan(free2.talent);

    // 슬롯을 더 부으면 유료의 우위가 커져야 한다. 격차가 줄어들면 "돈 낼 이유"가 슬롯 수에
    // 반비례한다는 뜻이라, 함정이 형태만 바뀐 것이다.
    expect(paid2.talent - free2.talent).toBeGreaterThan(paid1.talent - free1.talent);
  });

  it('실기 레슨은 예체능 레슨의 상위다 — 특기도 가격도 위', () => {
    const pro = pick('practical-lesson');
    const hobby = pick('art-lesson');
    expect(pro.effects.talent!).toBeGreaterThan(hobby.effects.talent!);
    expect(pro.moneyCost).toBeGreaterThan(hobby.moneyCost);
  });

  it('자율학습은 돈 대신 시간을 낸다 — 무료 2칸, 슬롯당 학업은 유료 보충수업보다 낮다', () => {
    const night = pick('night-study');
    const supp = pick('supplementary-class');
    expect(night.moneyCost).toBe(0);
    expect(supp.moneyCost).toBeGreaterThan(0);
    expect(night.slots).toBeGreaterThan(supp.slots);
    // 시간 비용 설계의 핵심 — 총량은 커도 슬롯당으로는 유료가 앞선다. 뒤집히면 돈 낼 이유가 사라진다.
    expect(night.effects.academic! / night.slots).toBeLessThan(supp.effects.academic! / supp.slots);
  });

  it('자율학습은 대가(mental 음수)와 소프트캡 우회축(social 양수)을 함께 가진다', () => {
    const night = pick('night-study');
    expect(night.effects.mental!).toBeLessThan(0);
    // 80+ 소프트캡은 스탯별이라 학업이 캡에 걸려도 social은 살아남는다 — 이 축이 0이 되면 후반 무가치
    expect(night.effects.social!).toBeGreaterThan(0);
  });

  it('무료 해금 3종이 있어 돈 없는 판에서도 학년마다 새 선택지가 열린다', () => {
    // 제품(ACTIVITIES)에서 파생한다 — SPEC을 필터해 SPEC 기준 목록과 비교하면 표가 표를 검사하는
    // 자기참조가 되어, 실제 활동이 유료로 바뀌어도 SPEC만 안 고치면 침묵한다.
    const freeUnlocks = Object.keys(SPEC)
      .filter(id => getActivityCost(pick(id), 7) === 0)
      .sort();
    expect(freeUnlocks).toEqual(['free-semester', 'mentoring', 'night-study']);
  });
});

describe('입시 설명회 — 상점 아이템 수치 잠금', () => {
  const briefing = SHOP_ITEMS.find(i => i.id === 'admission-briefing');

  it('가격·게이트·주간한도가 스펙 그대로다', () => {
    expect(briefing, 'admission-briefing 없음').toBeDefined();
    expect(briefing!.name).toBe('입시 설명회');
    expect(briefing!.price).toBe(3);
    expect(briefing!.category).toBe('growth');
    expect(briefing!.requireYear).toBe(5); // 고1부터
    // 루틴에 못 넣는 대신 주 1회 — 매주 사서 상시 버프로 만들 수 없다
    expect(briefing!.maxPerWeek).toBe(1);
  });

  it('버프는 6주·study 한정·0.1이다', () => {
    const effects = briefing!.effects;
    expect(effects).toHaveLength(1);
    expect(effects[0]).toStrictEqual({
      type: 'buff',
      buffId: 'admission-briefing',
      buffDuration: 6,
      // 'all'이면 3만에 전 스탯 버프가 되어 다른 성장 아이템을 전부 무의미하게 만든다
      buffTarget: 'study',
      buffAmount: 0.1,
    });
  });
});

// 학년별 차등 비용(`yearlyCost`)을 가진 활동은 위 6종과 규약이 다르다 — `moneyCost` 하나로
// 잠글 수 없고, 실효 가격은 `getActivityCost(a, year)`가 학교급별로 고른다. 이 값들은 주간 수입
// 곡선(초/중/고 4·5·5만, wealth +2만)과 맞물려 "루틴 고정비가 수입을 넘는가"를 결정하므로,
// 조용히 드리프트하면 루틴이 매주 실패하는 상태가 테스트 없이 되돌아온다.
const YEARLY_COST_SPEC: Record<string, { name: string; byYear: [number, number][]; rationale: string }> = {
  academy: {
    name: '학원 수업',
    // [학년, 실효 가격] — 학교급 경계(Y1/Y2·Y4/Y5) 양쪽을 끼고 본다.
    byYear: [[1, 2], [2, 3], [4, 3], [5, 3], [7, 3]],
    rationale:
      '고등 3만은 밸런스 결정이다(현실 고증은 단과 4만). 4만이면 academy+gym 기본 루틴이 6만으로 '
      + '고등 수입 5만을 넘어 주 −1만 적자가 되고, sim 실측으로 Y5~Y7 루틴이 48주 중 26~29주 '
      + '실패했다. 3만이면 고정비 5만 = 수입 5만으로 잉여 0 — 재량 예산은 없지만 적자는 아니다. '
      + '되돌리려면 그 26~29주를 감수한다는 뜻이므로 이 표를 같이 고칠 것.',
  },
  'part-time': {
    name: '편의점 알바',
    // 수입 활동 — 음수다. elementary 키가 없어 moneyCost로 폴백한다(Y1은 애초에 unlockYear로 잠김).
    byYear: [[4, -3], [5, -4], [7, -4]],
    rationale: '유일한 상시 수입원. 고등 −4만은 학원 3만 + 헬스 2만 루틴을 자력으로 감당하는 통로다.',
  },
  'short-term-job': {
    name: '방학 단기 일손 돕기',
    byYear: [[4, -6], [5, -8], [7, -8]],
    rationale: '방학 한정 고수입 — 알바의 2배. 방학 고액 활동(특강·캠프 5만, 가족여행 8만)의 재원.',
  },
};

describe('학년별 차등 비용 — 실효 가격 잠금', () => {
  for (const [id, spec] of Object.entries(YEARLY_COST_SPEC)) {
    it(`${id}(${spec.name})의 학교급별 실효 가격 — ${spec.rationale}`, () => {
      const a = pick(id);
      expect(a.name).toBe(spec.name);
      for (const [year, expected] of spec.byYear) {
        expect(getActivityCost(a, year), `${id} year ${year}`).toBe(expected);
      }
    });
  }

  it('고등 루틴 고정비(학원+헬스)가 고등 주간 수입을 넘지 않는다', () => {
    // B-2의 목적 자체 — 이 부등식이 깨지면 매주 반복되는 슬롯의 절반이 조용히 실패한다.
    // 비용을 되돌리거나 수입을 낮추면 여기서 걸린다.
    const HIGH_YEAR = 6;
    const routine = getActivityCost(pick('academy'), HIGH_YEAR) + getActivityCost(pick('gym'), HIGH_YEAR);
    // 기본 부모(wealth 없음) 기준 — wealth +2만은 구제 수단이지 전제가 아니다.
    const income = getWeeklyIncome(['emotional', 'info'], HIGH_YEAR);
    expect(routine, `루틴 고정비 ${routine}만 vs 수입 ${income}만`).toBeLessThanOrEqual(income);
  });
});

// 고가 4종 — 학년 해금 6종과 달리 unlockYear가 없거나(방학 3종) seasonGate/vacationLimit/
// catchupBonus/parentEffect가 있는 활동이라 BalanceSpec을 그대로 못 쓴다.
// 선택 필드는 값을 선언한 것만 잠그고, 선언하지 않은 것은 "없음"이 계약이다.
interface HighCostSpec {
  name: string;
  slots: number;
  fatigue: number;
  moneyCost: number;
  category: Activity['category'];
  effects: Record<string, number>;
  rationale: string;
  unlockYear?: number;
  seasonGate?: Activity['seasonGate'];
  vacationLimit?: number;
  catchupBonus?: Activity['catchupBonus'];
  parentEffect?: Activity['parentEffect'];
}

const HIGHCOST: Record<string, HighCostSpec> = {
  'private-tutoring': {
    name: '집중 과외', slots: 1, fatigue: 9, moneyCost: 28, category: 'study',
    effects: { academic: 2.5 },
    unlockYear: 5,
    rationale:
      '고비용 학업 돈 sink(C7-A). Y5부터, 15→28로 올려 비-wealth가 매주 사지 못하게 함(C7-B). '
      + '유료라 80+ 소프트캡 면제.',
  },
  'intensive-academy': {
    name: '학원 단기특강', slots: 2, fatigue: 12, moneyCost: 5, category: 'study',
    effects: { academic: 4 },
    seasonGate: 'vacation-only',
    vacationLimit: 2,
    catchupBonus: { targetStat: 'academic', threshold: 50, bonus: 0.5 },
    rationale: 'TODO(확인 필요) — 방학 2칸·5만·academic 4와 vacationLimit 2의 sim 도출 근거.',
  },
  'sports-camp': {
    name: '스포츠 캠프', slots: 3, fatigue: 8, moneyCost: 5, category: 'exercise',
    effects: { health: 5, talent: 2, social: 2 },
    seasonGate: 'vacation-only',
    vacationLimit: 1,
    catchupBonus: { targetStat: 'health', threshold: 50, bonus: 0.5 },
    rationale: 'TODO(확인 필요) — 3칸·5만·health 5/talent 2/social 2와 vacationLimit 1의 sim 도출 근거.',
  },
  'family-trip': {
    name: '가족 여행', slots: 3, fatigue: -8, moneyCost: 8, category: 'parent',
    effects: { mental: 6, social: 2, health: 1 },
    seasonGate: 'vacation-only',
    vacationLimit: 1,
    parentEffect: { baseDelta: 1.5, tag: 'familyTime' },
    rationale: 'TODO(확인 필요) — 8만·피로 −8·parentEffect familyTime 1.5의 sim 도출 근거.',
  },
};

function assertOptionalFields(id: string, a: Activity, spec: HighCostSpec): void {
  const rec = a as unknown as Record<string, unknown>;
  const declared = spec as unknown as Record<string, unknown>;
  for (const field of OPTIONAL_BALANCE_FIELDS) {
    if (declared[field] !== undefined) {
      expect(rec[field], `${id}.${field}`).toStrictEqual(declared[field]);
    } else {
      expect(rec[field], `${id}.${field}`).toBeUndefined();
    }
  }
}

// 엔진의 스킵 판정은 `WeekLog.skipped`에 {activityId, reason, origin}으로 남는다(PR #407).
// 로그 문자열을 파싱하지 않는 이유: 정규식 `.+`은 **어느 활동이** 걸렸는지 안 보고, 문구나
// 조사 처리가 바뀌면 조용히 통과한다. 구조화 기록은 활동 id까지 지목한다.
const moneySkipped = (s: GameState, id: string): boolean =>
  (s.weekLog?.skipped ?? []).some(k => k.activityId === id && k.reason === 'money');
const gateSkipped = (s: GameState, id: string): boolean =>
  (s.weekLog?.skipped ?? []).some(k => k.activityId === id && k.reason === 'gate');

/**
 * 활동이 실제로 **적용됐는지** — 활동을 뺀 대조군보다 그 활동의 효과 축이 더 올랐는가.
 *
 * `${name} 완료` 메시지는 `applyActivity` 말미의 무조건 push라 효과·차감이 전부 죽어도 남는다.
 * 그렇다고 `statChanges`에 키가 있는지만 보면 더 나쁘다 — **자연 감소가 academic·social·
 * talent·health를 활동과 무관하게 항상 채우므로**(활동 0개인 주에도 4개 축이 기록된다,
 * 실측) 그 판정은 항상 참이 되어 "효과 루프를 비워도 통과"했다. 그래서 대조군과 비교한다.
 */
function appliedEffect(withAct: GameState, control: GameState, activity: Activity): boolean {
  // **로그가 아니라 실제 스탯**을 본다. 로그(`statChanges`)만 보면 `state.stats` 대입을 생략한
  // 변형이 통과한다(엔진은 그 둘을 별개 줄에서 갱신한다 — 실측으로 확인된 구멍).
  // 스킵 기록은 여기서 보지 않는다. 스킵 단언은 호출부에서 따로 하며, 여기서까지 보면
  // "스킵으로 기록됐지만 효과는 들어갔다"는 모순 상태를 아무도 배제하지 못한다.
  return Object.keys(activity.effects).some(k => {
    const key = k as keyof GameState['stats'];
    return withAct.stats[key] > control.stats[key] + 1e-9;
  });
}

const CAT_LABEL: Record<Activity['category'], string> = {
  study: '공부',
  exercise: '운동',
  social: '관계',
  talent: '자기계발',
  rest: '휴식',
  parent: '가족',
  work: '알바',
};

function renderHighCostPicker(
  act: Activity,
  opts: {
    pendingVacUse?: Record<string, number>;
    vacationActivityCounts?: Record<string, number>;
  } = {},
): void {
  render(createElement(ActivityPicker, {
    activities: [act],
    selected: [],
    onToggle: vi.fn(),
    maxSlots: 10,
    currentSlots: 0,
    availableMoney: 999,
    pendingVacUse: opts.pendingVacUse,
    state: makeState(withSeason(true, {
      money: 999,
      year: 4,
      vacationActivityCounts: opts.vacationActivityCounts ?? {},
    })),
  }));
}

function highCostActivityButton(act: Activity): HTMLElement {
  const header = screen.getAllByRole('button').find(el =>
    (el.textContent ?? '').includes(CAT_LABEL[act.category])
    && el.getAttribute('aria-expanded') !== null,
  );
  if (!header) throw new Error(`카테고리 헤더 없음: ${act.category}`);
  if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
  const btn = screen.getAllByRole('button').find(el =>
    el.getAttribute('aria-pressed') != null && (el.textContent ?? '').includes(act.name),
  );
  if (!btn) throw new Error(`활동 버튼 없음: ${act.name}`);
  return btn;
}

function choiceSlots(id: string): string[] {
  return Array.from({ length: pick(id).slots }, () => id);
}

describe('고가 4종 — 밸런스 수치 잠금', () => {
  for (const [id, spec] of Object.entries(HIGHCOST)) {
    describe(`${id} (${spec.name})`, () => {
      it(`수치가 스펙과 정확히 같다 — ${spec.rationale}`, () => {
        const a = pick(id);
        expect(a.name).toBe(spec.name);
        expect(a.slots).toBe(spec.slots);
        expect(a.fatigue).toBe(spec.fatigue);
        expect(a.moneyCost).toBe(spec.moneyCost);
        expect(a.category).toBe(spec.category);
        if (spec.unlockYear !== undefined) {
          expect(a.unlockYear).toBe(spec.unlockYear);
          expect(typeof a.requires).toBe('function');
        } else {
          expect(a.unlockYear).toBeUndefined();
          expect(a.requires).toBeUndefined();
        }
        expect(a.effects).toStrictEqual(spec.effects);
      });

      it('실효 가격(getActivityCost)이 moneyCost와 같다 — yearlyCost로 우회되지 않는다', () => {
        const a = pick(id);
        // 해금 전 학년 밴드에 yearlyCost를 몰래 넣어도 잡히게 1~7 전부.
        for (let y = 1; y <= 7; y++) {
          expect(getActivityCost(a, y), `${id} year ${y} 실효 가격`).toBe(spec.moneyCost);
        }
      });

      it('선택 필드는 선언한 값이고, 선언하지 않은 것은 없다', () => {
        assertOptionalFields(id, pick(id), spec);
      });

      const unlockYear = spec.unlockYear;
      if (unlockYear !== undefined) {
        it('해금 학년 경계가 스펙 그대로다 (픽스처 변형·학기/방학 전부에서)', () => {
          for (const { label, patch } of FIXTURE_VARIANTS) {
            for (const isVacation of [false, true]) {
              const base = withSeason(isVacation, { money: 999, ...patch });
              expect(
                availableIn({ year: unlockYear - 1, ...base }, id),
                `${label} / 방학:${isVacation} / Y${unlockYear - 1}`,
              ).toBe(false);
              expect(
                availableIn({ year: unlockYear, ...base }, id),
                `${label} / 방학:${isVacation} / Y${unlockYear}`,
              ).toBe(true);
            }
          }
        });

        it(`잔액 ${spec.moneyCost - 1}만이면 빠지고 ${spec.moneyCost}만이면 나온다 (가격 리터럴)`, () => {
          // 하드코딩이라 moneyCost와 requires를 정합하게 같이 낮춰도 여기서 걸린다
          for (const { label, patch } of FIXTURE_VARIANTS) {
            for (const isVacation of [false, true]) {
              const base = withSeason(isVacation, { year: unlockYear, ...patch });
              expect(
                availableIn({ ...base, money: spec.moneyCost - 1 }, id),
                `${label} / 방학:${isVacation} / ${spec.moneyCost - 1}만`,
              ).toBe(false);
              expect(
                availableIn({ ...base, money: spec.moneyCost }, id),
                `${label} / 방학:${isVacation} / ${spec.moneyCost}만`,
              ).toBe(true);
            }
          }
        });

        it(`엔진이 확정 시 ${spec.moneyCost}만을 실제로 차감한다`, () => {
          // 위 테스트는 **목록 노출**(requires 게이트)만 본다. 게이트를 통과한 뒤 엔진이
          // 정말 그 값을 빼는지는 별개다 — 실측으로 확인된 구멍이었다: 이 활동만 cost 0으로
          // 만드는 변형이 리포 전체 779개를 통과했다(게임에서 가장 비싼 활동이 공짜가 된다).
          const week = (choices: string[]) => processWeek(makeState(withSeason(false, {
            year: unlockYear,
            money: spec.moneyCost,
            weekendChoices: choices,
            vacationChoices: [],
            eventTimeCost: 0,
            routineSlot2: null,
            routineSlot3: null,
          })));
          const applied = week(choiceSlots(id));
          const control = week([]);

          expect(moneySkipped(applied, id), `${spec.moneyCost}만인데 돈 부족으로 기록됐다`).toBe(false);
          expect(gateSkipped(applied, id), `해금 학년인데 게이트로 스킵됐다`).toBe(false);
          // 돈만 빠지고 효과는 0인 상태를 배제한다 — 차감만 보면 그걸 못 잡는다.
          expect(
            appliedEffect(applied, control, pick(id)),
            `${spec.moneyCost}만을 냈는데 효과가 들어가지 않았다`,
          ).toBe(true);
          // 로그와 지갑 둘 다 본다 — 한쪽만 보면 "로그만 차감" 또는 "지갑만 차감"을 놓친다.
          expect(
            (control.weekLog?.moneyChange ?? 0) - (applied.weekLog?.moneyChange ?? 0),
            '로그상 차감액이 선언 가격과 다르다',
          ).toBe(spec.moneyCost);
          expect(
            Number((control.money - applied.money).toFixed(6)),
            '지갑에서 빠진 금액이 선언 가격과 다르다',
          ).toBe(spec.moneyCost);
        });
      } else {
        it('vacation-only라 학기에는 없고 방학에만 나온다 (픽스처 변형 전부)', () => {
          expect(spec.seasonGate).toBe('vacation-only');
          for (const { label, patch } of FIXTURE_VARIANTS) {
            expect(
              availableIn(withSeason(false, { money: 999, year: 4, ...patch }), id),
              `${label} / 학기`,
            ).toBe(false);
            expect(
              availableIn(withSeason(true, { money: 999, year: 4, ...patch }), id),
              `${label} / 방학`,
            ).toBe(true);
          }
        });

        it(`잔액 ${spec.moneyCost - 1}만이면 엔진이 스킵하고 ${spec.moneyCost}만이면 적용된다`, () => {
          // 방학 3종은 requires가 없어 목록(getAvailableActivities)은 잔액과 무관하다.
          // 엔진 차감이 유일한 가격 경계 — processWeek + week/isVacation 짝.
          for (const { label, patch } of FIXTURE_VARIANTS) {
            const ids = choiceSlots(id);
            /** 같은 상태에서 선택 슬롯만 바꿔 돌린다 — 대조군은 활동을 아예 안 고른 주. */
            // 스탯을 catchup 발동선(중등 35) 위로 올린다 — 안 그러면 catchup이 대신 스탯을
            // 올려서 "본 효과가 죽어도 적용된 것처럼" 보인다(실측: intensive-academy가 그랬다).
            const NO_CATCHUP = { academic: 60, social: 60, talent: 60, mental: 60, health: 60 };
            const week = (money: number, choices: string[]) => processWeek(makeState(withSeason(true, {
              year: 4,
              money,
              stats: NO_CATCHUP,
              vacationChoices: choices,
              weekendChoices: [],
              eventTimeCost: 0,
              ...patch,
            })));

            const short = spec.moneyCost - 1;
            const skipped = week(short, ids);
            expect(
              moneySkipped(skipped, id),
              `${label} / ${short}만 — 돈 부족으로 기록되지 않았다`,
            ).toBe(true);
            expect(
              appliedEffect(skipped, week(short, []), pick(id)),
              `${label} / ${short}만 — 감당 못 하는데 적용됐다`,
            ).toBe(false);

            const applied = week(spec.moneyCost, ids);
            const control = week(spec.moneyCost, []);
            expect(
              appliedEffect(applied, control, pick(id)),
              `${label} / ${spec.moneyCost}만 — 감당되는데 적용되지 않았다`,
            ).toBe(true);
            expect(
              moneySkipped(applied, id),
              `${label} / ${spec.moneyCost}만 — 감당되는데 돈 부족으로 기록됐다`,
            ).toBe(false);
            // 가격 리터럴이 실제로 **차감**된다 — 스킵 기록만 보면 "공짜로 실행"을 못 잡는다.
            // moneyChange에는 용돈·생활비도 섞이므로(processWeek 9단계) 활동만 뺀 대조군과의
            // 차이로 본다. 절대값을 적으면 용돈 곡선이 바뀔 때 이 테스트가 같이 깨진다.
            expect(
              (control.weekLog?.moneyChange ?? 0) - (applied.weekLog?.moneyChange ?? 0),
              `${label} / ${spec.moneyCost}만 — 로그상 차감액이 선언 가격과 다르다`,
            ).toBe(spec.moneyCost);
            // 로그만 보면 "지갑은 안 빠지는" 변형을 놓친다(statChanges에서 겪은 것과 같은 부류).
            expect(
              Number((control.money - applied.money).toFixed(6)),
              `${label} / ${spec.moneyCost}만 — 지갑에서 빠진 금액이 선언 가격과 다르다`,
            ).toBe(spec.moneyCost);
          }
        });

        it('학기 주(잔액 충분)에서는 계절 게이트로 스킵된다 — 돈 부족과 구분', () => {
          const ids = choiceSlots(id);
          for (const { label, patch } of FIXTURE_VARIANTS) {
            const gated = processWeek(makeState(withSeason(false, {
              year: 4,
              money: 999,
              weekendChoices: ids,
              vacationChoices: [],
              eventTimeCost: 0,
              ...patch,
            })));
            const semesterControl = processWeek(makeState(withSeason(false, {
              year: 4,
              money: 999,
              weekendChoices: [],
              vacationChoices: [],
              eventTimeCost: 0,
              ...patch,
            })));
            expect(
              gateSkipped(gated, id),
              `${label} / 학기 — 계절 게이트로 기록되지 않았다`,
            ).toBe(true);
            expect(
              appliedEffect(gated, semesterControl, pick(id)),
              `${label} / 학기 — 방학 전용인데 학기에 적용됐다`,
            ).toBe(false);
            expect(
              moneySkipped(gated, id),
              `${label} / 학기 — 잔액이 충분한데 돈 부족으로 기록됐다`,
            ).toBe(false);
          }
        });
      }
    });
  }
});

describe('고가 4종 — 설계 의도 관계', () => {
  it('집중 과외는 학원(고등)보다 비싸고 학업 효과도 높다', () => {
    const tutor = pick('private-tutoring');
    const academy = pick('academy');
    expect(getActivityCost(tutor, 5)).toBeGreaterThan(getActivityCost(academy, 5));
    expect(tutor.effects.academic!).toBeGreaterThan(academy.effects.academic!);
  });

  it('단기특강은 2칸이고 학원보다 슬롯당 학업이 높다 (방학 전용의 대가)', () => {
    const intensive = pick('intensive-academy');
    const academy = pick('academy');
    expect(intensive.slots).toBe(2);
    expect(intensive.effects.academic! / intensive.slots)
      .toBeGreaterThan(academy.effects.academic! / academy.slots);
  });

  it('고가 4종 안에서 가족 여행만 피로가 음수다 (회복)', () => {
    // 카탈로그 전체의 음수 피로(rest·countryside 등)와 혼동하지 않는다 — 이 4종의 부호.
    const negative = Object.keys(HIGHCOST).filter(id => pick(id).fatigue < 0);
    expect(negative).toEqual(['family-trip']);
    expect(pick('family-trip').fatigue).toBeLessThan(0);
  });
});

describe('고가 4종 — vacationLimit 합산 판정', () => {
  it('isVacationLimitReached가 스펙 한도 리터럴에 걸린다 (pendingUse 포함)', () => {
    for (const [id, spec] of Object.entries(HIGHCOST)) {
      const a = pick(id);
      if (spec.vacationLimit === undefined) {
        expect(
          isVacationLimitReached(a, makeState(withSeason(true, {
            vacationActivityCounts: { [id]: 99 },
          }))),
          `${id} 한도 없음`,
        ).toBe(false);
        continue;
      }
      const limit = spec.vacationLimit;
      const vac = (counts: Record<string, number>, pending?: number) =>
        isVacationLimitReached(
          a,
          makeState(withSeason(true, { vacationActivityCounts: counts })),
          pending,
        );
      expect(vac({ [id]: limit - 1 }), `${id} counts=${limit - 1}`).toBe(false);
      expect(vac({ [id]: limit }), `${id} counts=${limit}`).toBe(true);
      expect(vac({ [id]: 0 }, limit), `${id} pendingUse=${limit}`).toBe(true);
      expect(vac({ [id]: limit - 1 }, 1), `${id} counts+pending=${limit}`).toBe(true);
      expect(
        isVacationLimitReached(
          a,
          makeState(withSeason(false, { vacationActivityCounts: { [id]: limit } })),
        ),
        `${id} 학기 주는 한도 미적용`,
      ).toBe(false);
    }
  });

  it('ActivityPicker는 pendingVacUse를 합산해 한도 도달 시 비활성이다 (한도 리터럴)', () => {
    for (const [id, spec] of Object.entries(HIGHCOST)) {
      if (spec.vacationLimit === undefined) continue;
      const a = pick(id);
      const limit = spec.vacationLimit;

      cleanup();
      renderHighCostPicker(a, { pendingVacUse: { [id]: limit - 1 } });
      const open = highCostActivityButton(a);
      expect(open, `${id} pending=${limit - 1}`).not.toBeDisabled();
      expect(
        within(open).getByText(`방학당 ${limit}회 (${limit - 1}/${limit})`),
      ).toBeInTheDocument();

      cleanup();
      renderHighCostPicker(a, { pendingVacUse: { [id]: limit } });
      const blocked = highCostActivityButton(a);
      expect(blocked, `${id} pending=${limit}`).toBeDisabled();
      expect(within(blocked).getByText('이번 방학 한도 도달')).toBeInTheDocument();
    }
  });
});

describe('카탈로그 무결성 — id 중복', () => {
  // 이 파일과 게이트 테스트 모두 `find(a => a.id === ...)`로 대상을 잡는다.
  // find는 첫 항목만 보므로, 같은 id가 뒤에 하나 더 붙으면 전부 통과하면서
  // 상점·활동 목록에는 중복 항목이 노출된다.
  it.each([
    ['ACTIVITIES', ACTIVITIES.map(a => a.id)],
    ['SHOP_ITEMS', SHOP_ITEMS.map(i => i.id)],
  ])('%s의 id는 고유하다', (_label, ids) => {
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
});
