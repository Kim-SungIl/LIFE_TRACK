/**
 * T67 성장 둔화 문장 표 — 칸 전수 계약.
 *
 *   · 모든 (요인, 축, 학교급) 칸에 문장이 있고 칸 안에서 겹치지 않는다.
 *   · 숫자·퍼센트·배율 표기가 없다(hide-numbers).
 *   · 축별 문장 요인 집합이 엔진의 회전 칸 규칙(AXIS_SPECIFIC_GROWTH_DRAGS)과 같다 — 어긋나면 칸 하나가
 *     짝수 번째 variant만 받아 첫 문장만 내는 모듈로 퇴화가 생긴다.
 *   · variant 0..n−1이 칸의 모든 문장을 한 번씩 낸다(계수 1 회전의 비퇴화를 **전 칸**에서).
 */
import { describe, expect, it } from 'vitest';
import { AXIS_SPECIFIC_GROWTH_DRAGS, GROWTH_DRAG_FACTORS, type GrowthAxis } from '../growthDrag';
import { AXIS_LINES, SITUATIONAL_LINES, growthReasonLine, growthReasonLines } from '../growthReasonText';

const AXES: GrowthAxis[] = ['academic', 'talent', 'health', 'social'];
const YEARS = [1, 2, 3, 4, 5, 6, 7];

describe('성장 둔화 문장 표', () => {
  it('요인 전부가 표에 있다 — 날씨 칸과 축 칸이 요인 목록을 정확히 나눈다', () => {
    const covered = [...Object.keys(SITUATIONAL_LINES), ...Object.keys(AXIS_LINES)].sort();
    expect(covered).toEqual([...GROWTH_DRAG_FACTORS].sort());
  });

  it('축별 문장 요인 = 엔진이 축 단위로 세는 요인', () => {
    expect(Object.keys(AXIS_LINES).sort()).toEqual([...AXIS_SPECIFIC_GROWTH_DRAGS].sort());
  });

  it('모든 칸에 문장이 있고 칸 안에서 겹치지 않는다', () => {
    let cells = 0;
    for (const f of GROWTH_DRAG_FACTORS) for (const a of AXES) for (const y of YEARS) {
      const lines = growthReasonLines(f, a, y);
      expect(lines.length, `${f}/${a}/Y${y}`).toBeGreaterThan(0);
      expect(new Set(lines).size, `${f}/${a}/Y${y} 중복`).toBe(lines.length);
      cells++;
    }
    expect(cells, '전수 모수').toBe(GROWTH_DRAG_FACTORS.length * AXES.length * YEARS.length);
  });

  it('초등(Y1)과 중·고는 다른 문장을 쓴다', () => {
    for (const f of GROWTH_DRAG_FACTORS) for (const a of AXES) {
      const elem = growthReasonLines(f, a, 1);
      const sec = growthReasonLines(f, a, 5);
      expect(elem.some(l => sec.includes(l)), `${f}/${a}`).toBe(false);
    }
  });

  it('숫자·퍼센트·배율 표기가 없다 (hide-numbers)', () => {
    const all = [
      ...Object.values(SITUATIONAL_LINES).flatMap(c => [...c.elementary, ...c.secondary]),
      ...Object.values(AXIS_LINES).flatMap(r => Object.values(r).flatMap(c => [...c.elementary, ...c.secondary])),
    ];
    expect(all.length).toBeGreaterThan(30);
    for (const line of all) expect(line, line).not.toMatch(/[0-9０-９%％×]|배율|퍼센트/);
  });

  it('variant 0..n−1이 칸의 모든 문장을 낸다 (전 칸 비퇴화)', () => {
    for (const f of GROWTH_DRAG_FACTORS) for (const a of AXES) for (const y of [1, 4, 7]) {
      const lines = growthReasonLines(f, a, y);
      const out = new Set(lines.map((_, v) => growthReasonLine({ factor: f, axis: a, variant: v }, y)));
      expect(out.size, `${f}/${a}/Y${y}`).toBe(lines.length);
    }
  });

  it('축별 요인은 축마다 다른 문장을 쓴다', () => {
    for (const f of AXIS_SPECIFIC_GROWTH_DRAGS) {
      const firsts = AXES.map(a => growthReasonLines(f, a, 5)[0]);
      expect(new Set(firsts).size, f).toBe(AXES.length);
    }
  });
});
