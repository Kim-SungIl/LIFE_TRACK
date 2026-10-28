// 효과 칩 문자열 — 사건 결과(GameScreen)와 미니 이벤트(MiniTalkModal)가 같이 쓰는 statEffectChips의 모양을 잠근다.
// 통합 전엔 두 곳이 각자 만들었고 아무 테스트도 없었다(3자 검수: 0 생략·소수·색·순서 뮤테이션이 전부 생존).
import { describe, expect, it } from 'vitest';
import { formatSignedEffect, statEffectChips, STAT_ICONS } from '../shared';

describe('formatSignedEffect', () => {
  it.each([[3, '+3'], [-2, '-2'], [0.4, '+0.4'], [-1.25, '-1.3'], [1.6000000000000001, '+1.6']] as const)('%s → %s', (v, want) => {
    expect(formatSignedEffect(v)).toBe(want);
  });
});

describe('statEffectChips', () => {
  it('스탯(키 순서) → 피로 → 돈, 0은 생략, 오른 스탯은 초록·내린 스탯은 빨강', () => {
    const chips = statEffectChips({ stats: { social: 2, academic: 0, mental: -1.5 }, fatigue: 3, money: -5 });
    expect(chips).toEqual([
      { text: `${STAT_ICONS.social} 인기 +2`, color: 'var(--green)' },
      { text: `${STAT_ICONS.mental} 멘탈 -1.5`, color: 'var(--red)' },
      { text: '피로 +3', color: 'var(--red)' },
      { text: '💰 -5만', color: 'var(--red)' },
    ]);
  });

  it('피로는 내려가면 초록, 돈은 들어오면 초록 — 축마다 좋은 방향이 다르다', () => {
    expect(statEffectChips({ fatigue: -4, money: 2 })).toEqual([
      { text: '피로 -4', color: 'var(--green)' },
      { text: '💰 +2만', color: 'var(--green)' },
    ]);
  });

  it('아무 효과도 없으면 칩이 없다', () => {
    expect(statEffectChips({})).toEqual([]);
    expect(statEffectChips({ stats: { health: 0 }, fatigue: 0, money: 0 })).toEqual([]);
  });
});
