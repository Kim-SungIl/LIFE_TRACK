/**
 * 성취 등급의 **도달 가능성** 락 — 픽스처가 아니라 7년을 실제로 살려서 등급을 확인한다.
 *
 * 왜 필요한가: `ending.test.ts`의 경계 테스트는 `achievementFixture`로 스탯을 직접 주입하므로
 * **함수 매핑만** 잠근다. 그 상태에서 `gameEngine`의 학업 노브를 흔들어도(자동 수업 2배,
 * 고등 감쇠 4배) 전체 스위트가 통과했다 — 등급이 실플레이에서 어디에 착지하는지를 보는 눈이
 * 리포에 하나도 없었다. 같은 계열 선례가 #409("픽 가능성만 잠그면 도달 가능성이 통째로 빠진다").
 *
 * 세 프로필은 사다리다. 최소투입 C · 무료 성실 A · 유료 성실 S —
 * 하나만 두면 "전부 C가 되는" 회귀도, "전부 S가 되는" 회귀도 그린이 된다.
 *
 * T29에서 가운데 칸(무료 성실)이 S → A로 내려왔다. 예전엔 성장 최저 보장(baseValue×0.1)이
 * 감쇠·피로·무료 소프트캡을 **하나도 안 맞는 상수 수입**이라, 슬롯만 채우면 무슨 활동이든
 * 85까지 끌어올렸다(QA 360판 중 89판이 84.8~85.35에 고착, 전부 특기 축). 이제 그 보장은
 * 무료 소프트캡 문턱(80)에서 0으로 꺼지고, 85+는 **유료 활동의 자리**다 — 엔진이 원래
 * 선언해 둔 "유료라 80+ 소프트캡 면제"가 비로소 등급까지 도달한다.
 *
 * 비용: 완주 1판 약 0.6초. 아래 6판으로 약 4초.
 */
import { describe, expect, it } from 'vitest';
import { calculateEnding } from '../ending';
import { createInitialState, processWeek } from '../gameEngine';
import { resolveEventLikeStore } from '../../../scripts/lib/y1-sim-resolve';
import type { EventChoice, GameState, ParentStrength } from '../types';

const PARENTS: [ParentStrength, ParentStrength] = ['freedom', 'freedom'];

// 성취에 적대적인 선택 정책 — bestAxis = max(학업, 특기, 생활)을 낮추는 쪽.
// **'effects 합 최소'로는 안 된다**: 그 정책은 멘탈·사회성에 큰 음수가 붙은 *학업 양수*
// 선택지를 집어서 오히려 학업을 78~85로 올린다. 축 기준으로 재야 40대로 내려간다.
function axisMin(choices: EventChoice[]): number {
  let best = 0, bestScore = Infinity;
  choices.forEach((c, i) => {
    const e = (c.effects ?? {}) as Record<string, number>;
    const score = (e.academic ?? 0) + (e.talent ?? 0)
      + ((e.mental ?? 0) + (e.health ?? 0) + (e.social ?? 0)) / 3;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

type Plan = {
  routine: [string, string];
  weekend: string[];
  vacation: string[];
  pick: (c: EventChoice[]) => number;
};

function playSevenYears(plan: Plan, rngSeed: number) {
  let s: GameState = createInitialState('male', PARENTS, { rngSeed });
  s.routineSlot2 = plan.routine[0];
  s.routineSlot3 = plan.routine[1];
  // 학년당 49회 진행이라 7년에 343주+ 필요 — 상한은 넉넉히(sim 하네스와 동일).
  for (let w = 0; w < 420; w++) {
    s.weekendChoices = plan.weekend;
    s.vacationChoices = plan.vacation;
    s = processWeek(s, undefined);
    let guard = 0;
    while (s.currentEvent && guard++ < 20) {
      const ev = s.currentEvent;
      const choices = s.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      s = resolveEventLikeStore(s, plan.pick(choices));
    }
    // 하네스가 학년을 스스로 못 넘긴다 — 이벤트 해결과 학년 전환은 별개의 두 걸음이다.
    if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
    if (s.phase === 'ending') break;
  }
  const life = (s.stats.mental + s.stats.health + s.stats.social) / 3;
  return {
    state: s,
    ending: calculateEnding(s),
    academic: s.stats.academic,
    talent: s.stats.talent,
    life,
    bestAxis: Math.max(s.stats.academic, s.stats.talent, life),
  };
}

// 제품에서 만들 수 있는 최소 투입. 학기 중 루틴 슬롯2는 비울 수 없고(MainWeekScreen)
// 루틴 슬롯엔 rest 계열을 넣을 수 없으므로(SlotEditPopup), 슬롯2는 가장 이득이 적은
// 비휴식(sns, 피로 2 · social +1 · mental −1)으로 채우고 슬롯3·주말·방학만 비운다.
const MIN_INPUT: Plan = { routine: ['sns-activity', ''], weekend: [], vacation: [], pick: axisMin };
/** 시간은 다 붓되 **돈은 한 푼도 안 쓰는** 성실 플레이. 루틴·주말·방학이 전부 무료 활동. */
const DILIGENT_FREE: Plan = {
  routine: ['self-study', 'light-exercise'],
  weekend: ['self-study', 'club'],
  vacation: ['self-study', 'creative', 'rest'],
  pick: () => 0,
};
/** 위와 **루틴 두 칸만** 다르다(독학·가벼운운동 → 학원·헬스). 이 한 쌍의 차이가 유료의 순효과다. */
const DILIGENT_PAID: Plan = {
  routine: ['academy', 'gym'],
  weekend: ['self-study', 'club'],
  vacation: ['self-study', 'creative', 'rest'],
  pick: () => 0,
};

describe('성취 등급 도달 가능성 (7년 완주)', () => {
  it('최소투입 플레이는 C에 착지한다', { timeout: 30_000 }, () => {
    // 시드마다 착지값을 먼저 못박는다 — 등급만 단언하면 경계 근처로 밀려도(예: 학업 49.9)
    // 여전히 C라서 통과하고, 임계가 조용히 이동한 것을 놓친다.
    // 시드 1은 #489(방학식 summer-start W20→W19 이동)로 착지값이 움직였다 — W19가 학기 마지막 주라
    // 그 주의 주간 맥락이 달라지고, 비워진 W20엔 도달형(jihun-basketball 등)이 대신 들어온다.
    // 두 시드 모두 움직였다. 등급 밴드는 셋 다 그대로다.
    const landings: Record<number, number> = { 1: 36.0, 7: 36.7 };
    for (const [seed, academic] of Object.entries(landings)) {
      const r = playSevenYears(MIN_INPUT, Number(seed));
      expect(r.state.year, `seed ${seed} 완주`).toBe(8);
      expect(r.state.phase).toBe('ending');
      expect(r.academic, `seed ${seed} 학업 착지값`).toBeCloseTo(academic, 4);
      expect(r.talent, '특기는 바닥(5)').toBeCloseTo(5, 4);
      expect(r.bestAxis, '학업이 지배 축').toBeCloseTo(academic, 4);
      expect(r.bestAxis, 'C 구간(30~50)').toBeLessThan(50);
      expect(r.ending.achievement, `seed ${seed}`).toBe('C');
      // 특기 5는 붕괴(<10)이므로 문장이 붙는다 — 등급은 깎이지 않는다.
      expect(r.ending.achievementNote).not.toBeNull();
    }
  });

  it('무료 성실 플레이는 A에 착지한다 — 시간만으로는 S에 못 닿는다', { timeout: 30_000 }, () => {
    // T29 전에는 85.6/85.4로 **S 임계에 걸쳐** 있었다. 그 85는 실력의 좌표가 아니라
    // 최저 보장이 꺼지는 좌표였다 — 그래서 시드가 달라도 소수점까지 비슷한 값이 나왔다.
    // 보장을 소프트캡 문턱에서 끄자 같은 플레이가 84대에 앉는다. 여전히 높지만 S는 아니다.
    // #489(방학식 summer-start W20→W19 이동)로 두 시드 다 올라갔다(84.0→84.1 · 83.0→84.3).
    // W19가 학기 마지막 주라 그 주의 주간 맥락이 달라지고, 비워진 W20엔 도달형이 대신 들어온다.
    // **S 임계(85)까지 여유가 0.7로 줄었다** — 이 구간을 건드리는 다음 변경은 이 값을 먼저 볼 것.
    const landings: Record<number, number> = { 1: 84.1, 7: 84.3 };
    for (const [seed, best] of Object.entries(landings)) {
      const r = playSevenYears(DILIGENT_FREE, Number(seed));
      expect(r.state.year, `seed ${seed} 완주`).toBe(8);
      expect(r.bestAxis, `seed ${seed} bestAxis 착지값`).toBeCloseTo(best, 4);
      expect(r.bestAxis, 'A 구간(70~84)').toBeGreaterThanOrEqual(70);
      expect(r.bestAxis, 'S 구간에 들어가면 벽이 돌아온 것이다').toBeLessThan(85);
      expect(r.ending.achievement, `seed ${seed}`).toBe('A');
      expect(r.ending.achievementNote, '부서진 축 없음').toBeNull();
    }
  });

  it('유료 성실 플레이는 S에 착지한다 (양성 짝 — 루틴 두 칸만 다르다)', { timeout: 30_000 }, () => {
    // 이 짝이 없으면 "전부 A로 주저앉는" 회귀가 그린이 된다. 그리고 두 플랜의 차이가
    // **루틴 두 칸뿐**이라는 점이 요점이다 — 등급을 가른 게 투입 시간이 아니라 돈이라는 뜻이고,
    // 그게 엔진이 원래 선언한 "무료 80+ ×0.1 캡 / 유료는 면제" 설계다.
    expect(DILIGENT_PAID.weekend, '주말이 다르면 유료의 순효과가 아니다').toEqual(DILIGENT_FREE.weekend);
    expect(DILIGENT_PAID.vacation, '방학이 다르면 유료의 순효과가 아니다').toEqual(DILIGENT_FREE.vacation);
    // 착지값은 #470(T28, 학원 피로 7→4 · 헬스 7→3)이 main에 먼저 들어가며 88.3/89.7 → 89.3/89.9로
    // 올랐다. 방향이 맞다 — 유료 루틴의 피로가 줄었으니 성장이 늘고, 무료 표(위)는 그 두 활동을
    // 안 쓰므로 그대로다. 이 PR과 #470은 옛 main에서 각자 초록이었고 합쳐서 처음 만났다.
    // 시드 1은 #489(방학식 summer-start W20→W19 이동)로 착지값이 움직였다 — W19가 학기 마지막 주라
    // 그 주의 주간 맥락이 달라지고, 비워진 W20엔 도달형(jihun-basketball 등)이 대신 들어온다.
    // 두 시드 모두 움직였다. 등급 밴드는 셋 다 그대로다.
    const landings: Record<number, number> = { 1: 90.2, 7: 89.7 };
    for (const [seed, best] of Object.entries(landings)) {
      const r = playSevenYears(DILIGENT_PAID, Number(seed));
      expect(r.state.year, `seed ${seed} 완주`).toBe(8);
      expect(r.bestAxis, `seed ${seed} bestAxis 착지값`).toBeCloseTo(best, 4);
      expect(r.bestAxis, 'S 구간(85+)').toBeGreaterThanOrEqual(85);
      expect(r.ending.achievement, `seed ${seed}`).toBe('S');
      expect(r.ending.achievementNote, '부서진 축 없음').toBeNull();
    }
  });
});
