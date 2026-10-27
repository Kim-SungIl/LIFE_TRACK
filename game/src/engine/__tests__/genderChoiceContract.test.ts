// 화면이 그리는 선택지 = resolveEvent가 적용하는 선택지 — 성별 판본에서. (2026-10 리팩토링 점검)
//
// 결함의 모양(실코드 확인):
//   presentEvent(withGenderFallback)는 femaleDescription이 있을 때만 femaleChoices를 화면 목록으로 골랐다.
//   resolveEvent·GameScreen은 femaleChoices가 있으면 무조건 그쪽을 적용한다. femaleDescription 없이
//   femaleChoices만 있는 사건 10건에서 여성은 남성 버튼을 보고 여성 결과를 받았다 —
//   jihun-birthday c1은 "농구화 끈" 버튼에 그립테이프 문장, jihun-envy c2는 "농구" 버튼에 배드민턴 기억,
//   jihun-same-sunset c2는 "툭 친다" 버튼에 "툭 기댄다" 문장. 효과 수치는 두 판본이 같아 숫자로는 안 보였다.
//
// 잠그는 계약(여주 기준 — 남주는 원래 choices를 그리고 choices를 적용한다):
//   A. 전 카탈로그 × 대표 학년(1·3·6) × 대표 주(학기·방학 하나씩): 구운 사건에 femaleChoices가 남아 있으면(=resolveEvent가 그쪽을
//      집으면) 화면 목록(choices)과 칸마다 같다. 공식을 베끼지 않고 "어느 쪽을 집어도 같다"를 본다.
//   A'. femaleChoices만 있는 사건 **각각**: 여주 화면이 카탈로그 femaleChoices의 문장을 그린다.
//      A만 두면 femaleChoices를 통째로 지워 화면·적용이 같이 남성 판본이 돼도 초록이다(3자 검수 M11).
//   B. 배선: femaleChoices만 있는 사건을 실제 store.resolveEvent로 닫으면, 기록되는 문장·기억이
//      **EventScene이 그린 선택지**의 것이다. 기억이 생겨야 하는 선택지는 슬롯이 실제로 생긴다.
//   C. 만난 NPC 처리(store applyChoiceOutcome)는 구운 사본의 choices+femaleChoices를 합쳐 센다. 여주는
//      이제 choices도 여성 사본이라 남성 판본에만 있는 NPC는 안 센다 — 여성 판본이 남성 판본의 NPC를 다 품어야 한다.
//
// 검사 수는 하한이 아니라 착지값으로 박는다. 사건을 더해 숫자가 바뀌면 그때 의도적으로 고칠 것.
import { beforeEach, describe, expect, it } from 'vitest';
import { GAME_EVENTS } from '../events';
import { SCHOOL_LIFE_EVENTS } from '../events/school-life';
import { assignCurrentEvent, isChoiceVisible, presentEvent } from '../eventPresentation';
import { createInitialState } from '../gameEngine';
import { ANNUAL_EVENT_IDS } from '../memorySystem';
import { useGameStore } from '../store';
import { clearArchive } from '../archive';
import { getWeekInfo } from '../weekMath';
import type { EventChoice, GameEvent, GameState } from '../types';

const POOL = [...GAME_EVENTS, ...SCHOOL_LIFE_EVENTS] as readonly GameEvent[];
const YEARS = [1, 3, 6];
const SEMESTER_WEEK = 10;
const VACATION_WEEK = Array.from({ length: 48 }, (_, i) => i + 1).find(w => getWeekInfo(w).isVacation)!;

const FEMALE_ONLY = POOL.filter(e => e.femaleChoices && !e.femaleDescription);

// 직렬화되는 칸(문장·효과)은 JSON으로, 함수 칸(condition)은 참조로 본다 — JSON은 함수를 버린다.
function sameChoice(a: EventChoice, b: EventChoice): boolean {
  return JSON.stringify(a) === JSON.stringify(b) && a.condition === b.condition;
}

function npcIds(choices: readonly EventChoice[] | undefined): Set<string> {
  return new Set((choices ?? []).flatMap(c => (c.npcEffects ?? []).map(n => n.npcId)));
}

describe('성별 선택지 — 화면 목록과 적용 목록이 같다', () => {
  it('A. 구운 사건에 femaleChoices가 남으면 choices와 칸마다 같다 (전 카탈로그)', () => {
    let femaleChecked = 0;
    const mismatches: string[] = [];
    for (const event of POOL) {
      for (const year of YEARS) {
        for (const week of [SEMESTER_WEEK, VACATION_WEEK]) {
          const shown = presentEvent(event, { year, week, gender: 'female' });
          if (!shown.femaleChoices) continue;
          femaleChecked++;
          if (shown.femaleChoices.length !== shown.choices.length) {
            mismatches.push(`${event.id} Y${year}W${week}: 길이 ${shown.choices.length}≠${shown.femaleChoices.length}`);
            continue;
          }
          shown.choices.forEach((c, i) => {
            if (!sameChoice(c, shown.femaleChoices![i])) mismatches.push(`${event.id} Y${year}W${week} c${i}: 「${c.text}」 vs 「${shown.femaleChoices![i].text}」`);
          });
        }
      }
    }
    expect(mismatches).toEqual([]);
    // femaleChoices를 가진 25건 × 학년 3 × 계절 2. 사건이 통째로 빠지면 이 숫자가 먼저 깨진다.
    expect(femaleChecked).toBe(150);
  });

  it("A'. femaleChoices만 있는 사건은 각각 여주에게 카탈로그 femaleChoices 문장을 그린다", () => {
    expect(FEMALE_ONLY.map(e => e.id).sort()).toEqual([
      'jihun-birthday', 'jihun-envy', 'jihun-hs-lastgame', 'jihun-hs-track', 'jihun-same-sunset',
      'subin-night-light', 'yuna-birthday', 'yuna-perfect-smile', 'yuna-study', 'yuna-window-promise',
    ]);
    const mismatches: string[] = [];
    for (const event of FEMALE_ONLY) {
      for (const year of YEARS) {
        // 학기 주 — 방학 판본(vacationText)이 문장을 덮지 않는 자리에서 카탈로그와 그대로 대조한다.
        const shown = presentEvent(event, { year, week: SEMESTER_WEEK, gender: 'female' });
        event.femaleChoices!.forEach((f, i) => {
          const c = shown.choices[i];
          if (!c || c.text !== f.text || c.message !== f.message
            || c.memorySlotDraft?.recallText !== f.memorySlotDraft?.recallText) {
            mismatches.push(`${event.id} Y${year} c${i}: 화면 「${c?.text}」 ≠ 여성 판본 「${f.text}」`);
          }
        });
      }
    }
    expect(mismatches).toEqual([]);
    // 남주는 여전히 남성 판본 — 대조가 한쪽으로 쏠리지 않았다.
    const birthday = POOL.find(e => e.id === 'jihun-birthday')!;
    expect(presentEvent(birthday, { year: 3, week: SEMESTER_WEEK, gender: 'male' }).choices[1].text).toContain('농구화');
  });

  it('C. 여성 판본은 남성 판본의 NPC를 모두 품는다 (만난 NPC 처리의 전제)', () => {
    const missing: string[] = [];
    let checked = 0;
    for (const event of POOL) {
      if (!event.femaleChoices) continue;
      checked++;
      const female = npcIds(event.femaleChoices);
      for (const id of npcIds(event.choices)) if (!female.has(id)) missing.push(`${event.id}: ${id}`);
    }
    expect(missing).toEqual([]);
    expect(checked).toBe(25);
  });
});

describe('성별 선택지 — store.resolveEvent 배선', () => {
  beforeEach(() => {
    clearArchive();
    useGameStore.setState({ state: null, runDelta: null, npcActivityMap: {} });
  });

  function stateAt(week: number): GameState {
    const s = createInitialState('female', ['wealth', 'freedom'], { rngSeed: 1 });
    s.year = 3;
    s.week = week;
    const info = getWeekInfo(week);
    s.semester = info.semester;
    s.isVacation = info.isVacation;
    s.money = 100;
    for (const n of s.npcs) n.met = true;
    s.weekLog = { statChanges: {}, fatigueChange: 0, moneyChange: 0, messages: [], skipped: [], milestoneMessages: [], year: s.year, week };
    return s;
  }

  it('B. 기록된 문장·기억이 EventScene이 그린 선택지의 것이다', () => {
    let resolved = 0;
    let recallChecked = 0;
    const mismatches: string[] = [];
    for (const event of FEMALE_ONLY) {
      for (const week of [SEMESTER_WEEK, VACATION_WEEK]) {
        for (let i = 0; i < event.choices.length; i++) {
          const s = stateAt(week);
          assignCurrentEvent(s, event, week);
          // EventScene은 currentEvent를 한 번 더 presentEvent에 넣어 그린다(멱등).
          const drawn = presentEvent(s.currentEvent!, { year: s.year, week, gender: s.gender }).choices[i];
          if (!drawn || !isChoiceVisible(drawn, s)) continue;
          useGameStore.setState({ state: s });
          useGameStore.getState().resolveEvent(i);
          const after = useGameStore.getState().state!;
          resolved++;
          if (!after.weekLog?.messages.includes(`📖 ${drawn.message}`)) {
            mismatches.push(`${event.id} W${week} c${i}: 문장 「${drawn.message.slice(0, 20)}」 미기록`);
          }
          // 기억 생성 조건(applyMemorySlotFromChoice) — 중요도 3 이상, 매년 사건 제외. 빈 상태에서 닫으니 중복 생략은 없다.
          const draft = drawn.memorySlotDraft;
          const expectSlot = !!draft && draft.importance >= 3 && !ANNUAL_EVENT_IDS.has(event.id);
          const slot = after.memorySlots.find(m => m.sourceEventId === event.id);
          if (expectSlot && !slot) {
            mismatches.push(`${event.id} W${week} c${i}: 기억 슬롯이 안 생겼다`);
          } else if (slot) {
            recallChecked++;
            if (slot.recallText !== draft?.recallText) {
              mismatches.push(`${event.id} W${week} c${i}: 기억 「${slot.recallText}」 ≠ 「${draft?.recallText}」`);
            }
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    // 10건의 선택지 28개 × 계절 2. 숨김 조건이 있는 선택지는 지금 0개라 전부 닫힌다.
    expect(resolved).toBe(56);
    expect(recallChecked).toBe(20);
  });
});
