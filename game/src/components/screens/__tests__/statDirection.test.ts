// 주간 결산 소리의 방향 판정 계약.
//
// 이전 구현은 5축 델타를 **단순합**해서 방향을 냈다. 그 합계는 화면 어디에도 표시되지 않으므로
// 소리가 "화면에 없는 판정"을 주장하는 상태였다. 여기서는 최대 변화 축과 일치하는지를 잠근다.
import { describe, it, expect } from 'vitest';
import { pickStatDirection } from '../shared';

describe('pickStatDirection — 가장 크게 변한 축을 따른다', () => {
  it('단일 축 상승/하락', () => {
    expect(pickStatDirection({ academic: 3 })).toBe('up');
    expect(pickStatDirection({ mental: -3 })).toBe('down');
  });

  // 핵심 회귀 케이스 — 합(=+1)과 최대 변화 축(=멘탈 -4)의 방향이 반대인 주.
  // 화면에는 "멘탈 -4"가 가장 큰 배지로 보이는데, 합으로 내면 상승음이 났다.
  it('합과 최대 축의 방향이 다르면 최대 축을 따른다', () => {
    expect(pickStatDirection({ academic: 5, mental: -4 })).toBe('up');
    expect(pickStatDirection({ academic: 3, mental: -4 })).toBe('down');
  });

  // 반대 방향 뮤테이션 짝 — 합으로 돌아가면 이 두 개가 서로를 잡는다.
  // (academic 3 / mental -4: 합 -1 = down, 최대 축 = down → 둘이 같아 못 잡으므로 위 첫 줄이 필요)
  it('합이 0이어도 최대 축이 뚜렷하면 소리가 난다', () => {
    expect(pickStatDirection({ academic: 4, mental: -4, social: 0 })).toBe(null); // 동률·반대 → 침묵
    expect(pickStatDirection({ academic: 4, mental: -3, social: -1 })).toBe('up'); // 합 0, 최대 축 +4
  });

  it('미세 변동(±0.5 미만)은 침묵한다', () => {
    expect(pickStatDirection({ academic: 0.4, mental: -0.3 })).toBe(null);
    expect(pickStatDirection({ academic: 0.5 })).toBe('up');   // 경계 포함
    expect(pickStatDirection({ academic: -0.5 })).toBe('down');
  });

  it('최대치가 동률인데 부호가 엇갈리면 침묵한다 (방향이 없는 주)', () => {
    expect(pickStatDirection({ academic: 3, mental: -3 })).toBe(null);
  });

  it('변화가 없거나 비어 있으면 침묵한다', () => {
    expect(pickStatDirection({})).toBe(null);
    expect(pickStatDirection({ academic: 0, mental: 0 })).toBe(null);
    expect(pickStatDirection({ academic: undefined })).toBe(null);
  });
});
