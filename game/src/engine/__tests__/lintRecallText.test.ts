import { describe, expect, it } from 'vitest';
import { lintRecallText } from '../memorySystem';

describe('lintRecallText', () => {
  it('flags each forbidden pattern individually', () => {
    // FORBIDDEN_RECALL_PATTERNS 4종 — 각각 단독 위반 시 비어 있지 않은 배열.
    // (패턴 문자열 자체는 기대하지 않음 — 위반 여부만 락)
    expect(lintRecallText('그날 academic이 눈에 밟혔다.').length).toBeGreaterThan(0);
    expect(lintRecallText('social 때문에 머뭇거렸다.').length).toBeGreaterThan(0);
    expect(lintRecallText('talent을 의심하던 밤.').length).toBeGreaterThan(0);
    expect(lintRecallText('mental이 무너진 오후.').length).toBeGreaterThan(0);
    expect(lintRecallText('health를 챙기지 못했다.').length).toBeGreaterThan(0);

    expect(lintRecallText('그날의 선택 +3이 남았다.').length).toBeGreaterThan(0);
    expect(lintRecallText('관계가 -5만큼 멀어졌다.').length).toBeGreaterThan(0);

    expect(lintRecallText('시험에서 10점을 받았다.').length).toBeGreaterThan(0);

    expect(lintRecallText('그해 등급이 바뀌던 순간.').length).toBeGreaterThan(0);
    expect(lintRecallText('스탯을 의식하던 방학.').length).toBeGreaterThan(0);
  });

  it('returns [] for clean Korean recall text', () => {
    // 정상 회상문 — 금지 패턴 없음. (lintRecallText는 길이를 검사하지 않으므로 길이 단언은 두지 않음)
    const clean = '처음으로 손을 들어 말했던 그날의 교실.';
    expect(lintRecallText(clean)).toEqual([]);

    expect(lintRecallText('운동장 끝에서 이름을 부르던 봄날.')).toEqual([]);
  });
});
