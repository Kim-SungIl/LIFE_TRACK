import { describe, expect, it } from 'vitest';
import { getGrade, STAT_GRADES } from '../types';

describe('getGrade', () => {
  it('matches STAT_GRADES thresholds at each boundary (inclusive min)', () => {
    // 소스 임계값을 그대로 읽어 경계 바로 위/아래를 고정한다.
    for (let i = 0; i < STAT_GRADES.length; i++) {
      const band = STAT_GRADES[i];
      expect(getGrade(band.min).grade).toBe(band.grade);

      if (i > 0) {
        const higher = STAT_GRADES[i - 1];
        // 상위 밴드 min 바로 아래는 현재 밴드
        expect(getGrade(higher.min - 1).grade).toBe(band.grade);
      }
    }
  });

  it('falls back to the last STAT_GRADES entry when no min matches', () => {
    const last = STAT_GRADES[STAT_GRADES.length - 1];
    // 현재 테이블의 최하 min보다 작으면 find 실패 → 마지막 항목
    expect(getGrade(last.min - 1)).toBe(last);
  });
});
