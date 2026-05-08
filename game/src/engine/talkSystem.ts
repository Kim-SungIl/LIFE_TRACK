// ===== Phase 2.1 말걸기 미니 이벤트 시스템 =====
// NPC/부모 모달에서 "말 걸기" 시 발동되는 가벼운 미니 이벤트.
// 누적 확률(pressure) 시스템 — 안 만나면 점점 차오르고, 한 번 발동하면 0으로 리셋.
// 1회만 발동(A안) — 이미 발동한 이벤트는 talkEventsFired에 기록되어 풀에서 제외.

import { GameState, ParentStrength, Stats } from './types';
import { seededRandom } from './rng';

// ===== 미니 이벤트 타입 =====
export interface MiniTalkEvent {
  id: string;                            // 'talk_jihun_30_1' 같이 고유
  npcId?: string;                        // NPC 이벤트
  parentStrength?: ParentStrength;       // 부모 이벤트
  intimacyMin?: number;                  // NPC 친밀도 하한 (이상이어야 풀 진입)
  description: string;                   // 본문 (NPC/부모 대사 + 상황)
  effects: {
    intimacy?: number;                   // NPC 친밀도 변화
    parentIntimacy?: number;             // 부모 친밀도 변화
    stats?: Partial<Stats>;
    fatigue?: number;
    money?: number;
  };
  message: string;                       // 효과 한 줄 요약 (UI 노출)
}

// ===== NPC 미니 이벤트 풀 (Phase 2.1 시드) =====
export const NPC_MINI_EVENTS: MiniTalkEvent[] = [
  {
    id: 'talk_jihun_basket',
    npcId: 'jihun', intimacyMin: 30,
    description: '"야, 농구장 갈래? 너 들어오면 우리 팀 이긴다."\n지훈이가 어깨를 툭 친다.',
    effects: { intimacy: 2, stats: { health: 1 }, fatigue: 1 },
    message: '지훈이와 한판 — 체력 +1, 친밀도 +2',
  },
  {
    id: 'talk_subin_problem',
    npcId: 'subin', intimacyMin: 30,
    description: '"이 문제, 답지 봤는데도 풀이가 이해가 안 돼."\n수빈이가 노트를 슥 내민다.',
    effects: { intimacy: 2, stats: { academic: 1 } },
    message: '수빈이와 함께 풀이 — 학업 +1, 친밀도 +2',
  },
  {
    id: 'talk_minjae_notes',
    npcId: 'minjae', intimacyMin: 30,
    description: '"노트 빌려줄까? 어차피 너 보고 나면 내가 다시 정리할 거니까."\n민재가 무심하게 노트를 건넨다.',
    effects: { intimacy: 2, stats: { academic: 1, mental: 1 } },
    message: '민재의 노트 — 학업 +1, 멘탈 +1, 친밀도 +2',
  },
  {
    id: 'talk_yuna_song',
    npcId: 'yuna', intimacyMin: 30,
    description: '"이 노래 들어봐. 너 좋아할 것 같아."\n유나가 이어폰 한쪽을 내민다.',
    effects: { intimacy: 2, stats: { talent: 1, mental: 1 } },
    message: '유나의 추천곡 — 특기 +1, 멘탈 +1, 친밀도 +2',
  },
  {
    id: 'talk_haeun_quiet',
    npcId: 'haeun', intimacyMin: 30,
    description: '"...괜찮아?"\n하은 선배가 자판기 옆에 서서 콜라를 건넨다.\n별 말 없이 옆에 같이 앉는다.',
    effects: { intimacy: 2, stats: { mental: 2 } },
    message: '하은 선배의 침묵 — 멘탈 +2, 친밀도 +2',
  },
  {
    id: 'talk_junha_riceball',
    npcId: 'junha', intimacyMin: 30,
    description: '"이거 어제 만들어 봤어. 한 번 먹어봐."\n준하가 도시락통을 내민다.\n주먹밥에서 김 냄새가 난다.',
    effects: { intimacy: 2, stats: { mental: 1 }, fatigue: -3 },
    message: '준하의 주먹밥 — 멘탈 +1, 피로 -3, 친밀도 +2',
  },
];

// ===== 부모 미니 이벤트 풀 (Phase 2.1 시드 — 강점별 1개) =====
export const PARENT_MINI_EVENTS: MiniTalkEvent[] = [
  {
    id: 'talk_parent_emotional',
    parentStrength: 'emotional',
    description: '"오늘 좀 피곤해 보이네. 힘들면 힘들다고 해."\n엄마가 핫초코를 내려놓는다.',
    effects: { parentIntimacy: 2, stats: { mental: 1 }, fatigue: -1 },
    message: '엄마의 따뜻한 한 마디 — 멘탈 +1, 피로 -1',
  },
  {
    id: 'talk_parent_wealth',
    parentStrength: 'wealth',
    description: '"필요한 거 있으면 말해. 친구들이랑 놀러도 다니고."\n아빠가 지갑에서 지폐를 꺼낸다.',
    effects: { parentIntimacy: 2, money: 3 },
    message: '용돈 +3만원',
  },
  {
    id: 'talk_parent_info',
    parentStrength: 'info',
    description: '"엄마가 알아봤는데, 그 분야 요즘 전망 좋대."\n메모지에 학원 이름이 빼곡히 적혀 있다.',
    effects: { parentIntimacy: 2, stats: { academic: 1 } },
    message: '진로 정보 — 학업 +1',
  },
  {
    id: 'talk_parent_strict',
    parentStrength: 'strict',
    description: '"이번에는 잘 봐야 한다. 11시까지는 자고."\n아빠가 책상을 한 번 둘러보고 방을 나간다.',
    effects: { parentIntimacy: 1, stats: { academic: 1, mental: -1 } },
    message: '아빠의 기대 — 학업 +1, 멘탈 -1',
  },
  {
    id: 'talk_parent_resilience',
    parentStrength: 'resilience',
    description: '"피곤해 보인다. 그냥 자, 내일 또 있어."\n엄마가 스탠드를 끄고 문을 닫는다.',
    effects: { parentIntimacy: 2, fatigue: -3 },
    message: '엄마의 무심한 격려 — 피로 -3',
  },
  {
    id: 'talk_parent_freedom',
    parentStrength: 'freedom',
    description: '"네가 알아서 해. 엄마는 네 결정 응원할게."\n식탁 너머로 잠깐 눈을 마주친다.',
    effects: { parentIntimacy: 2, stats: { mental: 1 } },
    message: '선택의 자유 — 멘탈 +1',
  },
];

// ===== 정적 인사말 풀 (대신 사용) — 풀 다 본 후 / pressure 미만 / 친밀도 미달 시 =====
// 기존 getNpcDialogue가 NPC 정적 대사를 처리하므로 여기선 별도 풀 불필요.
// 부모는 정적 대사 풀이 없어 새로 만든다.
const PARENT_STATIC_DIALOGUES: Record<ParentStrength, string[]> = {
  emotional: ['"오늘은 어땠어?"', '"밥은 먹었어?"', '"엄마는 항상 너 응원해."'],
  wealth: ['"용돈 모자라면 말해."', '"너무 무리하지 말고."', '"학원 잘 다녀와."'],
  info: ['"오늘 뉴스 봤어?"', '"이거 한번 읽어봐."', '"요즘 그 진로 어떻대?"'],
  strict: ['"숙제는 했어?"', '"성적표 봤어. 다음엔 더 잘하자."', '"일찍 자라."'],
  resilience: ['"잘 지내."', '"넌 잘 해낼 거야."', '"평소대로 하면 돼."'],
  freedom: ['"알아서 해."', '"잘 다녀와."', '"네 결정이야."'],
};

export function getParentStaticDialogue(state: GameState, strength: ParentStrength): string {
  const pool = PARENT_STATIC_DIALOGUES[strength];
  const idx = Math.floor(seededRandom(state) * pool.length);
  return pool[idx];
}

// ===== 짧은 잡담 폴백 (말 걸었으나 이번 주 이벤트가 사전 결정에서 미발동 시) =====
// 사전 결정 모델 — 미스가 아니라 "이번 주는 별 일 없는 평범한 만남". 클릭마다 캐릭터 톤의 다른 한 줄.
const NPC_SMALLTALK: Record<string, string[]> = {
  // 모든 라인은 학년 무관 (Y1 초등 ~ Y7 고3) 톤으로 유지 — "야자" 같은 학교급 종속 표현 금지
  jihun:  ['하이파이브만 하고 헤어졌다.', '"내일 또 보자!" 그게 다였다.', '"같이 하교하자!" 그러더니 먼저 가버렸다.'],
  subin:  ['별 다른 얘기 없이 같이 책장만 정리했다.', '같이 잠깐 말없이 앉아 있었다.', '"수학 너무 어렵다." 그게 다였다.'],
  minjae: ['"별 일 없지?" 한 마디만 듣고 헤어졌다.', '잠깐 눈만 마주치고 지나갔다.', '"공부해." 한 마디만 들었다.'],
  yuna:   ['오늘은 그냥 잡담만 하고 끝났다.', '"바빠?"라고 묻길래 그냥 웃었다.', '"이번 주 너무 졸려." 라고 했다.'],
  haeun:  ['"어..." 한 마디만 하고 자판기 콜라만 마셨다.', '말없이 같이 계단을 내려갔다.', '잠깐 머리를 헝클어주고 갔다.'],
  junha:  ['말없이 같이 점심을 먹었다.', '잠깐 인사만 하고 지나갔다.', '"오늘 김치찌개야." 그러고는 식판을 들고 갔다.'],
};

const PARENT_SMALLTALK: Record<ParentStrength, string[]> = {
  emotional:  ['엄마는 뉴스만 보다가 "잘 자라"고 했다.', '"밥 먹었어?" 한 마디뿐이었다.', '엄마가 어깨를 한 번 토닥였다.'],
  wealth:     ['"용돈 부족하면 말해." 그게 다였다.', '아빠는 신문만 보고 있었다.', '식탁 위에 봉투가 놓여 있었다.'],
  info:       ['엄마는 말없이 학원 전단지만 정리했다.', '"오늘 뉴스 봤어?" 그게 다였다.', '"이 책 한번 읽어봐." 라며 책을 내밀었다.'],
  strict:     ['"숙제 했냐"는 한 마디만 들었다.', '"일찍 자라"는 말만 듣고 방에 들어갔다.', '책상 정리 안 했다고 잔소리만 들었다.'],
  resilience: ['엄마는 "어"라고만 했다.', '"평소대로 해" 한 마디뿐이었다.', '"피곤해 보인다. 자." 그게 다였다.'],
  freedom:    ['"알아서 해" 그게 다였다.', '눈만 한 번 마주치고 지나갔다.', '"네 결정이야" 라며 미소만 지었다.'],
};

function pickRandomLine(state: GameState, pool: string[]): string {
  if (pool.length === 0) return '오늘은 별 다른 일 없이 지나갔다.';
  const idx = Math.floor(seededRandom(state) * pool.length);
  return pool[idx];
}

export function getNpcSmalltalk(state: GameState, npcId: string): string {
  return pickRandomLine(state, NPC_SMALLTALK[npcId] ?? []);
}

export function getHomeSmalltalk(state: GameState): string {
  // 가정은 단일 엔티티 — 두 부모 강점 풀에서 RNG로 한 줄 픽
  const pools = state.parents
    .map(p => PARENT_SMALLTALK[p] ?? [])
    .flat();
  return pickRandomLine(state, pools);
}

// ===== 풀 필터 — store에서 사전 결정 결과로 미니 이벤트 픽업 =====
export function getAvailableNpcEvents(state: GameState, npcId: string): MiniTalkEvent[] {
  const npc = state.npcs.find(n => n.id === npcId);
  if (!npc) return [];
  return NPC_MINI_EVENTS.filter(e =>
    e.npcId === npcId
    && (!e.intimacyMin || npc.intimacy >= e.intimacyMin)
    && !state.talkEventsFired.includes(e.id),
  );
}

export function getAvailableHomeEvents(state: GameState): MiniTalkEvent[] {
  // 가정은 두 부모 강점 풀 합집합에서 픽업
  return PARENT_MINI_EVENTS.filter(e =>
    e.parentStrength
    && state.parents.includes(e.parentStrength)
    && !state.talkEventsFired.includes(e.id),
  );
}

// ===== 부모 친밀도 회고 톤 (학년말 일기장 변주) =====
export function getParentIntimacyTone(parentIntimacy: number): 'distant' | 'normal' | 'warm' {
  if (parentIntimacy < 30) return 'distant';
  if (parentIntimacy >= 70) return 'warm';
  return 'normal';
}
