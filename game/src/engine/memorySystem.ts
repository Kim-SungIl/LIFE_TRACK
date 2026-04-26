// v1.2 기억 슬롯 시스템
// - applyMemorySlotFromChoice: 이벤트 선택에서 슬롯 생성 (resolveEvent 훅)
// - selectMemorialHighlights: 엔딩 회상 3~5개 선정 (importance + 분산 + 폴백)
// - milestone 자동 기록 로직

import type {
  GameState, MemorySlot, MemorySlotDraft, MemoryCategory,
  PhaseTag, ToneTag, MilestoneScene, MilestoneTheme,
  GameEvent, EventChoice,
} from './types';

// ===== ANNUAL 이벤트 (슬롯 생성 금지 대상, 부록 B.4) =====
// 단일 소스 — events.ts의 getEventForWeek도 이 Set을 import해서 사용
export const ANNUAL_EVENT_IDS = new Set<string>([
  'elementary-graduation', 'middle-school-entrance', 'middle-school-graduation',
  'high-school-entrance', 'suneung-eve', 'suneung-done', 'high-school-graduation',
  'year-end-reflection',
  'jihun-birthday', 'minjae-birthday', 'subin-birthday',
  'yuna-birthday', 'haeun-birthday', 'junha-birthday',
  // 반장 선거 — 매년 1학기/2학기 발동. 후속 결과/부반장도 매년 재발동
  'class-president', 'class-president-2',
  'class-president-win', 'class-president-lose', 'class-president-vice',
  'class-president-2-win', 'class-president-2-lose',
  'class-president-nudge',
]);

// ===== importance 임계값 (부록 C) =====
const MIN_IMPORTANCE_TO_SLOT = 3;

// ===== phaseTag 자동 산출 =====
export function yearToPhaseTag(year: number): PhaseTag {
  if (year <= 2) return 'early';
  if (year <= 4) return 'mid';
  return 'late';
}

// ===== recallText 린트 (부록 B.7) =====
const FORBIDDEN_RECALL_PATTERNS = [
  /\b(academic|social|talent|mental|health)\b/i,
  /[+\-]\d+/,           // +3, -5 등
  /\d+\s*점/,
  /등급|스탯/,
];

export function lintRecallText(text: string): string[] {
  return FORBIDDEN_RECALL_PATTERNS
    .filter(p => p.test(text))
    .map(p => `금지 패턴: ${p}`);
}

// ===== 슬롯 생성 (resolveEvent에서 호출) =====
export function applyMemorySlotFromChoice(
  state: GameState,
  event: GameEvent,
  choiceIndex: number,
  choice: EventChoice,
): void {
  const draft = choice.memorySlotDraft;
  if (!draft) return;
  if (draft.importance < MIN_IMPORTANCE_TO_SLOT) return;
  if (ANNUAL_EVENT_IDS.has(event.id)) return;  // 부록 B.4

  // 같은 sourceEventId로 이미 슬롯 있으면 스킵 (부록 B.2)
  if (state.memorySlots.some(s => s.sourceEventId === event.id)) return;

  // 개발 모드 린트 (치명적 오류 아님)
  const lintErrors = lintRecallText(draft.recallText);
  if (lintErrors.length > 0 && typeof console !== 'undefined') {
    console.warn(`[memorySlot lint] ${event.id} c${choiceIndex}:`, lintErrors);
  }

  const newSlot: MemorySlot = {
    id: `${draft.category}_${state.year}_${state.week}_${choiceIndex}`,
    category: draft.category,
    week: state.week,
    year: state.year,
    sourceEventId: event.id,
    choiceIndex,
    recallText: draft.recallText,
    npcIds: draft.npcIds,
    importance: draft.importance,
    phaseTag: yearToPhaseTag(state.year),
    toneTag: draft.toneTag,
  };

  // 상한 체크: 카테고리당 2개
  const sameCategory = state.memorySlots.filter(s => s.category === draft.category);
  if (sameCategory.length < 2) {
    state.memorySlots.push(newSlot);
    return;
  }

  // 꽉 찼으면 가장 importance 낮은 것 교체 (동률 시 학년 더 이른 것 밀어냄)
  const weakest = [...sameCategory].sort((a, b) => {
    if (a.importance !== b.importance) return a.importance - b.importance;
    return a.year - b.year;
  })[0];
  if (newSlot.importance > weakest.importance) {
    state.memorySlots = state.memorySlots.filter(s => s.id !== weakest.id);
    state.memorySlots.push(newSlot);
  }
}

// ===== 폴백 기본 시드 풀 (부록 D.2) =====
const FALLBACK_SEEDS: Record<number, string> = {
  1: '초등학교의 마지막 날, 운동장은 여전히 시끄러웠다.',
  2: '처음으로 입은 교복이 조금 컸던 중1의 봄.',
  3: '중2는 그저 지나갔다. 돌아보면 길었던 해.',
  4: '고입 원서를 쓰던 손끝이 차가웠다.',
  5: '새 교복, 새 반, 새 시간표. 낯설고 묘하게 설렜다.',
  6: '고2의 여름. 입시가 갑자기 가까워졌다.',
  7: '수능 전날 밤, 창밖은 이상하리만치 조용했다.',
};

// ===== 회상 선정 (§7.2) =====
export interface MemorialHighlight {
  recallText: string;
  year: number;
  isFallback?: boolean;
}

export function selectMemorialHighlights(state: GameState): MemorialHighlight[] {
  const slots = state.memorySlots || [];
  const result: MemorySlot[] = [];

  // 1. 카테고리 다양성 — growth/discovery/failure 우선 확보
  const priorityCategories: MemoryCategory[] = ['growth', 'discovery', 'failure'];
  for (const cat of priorityCategories) {
    const candidates = slots
      .filter(s => s.category === cat && !result.includes(s))
      .sort((a, b) => b.importance - a.importance);
    if (candidates.length > 0) result.push(candidates[0]);
  }

  // 2. importance 내림차순으로 나머지 추가 (5개까지)
  const remaining = slots
    .filter(s => !result.includes(s))
    .sort((a, b) => b.importance - a.importance);

  for (const slot of remaining) {
    if (result.length >= 5) break;
    // 학년 분산: 같은 phaseTag 3개 이상 되면 스킵
    const samePhase = result.filter(s => s.phaseTag === slot.phaseTag).length;
    if (samePhase >= 3 && result.length >= 3) continue;
    result.push(slot);
  }

  // 3. 3개 미만 시 폴백 — milestoneScene 승격
  const highlights: MemorialHighlight[] = result.map(s => ({
    recallText: s.recallText, year: s.year,
  }));

  if (highlights.length < 3) {
    const milestones = (state.milestoneScenes || [])
      .filter(m => m.summaryText)
      .sort((a, b) => a.year - b.year);
    for (const m of milestones) {
      if (highlights.length >= 3) break;
      if (m.summaryText) highlights.push({ recallText: m.summaryText, year: m.year });
    }
  }

  // 4. 여전히 부족하면 기본 시드 풀
  if (highlights.length < 3) {
    for (let y = 1; y <= 7 && highlights.length < 3; y++) {
      if (y > state.year) break;  // 아직 도달 안 한 학년은 건너뜀
      highlights.push({ recallText: FALLBACK_SEEDS[y], year: y, isFallback: true });
    }
  }

  // 5. 3~5개 보장
  return highlights.slice(0, 5);
}

// ===== Y3 milestoneScene summaryText 풀 (부록 D.1) =====
interface MilestonePattern {
  theme: MilestoneTheme;
  requires: (memoryIds: string[], slots: MemorySlot[]) => boolean;
  summaryText: string;
}

// 공용 헬퍼 (패턴 작성 편의)
const hasCat = (slots: MemorySlot[], c: MemoryCategory) => slots.some(s => s.category === c);
const hasNpc = (slots: MemorySlot[], npcId: string) => slots.some(s => s.npcIds?.includes(npcId));
const countCat = (slots: MemorySlot[], c: MemoryCategory) => slots.filter(s => s.category === c).length;
const countNegative = (slots: MemorySlot[]) => slots.filter(s => s.category === 'betrayal' || s.category === 'failure').length;
const countPositive = (slots: MemorySlot[]) => slots.filter(s => ['reconciliation', 'courage', 'discovery', 'growth'].includes(s.category)).length;

const Y1_PATTERNS: MilestonePattern[] = [
  {
    theme: 'connection',
    requires: (_ids, slots) => hasCat(slots, 'discovery') && (hasNpc(slots, 'jihun') || hasNpc(slots, 'minjae') || hasNpc(slots, 'yuna') || hasNpc(slots, 'subin')),
    summaryText: '초6의 봄, 처음으로 누군가의 이름을 교실에서 부르던 순간.',
  },
  {
    theme: 'loss',
    requires: (_ids, slots) => countNegative(slots) >= 1 && countPositive(slots) === 0,
    summaryText: '초등학교 마지막 해, 혼자 있는 시간이 많았다.',
  },
  {
    theme: 'growth',
    requires: (_ids, slots) => hasCat(slots, 'courage'),
    summaryText: '초6, 처음으로 작게 손을 들어본 해.',
  },
];

const Y2_PATTERNS: MilestonePattern[] = [
  {
    theme: 'connection',
    requires: (_ids, slots) => hasCat(slots, 'discovery') && slots.length >= 2,
    summaryText: '중1의 봄, 교복을 처음 입고 찾은 낯선 친구들.',
  },
  {
    theme: 'pressure',
    requires: (_ids, slots) => hasCat(slots, 'failure'),
    summaryText: '처음 본 중학교 시험지. 점수보다 긴장이 먼저 기억난다.',
  },
];

const Y3_PATTERNS: MilestonePattern[] = [
  {
    theme: 'growth',
    requires: (_ids, slots) => {
      const hasReconciliation = slots.some(s => s.category === 'reconciliation' && s.npcIds?.includes('minjae'));
      const hasGrowth = slots.some(s => s.category === 'growth');
      return hasReconciliation && hasGrowth;
    },
    summaryText: '경쟁과 번아웃 사이, 나를 붙잡아준 건 사람이었다.',
  },
  {
    theme: 'loss',
    requires: (_ids, slots) =>
      slots.some(s => s.category === 'failure') && !slots.some(s => s.category === 'growth'),
    summaryText: '중2는 조용히 지나갔다. 기억나는 건 피로뿐.',
  },
  {
    theme: 'connection',
    requires: (_ids, slots) => slots.some(s => s.npcIds?.includes('minjae')),
    summaryText: '민재와는 다시 얘기했지만, 내 안의 무언가는 돌아오지 않았다.',
  },
  {
    theme: 'identity',
    requires: (_ids, slots) => slots.filter(s => s.category === 'betrayal' || s.category === 'failure').length >= 2,
    summaryText: '그해 겨울, 나는 혼자 견디는 법을 먼저 배웠다.',
  },
];

const Y4_PATTERNS: MilestonePattern[] = [
  {
    theme: 'pressure',
    requires: (_ids, slots) => countCat(slots, 'failure') >= 1,
    summaryText: '고입 원서를 쓰는 손이 생각보다 오래 멈춰 있었다.',
  },
  {
    theme: 'identity',
    requires: (_ids, slots) => hasCat(slots, 'discovery') || hasCat(slots, 'growth'),
    summaryText: '중3 가을, 내가 뭘 원하는지 처음 스스로에게 물었다.',
  },
  {
    theme: 'connection',
    requires: (_ids, slots) => countPositive(slots) >= 2,
    summaryText: '중학교 마지막 해, 함께 걸은 시간이 길었다.',
  },
];

const Y5_PATTERNS: MilestonePattern[] = [
  {
    theme: 'identity',
    requires: (_ids, slots) => slots.some(s => s.sourceEventId === 'club-academy-choice-y5'),
    summaryText: '고1 봄, 내 선택이 하루의 색깔을 바꾸기 시작했다.',
  },
  {
    theme: 'connection',
    requires: (_ids, slots) => countPositive(slots) >= 1 && hasCat(slots, 'discovery'),
    summaryText: '낯선 교복이 익숙해질 무렵, 옆자리에 다른 이름이 있었다.',
  },
  {
    theme: 'loss',
    requires: (_ids, slots) => countNegative(slots) >= 1,
    summaryText: '고1 여름, 맞지 않는 것 몇 가지를 조용히 내려놓았다.',
  },
];

const Y6_PATTERNS: MilestonePattern[] = [
  {
    theme: 'pressure',
    requires: (_ids, slots) => hasCat(slots, 'failure') || hasCat(slots, 'betrayal'),
    summaryText: '고2의 여름, 입시가 손에 잡힐 거리로 다가왔다.',
  },
  {
    theme: 'growth',
    requires: (_ids, slots) => hasCat(slots, 'courage') || hasCat(slots, 'growth'),
    summaryText: '고2, 두려워하면서도 앞을 보던 해.',
  },
  {
    theme: 'connection',
    requires: (_ids, slots) => countPositive(slots) >= 2,
    summaryText: '고2의 점심시간마다 들리던 목소리들, 이제야 귀하게 들린다.',
  },
];

const Y7_PATTERNS: MilestonePattern[] = [
  {
    theme: 'growth',
    requires: (_ids, slots) => slots.some(s => s.sourceEventId === 'graduation-prep-high'),
    summaryText: '고3 겨울, 12년을 입고 있던 교복을 마지막으로 걸었다.',
  },
  {
    theme: 'loss',
    requires: (_ids, slots) => countNegative(slots) >= countPositive(slots),
    summaryText: '수능 전날 밤, 책상 위에 쌓인 것보다 놓친 것이 더 많아 보였다.',
  },
  {
    theme: 'identity',
    requires: (_ids, slots) => countPositive(slots) >= 1,
    summaryText: '수능 전야, 나는 더 이상 누군가의 기대 안에만 서 있지 않았다.',
  },
];

const PATTERNS_BY_YEAR: Record<number, MilestonePattern[]> = {
  1: Y1_PATTERNS, 2: Y2_PATTERNS, 3: Y3_PATTERNS, 4: Y4_PATTERNS,
  5: Y5_PATTERNS, 6: Y6_PATTERNS, 7: Y7_PATTERNS,
};

const MILESTONE_FALLBACK: Record<number, { theme: MilestoneTheme; text: string }> = {
  1: { theme: 'connection', text: '초등학교의 마지막 날, 운동장은 여전히 시끄러웠다.' },
  2: { theme: 'connection', text: '처음으로 입은 교복이 조금 컸던 중1의 봄.' },
  3: { theme: 'loss', text: '중2는 그저 지나갔다. 돌아보면 길었던 해.' },
  4: { theme: 'pressure', text: '고입 원서를 쓰던 손끝이 차가웠다.' },
  5: { theme: 'identity', text: '새 교복, 새 반, 새 시간표. 낯설고 묘하게 설렜다.' },
  6: { theme: 'pressure', text: '고2의 여름. 입시가 갑자기 가까워졌다.' },
  7: { theme: 'pressure', text: '수능 전날 밤, 창밖은 이상하리만치 조용했다.' },
};

// 학년 종료 시점에서 해당 학년의 milestone 자동 기록
export function recordMilestoneForYear(state: GameState, year: number): void {
  // 이미 있으면 스킵
  if (state.milestoneScenes.some(m => m.year === year)) return;

  const yearSlots = state.memorySlots.filter(s => s.year === year);
  const sourceMemoryIds = yearSlots.map(s => s.id);

  // 학년별 패턴 매칭 (Y1~Y7 모두)
  let summaryText: string | undefined;
  let theme: MilestoneTheme | undefined;

  const patterns = PATTERNS_BY_YEAR[year];
  if (patterns) {
    const matched = patterns.find(p => p.requires(sourceMemoryIds, yearSlots));
    if (matched) {
      summaryText = matched.summaryText;
      theme = matched.theme;
    }
  }

  // 패턴 매칭 실패 → 폴백
  if (!summaryText) {
    const fb = MILESTONE_FALLBACK[year];
    if (fb) {
      summaryText = fb.text;
      theme = fb.theme;
    }
  }

  state.milestoneScenes.push({
    year,
    sceneId: `milestone-y${year}`,
    dominantTheme: theme,
    sourceMemoryIds,
    summaryText,
    recordedAt: state.week,
  });
}

// ===== ripple 유틸 =====
export function activateRipple(state: GameState, rippleId: string): void {
  const ripple = state.socialRipples.find(r => r.id === rippleId);
  if (ripple && !ripple.activatedAt) {
    ripple.activatedAt = state.week;
  }
}

export function ensureRipple(state: GameState, ripple: Omit<import('./types').SocialRipple, 'activatedAt'>): void {
  if (!state.socialRipples.some(r => r.id === ripple.id)) {
    state.socialRipples.push({ ...ripple, activatedAt: state.week });
  } else {
    activateRipple(state, ripple.id);
  }
}
