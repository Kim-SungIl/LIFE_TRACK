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
  POST_SUNEUNG_WEEK,
} from '../activities';
import { createInitialState, processWeek } from '../gameEngine';
import { SHOP_ITEMS } from '../shopSystem';
import type { Activity, GameState, StatKey } from '../types';
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
    name: '입시 실기 레슨', slots: 1, fatigue: 4, moneyCost: 4, category: 'talent', unlockYear: 6,
    effects: { talent: 2.8 },
    rationale: '예체능 입시 — art-lesson(2.0/2만)의 상위. 특기 빌드가 80+를 넘는 유일한 통로라 고비용이다. '
      + 'T39에서 피로 7 → 4: 예체능 레슨과 **같은 칸**이 이 짝의 최소 조건이다(아래 유료 상위 규약 표). '
      + 'f7이던 때는 7년 96시드에서 특기마저 96.7 vs 96.8로 졌고 수능이 90.49 → 87.47 · SKY 19 → 0이었다.',
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

describe('Y7 수능 이후 3종 — 밸런스 수치 잠금', () => {
  // 위 6종과 같은 규약(리터럴 잠금)이되 **주차 축이 하나 더 있다.** 그래서 SPEC 테이블을
  // 따로 둔다 — 위 블록의 경계 판정은 기본 주차를 쓰므로 주차 게이트가 있는 활동엔 안 맞는다.
  //
  // 이 3종의 수치 근거는 앞 학년과 다르다. 수능 점수는 W35에 확정되지만(모의 2회+내신),
  // 진로 갈래까지 확정되는 건 아니다 — `determineCareer`는 졸업 시점 스탯의 절벽
  // (talent 85/90 · academic 70/80/85/88 · mental 15/30/40)을 여전히 읽는다. 그래서 이 3종의
  // 제약은 "진로에 무관할 것"이 아니라 **"기존 활동이 이미 연 통로를 넓히지 말 것"**이다
  // (수능 이후에도 학업 13종·특기 8종이 열려 있고 전부 이 3종보다 세다).
  // 무게가 실린 곳은 행복이다 — 궤적이 48주 전부를 표본으로 삼아 이 13주가 Y7 행복의 27%다.
  // 그래서 값이 mental·social에 있고, mental은 주당 +2 축 상한에서 면제된 유일한 축이다.
  // 값이 조용히 mental에서 빠지면 이 구간은 다시 아무 의미가 없어진다.
  const POST_SPEC: Record<string, BalanceSpec> = {
    'license-course': {
      name: '운전면허 학원', slots: 1, fatigue: 5, moneyCost: 4, category: 'talent', unlockYear: 7,
      effects: { mental: 2, talent: 0.5 },
      rationale: '수능 후 유일한 유료 선택. 4만은 실기레슨(4만)과 동급 — 이 구간에 남은 돈의 출구이되 무료 2종을 못 이기게',
    },
    'admission-prep': {
      name: '원서·면접 준비', slots: 1, fatigue: 6, moneyCost: 0, category: 'study', unlockYear: 7,
      effects: { academic: 1, social: 1, mental: -1 },
      rationale: 'social 1이 이 활동을 선택지로 만든다 — academic 1·피로 6은 self-study(1.5/5)에 지고, social이 없으면 self-study·study-group·library·study-with-parent 4종에 전 축 열등이라 고를 이유가 0인 함정이 된다. 면접 연습이 사람 앞에서 말하는 일이라는 것이 그 근거고, social은 determineCareer가 안 읽어 진로 절벽도 안 건드린다',
    },
    'overdue-meetup': {
      name: '밀린 약속', slots: 1, fatigue: 3, moneyCost: 1, category: 'social', unlockYear: 7,
      effects: { social: 1.5, mental: 2.5 },
      rationale: 'mental 2.5는 hang-out(2)보다 높다 — 수능 후 13주에 관계로 회복하는 경로를 공부 경로보다 세게 둔다. 1만은 hang-out과 동급',
    },
  };

  const OPEN = POST_SUNEUNG_WEEK;

  it('검사 모수가 살아 있다 — unlockYear 7 활동 전수를 덮는다', () => {
    const y7 = ACTIVITIES.filter(a => a.unlockYear === 7).map(a => a.id).sort();
    expect(y7).toEqual(Object.keys(POST_SPEC).sort());
  });

  for (const [id, spec] of Object.entries(POST_SPEC)) {
    describe(`${id} (${spec.name})`, () => {
      it(`수치가 스펙과 정확히 같다 — ${spec.rationale}`, () => {
        const a = pick(id);
        expect(a.name).toBe(spec.name);
        expect(a.slots).toBe(spec.slots);
        expect(a.fatigue).toBe(spec.fatigue);
        expect(a.moneyCost).toBe(spec.moneyCost);
        expect(a.category).toBe(spec.category);
        expect(a.unlockYear).toBe(spec.unlockYear);
        expect(a.effects).toStrictEqual(spec.effects);
      });

      it('실효 가격이 moneyCost와 같다 — yearlyCost로 우회되지 않는다', () => {
        expect(getActivityCost(pick(id), 7)).toBe(spec.moneyCost);
      });

      it('SPEC에 없는 선택 필드는 붙어 있지 않다', () => {
        const a = pick(id) as unknown as Record<string, unknown>;
        for (const field of OPTIONAL_BALANCE_FIELDS) {
          expect(a[field], `${id}.${field}`).toBeUndefined();
        }
      });

      it('수능 주에는 닫히고 다음 주에 열린다 (픽스처 변형 전부에서)', () => {
        for (const { label, patch } of FIXTURE_VARIANTS) {
          const base = { year: 7, money: 999, isVacation: false, ...patch };
          expect(availableIn({ ...base, week: OPEN - 1 }, id), `${label} / W${OPEN - 1}`).toBe(false);
          expect(availableIn({ ...base, week: OPEN }, id), `${label} / W${OPEN}`).toBe(true);
        }
      });

      it('Y6에는 어느 주차에도 안 열린다', () => {
        for (const { label, patch } of FIXTURE_VARIANTS) {
          for (const week of [1, OPEN - 1, OPEN, 48]) {
            expect(
              availableIn({ year: 6, week, money: 999, isVacation: week >= 43, ...patch }, id),
              `${label} / Y6 W${week}`,
            ).toBe(false);
          }
        }
      });

      if (spec.moneyCost > 0) {
        it(`잔액 ${spec.moneyCost - 1}만이면 빠지고 ${spec.moneyCost}만이면 나온다 (가격 리터럴)`, () => {
          for (const { label, patch } of FIXTURE_VARIANTS) {
            const base = { year: 7, week: OPEN, isVacation: false, ...patch };
            expect(availableIn({ ...base, money: spec.moneyCost - 1 }, id), label).toBe(false);
            expect(availableIn({ ...base, money: spec.moneyCost }, id), label).toBe(true);
          }
        });
      } else {
        it('무료라 잔액 0에서도 나온다', () => {
          for (const { label, patch } of FIXTURE_VARIANTS) {
            expect(availableIn({ year: 7, week: OPEN, money: 0, isVacation: false, ...patch }, id), label).toBe(true);
          }
        });
      }
    });
  }

  // 엔진이 열어도 **화면이 조용히 막으면 죽은 컷**이다. 그래서 prop을 주입하지 않고
  // 제품과 같은 경로(getAvailableActivities → ActivityPicker)로 한 번 렌더해서 본다
  // — prop으로 받는 테스트는 그 prop을 만드는 층의 누락을 원리상 못 잡는다(#431).
  it('제품 경로로 렌더하면 W36에 셋 다 뜨고 누를 수 있다 (W35엔 없다)', () => {
    const at = (week: number) => {
      const state = makeState({ year: 7, week, money: 999, isVacation: false });
      render(createElement(ActivityPicker, {
        activities: getAvailableActivities(state),
        selected: [], onToggle: vi.fn(), maxSlots: 2, currentSlots: 0, availableMoney: 999, state,
      }));
    };
    // 카테고리는 접힌 채로 그려진다 — 해당 카테고리를 펴야 활동 버튼이 DOM에 들어온다.
    const expand = (category: Activity['category']) => {
      const header = screen.getAllByRole('button')
        .filter(el => el.getAttribute('aria-expanded') !== null)
        .find(el => within(el).queryAllByText(CAT_LABEL[category]).length > 0);
      if (!header) throw new Error(`카테고리 헤더 없음: ${category}`);
      if (header.getAttribute('aria-expanded') === 'false') fireEvent.click(header);
    };

    at(POST_SUNEUNG_WEEK - 1);
    for (const spec of Object.values(POST_SPEC)) {
      expand(spec.category);
      expect(screen.queryByText(spec.name), `W${POST_SUNEUNG_WEEK - 1} ${spec.name}`).toBeNull();
    }
    cleanup();
    at(POST_SUNEUNG_WEEK);
    for (const spec of Object.values(POST_SPEC)) {
      expand(spec.category);
      const btn = screen.getByText(spec.name).closest('button');
      expect(btn, `${spec.name} 버튼`).not.toBeNull();
      expect(btn, `${spec.name} 비활성`).not.toBeDisabled();
    }
  });

  it('무게가 mental에 실려 있다 — 셋의 |mental| 합이 |academic| 합보다 크다', () => {
    const ids = Object.keys(POST_SPEC);
    const sum = (k: 'mental' | 'academic') =>
      ids.reduce((t, id) => t + Math.abs(pick(id).effects[k] ?? 0), 0);
    expect(sum('mental')).toBeGreaterThan(sum('academic'));
  });
});

describe('학년 해금 6종 — 설계 의도 관계', () => {
  it('독서실은 독학의 유료 상위다 — 효율은 높고 피로는 낮다', () => {
    const room = pick('study-room');
    const solo = pick('self-study');
    expect(room.moneyCost).toBeGreaterThan(solo.moneyCost);
    expect(room.effects.academic!).toBeGreaterThan(solo.effects.academic!);
    expect(room.fatigue).toBeLessThan(solo.fatigue);
  });

  it('예체능 레슨은 창작 활동의 유료 상위다 — 특기는 높고, 피로 격차는 1칸 이내다', () => {
    // 독서실/독학 규약("효율↑ 피로↓를 돈으로 산다")을 특기 축에도 건다. 단 여기서는 피로가
    // **더 낮지는 않다** — 독서실은 f4 < 독학 f5로 진짜 낮지만, 전문 레슨은 무료 창작(f3)보다
    // 고된 게 결에 맞아서 f4로 뒀다. 잠그는 것은 "격차가 1칸을 넘지 않는다"이다.
    // T24 전에는 f6 = 창작의 2배였고, 그 격차가 번아웃 게이트를 넘겨 18주 누적에서 무료가 이겼다.
    const lesson = pick('art-lesson');
    const free = pick('creative');
    expect(lesson.moneyCost).toBeGreaterThan(free.moneyCost);
    expect(lesson.effects.talent!).toBeGreaterThan(free.effects.talent!);
    // 피로 리터럴을 양쪽 다 잠근다. 무료 쪽만 잠그면 유료를 6으로 되돌려도 통과하고,
    // 유료 쪽만 잠그면 무료를 1로 내려 같은 함정을 다시 만들 수 있다.
    expect(lesson.fatigue).toBe(4);
    expect(free.fatigue).toBe(3);
    // 관계로도 잠근다 — 리터럴만 두면 둘을 나란히 올려 격차를 되살릴 수 있다.
    expect(lesson.fatigue).toBeGreaterThan(free.fatigue);          // 전문 레슨이 더 고된 결은 유지
    expect(lesson.fatigue - free.fatigue).toBeLessThanOrEqual(1);  // 격차는 1칸까지
    // 실제 계약은 아래 18주 누적 테스트다 — 수치 부등호만으로는 함정 여부를 알 수 없다.
  });

  it('유료 특기 활동이 무료보다 18주 누적에서 앞선다 — 돈 낼 이유가 실제로 있는가', () => {
    // T24의 진짜 계약. 수치 부등호(특기 2.0 > 1.5)만 보면 유료가 이기는 것처럼 보이지만,
    // 주당 축 상한(+2)·구간 감쇠·번아웃 게이트가 얽혀 **누적에서는 뒤집힐 수 있었다**.
    // T24 전 실측: 2칸 배치에서 유료 52.6 vs 무료 54.9로 무료가 이겼다.
    //
    // 기제는 번아웃 게이트(`mental < 20 || (mental < 25 && fatigue > 70)`)다. 피로 6이면
    // 2칸 배치가 12주차에 burnout에 걸려 성장 배율 0.35를 4주간 먹었고, 무료 창작 2칸은
    // 지침 0주였다. 돈 내는 쪽만 번아웃을 밟는 구조였다는 뜻이다.
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
    expect(paid1.skipped, '유료 1칸이 실행되지 못하고 밀린 주 (돈·게이트 무관하게 전부)').toBe(0);
    expect(paid1.talent, '1칸: 유료가 무료보다 높아야 한다').toBeGreaterThan(free1.talent);

    // 2칸 배치 — T24 전에 역전이 일어나던 곳
    const paid2 = play('art-lesson', 'art-lesson');
    const free2 = play('creative', 'creative');
    expect(paid2.skipped, '유료 2칸이 실행되지 못하고 밀린 주 (돈·게이트 무관하게 전부)').toBe(0);
    expect(paid2.talent, '2칸: 유료가 무료보다 높아야 한다').toBeGreaterThan(free2.talent);

    // T28로 이 단언의 전제가 바뀌었다 — 원래는 "슬롯을 더 부으면 유료의 우위가 커진다"였다.
    // 이 테스트의 루틴 2칸이 **학원+헬스**다. T28이 그 둘의 피로를 7+7 → 4+3으로 낮추자
    // 매주 얹히던 피로가 14 → 7로 반이 됐고, 그러자 **무료 2칸도 주당 특기 상한(+2)에 닿는다.**
    // 예전엔 무료 2칸만 피로에 눌려 캡 아래에 있었기 때문에 슬롯을 늘릴수록 격차가 벌어졌던 것이다.
    //
    // 18주·시드 42·wealth 실측:
    //   학원 f7 · 헬스 f7 (T24) → 1칸 43.30/40.10 (격차 3.20) · 2칸 58.40/54.90 (격차 3.50)
    //   학원 f4 · 헬스 f3 (T28) → 1칸 52.30/46.30 (격차 6.00) · 2칸 59.00/58.40 (격차 0.60)
    //
    // 2칸 격차가 눌린 건 **상한의 작용이지 함정이 아니다**(T24 자신이 "값 인상은 눌린 상태에서만
    // 먹힌다"고 적었다 — 여기서는 무료 쪽이 눌림에서 풀린 것이다). 그리고 T24가 막으려던 진짜
    // 함정(2칸에서 무료가 이김: 52.6 vs 54.9)은 바로 위 `paid2 > free2`가 그대로 잡는다.
    // 그래서 잠그는 대상을 바꾼다 — **캡이 물리지 않는 1칸 배치에서 돈 낼 이유가 남아 있는가.**
    // 루틴 피로가 T24 수준으로 되돌아가면 이 격차가 3.20으로 내려앉아 여기서 걸린다.
    const T24_ONE_SLOT_GAP = 3.2;   // 학원 f7 · 헬스 f7이던 시절의 1칸 격차 (실측)
    expect(paid1.talent - free1.talent, '1칸 격차 — 루틴 피로가 오르면 여기로 돌아온다')
      .toBeGreaterThan(T24_ONE_SLOT_GAP);
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

// ── 유료 상위 규약 (T24 → T28 → T39) ─────────────────────────────────────────────────────
// "유료는 싼 대안의 상위 — 효율↑ 피로↓를 돈으로 산다." 원형은 독서실(academic 2.0/f4/3만)과
// 독학(1.5/f5/무료)이고, T24가 예체능 레슨에서 이 규약이 깨진 걸 잡았다(f6 = 창작 f3의 2배라
// 18주 누적에서 무료가 이겼다). 위의 짝 테스트 둘은 그 두 짝을 개별로 잠근다.
//
// T28이 학업·운동 짝을 **표 하나**로 옮겼고, T39가 방학 특강·입시 실기를 같은 표에 넣는다.
// 개별 it을 더 쓰지 않는 이유는 짝이 늘 때 추가할 자리가 한 곳이어야 하기 때문이다.
// (T39가 함께 잰 세 번째 후보인 **집중 과외 vs 독서실**은 이 표가 아니라 아래 별도 describe에
//  있다 — 값을 안 고쳤고, 이 표의 계약을 48주 창에서 지키지도 않기 때문이다. 거기 주석에
//  왜 그런지가 적혀 있다.)
//
// ## 술어가 "슬롯당"이 된 이유 (T39)
//
// T24·T28의 짝은 전부 1슬롯이라 절대 피로 격차와 슬롯당 격차가 **같은 수**였다. T39가 2슬롯 짝
// (방학 단기특강 2칸 vs 방학 도서관 몰입 2칸)을 넣으면서 둘이 갈라진다. 피로 사다리는 원래
// 슬롯당이다 — `deep-rest`(2칸 −22)는 `rest`(1칸 −10)의 두 배고, 이 파일이 이미 자율학습 vs
// 보충수업을 **슬롯당 학업**으로 재고 있다. 짝은 `p.slots === a.slots`를 먼저 단언하므로
// (같은 자리를 다투지 않으면 대안이 아니다) 1슬롯 짝의 판정은 T24·T28 때와 한 글자도 다르지
// 않다: 학원 0 · 헬스 +1 · 실기 0 · 특강 (5−3)/2 = +1.
//
// 피로 "리터럴"도 양쪽 다 잠근다. 관계만 걸면 둘을 나란히 올려 같은 함정을 되살릴 수 있고,
// 한쪽만 걸면 반대쪽을 움직여 피할 수 있다(T24에서 실제로 지적된 구멍).
const MAX_FATIGUE_PREMIUM_PER_SLOT = 1;

/**
 * 누적 대조에서 짝을 **어느 칸에** 놓는지. 이것까지 스펙이다.
 *
 * 루틴은 슬롯2 → 슬롯3 순으로 적용되고 피로 배율은 **적용 시점의** state.fatigue/health를
 * 읽으므로, 같은 두 활동도 순서를 바꾸면 결과가 달라진다. 주말·방학 칸을 다투는 짝은
 * 루틴을 고정(`CUMULATIVE_ROUTINE`)해 슬롯 밖 변수를 줄인다.
 */
type Placement =
  | { kind: 'routine'; slotIndex: 2 | 3; otherSlot: string }
  | { kind: 'weekend' }
  | { kind: 'vacation' };

interface PaidUpgradePair {
  paid: string;        // 비싼 쪽
  alt: string;         // 같은 자리를 놓고 다투는 싼 대안
  paidFatigue: number; // 리터럴 잠금 (양쪽 다)
  altFatigue: number;
  costYear: number;    // 실효 가격을 비교할 학년 — yearlyCost가 있는 활동이 있어 필요하다
  place: Placement;
  /** 학년 해금 활동 — Y1에서는 게이트에 걸려 한 번도 안 돈다. 누적 대조를 이 학년에서 시작한다. */
  startYear?: number;
  /**
   * 누적 대조의 시작 스탯. **낮은 스탯에서는 주당 축 상한(+2)이 양쪽을 똑같이 눌러
   * 값 차이가 통째로 사라진다** — 특기 30에서는 2.8도 2.0도 그 주에 +2.00이다(T24가
   * "값 인상은 눌린 구간에서만 먹힌다"고 적은 그 현상). 이 짝들이 실제로 사는 구간은
   * 고학년 고스탯이라, 거기에 놓지 않으면 테스트가 무엇을 바꿔도 초록이 된다.
   */
  startStats?: Partial<GameState['stats']>;
  /** 누적 대조의 시작 잔액 — 위 좌표와 같은 판에서 읽은 값(Y5 W1에 1100만대). */
  startMoney?: number;
  winStat: StatKey;    // 돈을 낸 대가로 앞서야 하는 축
  rationale: string;
}

// 시드·부모·주말을 고정한 48주 대조의 조건. **주말을 rest로 두면 안 된다** — 피로가 매주 −10으로
// 상쇄돼 f7과 f3의 결과가 소수점까지 같아지고(실측), 이 테스트는 무엇을 바꿔도 초록이 된다.
const CUMULATIVE_WEEKS = 48;
const CUMULATIVE_SEED = 42;
const CUMULATIVE_WEEKEND = ['self-study', 'club'];
const CUMULATIVE_VACATION = ['rest', 'self-study', 'rest'];
/**
 * 방학 칸을 다투는 짝이 쓰는 나머지 3칸. 방학 자유 슬롯은 5칸이라(`VACATION_BASE_SLOTS`)
 * 2칸 활동 + 이 셋이 딱 채운다. **여기에도 rest를 넣으면 안 된다** — T39가 7년 96시드로
 * 실측한 바로는 방학을 휴식 2칸으로 채우면 단기특강 f12와 f4의 수능이 89.44 vs 89.45로
 * 붙고(차이 0.01), 휴식 0칸이면 85.40 vs 86.71로 갈린다.
 */
const CUMULATIVE_VACATION_FILLER = ['self-study', 'club', 'library'];
/** 주말·방학 칸을 다투는 짝이 쓰는 고정 루틴 — 싸고(1만) 피로가 낮아 슬롯 밖 변수를 줄인다. */
const CUMULATIVE_ROUTINE: [string, string] = ['internet-lecture', 'light-exercise'];
/**
 * 고학년 해금 활동을 재는 좌표. **같은 루틴으로 Y1~Y4를 실제로 살아 본 Y5 W1의 착지값**이다
 * (시드 42/1/7에서 학업 92~93 · 관계 83~84 · 특기 79~80 · 멘탈 86~88 · 체력 79 · 잔액 1100만대).
 *
 * 여기 앉히지 않으면 두 가지가 동시에 거짓말한다 —
 *   · 낮은 스탯에서는 **주당 축 상한(+2)이 양쪽을 똑같이 눌러** 값 차이가 통째로 사라진다
 *     (특기 30에서는 2.8도 2.0도 그 주에 +2.00이다).
 *   · 낮은 체력(<60)에서는 `applyActivity`의 피로 저항(−2/활동)이 꺼져 피로가 실제보다
 *     훨씬 세게 문다. 실측으로 한 번 그랬다 — 축 하나만 82로 올리고 나머지를 Y1 값으로 두면
 *     같은 짝이 정반대 부호를 냈다.
 */
const HIGH_YEAR_STATS = { academic: 92, talent: 80, mental: 88, health: 79, social: 83 };
const HIGH_YEAR_MONEY = 1100;

const PAID_UPGRADE_PAIRS: PaidUpgradePair[] = [
  {
    paid: 'academy', alt: 'internet-lecture', paidFatigue: 4, altFatigue: 4, costYear: 6,
    place: { kind: 'routine', slotIndex: 2, otherSlot: 'light-exercise' }, winStat: 'social',
    rationale: '학원(1.5 + social 0.4 / 3만)은 인강(1.5 / 1만)의 상위 — 학업이 같으니 3배를 받는 근거는 '
      + 'social과 "덜 지친다"뿐이다. f7이던 때는 피로만 +3이라 7년 96시드에서 수능점수 89.51 → 85.23 · '
      + 'SKY 9/96 → 0/96이었다(482만을 더 쓰고).',
  },
  {
    paid: 'gym', alt: 'light-exercise', paidFatigue: 3, altFatigue: 2, costYear: 6,
    place: { kind: 'routine', slotIndex: 3, otherSlot: 'internet-lecture' }, winStat: 'health',
    rationale: '헬스/PT(health 2 + mental 0.5 / 2만)는 가벼운 운동(health 1.5 + mental 1 / 무료)의 상위 — '
      + '효과 합은 2.5로 같고 무게가 체력 쪽으로 옮겨간 게 산 것이다. f7이던 때는 피로가 3.5배라 '
      + '수능점수 89.51 → 84.16 · SKY 9/96 → 0/96이었다.',
  },
  {
    // T39. 방학 2칸끼리의 짝이라 슬롯당으로 재는 첫 짝이다((5−3)/2 = 1칸).
    paid: 'intensive-academy', alt: 'vacation-library', paidFatigue: 5, altFatigue: 3, costYear: 6,
    place: { kind: 'vacation' }, winStat: 'academic',
    startYear: 5, startStats: HIGH_YEAR_STATS, startMoney: HIGH_YEAR_MONEY,
    rationale: '단기특강(academic 4 / 5만 / 2칸 · 방학당 2회)은 방학 도서관 몰입(academic 3 + mental 1 / '
      + '무료 / 2칸)의 유료 상위인데 **효과 합이 4로 같고** 피로가 4배(12 vs 3)였다. 7년 96시드 × '
      + '시드 블록 2벌(휴식 0칸 방학): f12는 학업을 +0.6 사는 대신 멘탈 82.0 → 79.2 · 행복 S '
      + '88·90/96 → 16·18/96을 내준다. f5에서 멘탈 80.5 · S 61·57/96로 돌아온다. 수능/SKY는 이 짝에서 '
      + '블록 간에 부호가 흔들려(무료 86.98 → 86.35) 판정에 안 쓴다 — 멘탈·행복 등급은 두 블록에서 '
      + '소수점까지 같다. 남는 격차는 피로가 아니라 무료 쪽이 들고 있는 mental +1이다.',
  },
  {
    // T39. T24가 "Y6 18주에서 위"라고 재 둔 짝인데, 7년으로 늘리자 뒤집혔다.
    paid: 'practical-lesson', alt: 'art-lesson', paidFatigue: 4, altFatigue: 4, costYear: 6,
    place: { kind: 'weekend' }, winStat: 'talent',
    startYear: 6, startStats: HIGH_YEAR_STATS, startMoney: HIGH_YEAR_MONEY,
    rationale: '입시 실기 레슨(talent 2.8 / 4만 / Y6~)은 예체능 레슨(2.0 / 2만)의 상위인데 피로가 +3이었다. '
      + 'T24의 "Y6 18주에서 위"(74.2 vs 71.5)는 특기가 낮아 주당 축 상한이 안 물리던 구간의 값이다. '
      + '7년 96시드로 늘리면 f7은 **산 축에서도 진다**: 특기 96.7 vs 96.8 · 수능 90.49 → 87.47 · '
      + 'SKY 19/96 → 0/96. 특기 빌드(학업 83)에서는 진로가 인서울 상위권 32/96 → 2/96로 무너졌다. '
      + 'f5도 −0.79점 · SKY 16 vs 19로 열위라(시드 노이즈는 ±0.4점) **대안과 같은 칸인 f4**가 이 짝의 '
      + '최소 조건이다 — 학원 f4 = 인강 f4와 같은 결론이고, f4에서 수능 90.64 · SKY 22/96 · 특기 99.4로 '
      + '모든 축에서 앞선다.',
  },
];

const sumEffects = (a: Activity): number =>
  Object.values(a.effects).reduce((t, v) => t + (v ?? 0), 0);

/** 짝의 활동을 이번 주 슬롯에 놓는다 — 누적 대조와 1주 배선 테스트가 같은 배치를 쓴다. */
function placePairActivity(s: GameState, pair: PaidUpgradePair, varied: string): void {
  const place = pair.place;
  if (place.kind === 'routine') {
    s.routineSlot2 = place.slotIndex === 2 ? varied : place.otherSlot;
    s.routineSlot3 = place.slotIndex === 2 ? place.otherSlot : varied;
    s.weekendChoices = CUMULATIVE_WEEKEND;
    s.vacationChoices = CUMULATIVE_VACATION;
    return;
  }
  s.routineSlot2 = CUMULATIVE_ROUTINE[0];
  s.routineSlot3 = CUMULATIVE_ROUTINE[1];
  if (place.kind === 'weekend') {
    s.weekendChoices = [varied, CUMULATIVE_WEEKEND[1]];
    s.vacationChoices = CUMULATIVE_VACATION;
    return;
  }
  // 방학 2칸 활동. **vacationLimit에 닿으면 빈 칸이 아니라 `alt`로 넘어간다** — 제품에서
  // 그 칸에 실제로 들어갈 것이 대안이기 때문이다. 빈 칸으로 두면 "못 돌아서 진 것"과
  // "돌았는데 진 것"이 구별되지 않고, 게이트 스킵이 쌓여 아래 skipped 단언이 무의미해진다.
  s.weekendChoices = CUMULATIVE_WEEKEND;
  const used = s.vacationActivityCounts?.[varied] ?? 0;
  const head = used >= (pick(varied).vacationLimit ?? Infinity) ? pair.alt : varied;
  s.vacationChoices = [head, head, ...CUMULATIVE_VACATION_FILLER];
}

/**
 * 짝을 놓고 `CUMULATIVE_WEEKS`주를 실제로 돌린다.
 *
 * 부모를 wealth로 두는 건 돈을 변수에서 빼기 위해서다. 일반 가정이면 유료가 스킵돼
 * "돈이 없어 진 것"과 "돌았는데 진 것"이 구별되지 않는다 — 그래서 스킵 0을 먼저 단언한다.
 * 48주는 1학년치라 학년 전환 걸음이 필요 없다(`advanceWeekCounter`가 W48 다음에 전환을
 * 예약하고 하네스는 거기서 멈춘다).
 */
function startPairState(pair: PaidUpgradePair): GameState {
  const s = createInitialState('male', ['wealth', 'wealth'], { rngSeed: CUMULATIVE_SEED });
  if (pair.startYear) s.year = pair.startYear;
  if (pair.startStats) s.stats = { ...s.stats, ...pair.startStats };
  if (pair.startMoney !== undefined) s.money = pair.startMoney;
  return s;
}

function playPairCumulative(pair: PaidUpgradePair, varied: string) {
  let s = startPairState(pair);
  let skipped = 0;
  for (let i = 0; i < CUMULATIVE_WEEKS; i++) {
    placePairActivity(s, pair, varied);
    s = processWeek(s);
    skipped += (s.weekLog?.skipped ?? []).length;
  }
  return { stats: s.stats, skipped };
}

const STAT_KEYS: StatKey[] = ['academic', 'talent', 'mental', 'health', 'social'];

/**
 * **두 활동이 둘 다 건드리지 않는 축.** 여기가 ②의 관측창이다 — 효과로는 아무 일도 일어나지
 * 않는 축이라, 유료 쪽에서 내려갔다면 원인은 피로 하나뿐이다(피로 배율은 축을 가리지 않는다).
 * 표에 적지 않고 **카탈로그에서 파생**한다: 효과를 옮기면 관측창도 따라 움직여야 한다.
 */
const untouchedAxes = (p: Activity, a: Activity): StatKey[] =>
  STAT_KEYS.filter(k => p.effects[k] === undefined && a.effects[k] === undefined);

describe('유료 상위 규약 — 돈을 내면 피로가 따라 오르지 않는다 (T24·T28·T39)', () => {
  it('짝 표가 비어 있지 않다 — it.each는 빈 배열이면 0개 테스트로 조용히 통과한다', () => {
    // 길이를 먼저 못 박지 않으면 표를 통째로 비워도 아래 it.each가 "0 tests"로 초록이 된다.
    expect(PAID_UPGRADE_PAIRS).toHaveLength(4);
    for (const p of PAID_UPGRADE_PAIRS) {
      expect(p.rationale.length, `${p.paid} rationale — 왜 이 값인지가 빠지면 다음 사람이 되돌린다`)
        .toBeGreaterThan(50);
    }
    // 짝이 중복되면 "4개"가 같은 짝 네 벌일 수 있다 — 길이만으로는 못 본다.
    expect(new Set(PAID_UPGRADE_PAIRS.map(p => p.paid)).size).toBe(PAID_UPGRADE_PAIRS.length);
  });

  it.each(PAID_UPGRADE_PAIRS)(
    '$paid는 $alt의 상위다 — 더 비싸고, 효과 합은 낮지 않고, 슬롯당 피로는 1칸 넘게 높지 않다',
    (pair) => {
      const { paid, alt, paidFatigue, altFatigue, costYear } = pair;
      const p = pick(paid);
      const a = pick(alt);
      // 비교값은 전부 카탈로그에서 읽는다 — 양쪽을 스펙에 적으면 표가 표를 검사하는 자기참조가 된다.
      expect(getActivityCost(p, costYear), `${paid} 실효가격`)
        .toBeGreaterThan(getActivityCost(a, costYear));
      expect(p.slots, `${paid} 슬롯`).toBe(a.slots);          // 슬롯이 다르면 같은 자리의 대안이 아니다
      expect(sumEffects(p), `${paid} 효과 합`).toBeGreaterThanOrEqual(sumEffects(a));
      expect(p.fatigue, `${paid} 피로 리터럴`).toBe(paidFatigue);
      expect(a.fatigue, `${alt} 피로 리터럴`).toBe(altFatigue);
      expect((p.fatigue - a.fatigue) / p.slots, `${paid} 슬롯당 피로 프리미엄`)
        .toBeLessThanOrEqual(MAX_FATIGUE_PREMIUM_PER_SLOT);
    },
  );

  it.each(PAID_UPGRADE_PAIRS)(
    '$paid의 피로 리터럴이 processWeek를 통과해 실제 피로로 들어간다 (배선)',
    (pair) => {
      // 리터럴만 잠그면 `applyActivity`가 activity.fatigue를 아예 안 읽어도 초록이다.
      // 한 주를 나란히 돌려 **엔진이 실제로 올린 피로**의 격차를 본다 — 체력 저항·tired 감면을
      // 다 통과한 뒤의 값이라 리터럴의 재선언이 아니다.
      const oneWeek = (varied: string) => {
        let s = startPairState(pair);
        // 방학 칸 짝은 방학 주에서 재야 한다 — 학기 주에 두면 vacationChoices가 통째로 무시된다.
        if (pair.place.kind === 'vacation') s.week = 20;
        placePairActivity(s, pair, varied);
        const before = s.fatigue;
        s = processWeek(s);
        return s.fatigue - before;
      };
      const paidDelta = oneWeek(pair.paid);
      const altDelta = oneWeek(pair.alt);
      expect(paidDelta, `${pair.paid} 한 주 피로 증가분`).toBeGreaterThan(0);
      expect((paidDelta - altDelta) / pick(pair.paid).slots, `${pair.paid} 슬롯당 실측 피로 프리미엄`)
        .toBeLessThanOrEqual(MAX_FATIGUE_PREMIUM_PER_SLOT);
      // 부호까지 본다. `paidDelta > 0`만으로는 부족하다 — 학교 수업 등 활동 밖 피로가 있어서,
      // `applyActivity`가 `activity.fatigue`를 통째로 무시해도 그 단언은 통과한다(실측:
      // `let fatigueDelta = activity.fatigue` → `= 0` 변이가 이 짝들에서 살아남았다).
      // 리터럴이 다르면 엔진이 만든 격차도 같은 부호여야 하고, 같으면 격차가 0이어야 한다.
      if (pair.paidFatigue > pair.altFatigue) {
        expect(paidDelta, `${pair.paid}가 ${pair.alt}보다 실제로 더 지치게 해야 한다`)
          .toBeGreaterThan(altDelta);
      } else {
        expect(paidDelta, `${pair.paid}와 ${pair.alt}는 같은 칸이라 한 주 피로도 같아야 한다`)
          .toBe(altDelta);
      }
    },
  );

  it.each(PAID_UPGRADE_PAIRS)(
    `$paid를 ${CUMULATIVE_WEEKS}주 돌리면 $alt를 산 축에서 앞서고 전체를 갉지 않는다`,
    (pair) => {
      // 진짜 계약. 수치 부등호(학원은 social이 +0.4 더 있다)만 보면 유료가 이기는 것처럼 보이지만,
      // 피로는 getFatigueModifier로 그 주의 **모든** 양수 성장에 곱해지고 tired/burnout 게이트를
      // 부르기 때문에 누적에서는 뒤집힐 수 있었다. f7이던 때 실측(48주·시드 42·wealth):
      //   헬스 f7  학업 80.8 (무료 84.4) · 지침 17주 (무료 0)
      //   학원 f7  학업 81.6 (인강 84.4) · 지침 10주 (인강 0)
      // 지금은 학원 f4가 인강과 학업·체력·멘탈·특기가 소수점까지 같고 관계만 24.4 → 28.2로 앞선다.
      const { paid, alt, winStat } = pair;
      const paidRun = playPairCumulative(pair, paid);
      const altRun = playPairCumulative(pair, alt);
      expect(paidRun.skipped, `${paid}가 실행되지 못하고 밀린 슬롯`).toBe(0);
      expect(altRun.skipped, `${alt}가 실행되지 못하고 밀린 슬롯`).toBe(0);

      // ① 돈을 낸 축에서는 이긴다
      expect(paidRun.stats[winStat], `${paid} vs ${alt} — ${winStat}`)
        .toBeGreaterThan(altRun.stats[winStat]);

      // ② 그 대가로 **두 활동이 둘 다 안 건드리는 축**이 내려가지 않는다.
      //    전 축 합으로 재면 안 된다 — 무료 쪽이 들고 있는 값(방학 도서관의 mental +1)까지
      //    합에 들어와, 피로를 0으로 만들어도 통과할 수 없는 단언이 된다(실측). 반대로 이 축들은
      //    효과상 아무 일도 안 일어나는 자리라, 유료 쪽에서 내려갔다면 원인은 피로 하나뿐이다.
      const axes = untouchedAxes(pick(paid), pick(alt));
      // 관측창이 비면 단언이 0번 돈다 — 그 상태는 통과가 아니라 결함이다(#437).
      expect(axes.length, `${paid}/${alt}가 모든 축을 건드려 관측창이 없다`).toBeGreaterThan(0);
      for (const k of axes) {
        expect(paidRun.stats[k], `${paid} vs ${alt} — ${k}(둘 다 안 건드리는 축 = 피로만 남는 자리)`)
          .toBeGreaterThanOrEqual(altRun.stats[k]);
      }
    },
  );
});

// ── 재 봤고 **안 고친** 짝: 집중 과외 vs 독서실 정기권 (T39) ─────────────────────────────
// 위 표에 넣지 않는다. 표의 계약은 "48주 누적에서 산 축을 이기고 안 건드리는 축을 안 갉는다"인데
// 집중 과외는 그 창에서 그걸 못 지킨다(Y5 한 해에 저축 1100만을 다 쓰면 37주 연속으로 돌아
// 학업 89.00 vs 90.30 · 멘탈 82.50 vs 86.40). 그런데 **7년 96시드 격리 실측에서는 1차 결과가
// 무료보다 나빴던 적이 없다** — 수능 90.73 → 91.20 · SKY 25/96 → 28/96(못 사는 주에 독서실로
// 대체한 배치에서도 90.95 · 24/96). 28만은 주간 수입(고등 5만)으로 못 내는 가격이라 7년에 걸쳐
// 44주만 돌고, 그 사이 방학 회복이 피로를 되돌린다. 같은 횟수라도 **한 해에 몰면 함정이고
// 3년에 펴면 대등**이라, 피로 하나로는 어느 쪽도 못 산다(f7·f5·f4로 낮춰도 7년 수능이
// 91.2~91.3에서 안 움직인다 — 지침 3.5% → 0%만 바뀐다).
// 그래서 값을 그대로 두고, **되돌릴 수 없게 양쪽 리터럴과 관계만** 못 박는다.
describe('집중 과외 — 재 보고 그대로 둔 짝 (T39)', () => {
  it('독서실 정기권보다 비싸고 학업 값이 크며, 양쪽 피로 리터럴이 스펙 그대로다', () => {
    const tutor = pick('private-tutoring');
    const room = pick('study-room');
    expect(tutor.slots, '같은 자리를 다투는 1칸끼리의 짝').toBe(room.slots);
    expect(getActivityCost(tutor, 6)).toBeGreaterThan(getActivityCost(room, 6));
    expect(tutor.effects.academic!).toBeGreaterThan(room.effects.academic!);
    // 한쪽만 잠그면 반대쪽을 움직여 같은 격차를 되살릴 수 있다(T24에서 지적된 구멍).
    expect(tutor.fatigue, '집중 과외 피로 — 7년 96시드에서 1차 결과가 무료보다 나쁘지 않아 유지').toBe(9);
    expect(room.fatigue, '독서실 피로').toBe(4);
  });

  it('28만은 고등 주간 수입으로 매주 낼 수 없다 — 그 희소성이 피로 총량의 상한이다', () => {
    // 이 부등식이 깨지면(가격을 내리거나 수입을 올리면) 위 관찰의 전제가 사라진다.
    // 매주 돌 수 있게 되는 순간 7년 실측은 48주 몰아쓰기 쪽으로 이동한다.
    const HIGH_YEAR = 6;
    const cost = getActivityCost(pick('private-tutoring'), HIGH_YEAR);
    const income = getWeeklyIncome(['wealth', 'wealth'], HIGH_YEAR);
    expect(cost, `과외 ${cost}만 vs 부유한 집 주간 수입 ${income}만`).toBeGreaterThan(income);
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
      + '유료라 80+ 소프트캡 면제. 피로 9는 T39가 독서실(2.0/f4/3만)과 짝지어 재고 **그대로 둔** 값이다 — '
      + '7년 96시드에서 1차 결과가 무료 대안보다 나쁘지 않았다(수능 90.73 → 91.20 · SKY 25 → 28). '
      + '28만은 주간 수입으로 못 내는 가격이라 111주 중 44주만 돌고, 그 희소성이 피로 총량의 상한이다.',
  },
  'intensive-academy': {
    name: '학원 단기특강', slots: 2, fatigue: 5, moneyCost: 5, category: 'study',
    effects: { academic: 4 },
    seasonGate: 'vacation-only',
    vacationLimit: 2,
    catchupBonus: { targetStat: 'academic', threshold: 50, bonus: 0.5 },
    rationale: '방학 2칸·5만·academic 4 — 방학 도서관 몰입(3 + mental 1 / f3 / 무료 / 2칸)의 유료 상위. '
      + 'vacationLimit 2는 "방학당 두 번"이라는 희소성이고, 그 뒤 같은 칸에 들어갈 것이 무료 대안이다. '
      + 'T39에서 피로 12 → 5: 효과 합이 4로 같은데 피로가 4배였다. 7년 96시드 × 블록 2벌(휴식 0칸 '
      + '방학)에서 행복 S 88·90/96 → 16·18/96 · 멘탈 82.0 → 79.2였고, f5에서 S 61·57 · 멘탈 80.5로 '
      + '돌아온다. 같은 2칸끼리의 짝이라 슬롯당 프리미엄 1칸 = 총 +2가 규약의 최대이고 그게 f5다.',
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
