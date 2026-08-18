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
import { ACTIVITIES, getAvailableActivities } from '../activities';
import { SHOP_ITEMS } from '../shopSystem';
import type { Activity } from '../types';
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
        // 효과는 정확 일치 — 축 추가/삭제도 잡는다(야자 mental -1 제거 같은 "대가 삭제")
        expect(a.effects).toEqual(spec.effects);
      });

      it('해금 학년 경계가 스펙 그대로다 (unlockYear-1 제외 / unlockYear 포함)', () => {
        const rich = { money: 999, isVacation: false };
        const before = getAvailableActivities(makeState({ year: spec.unlockYear - 1, ...rich }));
        const at = getAvailableActivities(makeState({ year: spec.unlockYear, ...rich }));
        expect(before.some(a => a.id === id)).toBe(false);
        expect(at.some(a => a.id === id)).toBe(true);
      });

      if (spec.moneyCost > 0) {
        it(`잔액 ${spec.moneyCost - 1}만이면 빠지고 ${spec.moneyCost}만이면 나온다 (가격 리터럴)`, () => {
          const at = (money: number) =>
            getAvailableActivities(makeState({ year: spec.unlockYear, money, isVacation: false }));
          // 기대값이 하드코딩이라 moneyCost와 requires를 정합하게 같이 낮춰도 여기서 걸린다
          expect(at(spec.moneyCost - 1).some(a => a.id === id)).toBe(false);
          expect(at(spec.moneyCost).some(a => a.id === id)).toBe(true);
        });
      } else {
        it('무료라 잔액 0에서도 나온다', () => {
          const broke = getAvailableActivities(
            makeState({ year: spec.unlockYear, money: 0, isVacation: false }),
          );
          expect(broke.some(a => a.id === id)).toBe(true);
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
    const free = Object.entries(SPEC).filter(([, s]) => s.moneyCost === 0);
    expect(free.map(([id]) => id).sort()).toEqual(['free-semester', 'mentoring', 'night-study']);
    for (const [id] of free) expect(pick(id).moneyCost).toBe(0);
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
    expect(effects[0]).toEqual({
      type: 'buff',
      buffId: 'admission-briefing',
      buffDuration: 6,
      // 'all'이면 3만에 전 스탯 버프가 되어 다른 성장 아이템을 전부 무의미하게 만든다
      buffTarget: 'study',
      buffAmount: 0.1,
    });
  });
});
