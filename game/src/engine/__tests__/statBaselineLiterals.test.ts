// 시작 스탯과 자연 감소의 "밸런스 수치" 잠금.
//
// 왜 필요한가: T23에서 특기 시작값을 15 → 30, 감쇠를 -0.2 → -0.1로 바꿨는데 **973개 테스트가
// 전부 그대로 통과했다.** 게임의 출발선과 매주 깎이는 양이라는, 체감을 가장 크게 좌우하는
// 두 수치가 아무 데도 안 잠겨 있었다는 뜻이다. activityBalanceLiterals.test.ts와 같은 규약으로
// 기대값을 여기 하드코딩해 잠근다 — 의도적으로 바꿀 때 이 표를 같이 고치면서 근거를 다시 읽게 된다.
//
// 등급 경계(STAT_GRADES)와 함께 봐야 의미가 있다: E<20 · D 20~39 · C 40~59 · B 60~79 · A 80+.
// 시작값이 어느 등급 칸에 떨어지는지가 첫인상을 정한다.
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { getGrade } from '../types';
import type { GameState, ParentStrength, StatKey } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['emotional', 'info'];
const fixture = (o: Partial<GameState> = {}) =>
  Object.assign(createInitialState('male', PARENTS, { rngSeed: 42 }), o);

describe('시작 스탯 (부모 보정 전 기준선)', () => {
  // 부모 보정이 얹히므로 createInitialState 결과가 아니라 "어느 등급 칸에 떨어지는가"를 잠근다.
  // 조합에 따라 ±몇 점은 움직여도, 출발 등급이 바뀌면 첫인상이 통째로 달라진다.
  it('다섯 스탯의 기준선이 고정돼 있다', () => {
    // gameEngine.createInitialState의 stats 리터럴. 바꾸려면 여기도 같이 고칠 것.
    const BASELINE: Record<StatKey, number> = {
      academic: 30, social: 25, talent: 25, mental: 50, health: 40,
    };
    const s = createInitialState('male', ['emotional', 'emotional'], { rngSeed: 1 });
    // 부모 보정 폭을 감안해 ±10 안에 있는지 + 등급 칸이 맞는지 둘 다 본다.
    for (const k of Object.keys(BASELINE) as StatKey[]) {
      expect(Math.abs(s.stats[k] - BASELINE[k]), `${k} 기준선 이탈`).toBeLessThanOrEqual(10);
    }
  });

  it('특기는 E(무관심)로 시작하지 않는다', () => {
    // T23의 핵심. 특기는 5개 중 유일하게 E에서 출발하는 축이었고(15 < 20),
    // "18주를 해도 D"라는 실플레이 신고의 뿌리였다. D 이상에서 시작해야 한다.
    const combos: [ParentStrength, ParentStrength][] = [
      ['emotional', 'info'], ['strict', 'emotional'], ['info', 'wealth'], ['wealth', 'strict'],
    ];
    for (const p of combos) {
      const s = createInitialState('male', p, { rngSeed: 1 });
      expect(s.stats.talent, `${p.join('+')} 조합의 시작 특기`).toBeGreaterThanOrEqual(20);
      expect(getGrade(s.stats.talent).grade, `${p.join('+')} 시작 등급`).not.toBe('E');
    }
  });

  it('특기 기준선이 정확히 25다 (양방향)', () => {
    // 부모 보정은 특기를 건드리지 않으므로(parentModifiers에 talent 항목 없음) 리터럴이 그대로 나온다.
    // 15로 되돌려도, 30으로 올려도 여기서 걸린다.
    //
    // 30이 아닌 이유: 성취는 bestAxis = max(학업, 특기, 생활)이라 특기를 올리면 성취도 같이
    // 오른다. QA 348판에서 30은 성취 B를 120 → 22로 무너뜨렸고, 25는 102로 지키면서
    // 특기 엔딩(예체능 진학 23 + 특기자 11)은 30과 동일하게 열었다.
    for (const p of [['emotional', 'emotional'], ['strict', 'wealth']] as [ParentStrength, ParentStrength][]) {
      expect(createInitialState('male', p, { rngSeed: 1 }).stats.talent, p.join('+')).toBe(25);
    }
  });
});

describe('자연 감소 (학기 중, 초6)', () => {
  /** 활동을 하나도 안 넣은 한 주의 스탯 변화 = 순수 감쇠 + 학교 기본값. */
  function idleWeekDelta(): Record<StatKey, number> {
    const s = fixture({
      year: 1, week: 10,
      stats: { academic: 50, social: 50, talent: 50, mental: 50, health: 50 },
      routineSlot2: null, routineSlot3: null, weekendChoices: [],
    });
    const after = processWeek(s);
    return {
      academic: after.stats.academic - 50, social: after.stats.social - 50,
      talent: after.stats.talent - 50, mental: after.stats.mental - 50,
      health: after.stats.health - 50,
    };
  }

  it('특기 감쇠 상수가 -0.1이다 (학업 감쇠와 같은 값)', () => {
    // T23 전에는 특기 -0.2 = 학업의 2배였다. 시작값이 최저인 축에 감쇠만 2배라
    // 불리가 복리로 쌓였고, 주당 축 상한(+2) 때문에 슬롯을 더 부어도 못 따라잡았다.
    const d = idleWeekDelta();
    expect(d.talent).toBeCloseTo(-0.1, 5);
  });

  it('**학업만 저절로 오른다** — 이 비대칭이 체감의 뿌리다', () => {
    // 감쇠 상수는 학업도 -0.1로 같지만, applySchoolClass가 평일마다 학업에만 +0.3을 준다.
    // 그래서 아무 활동도 안 넣은 주에 학업은 순 +0.2로 오르고 나머지는 전부 깎인다.
    // 이 테스트는 그 비대칭을 "고쳐야 할 버그"가 아니라 **알려진 설계**로 못박아 둔다 —
    // 특기가 안 오른다는 신고를 다시 받을 때 여기부터 읽으라는 뜻이다.
    const d = idleWeekDelta();
    expect(d.academic, '학교 수업(+0.3)이 감쇠(-0.1)를 이긴다').toBeGreaterThan(0);
    for (const k of ['talent', 'social', 'health'] as const) {
      expect(d[k], `${k}는 가만두면 깎인다`).toBeLessThan(0);
    }
    // 격차는 학교 수업(+0.3)에 체감 감소·피로 배율이 곱해진 뒤의 값이라 스탯 높이에 따라
    // 변한다(50 기준 실측 0.2). 정확한 값이 아니라 "학업만 앞서간다"를 잠근다.
    expect(d.academic - d.talent).toBeGreaterThan(0.15);
  });

  it('-0.2로 되돌리면 잡힌다 (양방향 고정)', () => {
    // 위 테스트만 두면 "특기 = 학업"만 유지한 채 둘 다 -0.2로 바꿔도 통과한다.
    const d = idleWeekDelta();
    expect(d.talent).toBeGreaterThan(-0.15);
    expect(d.talent).toBeLessThan(0);   // 감쇠 자체를 없애는 것도 아니다
  });

  it('감쇠만 두면 18주 뒤 특기가 한 등급만 내려간다', () => {
    // -0.2였을 때는 시작 15에서 18주면 11.4(E)까지 떨어졌다.
    let s = fixture({ year: 1, week: 1, routineSlot2: 'self-study', routineSlot3: 'self-study', weekendChoices: ['self-study'] });
    const start = s.stats.talent;
    for (let i = 0; i < 18; i++) {
      s.routineSlot2 = 'self-study'; s.routineSlot3 = 'self-study'; s.weekendChoices = ['self-study'];
      s = processWeek(s);
    }
    expect(s.stats.talent).toBeGreaterThanOrEqual(start - 2.5);
    expect(getGrade(s.stats.talent).grade).not.toBe('E');
  });
});

describe('특기 성장 — 실플레이 신고의 재현', () => {
  it('특기 활동 8주면 C(평범)에 닿는다 — 신고의 직접 재현', () => {
    // 신고: "초6 18주 동안 계속 예체능 레슨을 했는데 D".
    // T23 전에는 C 진입에 14주가 걸렸고 18주를 완주해도 47.6(C)이 한계였다. 이제 8주면 C다.
    // "18주째에 아직 D"가 다시 벌어지면 여기서 걸린다.
    let s = fixture({ year: 1, week: 1 });
    let weeksToC: number | null = null;
    for (let i = 1; i <= 18; i++) {
      s.routineSlot2 = 'creative'; s.routineSlot3 = 'club'; s.weekendChoices = ['coding'];
      s = processWeek(s);
      if (weeksToC === null && s.stats.talent >= 40) weeksToC = i;
    }
    expect(weeksToC, 'C(40) 도달 주차').not.toBeNull();
    expect(weeksToC!).toBeLessThanOrEqual(10);
    expect(s.stats.talent, '18주 후').toBeGreaterThanOrEqual(50);
    expect(['C', 'B', 'A']).toContain(getGrade(s.stats.talent).grade);
  });

  it('음성 대조: 특기 활동을 안 하면 오르지 않는다', () => {
    // 위 테스트가 "시작값을 올렸으니 그냥 통과"하는 게 아님을 보인다.
    let s = fixture({ year: 1, week: 1 });
    const start = s.stats.talent;
    for (let i = 0; i < 18; i++) {
      s.routineSlot2 = 'self-study'; s.routineSlot3 = 'self-study'; s.weekendChoices = ['self-study'];
      s = processWeek(s);
    }
    expect(s.stats.talent).toBeLessThan(start);
  });
});
