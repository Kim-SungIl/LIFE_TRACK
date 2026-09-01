// 시작 스탯과 자연 감소의 "밸런스 수치" 잠금.
//
// 왜 필요한가: T23에서 특기 시작값을 15 → 25, 감쇠를 -0.2 → -0.1로 바꿨는데 **973개 테스트가
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
    // 출발 등급 칸(STAT_GRADES: E<20 · D20 · C40 · B60 · A80). 값이 그대로여도 경계가 움직이면
    // 첫인상이 통째로 달라지므로 같이 잠근다.
    const BASELINE_GRADE: Record<StatKey, string> = {
      academic: 'D', social: 'D', talent: 'D', mental: 'C', health: 'C',
    };
    // 부모 초기 보정(parentModifiers.initStatBonus)은 resilience·strict·emotional 셋만 준다.
    // 셋 다 없는 조합이면 리터럴이 그대로 나오므로 **허용치 없이 toBe로** 잠글 수 있다.
    // (이전 판본은 ±10 허용이었는데, 하필 T23의 변경폭이 정확히 10이라 25→15 되돌림이
    //  통과했다. 실측으로 확인된 false lock이었다.)
    const s = createInitialState('male', ['info', 'wealth'], { rngSeed: 1 });
    for (const k of Object.keys(BASELINE) as StatKey[]) {
      expect(s.stats[k], `${k} 기준선`).toBe(BASELINE[k]);
      expect(getGrade(s.stats[k]).grade, `${k} 출발 등급`).toBe(BASELINE_GRADE[k]);
    }
  });

  it('부모 초기 보정은 학업·멘탈·체력에만 붙는다 (인기·특기는 불변)', () => {
    // 위 테스트가 특정 부모 조합에 기대므로, 그 전제 자체를 잠근다.
    // 이게 깨지면 위 테스트는 "우연히 통과"로 바뀐다.
    const combos: [ParentStrength, ParentStrength][] = [
      ['emotional', 'emotional'], ['strict', 'resilience'], ['wealth', 'freedom'], ['info', 'wealth'],
    ];
    for (const p of combos) {
      const s = createInitialState('male', p, { rngSeed: 1 });
      expect(s.stats.social, `${p.join('+')} 인기`).toBe(25);
      expect(s.stats.talent, `${p.join('+')} 특기`).toBe(25);
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

  it('특기 감쇠 상수가 -0.1이다 (초등 학기 학업 감쇠와 같은 값)', () => {
    // T23 전에는 특기 -0.2 = 학업의 2배였다. 시작값이 최저인 축에 감쇠만 2배라
    // 불리가 복리로 쌓였고, 주당 축 상한(+2) 때문에 슬롯을 더 부어도 못 따라잡았다.
    // ⚠️ "학업과 같다"는 이 관측 조건(Y1 학기 중)에서만 참이다 — 학업 감쇠는 Y2~4 -0.15 /
    // Y5~7 -0.3, 방학은 더 크다. 특기는 평탄한 -0.1이라 고등에서는 특기가 덜 깎인다.
    const d = idleWeekDelta();
    expect(d.talent).toBeCloseTo(-0.1, 5);
  });

  it('**학업만 저절로 오른다** — 이 비대칭이 체감의 뿌리다', () => {
    // 감쇠 상수는 학업도 -0.1로 같지만, applySchoolClass가 평일마다 학업에만 +0.3을 준다.
    // 그래서 아무 활동도 안 넣은 주에 학업만 오르고 나머지는 전부 깎인다. 명목은 +0.2(0.3-0.1)지만
    // 체감 감소·피로 배율이 곱해져 스탯 50 기준 **실측 +0.1**이다.
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

  it('감쇠만 두면 18주가 지나도 출발 등급을 유지한다', () => {
    // 25 → 23.2. 등급은 D 그대로다. -0.2였을 때는 시작 15에서 18주면 11.4(E)까지 떨어졌다.
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
  it('세 칸 전부 특기면 8주에 C(평범)에 닿는다', () => {
    // 특기에 슬롯을 다 몰아준 상한선. T23 전에는 C 진입에 14주가 걸렸고 18주를 완주해도
    // 47.6(C)이 한계였다. 이제 8주면 C다.
    // ⚠️ 이건 신고 조건이 **아니다** — 신고자는 주말 1칸만 특기였다(아래 테스트).
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

  it('신고 조건 그대로 — 주말 1칸만 특기여도 18주면 D를 벗어난다', () => {
    // 신고 원문: "초6 18주 동안 계속 예체능 레슨을 했는데도 D".
    // 재현해 보니 **배치**가 핵심이었다: 루틴 2칸은 학원·헬스에 쓰고 주말 1칸만 예체능 레슨.
    // 위 테스트(3칸 전부 특기)와는 다른 조건이고, 이쪽이 신고자가 실제로 한 플레이다.
    //
    // 부모를 wealth로 두는 것도 재현의 일부다. 일반 가정(4만/주)이면 학원+헬스 루틴만으로
    // 돈이 말라 예체능이 **18주 내내 스킵된다**(실측 18/18칸). 신고자는 부유한 가정이라
    // 예체능이 정상 실행됐는데도 D였다 — 돈이 아니라 슬롯이 원인이었다는 뜻이다.
    //
    // 실측(T23 적용 후): 25 → 41.90, C 도달 16주차, 스킵 0칸.
    // T23 이전 수치(시작 15 · 감쇠 -0.2)로는 같은 배치가 32.4(D)였다 — 신고 그대로다.
    let s = createInitialState('male', ['wealth', 'wealth'], { rngSeed: 42 });
    let artSkipped = 0;
    for (let i = 0; i < 18; i++) {
      s.routineSlot2 = 'academy'; s.routineSlot3 = 'gym'; s.weekendChoices = ['art-lesson'];
      s = processWeek(s);
      artSkipped += (s.weekLog?.skipped ?? []).filter(k => k.activityId === 'art-lesson').length;
    }
    // 스킵 0을 먼저 확인하지 않으면 "돈이 없어 안 돈 것"과 "돌았는데 안 오른 것"을 구별할 수 없다.
    expect(artSkipped, '예체능 레슨이 돈 부족으로 밀린 주').toBe(0);
    expect(s.stats.talent, '18주 후 특기').toBeGreaterThanOrEqual(40);
    expect(getGrade(s.stats.talent).grade, '18주 후 등급').not.toBe('D');
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
