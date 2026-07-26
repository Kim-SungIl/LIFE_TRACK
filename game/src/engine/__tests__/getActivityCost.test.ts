import { describe, expect, it } from 'vitest';
import { getActivityCost } from '../activities';

describe('getActivityCost', () => {
  it('returns moneyCost when yearlyCost is absent', () => {
    expect(getActivityCost({ moneyCost: 0 }, 1)).toBe(0);
    expect(getActivityCost({ moneyCost: 3 }, 7)).toBe(3);
    expect(getActivityCost({ moneyCost: -8 }, 4)).toBe(-8);
  });

  it('selects yearlyCost by year bands: ≤1 elementary, ≤4 middle, else high', () => {
    const activity = {
      moneyCost: 99,
      yearlyCost: { elementary: 2, middle: 3, high: 4 },
    };
    // year <= 1 → elementary
    expect(getActivityCost(activity, 1)).toBe(2);
    expect(getActivityCost(activity, 0)).toBe(2);
    // 1 < year <= 4 → middle
    expect(getActivityCost(activity, 2)).toBe(3);
    expect(getActivityCost(activity, 4)).toBe(3);
    // year > 4 → high
    expect(getActivityCost(activity, 5)).toBe(4);
    expect(getActivityCost(activity, 7)).toBe(4);
  });

  it('falls back to moneyCost when the selected level key is missing', () => {
    // part-time 패턴: elementary 키 없음 → moneyCost
    const work = {
      moneyCost: -3,
      yearlyCost: { middle: -3, high: -4 },
    };
    expect(getActivityCost(work, 1)).toBe(-3);
    expect(getActivityCost(work, 4)).toBe(-3);
    expect(getActivityCost(work, 5)).toBe(-4);
  });
});
