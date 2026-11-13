// 연애 순간 다시 보기 — 학년말 회고·기록장이 읽는 **표시 전용** 기억.
//
// 왜 필요한가: 연애 선택지의 기억(growth 6~7)은 카테고리당 2칸 규칙(memorySystem
// applyMemorySlotFromChoice)에서 거의 살아남지 못한다. 고2가 되면 growth 두 칸은 대개 앞 학년의
// 중요도 7 기억(지훈 relay-baton·different-path 등)이 차지하고 있어, 같은 7인 고백은 들어가지도
// 못하고 6인 만남은 한 번도 들어간 적이 없다(3자 검수 실측). 그림은 앨범에 남는데 회고에는 없는
// 불일치가 생긴다.
//
// 왜 기억 엔진을 고치지 않는가: memorySlots는 엔딩의 근황·후회·회고 층과 학년 요약이 함께
// 읽는다. 연애 기억을 슬롯에 밀어 넣거나 카테고리를 떼면 그 층들의 균형(후회 0장 문제를 풀었던
// 레이어 순서 포함)이 움직인다. 여기서는 **이미 남아 있는 이벤트 기록**(resolvedChoice·year·week와
// 고른 선택지의 추억 문장)에서 파생해 화면에만 덧붙인다 — state도 세이브도 바꾸지 않는다.
//
// 실제로 겪은 것만: 고백·재고백은 관계가 **그 주에 시작된** 기록만(선택지 번호로 추정하지 않는다),
// 졸업 약속은 관계에 graduation:'together'가 남은 판만 센다. 만남은 기록 자체가 겪은 증거라 관계를
// 묻지 않는다(관계 값이 손상돼도 열린 만남은 남는다 — 만남은 사귀는 동안에만 열리므로 추정이 아니다).
//
// 보이는 범위: 학년말 회고는 Y1~Y6만 있고(고3은 회고 없이 곧장 엔딩), 기록장은 지난 학년까지만 연다.
// 그래서 **고3에 생긴 순간(졸업 약속·고3 만남·고3 재고백)은 지금 어느 화면에도 닿지 않는다** — 고3의
// 연애는 엔딩의 romanceClosure 문장이 맡는다. 파생은 학년과 무관하게 하되, 엔딩에 노출할지는 별건.
import { yearToPhaseTag } from './memorySystem';
import { ALL_ROMANCE_OUTING_IDS, sanitizeRelationship } from './romance';
import type { EventChoice, GameEvent, GameState, MemorySlot } from './types';

const OUTING_IDS = ALL_ROMANCE_OUTING_IDS;

/** 기록 레코드에서 실제로 고른 선택지 — 여주 경로로 해결됐으면 femaleChoices를 본다. */
function chosenChoice(e: GameEvent): EventChoice | undefined {
  if (e.resolvedChoice === undefined) return undefined;
  const list = e.resolvedFemale && e.femaleChoices ? e.femaleChoices : e.choices;
  return list?.[e.resolvedChoice];
}

type MomentSource = Pick<GameState, 'events' | 'relationship' | 'gender'> & Partial<Pick<GameState, 'memorySlots'>>;

/** 이번 판에서 겪은 연애 순간 중 기억 슬롯에 없는 것 — 발생 순서. */
export function romanceMomentSlots(state: MomentSource): MemorySlot[] {
  const r = sanitizeRelationship(state.relationship, state.gender);
  const kept = new Set((state.memorySlots ?? []).map(m => m.sourceEventId));
  const out: MemorySlot[] = [];
  for (const e of state.events ?? []) {
    if (e.year === undefined || e.week === undefined || kept.has(e.id)) continue;
    const choice = chosenChoice(e);
    const draft = choice?.memorySlotDraft;
    if (!choice || !draft) continue;
    const sel = choice.relationshipSelect;
    const lived = OUTING_IDS.has(e.id)
      || (!!r && sel?.decision === 'date' && sel.npcId === r.npcId && r.year === e.year && r.week === e.week)
      || (!!r && sel?.decision === 'together' && sel.npcId === r.npcId && r.graduation === 'together');
    if (!lived) continue;
    out.push({
      id: `romance_${e.id}_${e.year}_${e.week}`,
      category: draft.category,
      week: e.week,
      year: e.year,
      sourceEventId: e.id,
      choiceIndex: e.resolvedChoice!,
      recallText: draft.recallText,
      npcIds: draft.npcIds,
      importance: draft.importance,
      phaseTag: yearToPhaseTag(e.year),
      toneTag: draft.toneTag,
    });
  }
  return out;
}

/** 회고 화면에 넘길 기억 — 저장된 슬롯 + 슬롯에서 밀린 연애 순간. 엔딩 층은 이걸 읽지 않는다. */
export function recallSlots(state: MomentSource): MemorySlot[] {
  return [...(state.memorySlots ?? []), ...romanceMomentSlots(state)];
}
