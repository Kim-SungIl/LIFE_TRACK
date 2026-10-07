// **T66 불변 증명 — 갈림이 없는 판(=선택이 없는 판)의 엔딩 판정은 T66 이전과 바이트 단위로 같다.**
//
// T66은 determineCareer를 갈래 표(careerBranchesOf)로 쪼개고, calculateEnding에 회복 문장 층을 얹는다.
// 둘 다 calculateEnding 본문을 건드리므로 "안 바뀌었다"를 말이 아니라 값으로 증명한다.
//
// 증명 방식: 결정론적 격자 4,000판(endingStateGrid — 진로·행복 문턱 근처에 몰리도록 고른 값)의
// 판정 층(타이틀·설명·등급·노트·성장 모양·행복·총합·진로·진로 설명·수능)을 한 줄씩 뽑아 FNV 해시로
// 접었다. 기대값 `60035cfc`는 **origin/main(9b44f48)의 ending.ts 사본**으로 같은 격자를 돌려 뜬 값이고,
// 같은 실행에서 새 코드와 줄 단위로 비교해 0줄 차이를 확인했다.
// (해시를 다시 뜨고 싶어진다면 그건 기존 판정이 달라졌다는 뜻이다 — 해시가 아니라 변경을 되돌릴 것.)
//
// 해시 하나만 두면 격자가 퇴화해도(전부 같은 판이 되어도) 다시 뜬 해시로 초록이 될 수 있으므로,
// 아래에 **커버리지 하한**을 함께 단언한다 — 격자 안에 두 갈래 판·강제 루트 판·회복 문장 판이
// 실제로 들어 있어야 한다.
import { describe, expect, it } from 'vitest';
import { calculateEnding, careerBranchesOf } from '../ending';
import { digest, endingStateGrid, judgmentLine } from './endingStateGrid';

const N = 4000;
const GRID = endingStateGrid(N);
const ENDINGS = GRID.map(s => calculateEnding(s));

describe('T66 — 선택이 없는 판의 엔딩 판정 불변', () => {
  it('격자 4,000판의 판정 층이 T66 이전과 한 글자도 다르지 않다', () => {
    expect(digest(ENDINGS.map(judgmentLine))).toBe('60035cfc');
  });

  it('갈림 없는 판은 선택값이 무엇이든(손상값 포함) 결과가 같다', () => {
    let closed = 0;
    GRID.forEach((s, i) => {
      if (careerBranchesOf(s).open.length >= 2) return;
      closed++;
      const base = judgmentLine(ENDINGS[i]);
      for (const c of ['specialist', 'general', 'foo'] as const) {
        expect(judgmentLine(calculateEnding({ ...s, careerChoice: c as 'general' }))).toBe(base);
      }
    });
    expect(closed).toBeGreaterThan(N / 2);
  });

  it('두 갈래 판에서 일반을 고른 결과 = 자동 판정(= T66 이전)', () => {
    GRID.forEach((s, i) => {
      if (careerBranchesOf(s).open.length < 2) return;
      expect(judgmentLine(calculateEnding({ ...s, careerChoice: 'general' }))).toBe(judgmentLine(ENDINGS[i]));
    });
  });

  // ↓ 커버리지 하한 — 격자가 퇴화하면 위 해시는 그 퇴화까지 굳힌다.
  it('격자가 두 갈래 판·특기 단독 판·강제 루트로 닫힌 특기 판을 충분히 덮는다', () => {
    const bs = GRID.map(careerBranchesOf);
    const twoWay = bs.filter(b => b.open.length === 2).length;
    const specOnly = bs.filter(b => b.open.length === 1 && b.open[0] === 'specialist').length;
    const forcedClosed = GRID.filter((s, i) => s.stats.talent >= 85 && bs[i].open.length === 1
      && bs[i].open[0] === 'general').length;
    expect(twoWay).toBeGreaterThan(400);   // 실측 522
    expect(specOnly).toBeGreaterThan(800); // 실측 1198
    expect(forcedClosed).toBeGreaterThan(600); // 실측 942
  });

  it('격자가 회복 문장 판과 미출력 판을 둘 다 덮는다 — 회복 층은 판정 층 해시 밖이다', () => {
    const shown = ENDINGS.filter(e => e.recoveryNote).length;
    expect(shown).toBeGreaterThan(100);   // 실측 152
    expect(N - shown).toBeGreaterThan(N / 2);
  });
});
