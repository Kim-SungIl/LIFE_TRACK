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
import { AXIS_LINES, NEUTRAL_LINES, growthReasonLine, growthReasonLines } from '../growthReasonText';

const AXES: GrowthAxis[] = ['academic', 'talent', 'health', 'social'];
const YEARS = [1, 2, 3, 4, 5, 6, 7];

describe('성장 둔화 문장 표', () => {
  it('요인 전부가 표에 있다 — 날씨 칸과 축 칸이 요인 목록을 정확히 나눈다', () => {
    const covered = [...Object.keys(NEUTRAL_LINES), ...Object.keys(AXIS_LINES)].sort();
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
      ...Object.values(NEUTRAL_LINES).flatMap(c => [...c.elementary, ...c.secondary]),
      ...Object.values(AXIS_LINES).flatMap(r => Object.values(r).flatMap(c => [...c.elementary, ...c.secondary])),
    ];
    expect(all.length).toBeGreaterThan(30);
    for (const line of all) expect(line, line).not.toMatch(/[0-9０-９%％×]|배율|퍼센트/);
  });

  // 사용자 판정(3자 검수 F): 돈 축은 닫혀 있다 — 유료 전환 암시 금지. 무료 활동엔 스터디 그룹·부모와
  // 공부·동아리 같은 단체 활동이 있어 "혼자·독학"도 거짓이 된다.
  it('유료 전환 암시·"혼자/독학" 표현이 없다', () => {
    const all = [
      ...Object.values(NEUTRAL_LINES).flatMap(c => [...c.elementary, ...c.secondary]),
      ...Object.values(AXIS_LINES).flatMap(r => Object.values(r).flatMap(c => [...c.elementary, ...c.secondary])),
    ];
    for (const line of all) {
      expect(line, line).not.toMatch(/혼자|독학|배울 곳|배워야|짚어 줄|학원|과외|돈|사야|등록/);
    }
  });

  it('피로·마음 문장 중 공부 장면("책상"·"책"·"페이지"·"글자")은 학업 칸에만 있다', () => {
    for (const f of ['fatigue', 'mood'] as const) for (const a of AXES) {
      if (a === 'academic') continue;
      for (const y of [1, 5]) for (const line of growthReasonLines(f, a, y)) {
        expect(line, `${f}/${a}: ${line}`).not.toMatch(/책상|책을|페이지|글자|공부/);
      }
    }
  });

  it('손상된 판정이면 문장 대신 null (렌더 크래시 방지)', () => {
    for (const bad of [null, undefined, 'fatigue', {}, { factor: 'nope', axis: 'academic', variant: 0 },
      { factor: 'fatigue', axis: 'mental', variant: 0 }, { factor: 'fatigue', axis: 'academic', variant: -1 },
      { factor: 'fatigue', axis: 'academic', variant: 1.5 }, { factor: 'fatigue', axis: 'academic', variant: '1' }]) {
      expect(growthReasonLine(bad, 5), JSON.stringify(bad)).toBeNull();
    }
    expect(growthReasonLine({ factor: 'fatigue', axis: 'academic', variant: 0 }, 5)).toBeTruthy();
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
