/**
 * 「곁에 남은 이름들」(BOND_TITLE, T30)의 **도달 가능성** 락 — 픽스처가 아니라 7년을 실제로 살려서
 * 타이틀을 확인한다.
 *
 * 왜 필요한가: `bondEndingTitle.test.ts`·`endingNpc.test.ts`는 intimacy를 손으로 주입하므로
 * **픽 가능성**만 잠근다. 그 상태에서 친밀도 엔진(grind 소프트캡 80·주간 감쇠·동행 +3·미니톡·
 * 이벤트 보상)을 어떻게 흔들어도 전부 초록이다 — 타이틀이 실플레이에서 어디에 착지하는지를 보는
 * 눈이 리포에 없었다. 같은 계열 선례가 #409("픽 가능성만 잠그면 도달 가능성이 통째로 빠진다")와
 * `achievementReach.test.ts`(성취 등급의 7년 착지).
 *
 * 빌드는 QA 하네스의 `bond-max` 페르소나 **그대로**다 — bondEndingTitle 머리말이 인용하는 24시드
 * 실측(soc 97.1 · men 92.4 · hea 79.6 · 절친 8~9명)이 이 페르소나다. 여기 다시 적지 않고 PERSONAS에서
 * 가져온다: 같은 빌드를 두 자리에 박아 두면 한쪽만 고쳐도 초록이다(#431 계열).
 *
 * 세 칸은 사다리다. 발주 가정은 "말걸기를 끄면 대조군"이었는데 실측이 뒤집었다:
 *   (i)   동행 분산 + 매주 말걸기       → 절친 9(시드1)·8(시드7) · 타이틀
 *   (ii)  동행 분산만 끔(말걸기 유지)   → 절친 4 · 타이틀 아님   ← 게이트의 분리선
 *   (iii) 말걸기만 끔(동행 분산 유지)   → 절친 8 · 타이틀 유지   ← 말걸기는 분리선이 아니다
 * 말걸기는 서아 한 명(79.8 → 95.4) 차이고, 절친 5명을 가르는 건 동행 분산이다(4 → 8~9). 동행은
 * grind 소스라 80에서 멈추지만, 그 80까지 끌어올려 둬야 이벤트 보상(≥8, 감쇠 면제)이 82를 넘긴다 —
 * 동행 없이 이벤트만으로는 하은 75·준하 65에서 끝난다. (iii)이 없으면 다음 사람이 대조군을
 * "말걸기 끔"으로 바꿔 놓고 초록을 볼 수 있다(그 판은 8명이라 타이틀을 받는다).
 *
 * (ii)의 4는 bondEndingTitle.test.ts가 리터럴로 적어 둔 실측 분리선(360판 최대 4명)과 같은 수다 —
 * 거기서는 측정값의 사본이었고, 여기서는 매번 다시 산다.
 *
 * 비용: 1판 1.0~1.7초. 아래 5판 약 7초.
 */
import { describe, expect, it } from 'vitest';
import { NPC_COMPANION_ACTIVITIES } from '../activities';
import { AXIS_WEAKNESS, BOND_MIN_FRIENDS, BOND_TITLE, calculateEnding, closeFriends } from '../ending';
import { createInitialState, getWeekInfo, processWeek } from '../gameEngine';
import { isNpcInteractable } from '../relationshipSignals';
import { getAvailableNpcEvents } from '../talkSystem';
import type { GameState } from '../types';
import { resolveEventLikeStore, talkToNpcLikeStore } from '../../../scripts/lib/y1-sim-resolve';
import { validatePersona, type Persona } from '../../../scripts/sim/lib/qa-persona';
import { PERSONAS, pickChoice } from '../../../scripts/sim/sim-qa-playthrough';

const BOND_BUILD = PERSONAS.find(p => p.name === 'bond-max')!;

// 이 하네스가 구현하지 않는 페르소나 지렛대. 빌드가 이 중 하나를 켜면 하네스는 조용히 무시하고
// 다른 판을 재게 되므로, 전제 테스트가 전부 꺼져 있음을 못박는다.
const UNSUPPORTED_LEVERS = ['talkFocus', 'companionFocus', 'tutoringY6', 'partTimeY4', 'partTimeVacationY4'] as const;

/**
 * sim-qa-playthrough.runPersona의 축약 미러 — 루틴·주말·방학·동행 분산·말걸기·이벤트 해결·학년 전환.
 * runPersona를 직접 쓰지 않는 이유: 결과에 GameState가 없어 closeFriends(state)를 못 부르고,
 * 매주 제품 확정 잠금 3종을 재현(predictWeekOutcome = processWeek 한 번 더)하느라 판당 2.2초다.
 * 돈 게이트는 엔진의 스킵 로그('돈이 부족해서')를 세는 것으로 갈음한다 — 0이면 제품도 같은 궤적이다.
 */
function playSevenYears(p: Persona, rngSeed: number) {
  let s: GameState = createInitialState(p.gender, p.parents, { rngSeed });
  s.routineSlot2 = p.routineSlot2;
  s.routineSlot3 = p.routineSlot3;
  let moneySkips = 0;
  // 학년당 49회 진행이라 7년에 343주+ 필요 — 상한은 넉넉히(sim 하네스와 동일).
  for (let w = 0; w < 420; w++) {
    s.weekendChoices = p.weekend;
    s.vacationChoices = p.vacation;

    // 동행(+3, grind 소스) — UI npcActivityMap 미러. 이번 주 실제로 돌 슬롯(학기=주말/방학=방학)의
    // 동행 가능 활동에만, 활동마다 **최저 친밀도 순으로 서로 다른** met NPC를 붙인다(companionSpread).
    let npcMap: Record<string, string> | undefined;
    if (p.companionSpread) {
      const acts = getWeekInfo(s.week).isVacation ? s.vacationChoices : s.weekendChoices;
      const eligible = [...new Set(acts.filter(a => NPC_COMPANION_ACTIVITIES.includes(a)))];
      const met = s.npcs.filter(n => n.met);
      if (eligible.length > 0 && met.length > 0) {
        const sorted = [...met].sort((a, b) => a.intimacy - b.intimacy);
        npcMap = Object.fromEntries(eligible.map((a, i) => [a, sorted[i % sorted.length].id]));
      }
    }

    s = processWeek(s, npcMap);
    moneySkips += (s.weekLog?.messages ?? []).filter(m => m.includes('돈이 부족해서')).length;

    // 말걸기 — processWeek가 npcEventPendingThisWeek를 굴린 직후, 미니톡이 열린 NPC를 우선하고
    // 없으면 친밀도 최상위에게. 부재(전출·졸업) 친구는 플레이어가 고를 수 없으므로 후보에서 뺀다.
    if (p.talk) {
      const candidates = s.npcs.filter(n => isNpcInteractable(n, s)).sort((a, b) => b.intimacy - a.intimacy);
      const target = candidates.find(n => n.intimacy >= 30 && getAvailableNpcEvents(s, n.id).length > 0)
        ?? candidates[0];
      if (target) s = talkToNpcLikeStore(s, target.id);
    }

    let guard = 0;
    while (s.currentEvent && guard++ < 20) {
      const ev = s.currentEvent;
      const choices = s.gender === 'female' && ev.femaleChoices ? ev.femaleChoices : ev.choices;
      s = resolveEventLikeStore(s, pickChoice(choices, p.policy));
    }

    // 하네스는 학년을 스스로 못 넘긴다 — store.advanceFromYearEnd 미러(isVacation·semester까지).
    if (s.phase === 'year-end') {
      s.week = 1;
      s.year++;
      s.currentEvent = null;
      s.phase = 'weekday';
      const next = getWeekInfo(s.week);
      s.semester = next.semester;
      s.isVacation = next.isVacation;
    }
    if (s.phase === 'ending') break;
  }
  return {
    state: s,
    ending: calculateEnding(s),
    friends: closeFriends(s),
    moneySkips,
    miniTalks: s.talkEventsFired.length,
  };
}

/** 완주·제품 정합 자기검사 — 세 칸이 공유한다. */
function expectCompleted(r: ReturnType<typeof playSevenYears>, label: string) {
  expect(r.state.year, `${label} 완주`).toBe(8);
  expect(r.state.phase, label).toBe('ending');
  expect(r.moneySkips, `${label}: 돈이 모자라 엔진이 스킵한 슬롯 — 0이어야 제품에서 같은 궤적이다`).toBe(0);
  // 게이트의 나머지 두 조건(마음·몸이 안 부서짐)은 세 칸 모두 만족한다 — 그래야 타이틀의 유무가
  // **절친 수 하나**로 갈린 것이 된다.
  expect(r.state.stats.mental, `${label} 마음`).toBeGreaterThanOrEqual(AXIS_WEAKNESS);
  expect(r.state.stats.health, `${label} 몸`).toBeGreaterThanOrEqual(AXIS_WEAKNESS);
}

describe('관계 타이틀 도달 가능성 (7년 완주)', () => {
  it('전제: 빌드는 제품에서 만들 수 있고, 이 하네스가 아는 지렛대만 쓴다', () => {
    expect(BOND_BUILD, 'QA 하네스에 bond-max 페르소나가 있어야 한다').toBeDefined();
    expect(validatePersona(BOND_BUILD), '부모 강점 상이·루틴 슬롯 상이·카탈로그 id — 제품 규칙 (a)(b)').toEqual([]);
    expect(BOND_BUILD.invalid).toBeUndefined();
    expect(BOND_BUILD.talk, '말걸기 지렛대').toBe(true);
    expect(BOND_BUILD.companionSpread, '동행 분산 지렛대').toBe(true);
    for (const lever of UNSUPPORTED_LEVERS) {
      expect(BOND_BUILD[lever], `${lever}는 이 하네스가 구현하지 않는다`).toBeUndefined();
    }
    // 분산할 동행 슬롯이 실제로 있어야 companionSpread가 의미를 가진다.
    expect(BOND_BUILD.weekend.some(a => NPC_COMPANION_ACTIVITIES.includes(a)), '주말에 동행 가능 활동').toBe(true);
    expect(BOND_BUILD.vacation.some(a => NPC_COMPANION_ACTIVITIES.includes(a)), '방학에 동행 가능 활동').toBe(true);
  });

  it('(i) 동행 분산 + 매주 말걸기는 절친 8~9명으로 「곁에 남은 이름들」에 착지한다', { timeout: 30_000 }, () => {
    // 시드마다 절친 수를 먼저 못박는다 — 타이틀만 단언하면 9 → 5로 무너져도(문턱 위) 통과하고,
    // BEST_TIER가 조용히 오르거나 감쇠가 세진 것을 놓친다.
    const landings: Record<number, number> = { 1: 9, 7: 8 };
    for (const [seed, count] of Object.entries(landings)) {
      const r = playSevenYears(BOND_BUILD, Number(seed));
      expectCompleted(r, `seed ${seed}`);
      expect(r.miniTalks, `seed ${seed}: 말걸기 지렛대가 실제로 켜졌다(미니톡 발동)`).toBeGreaterThan(0);
      expect(r.friends.length, `seed ${seed} 절친 착지값`).toBe(count);
      expect(r.friends.length, '문턱 이상').toBeGreaterThanOrEqual(BOND_MIN_FRIENDS);
      // 진로는 지워지지 않고 뒤에 붙는다 — bondEndingTitle의 픽 계약과 같은 모양이 실플레이에서도 나온다.
      expect(r.ending.title, `seed ${seed}`).toBe(`${BOND_TITLE} — ${r.ending.career}`);
      expect(r.ending.description, '문장이 부르는 이름은 가장 가까운 친구다').toContain(r.friends[0].name);
    }
  });

  it('(ii) 대조군 — 동행 분산만 끄면 절친 4명에서 멈추고 타이틀을 못 받는다', { timeout: 30_000 }, () => {
    const control: Persona = { ...BOND_BUILD, name: 'bond-no-spread', companionSpread: undefined };
    // 지렛대 **하나만** 다르다 — 그래야 이 짝의 차이가 동행 분산의 순효과다.
    expect({ ...control, name: BOND_BUILD.name, companionSpread: true }).toEqual(BOND_BUILD);

    // 4 = 360판(30페르소나 × 12시드)에서 몸이 성한 판의 절친 최대치 — bondEndingTitle.test.ts의
    // MEASURED_MAX_WITHOUT_COMPANION_SPREAD와 같은 수. 여기서는 사본이 아니라 매번 다시 산 값이다.
    const landings: Record<number, number> = { 1: 4, 7: 4 };
    for (const [seed, count] of Object.entries(landings)) {
      const r = playSevenYears(control, Number(seed));
      expectCompleted(r, `seed ${seed}`);
      expect(r.miniTalks, `seed ${seed}: 말걸기는 켜져 있다 — 그래도 못 넘는다`).toBeGreaterThan(0);
      expect(r.friends.length, `seed ${seed} 절친 착지값`).toBe(count);
      expect(r.friends.length, '문턱 아래').toBeLessThan(BOND_MIN_FRIENDS);
      expect(r.ending.title, `seed ${seed}`).not.toContain(BOND_TITLE);
    }
  });

  it('(iii) 말걸기만 끄면 절친 8명 — 여전히 타이틀을 받는다 (말걸기는 분리선이 아니다)', { timeout: 30_000 }, () => {
    const noTalk: Persona = { ...BOND_BUILD, name: 'bond-no-talk', talk: undefined };
    expect({ ...noTalk, name: BOND_BUILD.name, talk: true }).toEqual(BOND_BUILD);

    const r = playSevenYears(noTalk, 1);
    expectCompleted(r, 'seed 1');
    expect(r.miniTalks, '말걸기가 실제로 꺼졌다').toBe(0);
    // (i)과 한 명 차이(서아: 미니톡 없이는 79.8에서 멈춘다). 이 수가 문턱 아래로 내려오면
    // 말걸기가 분리선이 된 것이고, 그때는 (ii)를 다시 재야 한다.
    expect(r.friends.length, '절친 착지값').toBe(8);
    expect(r.friends.length, '문턱 이상').toBeGreaterThanOrEqual(BOND_MIN_FRIENDS);
    expect(r.ending.title).toContain(BOND_TITLE);
  });
});
