// ===== NPC 명단 SSOT =====
// createInitialState 안에 인라인으로 있던 배열을 분리했다. 런간 기록실(archive)은 게임 상태 없이도
// "누구를 못 만났는지"를 말해야 하므로, 상태를 만들지 않고 명단을 읽을 수 있는 출처가 필요하다.
// gameEngine 전체를 끌어오지 않도록 별도 모듈로 둔다(rng.ts·intimacyScaling.ts와 같은 리프 모듈 규칙).
import type { NpcState } from './types';

// 템플릿 — createInitialState가 매번 얕은 복사해서 쓴다(모듈 상수를 공유하면 런끼리 오염된다).
export const INITIAL_NPCS: readonly Readonly<NpcState>[] = [
  // met: true 초기값에 부팅 first-week 장면·튜토리얼 '친구' 스텝(npc 카드 렌더)이 의존한다.
  { id: 'jihun', name: '지훈', intimacy: 40, description: '초등학교 때부터 알던 소꿉친구', emoji: '😄', met: true,
    greeting: '야! 오늘도 같이 놀자!', personality: '활발하고 운동을 좋아하는 소꿉친구. 항상 먼저 말을 걸어준다.' },
  { id: 'subin', name: '수빈', intimacy: 25, description: '같은 동네에 사는 같은 학원 친구', emoji: '😊', met: false,
    greeting: '어, 안녕! 너도 김쌤 반이야? 숙제 진짜 많지 않아?', personality: '어디서든 금방 친해지는 외향형. 친구가 많아 보이지만 어느 그룹에서든 "같이 어울리는 애" 포지션. 엄마와 둘이 산다.' },
  { id: 'minjae', name: '민재', intimacy: 15, description: '공부를 잘하는데 티를 안 내는 아이', emoji: '😎', met: false,
    greeting: '어, 안녕. 시험공부 했어? 나 하나도 안 했는데.', personality: '전교 1등이지만 천재가 아니라 노력형. 새벽까지 공부하고 아침에 태연한 척하는 아이. 학원 원장 엄마와 교사 아빠 밑에서 자란 교육 가정.' },
  { id: 'yuna', name: '유나', intimacy: 20, description: '밝고 활발한 같은 반 친구', emoji: '🌟', met: false,
    greeting: '야! 오늘 숙제 했어? 나 7번 모르겠는데 같이 풀자!', personality: '성적은 항상 상위권인데 공부벌레 느낌은 아니다. 밝고 에너지 넘치는 성격. 피아노도 잘 치고 친구도 잘 사귄다. 근데 그 밝음 뒤에는 1등을 놓치면 안 된다는 압박이 있다.' },
  { id: 'doyun', name: '도윤', intimacy: 20, description: '초등 같은 반 체육부장', emoji: '⚽', met: false,
    greeting: '야! 점심에 축구 나갈래? 한 명 모자라!', personality: '반에서 모두가 따르는 자연스러운 리더. 축구 잘하고 예의 바르지만 찐따스럽지 않음. "괜찮아"를 입에 달고 사는 착한 아이 페르소나 — 부모 기대에 부응하느라 속마음 잘 안 보여줌. 중학교 진학 시 학군 이사로 갈라짐.' },
  { id: 'haeun', name: '하은', intimacy: 0, description: '1학년 위 선배', emoji: '🌿', met: false,
    greeting: '야, 존댓말 하지 마. 어색해.', personality: '중학교 2학년 선배. 겉으로는 여유 있어 보이지만, 고등학교 진학과 오빠의 수능 실패 트라우마로 속은 불안하다. 후배를 챙기면서 자기 자신을 다독이는 사람.' },
  { id: 'junha', name: '준하', intimacy: 0, description: '고2에 전학 온 부산 출신', emoji: '🍙', met: false,
    greeting: '안녕하세요... 아 안녕. (어색하게 웃는다)', personality: '부산에서 전학 온 직설적인 남자아이. 원래 밝고 사람을 좋아하는 성격인데 전학이 눌러놓고 있다. 요리를 좋아하고 주먹밥을 싸온다. 엄마가 식당에서 일한다.' },
  { id: 'seoa', name: '서아', intimacy: 0, description: '중학교 때 만난 글 쓰는 아이', emoji: '✏️', met: false,
    greeting: '…어. (한쪽 이어폰을 뺀다)', personality: '내성적인 글쟁이. 한쪽 이어폰=한 칸 열림 / 양쪽 다 낌=닫힘. 욕망을 숨기듯 글의 끝을 자꾸 미룬다. 읽어줄 한 사람이 생겨야 끝이 따라온다.' },
  { id: 'siwoo', name: '시우', intimacy: 0, description: '고1 때 만난 창밖만 보는 아이', emoji: '🏙️', met: false,
    greeting: '저거 봐. 저 자리.', personality: '건축을 꿈꾸는 관찰자. 감정을 사물·공간·동선으로만 비춘다. 밖을 향하던 시선의 소실점이 줄곧 한 사람이었다.' },
  { id: 'yerin', name: '예린', intimacy: 0, description: '고1 때 만난 입시 전략가', emoji: '📊', met: false,
    greeting: '너 단가, 아직 미산정이야.', personality: '효율의 언어로 사람을 장부·단가로 번역하는 입시 전략가. 모두를 등급으로 매기지만 주인공 줄만은 단가를 못 매겨 미산정으로 남긴다.' },
] as const;

export function createInitialNpcs(): NpcState[] {
  return INITIAL_NPCS.map(n => ({ ...n }));
}

// ===== 친밀도 티어 =====
// NpcRelationPanel·NpcDetailModal에 같은 임계가 각각 하드코딩돼 있던 것을 여기로 모았다.
// raw 친밀도는 게임 어디에도 노출하지 않는다(hide-numbers) — 티어 라벨만 보여준다.
export type IntimacyTier = 'unmet' | 'acquaintance' | 'friend' | 'best';

export const INTIMACY_TIER_LABEL: Record<IntimacyTier, string> = {
  unmet: '만난 적 없음',
  acquaintance: '아는 사이',
  friend: '친구',
  best: '절친',
};

export function intimacyTier(intimacy: number, met = true): IntimacyTier {
  if (!met) return 'unmet';
  if (intimacy >= 70) return 'best';
  if (intimacy >= 40) return 'friend';
  return 'acquaintance';
}
