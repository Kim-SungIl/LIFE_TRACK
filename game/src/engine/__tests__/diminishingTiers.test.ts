/**
 * 감쇠표(DIMINISHING_TIERS) **자체**의 계약. (T52)
 *
 * activityGrowthCurve.test.ts는 "경계 좌표를 리터럴로 쓰지 않는다"가 규약이라 표에서 파생만 한다 —
 * 그래서 표의 값이 바뀌어도 곡선의 모양(연속·단조·계단 이하)만 유지되면 전부 초록이다. 계수
 * (1.2·1.0·0.8·0.5·0.3·0.1)를 잡는 건 achievementReach.test.ts의 7년 완주 착지 리터럴뿐인데,
 * 그건 어느 계단이 움직였는지 말해 주지 않는다(실측: factor 하나를 ±0.1 옮겨도 이 파일 없이는
 * 완주 착지값만 어긋난다).
 *
 * 여기서만 리터럴을 쓴다. 표 스냅샷은 **값을 바꾸면 의도적으로 갱신해야 하는 계약**이다 — 감쇠
 * 계단은 성취 사다리(C/A/S)와 85 벽 해소(T29)의 근거라 한 칸도 조용히 움직이면 안 된다(공통 규칙:
 * DIMINISHING_TIERS 값은 불가침). 스냅샷 아래의 구조 단언은 스냅샷을 갱신하는 사람이 지켜야 할
 * **표의 모양**을 리터럴이 아니라 성질로 적어 둔 층이다 — 전부 현재 표에서 참인 것만 적었다.
 */
import { describe, expect, it } from 'vitest';
import { DIMINISHING_TIERS } from '../gameEngine';

// `as const` 리터럴 타입을 벗겨 일반 수로 비교한다(구조 단언이 인덱스마다 다른 리터럴 타입에 걸리지 않게).
const tiers: { upTo: number; factor: number }[] = DIMINISHING_TIERS.map(t => ({ upTo: t.upTo, factor: t.factor }));

describe('DIMINISHING_TIERS — 표 스냅샷 (값을 바꾸면 여기를 의도적으로 갱신한다)', () => {
  it('6계단 — 경계와 계수가 정확히 이 값이다', () => {
    expect(tiers).toEqual([
      { upTo: 30, factor: 1.2 },
      { upTo: 50, factor: 1.0 },
      { upTo: 70, factor: 0.8 },
      { upTo: 85, factor: 0.5 },
      { upTo: 95, factor: 0.3 },
      { upTo: 100, factor: 0.1 },
    ]);
  });
});

describe('DIMINISHING_TIERS — 표의 모양 (스냅샷을 갱신할 때도 지켜야 하는 것)', () => {
  it('경계(upTo)는 강증가하고 마지막이 100이다 — 스탯 전 구간을 빈틈·겹침 없이 덮는다', () => {
    expect(tiers.length, '계단이 없으면 감쇠가 없다').toBeGreaterThan(1);
    expect(tiers[0].upTo, '첫 경계가 0 이하면 첫 계단이 빈 구간이다').toBeGreaterThan(0);
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].upTo, `${i}번째 경계(${tiers[i].upTo})가 앞 경계(${tiers[i - 1].upTo})보다 크지 않다`)
        .toBeGreaterThan(tiers[i - 1].upTo);
    }
    expect(tiers[tiers.length - 1].upTo, '마지막 경계가 100이 아니면 그 위 스탯은 표 밖이다').toBe(100);
  });

  it('계수(factor)는 강감소한다 — 높을수록 느려지는 것이 감쇠다', () => {
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].factor, `${i}번째 계수(${tiers[i].factor})가 앞 계수(${tiers[i - 1].factor})보다 작지 않다`)
        .toBeLessThan(tiers[i - 1].factor);
    }
  });

  it('첫 계단만 가속(>1)이고 나머지는 기본(1) 이하다', () => {
    expect(tiers[0].factor, '초반 가속이 사라졌다').toBeGreaterThan(1);
    tiers.slice(1).forEach((t, i) => {
      expect(t.factor, `${i + 1}번째 계단이 기본(1)을 넘는다`).toBeLessThanOrEqual(1);
    });
  });

  it('마지막 계수는 0보다 크고 첫 계수의 1/10 이하다 — 상한 근처는 거의 멈추되 완전히 멈추진 않는다', () => {
    const first = tiers[0].factor;
    const last = tiers[tiers.length - 1].factor;
    expect(last, '계수 0은 성장 정지 — 상한 근처에서 활동이 무의미해진다').toBeGreaterThan(0);
    expect(last, '꼭대기 감쇠가 얕아졌다 — 85+ 유료 통로의 희소성이 무너진다').toBeLessThanOrEqual(first / 10);
  });
});
