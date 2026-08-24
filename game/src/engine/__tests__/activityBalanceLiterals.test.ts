// 학년 해금 활동 6종 + 입시 설명회의 "밸런스 수치" 잠금.
//
// activityGates.test.ts는 게이트 계약 SSOT라 규약이 "리터럴 주입 금지 — 데이터에서 파생"이다.
// 그래서 가격 경계를 a.moneyCost로 만들고, moneyCost와 requires를 정합하게 함께 바꾸면 통과한다.
// (뮤테이션 실측: 독서실 3만→1만 MISS, 실기레슨 4만→1만 MISS, 야자 무료→5만 MISS, 설명회 3→30 MISS)
//
// 이 파일은 반대 규약이다 — 기대값을 여기 하드코딩해 수치 자체를 잠근다.
// 수치는 sim 측정으로 도출한 값이라(독서실 3만: 2만이면 무료 대비 우위가 과해짐 / 야자 social 1:
// 80+ 소프트캡이 스탯별이라 후반까지 살아남는 유일한 축) 조용히 드리프트하면 근거가 사라진다.
// 값을 의도적으로 바꿀 때는 아래 표를 같이 고치면 되고, 그때 rationale을 다시 읽게 된다.
import { describe, expect, it } from 'vitest';
import { ACTIVITIES, getActivityCost, getAvailableActivities } from '../activities';
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
